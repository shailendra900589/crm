import type { FormField } from "@/lib/api";

export type FormWizardStep = {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
};

export function isStepBreak(field: FormField): boolean {
  return field.type === "step_break";
}

export function isInputField(field: FormField): boolean {
  return !isStepBreak(field);
}

export function hasWizardSteps(schema: FormField[] | undefined | null): boolean {
  return !!schema?.some(isStepBreak);
}

export function countStepBreaks(schema: FormField[]): number {
  return schema.filter(isStepBreak).length;
}

export function defaultStepBreak(stepNumber: number): FormField {
  const titles: Record<number, string> = {
    2: "Business & GST details",
    3: "Documents & uploads",
  };
  return {
    field_id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type: "step_break",
    label: titles[stepNumber] || `Step ${stepNumber}`,
    help_text:
      stepNumber === 2
        ? "GST number, requirements, and compliance fields"
        : stepNumber === 3
          ? "Upload images and supporting files"
          : "Next group of questions",
    required: false,
  };
}

/** Split schema at step_break markers into wizard panels. */
export function splitSchemaIntoSteps(schema: FormField[]): FormWizardStep[] {
  const input = (schema || []).filter(Boolean);
  if (!hasWizardSteps(input)) {
    return [{ id: "single", title: "", fields: input.filter(isInputField) }];
  }

  const steps: FormWizardStep[] = [];
  let bucket: FormField[] = [];
  let nextTitle = "Contact & basic details";
  let nextDescription: string | undefined = "Name, email, phone, and primary info";

  const flush = () => {
    const fields = bucket.filter(isInputField);
    if (!fields.length) return;
    steps.push({
      id: `step_${steps.length}`,
      title: nextTitle,
      description: nextDescription,
      fields,
    });
    bucket = [];
  };

  for (const field of input) {
    if (isStepBreak(field)) {
      flush();
      nextTitle = field.label?.trim() || `Step ${steps.length + 1}`;
      nextDescription = field.help_text?.trim() || undefined;
    } else {
      bucket.push(field);
    }
  }
  flush();

  return steps.length ? steps : [{ id: "single", title: "", fields: [] }];
}

export function validateStepValues(fields: FormField[], values: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const f of fields) {
    if (!f.required || isStepBreak(f)) continue;
    const val = values[f.field_id];
    const label = f.label || "This field";
    if (f.type === "multiselect") {
      if (!Array.isArray(val) || val.length === 0) errors.push(`${label} is required`);
      continue;
    }
    if (f.type === "file") {
      if (!val || (typeof val === "string" && !val.trim())) errors.push(`${label} is required`);
      continue;
    }
    if (val === undefined || val === null || (typeof val === "string" && !val.trim())) {
      errors.push(`${label} is required`);
    }
  }
  return errors;
}
