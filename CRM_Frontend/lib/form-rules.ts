import type { FormField, FormOptionFlow, FormOptionRule } from "@/lib/api";
import { isOptionField } from "@/lib/form-fields";
import { isInputField, isStepBreak } from "@/lib/form-steps";

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
  // Drop empty rules
  const empty =
    (!next.flow || next.flow === "continue") && !(next.show_field_ids && next.show_field_ids.length);
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
