import type { FormField, FormOptionCapture, FormOptionFlow, FormOptionRule } from "@/lib/api";
import { isOptionField, optionCaptureKey } from "@/lib/form-fields";
import { isInputField, isStepBreak, validateStepValues } from "@/lib/form-steps";

export const OPTION_FLOW_LABELS: Record<FormOptionFlow, string> = {
  continue: "Continue normally",
  end: "End form here (submit)",
  next_step: "Go to next step panel",
};

export function getOptionRule(field: FormField, option: string): FormOptionRule | undefined {
  return (field.option_rules || []).find((r) => r.option === option);
}

export function upsertOptionRule(
  field: FormField,
  option: string,
  patch: Partial<Omit<FormOptionRule, "option">>,
): FormOptionRule[] {
  const rules = [...(field.option_rules || [])];
  const idx = rules.findIndex((r) => r.option === option);
  const next: FormOptionRule = {
    option,
    ...(idx >= 0 ? rules[idx] : {}),
    ...patch,
  };
  if (!next.capture) {
    delete next.capture;
    delete next.capture_label;
    delete next.capture_required;
  }
  if (next.show_field_ids && !next.show_field_ids.length) delete next.show_field_ids;
  // Drop empty rules
  const empty =
    (!next.flow || next.flow === "continue") && !next.show_field_ids?.length && !next.capture;
  if (idx >= 0) {
    if (empty) rules.splice(idx, 1);
    else rules[idx] = next;
  } else if (!empty) {
    rules.push(next);
  }
  return rules;
}

export function renameOptionRule(rules: FormOptionRule[] | undefined, from: string, to: string): FormOptionRule[] {
  return (rules || []).map((r) => (r.option === from ? { ...r, option: to } : r)).filter((r) => r.option.trim());
}

export function removeOptionRule(rules: FormOptionRule[] | undefined, option: string): FormOptionRule[] {
  return (rules || []).filter((r) => r.option !== option);
}

/** Field IDs that only appear when revealed by an option rule. */
export function getConditionalFieldIds(schema: FormField[]): Set<string> {
  const ids = new Set<string>();
  for (const f of schema) {
    for (const rule of f.option_rules || []) {
      for (const id of rule.show_field_ids || []) ids.add(id);
    }
  }
  return ids;
}

function selectedOptionsForField(field: FormField, values: Record<string, unknown>): string[] {
  const raw = values[field.field_id];
  if (field.type === "multiselect") {
    return Array.isArray(raw) ? raw.map(String) : [];
  }
  if (raw === undefined || raw === null || raw === "") return [];
  return [String(raw)];
}

export type ActiveOptionCapture = {
  option: string;
  key: string;
  kind: FormOptionCapture;
  label: string;
  required: boolean;
};

/** Calendars that should be on screen for the options currently chosen. */
export function activeOptionCaptures(field: FormField, values: Record<string, unknown>): ActiveOptionCapture[] {
  if (!isOptionField(field.type)) return [];
  const selected = new Set(selectedOptionsForField(field, values));
  const out: ActiveOptionCapture[] = [];
  for (const rule of field.option_rules || []) {
    if (!rule.capture || !selected.has(rule.option)) continue;
    out.push({
      option: rule.option,
      key: optionCaptureKey(field.field_id, rule.option),
      kind: rule.capture,
      label: rule.capture_label?.trim() || `Date for ${rule.option}`,
      required: rule.capture_required !== false,
    });
  }
  return out;
}

/** Write the choice and drop dates for options that are no longer selected. */
export function withOptionAnswer(
  field: FormField,
  values: Record<string, unknown>,
  nextValue: unknown,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...values, [field.field_id]: nextValue };
  const selected = new Set(selectedOptionsForField(field, next));
  for (const rule of field.option_rules || []) {
    if (!rule.capture || selected.has(rule.option)) continue;
    delete next[optionCaptureKey(field.field_id, rule.option)];
  }
  return next;
}

export function validateOptionCaptures(fields: FormField[], values: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    for (const cap of activeOptionCaptures(field, values)) {
      const raw = values[cap.key];
      const empty = raw == null || (typeof raw === "string" && !raw.trim());
      if (cap.required && empty) errors.push(`${cap.label} is required`);
    }
  }
  return errors;
}

export function validateAnsweredFields(fields: FormField[], values: Record<string, unknown>): string[] {
  return [...validateStepValues(fields, values), ...validateOptionCaptures(fields, values)];
}

/** Required questions and option calendars that are currently visible. */
export function validateVisibleAnswers(schema: FormField[], values: Record<string, unknown>): string[] {
  const fields = getVisibleFields(schema, values).filter((f) => !isStepBreak(f));
  return validateAnsweredFields(fields, values);
}

/** Fields currently visible given answers (hides conditional fields until revealed). */
export function getVisibleFields(schema: FormField[], values: Record<string, unknown>): FormField[] {
  const conditional = getConditionalFieldIds(schema);
  if (!conditional.size) return schema.filter((f) => isInputField(f) || isStepBreak(f));

  const revealed = new Set<string>();
  for (const f of schema) {
    if (!isOptionField(f.type) || !(f.option_rules || []).length) continue;
    const selected = selectedOptionsForField(f, values);
    for (const opt of selected) {
      const rule = getOptionRule(f, opt);
      for (const id of rule?.show_field_ids || []) revealed.add(id);
    }
  }

  return schema.filter((f) => {
    if (isStepBreak(f)) return true;
    if (!conditional.has(f.field_id)) return true;
    return revealed.has(f.field_id);
  });
}

/**
 * Effective flow from all choice answers.
 * Priority: next_step > continue > end
 */
export function resolveFormFlow(schema: FormField[], values: Record<string, unknown>): FormOptionFlow {
  let sawEnd = false;
  let sawContinue = false;

  for (const f of schema) {
    if (!isOptionField(f.type) || !(f.option_rules || []).length) continue;
    for (const opt of selectedOptionsForField(f, values)) {
      const flow = getOptionRule(f, opt)?.flow || "continue";
      if (flow === "next_step") return "next_step";
      if (flow === "end") sawEnd = true;
      else sawContinue = true;
    }
  }

  if (sawEnd && !sawContinue) return "end";
  return "continue";
}

/** Whether wizard should treat current panel as last (submit) based on option flow. */
export function shouldEndFormEarly(
  schema: FormField[],
  values: Record<string, unknown>,
  stepIdx: number,
  totalSteps: number,
): boolean {
  if (stepIdx >= totalSteps - 1) return true;
  return resolveFormFlow(schema, values) === "end";
}

/** Whether Next is allowed / required toward later panels. */
export function shouldAllowNextStep(
  schema: FormField[],
  values: Record<string, unknown>,
  stepIdx: number,
  totalSteps: number,
): boolean {
  if (stepIdx >= totalSteps - 1) return false;
  const flow = resolveFormFlow(schema, values);
  if (flow === "end") return false;
  return true;
}

export function fieldOptionsForRules(schema: FormField[], excludeFieldId: string): { id: string; label: string }[] {
  return schema
    .filter((f) => isInputField(f) && f.field_id !== excludeFieldId)
    .map((f) => ({ id: f.field_id, label: f.label || f.field_id }));
}
