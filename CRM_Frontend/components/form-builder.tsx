"use client";

import { DynamicForm } from "@/components/dynamic-form";
import { Button, Input } from "@/components/ui";
import { api, getProjectId, setProjectId, type FormField, type Project } from "@/lib/api";
import {
  defaultField,
  FIELD_TYPE_OPTIONS,
  FILE_ACCEPT_PRESETS,
  isMoneyField,
  isOptionField,
  METRIC_ROLE_OPTIONS,
} from "@/lib/form-fields";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Clock,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Hash,
  IndianRupee,
  Link2,
  List,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  text: { icon: Type, label: "Short answer" },
  textarea: { icon: AlignLeft, label: "Paragraph" },
  number: { icon: Hash, label: "Number" },
  currency: { icon: IndianRupee, label: "Amount (₹)" },
  email: { icon: Mail, label: "Email" },
  phone: { icon: Phone, label: "Phone" },
  url: { icon: Link2, label: "Website" },
  date: { icon: Calendar, label: "Date" },
  time: { icon: Clock, label: "Time" },
  datetime: { icon: Calendar, label: "Date & time" },
  radio: { icon: CircleDot, label: "Multiple choice" },
  dropdown: { icon: List, label: "Dropdown" },
  multiselect: { icon: CheckSquare, label: "Checkboxes" },
  file: { icon: Upload, label: "File upload" },
};

const QUICK_ADD = [
  { type: "text", label: "Text" },
  { type: "currency", label: "Amount ₹" },
  { type: "dropdown", label: "Dropdown" },
  { type: "date", label: "Date" },
  { type: "file", label: "File" },
] as const;

function typeLabel(type: string) {
  return TYPE_META[type]?.label || FIELD_TYPE_OPTIONS.find((f) => f.type === type)?.label || type;
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Options</p>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-medium text-slate-400">
            {i + 1}
          </span>
          <Input
            value={opt}
            placeholder={`Option ${i + 1}`}
            className="border-slate-700 bg-slate-950 text-slate-100"
            onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            disabled={options.length <= 1}
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...options, `Option ${options.length + 1}`])}
        className="flex items-center gap-2 rounded-xl border border-dashed border-slate-700 px-3 py-2 text-sm font-medium text-sky-300 hover:border-sky-500/40 hover:bg-sky-500/5"
      >
        <Plus className="h-4 w-4" />
        Add option
      </button>
    </div>
  );
}

