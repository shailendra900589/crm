"use client";

import { DynamicForm } from "@/components/dynamic-form";
import { api, getProjectId, setProjectId, type FormField, type Project } from "@/lib/api";
import {
  defaultField,
  FIELD_TYPE_OPTIONS,
  FILE_ACCEPT_PRESETS,
  isOptionField,
} from "@/lib/form-fields";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, Reorder, useDragControls } from "framer-motion";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Hash,
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
import { useEffect, useState } from "react";

const FIELD_PALETTE = [
  { type: "text", label: "Short answer", icon: Type, color: "bg-blue-50 text-blue-600 border-blue-100" },
  { type: "textarea", label: "Paragraph", icon: AlignLeft, color: "bg-violet-50 text-violet-600 border-violet-100" },
  { type: "number", label: "Number", icon: Hash, color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  { type: "email", label: "Email", icon: Mail, color: "bg-sky-50 text-sky-600 border-sky-100" },
  { type: "phone", label: "Phone", icon: Phone, color: "bg-teal-50 text-teal-600 border-teal-100" },
  { type: "url", label: "Website", icon: Link2, color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
  { type: "date", label: "Date", icon: Calendar, color: "bg-amber-50 text-amber-600 border-amber-100" },
  { type: "radio", label: "Multiple choice", icon: CircleDot, color: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100" },
  { type: "dropdown", label: "Dropdown", icon: List, color: "bg-rose-50 text-rose-600 border-rose-100" },
  { type: "multiselect", label: "Checkboxes", icon: CheckSquare, color: "bg-cyan-50 text-cyan-600 border-cyan-100" },
  { type: "file", label: "File upload", icon: Upload, color: "bg-slate-100 text-slate-600 border-slate-200" },
] as const;

function typeLabel(type: string) {
  return FIELD_TYPE_OPTIONS.find((f) => f.type === type)?.label || FIELD_PALETTE.find((f) => f.type === type)?.label || type;
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
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Options</p>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-500">
            {i + 1}
          </span>
          <Input
            value={opt}
            placeholder={`Option ${i + 1}`}
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
            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...options, `Option ${options.length + 1}`])}
        className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-sm font-medium text-violet-600 hover:border-violet-200 hover:bg-violet-50/50"
      >
        <Plus className="h-4 w-4" />
        Add option
      </button>
    </div>
  );
}

function FileTypeSelector({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Allowed file type</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.values(FILE_ACCEPT_PRESETS).map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition",
              (value || "pdf") === preset.id
                ? "border-violet-400 bg-violet-50 text-violet-700 ring-2 ring-violet-100"
                : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {(FILE_ACCEPT_PRESETS[(value || "pdf") as keyof typeof FILE_ACCEPT_PRESETS] || FILE_ACCEPT_PRESETS.pdf).hint}
      </p>
    </div>
  );
}

