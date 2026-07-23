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

export const formInputCls =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50";

export const formTextareaCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50";

export function FormLabel({ children, required, help }: { children: React.ReactNode; required?: boolean; help?: string }) {
  return (
    <div className="mb-2">
      <label className="block text-sm font-semibold text-slate-700">
        {children}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {help && <p className="mt-1 text-xs text-slate-500">{help}</p>}
    </div>
  );
}

function isCompactField(type: string) {
  return ["text", "number", "email", "phone", "url", "date", "time", "datetime", "dropdown"].includes(type);
}

function getFieldColSpan(field: FormField, schema: FormField[], layout: "grid" | "stack") {
  if (layout !== "grid") return "";
  if (isFullWidthField(field.type)) return "sm:col-span-2";

  const compactFields = schema.filter((f) => isCompactField(f.type));
  const compactIndex = compactFields.findIndex((f) => f.field_id === field.field_id);
  const isLastCompact = compactIndex === compactFields.length - 1;
  const hasOddCompactCount = compactFields.length % 2 === 1;

  if (isLastCompact && hasOddCompactCount) return "sm:col-span-2";
  return "";
}

export function DynamicForm({
  schema,
  values,
  onChange,
  readOnly,
  layout = "grid",
  leadId,
}: {
  schema: FormField[];
  values: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  readOnly?: boolean;
  layout?: "grid" | "stack";
  leadId?: number;
}) {
  if (!schema?.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
        <p className="text-sm text-slate-400">No questions in this form yet.</p>
      </div>
    );
  }

  const set = (id: string, val: unknown) => onChange({ ...values, [id]: val });

  return (
    <div className={cn(layout === "grid" ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : "space-y-4")}>
      {schema.map((f) => (
        <div
          key={f.field_id}
          className={cn(
            "rounded-xl border border-slate-100 bg-white p-4 shadow-sm",
            getFieldColSpan(f, schema, layout)
          )}
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
            <div className="space-y-2">
              {(f.options || []).map((o) => (
                <label
                  key={o}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
                    values[f.field_id] === o
                      ? "border-violet-300 bg-violet-50 text-violet-900"
                      : "border-slate-200 bg-slate-50/50 hover:border-violet-200"
                  )}
                >
                  <input
                    type="radio"
                    name={f.field_id}
                    disabled={readOnly}
                    checked={values[f.field_id] === o}
                    onChange={() => set(f.field_id, o)}
                    className="h-4 w-4 border-slate-300 text-violet-600 focus:ring-violet-500"
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
                      "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition",
                      checked
                        ? "border-violet-300 bg-violet-50 text-violet-900"
                        : "border-slate-200 bg-slate-50/50 text-slate-700 hover:border-violet-200 hover:bg-violet-50/40"
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
                      className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="font-medium">{o}</span>
                  </label>
                );
              })}
            </div>
          ) : f.type === "textarea" ? (
            <textarea
              className={formTextareaCls}
              rows={4}
              disabled={readOnly}
              placeholder={getFieldPlaceholder(f)}
              value={String(values[f.field_id] || "")}
              onChange={(e) => set(f.field_id, e.target.value)}
            />
          ) : f.type === "file" ? (
            <FileUploadField field={f} value={values[f.field_id]} readOnly={readOnly} leadId={leadId} onChange={(val) => set(f.field_id, val)} />
          ) : (
            <Input
              className={formInputCls}
              disabled={readOnly}
              placeholder={getFieldPlaceholder(f)}
              type={getInputType(f)}
              min={f.type === "number" && f.min !== undefined ? f.min : undefined}
              max={f.type === "number" && f.max !== undefined ? f.max : undefined}
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
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
      <UploadIcon />
      <p className="mt-2 text-sm font-medium text-slate-600">Upload file</p>
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
      {uploading && <p className="mt-2 text-xs font-medium text-indigo-600">Uploading to cloud storage...</p>}
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
      {displayName && !uploading && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-violet-600">{displayName}</p>
          {displayUrl && (
            <a href={displayUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">
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
    <svg className="mx-auto h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}