function FileTypeSelector({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Allowed files</p>
      <div className="flex flex-wrap gap-2">
        {Object.values(FILE_ACCEPT_PRESETS).map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition",
              (value || "pdf") === preset.id
                ? "border-sky-400/50 bg-sky-500/15 text-sky-300"
                : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FieldCard({
  field,
  index,
  selected,
  onSelect,
  onChange,
  onRemove,
  onDuplicate,
}: {
  field: FormField;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (f: FormField) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const controls = useDragControls();
  const meta = TYPE_META[field.type] || TYPE_META.text;
  const Icon = meta.icon;

  const changeType = (type: string) => {
    const next = defaultField(type);
    onChange({
      ...next,
      field_id: field.field_id,
      label: field.label,
      required: field.required,
      placeholder: field.placeholder,
      help_text: field.help_text,
      metric_role: isMoneyField(type) ? field.metric_role || next.metric_role : undefined,
      currency: type === "currency" ? field.currency || "INR" : undefined,
      options: isOptionField(type) ? field.options || ["Option 1", "Option 2"] : undefined,
    });
  };

  return (
    <Reorder.Item
      value={field}
      dragListener={false}
      dragControls={controls}
      onClick={onSelect}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border transition-all",
        selected
          ? "border-sky-500/50 bg-slate-900 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
          : "border-slate-800 bg-slate-900/70 hover:border-slate-700",
      )}
      whileDrag={{ scale: 1.01, boxShadow: "0 16px 40px rgba(0,0,0,0.35)" }}
    >
      {selected && <div className="absolute inset-y-0 left-0 w-1 bg-sky-400" />}

      <div className="flex items-start gap-3 p-4 sm:p-5">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          className="mt-1 cursor-grab rounded-lg p-1.5 text-slate-600 hover:bg-slate-800 hover:text-slate-300 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          {/* Collapsed summary */}
          {!selected ? (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-100">
                  {index + 1}. {field.label || "Untitled question"}
                </p>
                <p className="text-xs text-slate-500">
                  {typeLabel(field.type)}
                  {field.required ? " · Required" : ""}
                  {field.metric_role ? ` · ${METRIC_ROLE_OPTIONS.find((m) => m.value === field.metric_role)?.label || field.metric_role}` : ""}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 transition group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={onDuplicate} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={onRemove} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start gap-3">
                <input
                  className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent text-lg font-semibold text-white outline-none placeholder:text-slate-600 focus:border-sky-500/40"
                  value={field.label}
                  placeholder="Question title"
                  onChange={(e) => onChange({ ...field, label: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
                <select
                  value={field.type}
                  onChange={(e) => changeType(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-sky-500/50"
                >
                  {FIELD_TYPE_OPTIONS.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.group} · {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {isOptionField(field.type) && (
                <OptionsEditor options={field.options || []} onChange={(options) => onChange({ ...field, options })} />
              )}

              {field.type === "file" && (
                <FileTypeSelector value={field.file_accept} onChange={(file_accept) => onChange({ ...field, file_accept })} />
              )}

              {isMoneyField(field.type) && (
                <div className="grid gap-3 sm:grid-cols-2" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-slate-500">Dashboard metric</p>
                    <select
                      value={field.metric_role || ""}
                      onChange={(e) =>
                        onChange({
                          ...field,
                          metric_role: e.target.value || undefined,
                          type: field.type === "number" && e.target.value ? "currency" : field.type,
                          currency: e.target.value ? field.currency || "INR" : field.currency,
                        })
                      }
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-sky-500/50"
                    >
                      {METRIC_ROLE_OPTIONS.map((m) => (
                        <option key={m.value || "none"} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {METRIC_ROLE_OPTIONS.find((m) => m.value === (field.metric_role || ""))?.hint}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-slate-500">Min</p>
                      <Input
                        type="number"
                        value={field.min ?? ""}
                        placeholder="0"
                        className="border-slate-700 bg-slate-950 text-slate-100"
                        onChange={(e) => onChange({ ...field, min: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-slate-500">Max</p>
                      <Input
                        type="number"
                        value={field.max ?? ""}
                        placeholder="—"
                        className="border-slate-700 bg-slate-950 text-slate-100"
                        onChange={(e) => onChange({ ...field, max: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <details className="rounded-xl border border-slate-800 bg-slate-950/50" onClick={(e) => e.stopPropagation()}>
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
                  More options
                </summary>
                <div className="grid gap-3 border-t border-slate-800 p-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-slate-500">Placeholder</p>
                    <Input
                      value={field.placeholder || ""}
                      placeholder="Hint inside the input"
                      className="border-slate-700 bg-slate-950 text-slate-100"
                      onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-slate-500">Help text</p>
                    <Input
                      value={field.help_text || ""}
                      placeholder="Shown under the label"
                      className="border-slate-700 bg-slate-950 text-slate-100"
                      onChange={(e) => onChange({ ...field, help_text: e.target.value })}
                    />
                  </div>
                </div>
              </details>

              <div className="flex items-center justify-between border-t border-slate-800 pt-3" onClick={(e) => e.stopPropagation()}>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-sky-500 focus:ring-sky-500"
                    checked={!!field.required}
                    onChange={(e) => onChange({ ...field, required: e.target.checked })}
                  />
                  Required
                </label>
                <div className="flex gap-1">
                  <button type="button" onClick={onDuplicate} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200" title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={onRemove} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}

function AddQuestionMenu({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof FIELD_TYPE_OPTIONS>();
    for (const opt of FIELD_TYPE_OPTIONS) {
      const list = map.get(opt.group) || ([] as typeof FIELD_TYPE_OPTIONS);
      list.push(opt);
      map.set(opt.group, list);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
        >
          <Plus className="h-4 w-4" />
          Add question
        </button>
        {QUICK_ADD.map((q) => (
          <button
            key={q.type}
            type="button"
            onClick={() => onAdd(q.type)}
            className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            {q.label}
          </button>
        ))}
      </div>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-[min(100vw-2rem,420px)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="border-b border-slate-800 px-4 py-3">
            <p className="text-sm font-bold text-white">Choose field type</p>
            <p className="text-xs text-slate-500">Amounts with a metric role appear on dashboards</p>
          </div>
          <div className="grid max-h-80 gap-4 overflow-y-auto p-4 sm:grid-cols-2">
            {groups.map(([group, items]) => (
              <div key={group}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group}</p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = TYPE_META[item.type]?.icon || Type;
                    return (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => {
                          onAdd(item.type);
                          setOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                      >
                        <Icon className="h-4 w-4 text-sky-300" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FormBuilder() {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: api.projects, enabled: mounted });
  const [projectId, setLocalProject] = useState("");
  const pid = Number(projectId) || 0;

  const { data: form, isLoading } = useQuery({
    queryKey: ["custom-form", pid],
    queryFn: () => api.customForm(pid),
    enabled: mounted && !!pid,
  });

  const [schema, setSchema] = useState<FormField[]>([]);
  const [title, setTitle] = useState("");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    setMounted(true);
    const savedPid = getProjectId();
    if (savedPid) setLocalProject(savedPid);
  }, []);

  useEffect(() => {
    if (!mounted || projectId || !projects?.length) return;
    setLocalProject(String(projects[0].id));
  }, [mounted, projects, projectId]);

  useEffect(() => {
    if (form) {
      setSchema(form.schema || []);
      setTitle(form.title || "");
      setSelectedIdx(null);
      setPreviewValues({});
    }
  }, [form, pid]);

  const save = useMutation({
    mutationFn: () => api.saveCustomForm(pid, { title, schema, is_active: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-form", pid] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const switchProject = (id: string) => {
    setLocalProject(id);
    setProjectId(id);
    setSchema([]);
    setTitle("");
    qc.invalidateQueries({ queryKey: ["custom-form"] });
  };

  const addField = (type: string) => {
    const next = [...schema, defaultField(type)];
    setSchema(next);
    setSelectedIdx(next.length - 1);
  };

  const duplicateField = (index: number) => {
    const source = schema[index];
    const copy: FormField = {
      ...source,
      field_id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: `${source.label} (copy)`,
      options: source.options ? [...source.options] : undefined,
    };
    const next = [...schema];
    next.splice(index + 1, 0, copy);
    setSchema(next);
    setSelectedIdx(index + 1);
  };

  const currentProject = projects?.find((p) => p.id === pid);
  const moneyFields = schema.filter((f) => f.metric_role);

  if (!mounted) {
    return <div className="h-96 animate-pulse rounded-2xl bg-slate-900" />;
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/80 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#0f172a_100%)] p-4 sm:p-5">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-md border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">
            <FileText className="h-3.5 w-3.5" />
            Form studio
          </div>
          <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">Build project forms</h2>
          <p className="mt-1 text-sm text-slate-400">
            Clean questions for BDMs — tag amounts as Collection or Pending for live dashboard KPIs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={projectId || String(pid || "")}
              onChange={(e) => switchProject(e.target.value)}
              className="min-w-[160px] appearance-none rounded-xl border border-slate-600 bg-slate-950 py-2.5 pl-3 pr-9 text-sm font-semibold text-slate-100 outline-none focus:border-sky-500/50"
            >
              <option value="">Select project</option>
              {(projects || [])
                .filter((p: Project) => p.is_active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:border-slate-500 xl:hidden"
          >
            <Eye className="h-3.5 w-3.5" />
            {showPreview ? "Hide preview" : "Preview"}
          </button>
          <Button
            onClick={() => save.mutate()}
            disabled={!pid || save.isPending || !title.trim()}
            className="gap-2 bg-sky-500 text-slate-950 hover:bg-sky-400"
          >
            <Sparkles className="h-4 w-4" />
            {save.isPending ? "Publishing…" : saved ? "Published" : "Publish"}
          </Button>
        </div>
      </div>

      {!pid ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-slate-400">Pick a project to design its onboarding / collection form.</p>
        </div>
      ) : (
        <div className={cn("grid gap-5", showPreview ? "xl:grid-cols-[1fr_320px]" : "")}>
          <div className="space-y-4">
            {/* Title card */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
              <input
                className="w-full border-0 bg-transparent text-2xl font-bold text-white outline-none placeholder:text-slate-600"
                placeholder="Form title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {currentProject && (
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 font-semibold text-white"
                    style={{ backgroundColor: currentProject.color || "#334155" }}
                  >
                    {currentProject.name}
                  </span>
                )}
                <span className="rounded-full border border-slate-700 px-2.5 py-1 text-slate-400">
                  {schema.length} question{schema.length === 1 ? "" : "s"}
                </span>
                {moneyFields.length > 0 && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-300">
                    {moneyFields.length} money KPI{moneyFields.length === 1 ? "" : "s"} linked
                  </span>
                )}
              </div>
            </div>

            <AddQuestionMenu onAdd={addField} />

            {isLoading ? (
              <div className="h-40 animate-pulse rounded-2xl bg-slate-900" />
            ) : (
              <Reorder.Group axis="y" values={schema} onReorder={setSchema} className="space-y-3">
                <AnimatePresence>
                  {schema.map((f, i) => (
                    <FieldCard
                      key={f.field_id}
                      field={f}
                      index={i}
                      selected={selectedIdx === i}
                      onSelect={() => setSelectedIdx(i)}
                      onChange={(updated) => {
                        const s = [...schema];
                        s[i] = updated;
                        setSchema(s);
                      }}
                      onRemove={() => {
                        setSchema(schema.filter((_, j) => j !== i));
                        setSelectedIdx(null);
                      }}
                      onDuplicate={() => duplicateField(i)}
                    />
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            )}

            {schema.length === 0 && !isLoading && (
              <button
                type="button"
                onClick={() => addField("currency")}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 py-12 text-slate-500 transition hover:border-sky-500/40 hover:bg-sky-500/5 hover:text-sky-300"
              >
                <IndianRupee className="h-6 w-6" />
                <span className="text-sm font-semibold">Start with Collection Pending Amount</span>
                <span className="text-xs">or use Add question above</span>
              </button>
            )}
          </div>

          {/* Preview */}
          {showPreview && (
            <aside className="xl:sticky xl:top-24 xl:self-start">
              <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
                <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
                  <Eye className="h-4 w-4 text-sky-300" />
                  <span className="text-sm font-semibold text-slate-100">Preview</span>
                  <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                    Field view
                  </span>
                </div>
                <div className="max-h-[70vh] overflow-y-auto p-4">
                  <h3 className="text-base font-bold text-white">{title || "Untitled form"}</h3>
                  <p className="mt-1 text-xs text-slate-500">{currentProject?.name}</p>
                  <div className="mt-4">
                    {schema.length > 0 ? (
                      <DynamicForm schema={schema} values={previewValues} onChange={setPreviewValues} layout="stack" />
                    ) : (
                      <p className="py-10 text-center text-sm text-slate-500">Add questions to preview</p>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
