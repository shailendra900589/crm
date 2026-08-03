"""Single write path for BDM form answers → Lead.custom_data + FormSubmission + verification."""

from __future__ import annotations

import re

from django.utils import timezone
from django.utils.text import slugify

from .models import CustomForm, FormSubmission, Lead, LeadDocument

# Only exact demo seed patterns — never wipe real BDM answers
_SEED_GST_RE = re.compile(r"^GST\d{1,4}000$", re.I)


def is_seed_junk_value(field_id: str, value) -> bool:
    """True only for classic demo placeholders (GST4000 / Retail on seed fields)."""
    if value in (None, "", [], {}):
        return False
    fid = (field_id or "").lower()
    s = str(value).strip()
    # Exact seed GST pattern only (GST1000, GST4000, …) — not real GSTINs
    if _SEED_GST_RE.match(s):
        return True
    # Seed business_type default
    if fid in ("business_type", "business") and s.lower() == "retail":
        return True
    # Mobile/phone field wrongly holding seed "Retail"
    if ("mobile" in fid or "phone" in fid) and s.lower() == "retail":
        return True
    return False


def scrub_seed_form_junk(lead: Lead, *, sync_submission: bool = True) -> bool:
    """
    Remove ONLY demo seed placeholder values from lead.custom_data.
    Never deletes a key just because it is named gst_number/business_type —
    Amazon forms reuse those field_ids with real Merchant Name / Mobile data.
    """
    data = dict(lead.custom_data or {})
    if not data:
        return False
    changed = False
    for key in list(data.keys()):
        if is_seed_junk_value(key, data.get(key)):
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


def _normalize_answers_to_field_ids(answers: dict | None, schema: list) -> dict:
    """Map answers keyed by label / slug back onto schema field_ids."""
    if not answers:
        return {}
    by_id = {f.get("field_id"): f for f in schema if f.get("field_id")}
    by_label = {}
    by_slug = {}
    for f in schema:
        fid = f.get("field_id")
        if not fid:
            continue
        label = (f.get("label") or "").strip()
        if label:
            by_label[label.lower()] = fid
        by_slug[slugify(label) or fid] = fid
        by_slug[fid.lower()] = fid

    out = {}
    for key, val in answers.items():
        if val in (None, ""):
            continue
        k = str(key)
        if k in by_id:
            out[k] = val
            continue
        fid = by_label.get(k.lower()) or by_slug.get(slugify(k)) or by_slug.get(k.lower())
        if fid:
            out[fid] = val
        else:
            # Keep unknown keys (won't hurt); sync will filter to schema when possible
            out[k] = val
    return out


def merge_form_answers(lead: Lead, answers: dict | None, form: CustomForm | None = None) -> dict:
    """Merge incoming answers with existing custom_data; preserve prior file URLs; drop seed junk only."""
    form = form or project_form_for_lead(lead)
    schema = (form.schema if form else None) or []
    schema_ids = {f.get("field_id") for f in schema if f.get("field_id")}

    incoming = _normalize_answers_to_field_ids(answers, schema)
    merged = dict(lead.custom_data or {})

    # Strip only placeholder junk from existing data
    for key in list(merged.keys()):
        if is_seed_junk_value(key, merged.get(key)):
            merged.pop(key, None)

    merged.update(incoming)

    # Preserve prior file URLs if omitted on re-submit
    for f in schema:
        if f.get("type") == "file" and f.get("field_id"):
            fid = f["field_id"]
            if not merged.get(fid) and (lead.custom_data or {}).get(fid):
                prev = lead.custom_data[fid]
                if not is_seed_junk_value(fid, prev):
                    merged[fid] = prev

    # Drop leftover seed junk after merge
    for key in list(merged.keys()):
        if is_seed_junk_value(key, merged.get(key)):
            merged.pop(key, None)

    # If schema is known, keep schema fields (+ media URLs). Never drop non-empty user answers
    # that match schema. Orphan keys outside schema are kept if they look like real fills
    # (helps when Admin recently changed field_ids).
    if schema_ids:
        cleaned = {}
        for k, v in merged.items():
            if v in (None, "", [], {}):
                continue
            if is_seed_junk_value(k, v):
                continue
            if k in schema_ids:
                cleaned[k] = v
            elif isinstance(v, str) and ("/media/" in v or v.startswith("http")):
                cleaned[k] = v
            elif k in incoming:
                # Explicitly submitted — keep even if schema drifted
                cleaned[k] = v
        merged = cleaned
    return merged


def answer_preview(answers: dict | None, schema: list | None = None, limit: int = 8) -> list[dict]:
    """Human-readable snippets for dashboards / verification desk."""
    answers = answers or {}
    schema = schema or []
    labels = {f.get("field_id"): (f.get("label") or f.get("field_id") or "") for f in schema if f.get("field_id")}
    types = {f.get("field_id"): f.get("type") for f in schema if f.get("field_id")}
    items = []
    for key, val in answers.items():
        if val in (None, "", [], {}):
            continue
        if is_seed_junk_value(key, val):
            continue
        label = labels.get(key) or str(key).replace("_", " ").title()
        ftype = types.get(key)
        if ftype == "file" or (
            isinstance(val, str)
            and (val.startswith("http://") or val.startswith("https://") or val.startswith("/media/"))
        ):
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
