"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { SearchableSelect } from "@/components/searchable-select";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FormField } from "@/lib/api";
import {
  getFieldPlaceholder,
  getFileAcceptConfig,
  getInputType,
  isFullWidthField,
  validateFileSelection,
} from "@/lib/form-fields";
import {
  hasWizardSteps,
  splitSchemaIntoSteps,
  validateStepValues,
} from "@/lib/form-steps";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const formInputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400/50 dark:disabled:bg-slate-900";

export const formTextareaCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400/50 dark:disabled:bg-slate-900";

export function FormLabel({ children, required, help }: { children: React.ReactNode; required?: boolean; help?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-[13px] font-semibold text-slate-700 dark:text-slate-300">
        {children}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {help && <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{help}</p>}
    </div>
  );
}

export function DynamicForm({
  schema,
  values,
  onChange,
  readOnly,
  layout = "grid",
  leadId,
  onSubmit,
  submitLabel = "Submit",
  submitting = false,
}: {
  schema: FormField[];
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  readOnly?: boolean;
  layout?: "grid" | "stack";
  leadId?: number;
  /** When set, wizard last step shows this action (multi-panel forms). */
  onSubmit?: () => void;
  submitLabel?: string;
  submitting?: boolean;
}) {
  if (!schema?.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-700">
        <p className="text-sm text-slate-400">No questions in this form yet.</p>
      </div>
    );
  }

  if (hasWizardSteps(schema)) {
    return (
      <WizardForm
        schema={schema}
        values={values}
        onChange={onChange}
        readOnly={readOnly}
        layout={layout}
        leadId={leadId}
        onSubmit={onSubmit}
        submitLabel={submitLabel}
        submitting={submitting}
      />
    );
  }

  return (
    <FormFieldsBlock
      fields={schema}
      values={values}
      onChange={onChange}
      readOnly={readOnly}
      layout={layout}
      leadId={leadId}
    />
  );
}

