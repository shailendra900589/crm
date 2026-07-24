import type { FormField, FormFieldType, FormMetricRole } from "@/lib/api";

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

export const METRIC_ROLE_OPTIONS: { value: FormMetricRole | ""; label: string; hint: string }[] = [
  { value: "", label: "None — capture only", hint: "Saved on the lead, not rolled up on dashboards" },
  { value: "collection", label: "Amount collected", hint: "Sums into Collection KPI" },
  { value: "pending_amount", label: "Collection pending", hint: "Sums into Pending Amount KPI" },
  { value: "deal_value", label: "Deal / order value", hint: "Sums into Deal Value KPI" },
];

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
    case "currency":
      return "0.00";
    case "date":
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
    case "currency":
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

export function isMoneyField(type: string) {
  return type === "currency" || type === "number";
}

export function isFullWidthField(type: string) {
  return type === "textarea" || type === "multiselect" || type === "file" || type === "radio";
}

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount || 0);
}

export function defaultField(type: FormFieldType | string): FormField {
  const labels: Record<string, string> = {
    text: "Short answer",
    textarea: "Paragraph",
    number: "Number",
    currency: "Amount (₹)",
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

  const base: FormField = {
    field_id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    label: labels[type] || "Question",
    type,
    required: false,
    options: isOptionField(type) ? ["Option 1", "Option 2"] : undefined,
    file_accept: type === "file" ? "pdf" : undefined,
    max_file_mb: type === "file" ? 10 : undefined,
  };

  if (type === "currency") {
    base.currency = "INR";
    base.metric_role = "pending_amount";
    base.label = "Collection Pending Amount";
    base.min = 0;
  }

  return base;
}

export const FIELD_TYPE_OPTIONS: { type: FormFieldType; label: string; group: string }[] = [
  { type: "text", label: "Short answer", group: "Text" },
  { type: "textarea", label: "Paragraph", group: "Text" },
  { type: "email", label: "Email", group: "Text" },
  { type: "phone", label: "Phone", group: "Text" },
  { type: "url", label: "Website / URL", group: "Text" },
  { type: "number", label: "Number", group: "Numbers" },
  { type: "currency", label: "Amount (₹)", group: "Numbers" },
  { type: "date", label: "Date", group: "Date & time" },
  { type: "time", label: "Time", group: "Date & time" },
  { type: "datetime", label: "Date & time", group: "Date & time" },
  { type: "dropdown", label: "Dropdown", group: "Choice" },
  { type: "radio", label: "Multiple choice", group: "Choice" },
  { type: "multiselect", label: "Checkboxes", group: "Choice" },
  { type: "file", label: "File upload", group: "Files" },
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
