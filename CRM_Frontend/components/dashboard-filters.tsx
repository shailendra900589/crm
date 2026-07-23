"use client";

import { Button, Input } from "@/components/ui";
import type { AdminFilters, FilterSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Filter, X } from "lucide-react";

type Option = { id: number; name: string; extra?: string };

export function DashboardFilters({
  filters,
  onChange,
  projects,
  products,
  companies,
  managers,
  showManager = true,
  className,
}: {
  filters: AdminFilters;
  onChange: (filters: AdminFilters) => void;
  projects?: Option[];
  products?: Option[];
  companies?: Option[];
  managers?: Option[];
  showManager?: boolean;
  className?: string;
}) {
  const activeCount = [
    filters.project,
    filters.product,
    filters.company,
    filters.manager,
    filters.from,
    filters.to,
  ].filter(Boolean).length;

  const set = (patch: Partial<AdminFilters>) => {
    const next = { ...filters, ...patch };
    if ("project" in patch && patch.project !== filters.project) {
      next.product = "";
      next.company = "";
    }
    onChange(next);
  };

  const clear = () => onChange({});

  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
            <Filter className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Using Filters</h3>
            <p className="text-xs text-slate-500">Project-wise companies & products KPIs</p>
          </div>
          {activeCount > 0 && (
            <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white">
              {activeCount} active
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <Button variant="outline" className="h-8 gap-1 text-xs" onClick={clear}>
            <X className="h-3.5 w-3.5" /> Clear all
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FilterSelect
          label="Project"
          value={filters.project || ""}
          onChange={(v) => set({ project: v })}
          options={[{ id: 0, name: "All Projects" }, ...(projects || [])]}
          allValue=""
        />
        <FilterSelect
          label="Product"
          value={filters.product || ""}
          onChange={(v) => set({ product: v })}
          options={[{ id: 0, name: "All Products" }, ...(products || [])]}
          allValue=""
          disabled={!filters.project && !(products || []).length}
        />
        <FilterSelect
          label="Company"
          value={filters.company || ""}
          onChange={(v) => set({ company: v })}
          options={[{ id: 0, name: "All Companies" }, ...(companies || [])]}
          allValue=""
        />
        {showManager && (
          <FilterSelect
            label="Manager"
            value={filters.manager || ""}
            onChange={(v) => set({ manager: v })}
            options={[{ id: 0, name: "All Managers" }, ...(managers || [])]}
            allValue=""
          />
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">From</label>
          <Input type="date" value={filters.from || ""} onChange={(e) => set({ from: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">To</label>
          <Input type="date" value={filters.to || ""} onChange={(e) => set({ to: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allValue,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  allValue: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <select
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-900/40 dark:disabled:bg-slate-800"
        value={value}
        onChange={(e) => onChange(e.target.value === allValue ? "" : e.target.value)}
      >
        {options.map((o) => (
          <option key={`${label}-${o.id}-${o.name}`} value={o.id === 0 ? allValue : String(o.id)}>
            {o.extra ? `${o.name} · ${o.extra}` : o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterSummaryBanner({ summary }: { summary?: FilterSummary }) {
  if (!summary) return null;
  const parts: string[] = [];
  if (summary.project_name) parts.push(`Project: ${summary.project_name}`);
  if (summary.from || summary.to) parts.push(`Date: ${summary.from || "…"} → ${summary.to || "…"}`);
  if (!parts.length) return null;
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-sm text-indigo-900">
      Showing filtered data — {parts.join(" · ")}
    </div>
  );
}