function WizardForm({
  schema,
  values,
  onChange,
  readOnly,
  layout,
  leadId,
  onSubmit,
  submitLabel,
  submitting,
}: {
  schema: FormField[];
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  readOnly?: boolean;
  layout: "grid" | "stack";
  leadId?: number;
  onSubmit?: () => void;
  submitLabel: string;
  submitting?: boolean;
}) {
  const steps = splitSchemaIntoSteps(schema);
  const [stepIdx, setStepIdx] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const step = steps[stepIdx] ?? steps[0];
  const isLast = stepIdx >= steps.length - 1;

  const goNext = () => {
    const stepErrors = validateStepValues(step.fields, values);
    if (stepErrors.length) {
      setErrors(stepErrors);
      return;
    }
    setErrors([]);
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  const goBack = () => {
    setErrors([]);
    setStepIdx((i) => Math.max(i - 1, 0));
  };

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            disabled={readOnly || i > stepIdx}
            onClick={() => {
              if (i <= stepIdx) {
                setErrors([]);
                setStepIdx(i);
              }
            }}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              i === stepIdx
                ? "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-200"
                : i < stepIdx
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                  : "border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                i === stepIdx ? "bg-blue-600 text-white" : i < stepIdx ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-slate-700",
              )}
            >
              {i + 1}
            </span>
            <span className="max-w-[120px] truncate sm:max-w-none">{s.title || `Step ${i + 1}`}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40 sm:p-5">
        {step.title && (
          <div className="mb-4 border-b border-slate-200 pb-3 dark:border-slate-700">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
              Step {stepIdx + 1} of {steps.length}
            </p>
            <h4 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">{step.title}</h4>
            {step.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{step.description}</p>}
          </div>
        )}

        <FormFieldsBlock
          fields={step.fields}
          values={values}
          onChange={onChange}
          readOnly={readOnly}
          layout={layout}
          leadId={leadId}
        />

        {errors.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIdx === 0}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold transition",
                stepIdx === 0
                  ? "cursor-not-allowed border-slate-100 text-slate-300 dark:border-slate-800 dark:text-slate-600"
                  : "border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800",
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            {isLast ? (
              onSubmit ? (
                <button
                  type="button"
                  onClick={() => {
                    const stepErrors = validateStepValues(step.fields, values);
                    if (stepErrors.length) {
                      setErrors(stepErrors);
                      return;
                    }
                    setErrors([]);
                    onSubmit();
                  }}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : submitLabel}
                </button>
              ) : null
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FormFieldsBlock({
  fields,
  values,
  onChange,
  readOnly,
  layout,
  leadId,
}: {
  fields: FormField[];
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  readOnly?: boolean;
  layout: "grid" | "stack";
  leadId?: number;
}) {
  if (!fields.length) {
    return <p className="text-sm text-slate-400">No fields in this step.</p>;
  }

  const set = (id: string, val: unknown) => onChange({ ...values, [id]: val });

  return (
    <div className={cn(layout === "grid" ? "grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2" : "space-y-4")}>
      {fields.map((f) => (
        <div
          key={f.field_id}
          className={cn(layout === "grid" && isFullWidthField(f.type) && "sm:col-span-2")}
        >
          <FormLabel required={f.required} help={f.help_text}>{f.label}</FormLabel>

          {f.type === "dropdown" ? (
            <SearchableSelect
              value={String(values[f.field_id] || "")}
              onChange={(val) => set(f.field_id, val)}
              disabled={readOnly}
              placeholder={getFieldPlaceholder(f) || "Select an option"}
              searchPlaceholder={`Search ${f.label.toLowerCase()}...`}
              options={(f.options || []).map((o) => ({ value: o, label: o }))}
            />
          ) : f.type === "radio" ? (
            <div className="flex flex-wrap gap-2">
              {(f.options || []).map((o) => (
                <label
                  key={o}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                    values[f.field_id] === o
                      ? "border-blue-400 bg-blue-50 text-blue-900 dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-200"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300",
                  )}
                >
                  <input
                    type="radio"
                    name={f.field_id}
                    disabled={readOnly}
                    checked={values[f.field_id] === o}
                    onChange={() => set(f.field_id, o)}
                    className="h-3.5 w-3.5 border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium">{o}</span>
                </label>
              ))}
            </div>
          ) : f.type === "multiselect" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {(f.options || []).map((o) => {
                const selected = Array.isArray(values[f.field_id]) ? (values[f.field_id] as string[]) : [];
                const checked = selected.includes(o);
                return (
                  <label
                    key={o}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                      checked
                        ? "border-blue-400 bg-blue-50 text-blue-900 dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-200"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300",
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked ? [...selected, o] : selected.filter((x) => x !== o);
                        set(f.field_id, next);
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium">{o}</span>
                  </label>
                );
              })}
            </div>
          ) : f.type === "textarea" ? (
            <textarea
              className={formTextareaCls}
              rows={3}
              disabled={readOnly}
              placeholder={getFieldPlaceholder(f)}
              value={String(values[f.field_id] || "")}
              onChange={(e) => set(f.field_id, e.target.value)}
            />
          ) : f.type === "file" ? (
            <FileUploadField field={f} value={values[f.field_id]} readOnly={readOnly} leadId={leadId} onChange={(val) => set(f.field_id, val)} />
          ) : f.type === "currency" ? (
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₹</span>
              <Input
                className={cn(formInputCls, "pl-7")}
                disabled={readOnly}
                placeholder={getFieldPlaceholder(f)}
                type="number"
                min={f.min !== undefined ? f.min : 0}
                max={f.max !== undefined ? f.max : undefined}
                step="0.01"
                value={String(values[f.field_id] ?? "")}
                onChange={(e) => set(f.field_id, e.target.value)}
              />
            </div>
          ) : (
            <Input
              className={formInputCls}
              disabled={readOnly}
              placeholder={getFieldPlaceholder(f)}
              type={getInputType(f)}
              min={(f.type === "number" || f.type === "currency") && f.min !== undefined ? f.min : undefined}
              max={(f.type === "number" || f.type === "currency") && f.max !== undefined ? f.max : undefined}
              value={String(values[f.field_id] || "")}
              onChange={(e) => set(f.field_id, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FileUploadField({
  field,
  value,
  readOnly,
  leadId,
  onChange,
}: {
  field: FormField;
  value: unknown;
  readOnly?: boolean;
  leadId?: number;
  onChange: (val: string) => void;
}) {
  const config = getFileAcceptConfig(field);
  const maxMb = field.max_file_mb || 10;
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const displayUrl = typeof value === "string" && value.startsWith("http") ? value : null;
  const displayName = typeof value === "string" ? (displayUrl ? value.split("/").pop()?.split("?")[0] : value) : "";

  const handleFile = async (file: File) => {
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File must be under ${maxMb}MB`);
      return;
    }
    const typeErr = validateFileSelection(file.name, field);
    if (typeErr) {
      setError(typeErr);
      return;
    }
    if (!leadId) {
      setError("Select a lead before uploading files");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const result = await api.uploadFormFile(leadId, field.field_id, file);
      onChange(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-5 text-center dark:border-slate-600 dark:bg-slate-950/50">
      <UploadIcon />
      <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">Upload file</p>
      <p className="mt-0.5 text-xs text-slate-400">{config.hint} · max {maxMb}MB</p>
      {!readOnly && (
        <Input
          type="file"
          accept={config.accept}
          disabled={uploading}
          className="mx-auto mt-3 max-w-xs text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      )}
      {uploading && <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300">Uploading…</p>}
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
      {displayName && !uploading && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-300">{displayName}</p>
          {displayUrl && (
            <a href={displayUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline dark:text-blue-300">
              View uploaded file
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
