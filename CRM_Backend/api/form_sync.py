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
        k = str(key)
        if parse_option_capture_key(k):
            out[k] = "" if val in (None, "") else val
            continue
        if val in (None, ""):
            continue
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


CAPTURE_MARK = "__date__"
CAPTURE_KINDS = {"date", "datetime", "time"}


def option_capture_key(field_id: str, option: str) -> str:
    return f"{field_id}{CAPTURE_MARK}{option}"


def parse_option_capture_key(key: str):
    if not isinstance(key, str):
        return None
    idx = key.find(CAPTURE_MARK)
    if idx <= 0:
        return None
    field_id = key[:idx]
    option = key[idx + len(CAPTURE_MARK) :]
    if not field_id or option == "":
        return None
    return field_id, option


def selected_options_for_field(field: dict, answers: dict) -> list[str]:
    fid = field.get("field_id")
    raw = answers.get(fid) if fid else None
    if field.get("type") == "multiselect":
        return [str(x) for x in raw] if isinstance(raw, list) else []
    if raw is None or raw == "":
        return []
    return [str(raw)]


def iter_active_captures(field: dict, answers: dict):
    field_id = field.get("field_id")
    if not field_id:
        return
    selected = set(selected_options_for_field(field, answers))
    for rule in field.get("option_rules") or []:
        kind = rule.get("capture") or ""
        option = rule.get("option")
        if kind not in CAPTURE_KINDS or option not in selected:
            continue
        yield rule, kind, option_capture_key(field_id, option)


def capture_answer_label(rule: dict, option: str) -> str:
    custom = (rule.get("capture_label") or "").strip()
    return custom or f"Date for {option}"


def capture_display_label(schema, key: str) -> str | None:
    parsed = parse_option_capture_key(key)
    if not parsed:
        return None
    field_id, option = parsed
    for field in schema or []:
        if field.get("field_id") != field_id:
            continue
        parent = field.get("label") or field_id
        for rule in field.get("option_rules") or []:
            if rule.get("option") != option:
                continue
            custom = (rule.get("capture_label") or "").strip()
            return f"{parent} · {custom}" if custom else f"{parent} · {option}"
        return f"{parent} · {option}"
    return None


def validate_option_captures(field: dict, answers: dict) -> list[str]:
    from datetime import datetime

    errors = []
    for rule, kind, key in iter_active_captures(field, answers):
        raw = answers.get(key)
        label = capture_answer_label(rule, rule.get("option") or "")
        empty = raw is None or (isinstance(raw, str) and not str(raw).strip())
        required = rule.get("capture_required")
        if required is None:
            required = True
        if empty:
            if required:
                errors.append(f"{label} is required")
            continue
        text = str(raw).strip()
        try:
            if kind == "date":
                datetime.strptime(text, "%Y-%m-%d")
            elif kind == "time":
                datetime.strptime(text, "%H:%M")
            else:
                datetime.strptime(text[:16], "%Y-%m-%dT%H:%M")
        except ValueError:
            errors.append(f"{label} must be a valid date")
    return errors


def prune_inactive_option_captures(schema, answers: dict) -> dict:
    if not isinstance(answers, dict):
        return answers
    out = dict(answers)
    for field in schema or []:
        fid = field.get("field_id")
        if not fid or fid not in out:
            continue
        prefix = f"{fid}{CAPTURE_MARK}"
        active = {key for _rule, _kind, key in iter_active_captures(field, out)}
        for key in list(out.keys()):
            if isinstance(key, str) and key.startswith(prefix) and key not in active:
                out.pop(key, None)
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

    # Keep a schedule date already saved when this submit left that key out.
    for field in schema:
        for _rule, _kind, key in iter_active_captures(field, merged):
            if key in incoming:
                continue
            prev = (lead.custom_data or {}).get(key)
            if prev not in (None, "", [], {}):
                merged[key] = prev

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
        active_captures = set()
        for field in schema:
            for _rule, _kind, key in iter_active_captures(field, merged):
                active_captures.add(key)
        cleaned = {}
        for k, v in merged.items():
            if v in (None, "", [], {}):
                continue
            if is_seed_junk_value(k, v):
                continue
            if k in schema_ids or k in active_captures:
                cleaned[k] = v
            elif isinstance(v, str) and ("/media/" in v or v.startswith("http")):
                cleaned[k] = v
            elif k in incoming:
                # Explicitly submitted — keep even if schema drifted
                cleaned[k] = v
        merged = cleaned
    if schema:
        merged = prune_inactive_option_captures(schema, merged)
    return merged


def answer_preview(answers: dict | None, schema: list | None = None, limit: int = 8) -> list[dict]:
    """Human-readable snippets for dashboards / verification desk."""
    answers = answers or {}
    schema = schema or []
    labels = {f.get("field_id"): (f.get("label") or f.get("field_id") or "") for f in schema if f.get("field_id")}
    types = {f.get("field_id"): f.get("type") for f in schema if f.get("field_id")}
    items = []
    for key, val in answers.items():
        if parse_option_capture_key(key):
            continue
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
    for key, val in answers.items():
        if val in (None, "", [], {}):
            continue
        cap_label = capture_display_label(schema, key)
        if not cap_label:
            continue
        if isinstance(val, str):
            display = val.replace("T", " ")[:16]
        else:
            display = str(val)[:80]
        items.append({"field_id": key, "label": cap_label, "value": display})
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
