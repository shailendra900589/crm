import type { FormField, FormFieldType } from "@/lib/api";

export const FILE_ACCEPT_PRESETS = {
  pdf: {
    id: "pdf",
    label: "PDF only",
    accept: ".pdf,application/pdf",
    hint: "PDF files only (max 10MB)",
  },
  excel: {
    id: "excel",
    label: "Excel only",
    accept: ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    hint: "XLS or XLSX spreadsheets only",
  },
  word: {
    id: "word",
    label: "Word only",
    accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    hint: "DOC or DOCX documents only",
  },
  image: {
    id: "image",
    label: "Images only",
    accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
    hint: "JPG, PNG or WEBP images only",
  },
  csv: {
    id: "csv",
    label: "CSV only",
    accept: ".csv,text/csv",
    hint: "CSV files only",
  },
  document: {
    id: "document",
    label: "Office documents",
    accept: ".pdf,.doc,.docx,.xls,.xlsx",
    hint: "PDF, Word or Excel files",
  },
  any: {
    id: "any",
    label: "Any file",
    accept: "*/*",
    hint: "Any file type (max 10MB)",
  },
} as const;

export type FileAcceptPreset = keyof typeof FILE_ACCEPT_PRESETS;

export function getFileAcceptConfig(field: FormField) {
  const key = (field.file_accept || "any") as FileAcceptPreset;
  return FILE_ACCEPT_PRESETS[key] || FILE_ACCEPT_PRESETS.any;
}

export function getFieldPlaceholder(field: FormField) {
  if (field.placeholder) return field.placeholder;
  switch (field.type) {
    case "email":
      return "name@company.com";
    case "phone":
      return "+91 98765 43210";
    case "url":
      return "https://example.com";
    case "number":
      return "Enter a number";
    case "date":
      return "";
    case "time":
      return "";
    default:
      return `Enter ${field.label.toLowerCase()}`;
  }
}

export function getInputType(field: FormField): string {
  switch (field.type) {
    case "email":
      return "email";
    case "phone":
      return "tel";
    case "url":
      return "url";
    case "number":
      return "number";
    case "date":
      return "date";
    case "time":
      return "time";
    case "datetime":
      return "datetime-local";
    default:
      return "text";
  }
}

export function isOptionField(type: string) {
  return type === "dropdown" || type === "radio" || type === "multiselect";
}

export function isFullWidthField(type: string) {
  return type === "textarea" || type === "multiselect" || type === "file" || type === "radio";
}

export function defaultField(type: FormFieldType | string): FormField {
  const labels: Record<string, string> = {
    text: "Short answer",
    textarea: "Paragraph",
    number: "Number",
    email: "Email",
    phone: "Phone number",
    url: "Website URL",
    date: "Date",
    time: "Time",
    datetime: "Date & time",
    dropdown: "Dropdown",
    radio: "Multiple choice",
    multiselect: "Checkboxes",
    file: "File upload",
  };

  return {
    field_id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: labels[type] || "Question",
    type,
    required: false,
    options: isOptionField(type) ? ["Option 1", "Option 2"] : undefined,
    file_accept: type === "file" ? "pdf" : undefined,
    max_file_mb: type === "file" ? 10 : undefined,
  };
}

export const FIELD_TYPE_OPTIONS: { type: FormFieldType; label: string }[] = [
  { type: "text", label: "Short answer" },
  { type: "textarea", label: "Paragraph" },
  { type: "number", label: "Number" },
  { type: "email", label: "Email" },
  { type: "phone", label: "Phone" },
  { type: "url", label: "Website / URL" },
  { type: "date", label: "Date" },
  { type: "time", label: "Time" },
  { type: "datetime", label: "Date & time" },
  { type: "dropdown", label: "Dropdown" },
  { type: "radio", label: "Multiple choice" },
  { type: "multiselect", label: "Checkboxes" },
  { type: "file", label: "File upload" },
];

export function validateFileSelection(filename: string, field: FormField): string | null {
  const preset = getFileAcceptConfig(field);
  if (preset.id === "any") return null;
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : "";
  const allowed: Record<string, string[]> = {
    pdf: ["pdf"],
    excel: ["xls", "xlsx"],
    word: ["doc", "docx"],
    image: ["jpg", "jpeg", "png", "webp"],
    csv: ["csv"],
    document: ["pdf", "doc", "docx", "xls", "xlsx"],
  };
  const list = allowed[preset.id as keyof typeof allowed];
  if (list && ext && !list.includes(ext)) {
    return `Only ${preset.hint.toLowerCase()} allowed`;
  }
  return null;
}
