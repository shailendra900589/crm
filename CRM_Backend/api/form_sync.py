"""Single write path for BDM form answers → Lead.custom_data + FormSubmission + verification."""

from __future__ import annotations

from django.utils import timezone

from .models import CustomForm, FormSubmission, Lead, LeadDocument
from .permissions import effective_form_schema


def project_form_for_lead(lead: Lead) -> CustomForm | None:
    form = getattr(lead.project, "custom_form", None)
    if form is None:
        form = CustomForm.objects.filter(project=lead.project, is_active=True).first()
    return form


def merge_form_answers(lead: Lead, answers: dict | None, form: CustomForm | None = None) -> dict:
    """Merge incoming answers with existing custom_data; preserve prior file URLs."""
    form = form or project_form_for_lead(lead)
    merged = dict(lead.custom_data or {})
    merged.update(answers or {})
    schema = (form.schema if form else None) or []
    for f in schema:
        if f.get("type") == "file" and f.get("field_id"):
            fid = f["field_id"]
            if not merged.get(fid) and (lead.custom_data or {}).get(fid):
                merged[fid] = lead.custom_data[fid]
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