function FieldCard({
  field,
  selected,
  onSelect,
  onChange,
  onRemove,
  onDuplicate,
}: {
  field: FormField;
  selected: boolean;
  onSelect: () => void;
  onChange: (f: FormField) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const controls = useDragControls();
  const meta = FIELD_PALETTE.find((f) => f.type === field.type);

  const changeType = (type: string) => {
    const next = defaultField(type);
    onChange({
      ...next,
      field_id: field.field_id,
      label: field.label,
      required: field.required,
      placeholder: field.placeholder,
      help_text: field.help_text,
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
        "group relative cursor-pointer rounded-2xl border bg-white transition-all",
        selected ? "border-violet-400 shadow-md ring-2 ring-violet-100" : "border-slate-200 shadow-sm hover:border-slate-300 hover:shadow"
      )}
      whileDrag={{ scale: 1.01, boxShadow: "0 12px 32px rgba(99,102,241,0.15)" }}
    >
      <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-violet-500 opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start gap-3 p-5">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          className="mt-2 cursor-grab rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <input
              className="min-w-[200px] flex-1 border-0 border-b border-transparent bg-transparent text-base font-semibold text-slate-900 outline-none transition focus:border-violet-300"
              value={field.label}
              placeholder="Question"
              onChange={(e) => onChange({ ...field, label: e.target.value })}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <select
                value={field.type}
                onChange={(e) => changeType(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-violet-400"
              >
                {FIELD_TYPE_OPTIONS.map((t) => (
                  <option key={t.type} value={t.type}>{t.label}</option>
                ))}
              </select>
              {meta && (
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", meta.color)}>
                  <meta.icon className="h-3 w-3" />
                  {typeLabel(field.type)}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Placeholder (optional)</p>
              <Input
                value={field.placeholder || ""}
                placeholder="Hint text for respondent"
                onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Help text (optional)</p>
              <Input
                value={field.help_text || ""}
                placeholder="Extra instructions shown below label"
                onChange={(e) => onChange({ ...field, help_text: e.target.value })}
              />
            </div>
          </div>

          {field.type === "number" && (
            <div className="grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Minimum</p>
                <Input
                  type="number"
                  value={field.min ?? ""}
                  placeholder="No min"
                  onChange={(e) => onChange({ ...field, min: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Maximum</p>
                <Input
                  type="number"
                  value={field.max ?? ""}
                  placeholder="No max"
                  onChange={(e) => onChange({ ...field, max: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>
          )}

          {isOptionField(field.type) && (
            <OptionsEditor
              options={field.options || []}
              onChange={(options) => onChange({ ...field, options })}
            />
          )}

          {field.type === "file" && (
            <FileTypeSelector
              value={field.file_accept}
              onChange={(file_accept) => onChange({ ...field, file_accept })}
            />
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                checked={!!field.required}
                onChange={(e) => onChange({ ...field, required: e.target.checked })}
              />
              Required
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onDuplicate}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                title="Duplicate question"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                title="Delete question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Reorder.Item>
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
  const [description, setDescription] = useState("");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState(false);

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
      setDescription("");
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

  if (!mounted) {
    return <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <FileText className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Form Builder</h2>
            <p className="text-xs text-slate-500">Google Forms style · text, numeric, file types & more</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Project</label>
            <div className="relative">
              <select
                value={projectId || String(pid || "")}
                onChange={(e) => switchProject(e.target.value)}
                className="min-w-[180px] appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-10 text-sm font-medium text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="">Select project</option>
                {(projects || []).filter((p: Project) => p.is_active).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <Button
            onClick={() => save.mutate()}
            disabled={!pid || save.isPending || !title.trim()}
            className="gap-2 bg-violet-600 hover:bg-violet-700"
          >
            <Sparkles className="h-4 w-4" />
            {save.isPending ? "Publishing..." : saved ? "Published!" : "Publish Form"}
          </Button>
        </div>
      </div>

      {!pid ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-slate-500">Select a project from the dropdown to start building.</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-2 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
              <div className="space-y-3 p-6">
                <input
                  className="w-full border-0 text-2xl font-normal text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="Untitled form"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <input
                  className="w-full border-0 text-sm text-slate-500 outline-none placeholder:text-slate-400"
                  placeholder="Form description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                {currentProject && (
                  <p className="text-xs text-violet-600">
                    Assigned to project: <strong>{currentProject.name}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Add a question</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {FIELD_PALETTE.map(({ type, label, icon: Icon, color }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addField(type)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition hover:scale-[1.02] hover:shadow-sm",
                      color
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
            ) : (
              <Reorder.Group axis="y" values={schema} onReorder={setSchema} className="space-y-3">
                <AnimatePresence>
                  {schema.map((f, i) => (
                    <FieldCard
                      key={f.field_id}
                      field={f}
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
                onClick={() => addField("text")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-10 text-slate-400 transition hover:border-violet-300 hover:bg-violet-50/50 hover:text-violet-600"
              >
                <Plus className="h-5 w-5" />
                Add your first question
              </button>
            )}
          </div>

          <div className="xl:sticky xl:top-24 xl:self-start">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <Eye className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-semibold text-slate-700">Live Preview</span>
                <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  BDM view
                </span>
              </div>
              <div className="max-h-[75vh] overflow-y-auto p-5">
                <div className="mb-4 border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-medium text-slate-900">{title || "Untitled form"}</h3>
                  {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
                  {currentProject && (
                    <span
                      className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: currentProject.color }}
                    >
                      {currentProject.name}
                    </span>
                  )}
                </div>
                {schema.length > 0 ? (
                  <DynamicForm schema={schema} values={previewValues} onChange={setPreviewValues} layout="stack" />
                ) : (
                  <p className="py-8 text-center text-sm text-slate-400">Add questions to see preview</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
