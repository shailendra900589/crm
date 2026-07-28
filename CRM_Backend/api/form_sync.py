"""Single write path for BDM form answers → Lead.custom_data + FormSubmission + verification."""

from __future__ import annotations

import re

from django.utils import timezone

from .models import CustomForm, FormSubmission, Lead, LeadDocument
from .permissions import effective_form_schema

# Legacy demo seed values that show up when Admin renames GST/Business Type labels
_SEED_GST_RE = re.compile(r"^GST\d+000$", re.I)
_SEED_JUNK_KEYS = {
    "gst_number",
    "business_type",
    "pending_amount",
    "amount_collected",
    "gst_certificate",
    "annual_revenue",
}


def is_seed_junk_value(field_id: str, value) -> bool:
    """True for demo seed placeholders like GST4000 / Retail."""
    if value in (None, "", [], {}):
        return False
    fid = (field_id or "").lower()
    s = str(value).strip()
    if fid in ("gst_number", "gst") and _SEED_GST_RE.match(s):
        return True
    if fid in ("business_type", "business") and s.lower() == "retail":
        return True
    # Renamed labels still using old seed values
    if _SEED_GST_RE.match(s):
        return True
    if fid.endswith("mobile") or "mobile" in fid or "phone" in fid:
        if s.lower() == "retail":
            return True
    if ("merchant" in fid or "name" in fid) and _SEED_GST_RE.match(s):
        return True
    return False


def scrub_seed_form_junk(lead: Lead, *, sync_submission: bool = True) -> bool:
    """
    Remove legacy seed answers (GST4000, Retail, demo money) from lead.custom_data
    and matching FormSubmission so BDM form starts clean / shows real submits only.
    """
    data = dict(lead.custom_data or {})
    if not data:
        return False
    changed = False
    for key in list(data.keys()):
        val = data.get(key)
        if key in _SEED_JUNK_KEYS or is_seed_junk_value(key, val):
            # Only strip classic seed money when clearly demo amounts on seed keys
            if key in ("pending_amount", "amount_collected", "annual_revenue") and key in _SEED_JUNK_KEYS:
                data.pop(key, None)
                changed = True
            elif is_seed_junk_value(key, val) or key in ("gst_number", "business_type", "gst_certificate"):
                data.pop(key, None)
                changed = True
    if not changed:
        return False
    lead.custom_data = data
    lead.save(update_fields=["custom_data", "updated_at"])
    if sync_submission:
        form = project_form_for_lead(lead)
        if form:
            FormSubmission.objects.filter(lead=lead, custom_form=form).update(answers=data)
    return True


def project_form_for_lead(lead: Lead) -> CustomForm | None:
    form = getattr(lead.project, "custom_form", None)
    if form is None:
        form = CustomForm.objects.filter(project=lead.project, is_active=True).first()
    return form


def merge_form_answers(lead: Lead, answers: dict | None, form: CustomForm | None = None) -> dict:
    """Merge incoming answers with existing custom_data; preserve prior file URLs; drop seed junk."""
    form = form or project_form_for_lead(lead)
    schema = (form.schema if form else None) or []
    schema_ids = {f.get("field_id") for f in schema if f.get("field_id")}

    merged = dict(lead.custom_data or {})
    # Drop legacy seed junk before merge so GST4000/Retail never stick on renamed fields
    for key in list(merged.keys()):
        if is_seed_junk_value(key, merged.get(key)) or (
            key in _SEED_JUNK_KEYS and key not in (answers or {})
        ):
            # Keep non-junk user values on seed keys; strip only junk-looking values
            if is_seed_junk_value(key, merged.get(key)):
                merged.pop(key, None)

    merged.update(answers or {})
    for f in schema:
        if f.get("type") == "file" and f.get("field_id"):
            fid = f["field_id"]
            if not merged.get(fid) and (lead.custom_data or {}).get(fid):
                prev = lead.custom_data[fid]
                if not is_seed_junk_value(fid, prev):
                    merged[fid] = prev

    # Prefer schema keys for persistence clarity (keep extras that are files/urls too)
    if schema_ids:
        cleaned = {}
        for k, v in merged.items():
            if k in schema_ids or (isinstance(v, str) and ("/media/" in v or v.startswith("http"))):
                if is_seed_junk_value(k, v):
                    continue
                cleaned[k] = v
        merged = cleaned
    return merged


def answer_preview(answers: dict | None, schema: list | None = None, limit: int = 6) -> list[dict]:
    """Human-readable snippets for dashboards / verification desk."""
    answers = answers or {}
    schema = schema or []
    labels = {f.get("field_id"): (f.get("label") or f.get("field_id") or "") for f in schema if f.get("field_id")}
    types = {f.get("field_id"): f.get("type") for f in schema if f.get("field_id")}
    items = []
    for key, val in answers.items():
        if val in (None, "", [], {}):
            continue
        label = labels.get(key) or str(key).replace("_", " ").title()
        ftype = types.get(key)
        if ftype == "file" or (isinstance(val, str) and (val.startswith("http://") or val.startswith("https://") or val.startswith("/media/"))):
            display = "File uploaded"
        elif isinstance(val, (list, dict)):
            display = str(val)[:80]
        else:
            display = str(val)[:80]
        items.append({"field_id": key, "label": label, "value": display})
        if len(items) >= limit:
            break
    return items


def sync_lead_form_data(
    lead: Lead,
    answers: dict | None = None,
    *,
    actor=None,
    form: CustomForm | None = None,
    bump_submitted_at: bool = True,
    ensure_verification: bool = True,
    mark_docs_pending: bool = True,
) -> FormSubmission | None:
    """
    Persist form answers end-to-end:
      Lead.custom_data ← merged answers
      FormSubmission ← update_or_create (same answers)
      VerificationWork ← open/update queue item
    """
    form = form or project_form_for_lead(lead)
    if not form:
        # Still persist custom_data if answers provided
        if answers is not None:
            lead.custom_data = merge_form_answers(lead, answers, None)
            lead.save(update_fields=["custom_data", "updated_at"])
        return None

    merged = merge_form_answers(lead, answers if answers is not None else (lead.custom_data or {}), form)
    lead.custom_data = merged
    lead.save(update_fields=["custom_data", "updated_at"])

    defaults = {
        "answers": merged,
        "submitted_by": actor or getattr(lead, "bdm", None),
    }
    if bump_submitted_at:
        defaults["submitted_at"] = timezone.now()

    sub, _ = FormSubmission.objects.update_or_create(
        lead=lead,
        custom_form=form,
        defaults=defaults,
    )

    if mark_docs_pending:
        schema = form.schema or []
        has_files = any(f.get("type") == "file" and merged.get(f.get("field_id")) for f in schema)
        doc, _ = LeadDocument.objects.get_or_create(lead=lead)
        if has_files or doc.gst_file or doc.pan_file or doc.cheque_file:
            doc.verification_status = LeadDocument.VerificationStatus.PENDING
            doc.verified_by = None
            doc.save(update_fields=["verification_status", "verified_by"])

    if ensure_verification:
        from .workflow_views import ensure_verification_work_for_submission

        ensure_verification_work_for_submission(lead, sub, actor=actor)

    return sub
