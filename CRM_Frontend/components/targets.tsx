"use client";

import { Button, Card, Input } from "@/components/ui";
import { api, getProjectId, onProjectChange, type CreateSalesTargetData, type SalesTarget } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crosshair, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function TargetsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const canManage = !!me && ["Admin", "Manager", "TL"].includes(me.role);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [projectId, setProjectId] = useState(() => getProjectId() || "");

  useEffect(() => onProjectChange((id) => setProjectId(id)), []);

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const { data: users = [] } = useQuery({
    queryKey: ["users-targets"],
    queryFn: () => api.users(),
    enabled: canManage,
  });
  const assignees = useMemo(
    () => users.filter((u) => ["BDM", "TL"].includes(u.role)),
    [users],
  );

  const { data: targets = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["sales-targets", year, month, projectId],
    queryFn: () =>
      api.salesTargets({
        year,
        month,
        project: projectId || undefined,
      }),
  });

  const [form, setForm] = useState({
    user: "",
    target_confirmed: "10",
    target_leads: "30",
  });

  const create = useMutation({
    mutationFn: (data: CreateSalesTargetData) => api.createSalesTarget(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-targets"] });
      qc.invalidateQueries({ queryKey: ["reports-performance"] });
      setForm({ user: "", target_confirmed: "10", target_leads: "30" });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateSalesTargetData> }) =>
      api.updateSalesTarget(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-targets"] });
      qc.invalidateQueries({ queryKey: ["reports-performance"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteSalesTarget(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales-targets"] });
      qc.invalidateQueries({ queryKey: ["reports-performance"] });
    },
  });

  const handleCreate = () => {
    if (!form.user) return;
    create.mutate({
      user: Number(form.user),
      project: projectId ? Number(projectId) : null,
      year,
      month,
      target_confirmed: Number(form.target_confirmed) || 0,
      target_leads: Number(form.target_leads) || 0,
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <Crosshair className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Sales Targets</h1>
              <p className="mt-1 text-sm text-slate-600">
                Monthly confirmed-order and lead goals per BDM — progress also shows on Reports.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-emerald-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All projects (org-wide)</option>
            {(projects || []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </section>

      {canManage && (
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <Plus className="h-4 w-4 text-emerald-600" /> Set target
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <select
              value={form.user}
              onChange={(e) => setForm({ ...form, user: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Select BDM / TL</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name || u.username} ({u.role})
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={0}
              placeholder="Confirmed target"
              value={form.target_confirmed}
              onChange={(e) => setForm({ ...form, target_confirmed: e.target.value })}
            />
            <Input
              type="number"
              min={0}
              placeholder="Leads target"
              value={form.target_leads}
              onChange={(e) => setForm({ ...form, target_leads: e.target.value })}
            />
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 sm:col-span-2 lg:col-span-1"
              disabled={!form.user || create.isPending}
              onClick={handleCreate}
            >
              {create.isPending ? "Saving…" : "Save target"}
            </Button>
          </div>
          {create.isError && (
            <p className="mt-2 text-sm text-rose-600">{(create.error as Error).message}</p>
          )}
        </Card>
      )}

      {isLoading ? (
        <Card><p className="text-sm text-slate-400">Loading targets…</p></Card>
      ) : targets.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No targets for {MONTHS[month - 1]} {year}.</p>
          {!canManage && (
            <p className="mt-1 text-xs text-slate-400">Ask your manager to set a monthly goal.</p>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {targets.map((t) => (
            <TargetCard
              key={t.id}
              target={t}
              canManage={canManage}
              onUpdate={(data) => update.mutate({ id: t.id, data })}
              onDelete={() => confirm("Delete this target?") && remove.mutate(t.id)}
              saving={update.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TargetCard({
  target, canManage, onUpdate, onDelete, saving,
}: {
  target: SalesTarget;
  canManage: boolean;
  onUpdate: (data: Partial<CreateSalesTargetData>) => void;
  onDelete: () => void;
  saving?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(String(target.target_confirmed));
  const [leads, setLeads] = useState(String(target.target_leads));

  useEffect(() => {
    setConfirmed(String(target.target_confirmed));
    setLeads(String(target.target_leads));
  }, [target.target_confirmed, target.target_leads]);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{target.user_name}</h3>
          <p className="text-xs text-slate-500">
            {MONTHS[target.month - 1]} {target.year}
            {target.project_name ? ` · ${target.project_name}` : " · Org-wide"}
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={onDelete} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <ProgressBar
        label="Confirmed orders"
        actual={target.actual_confirmed ?? 0}
        target={target.target_confirmed}
        pct={target.confirmed_pct ?? 0}
        color="bg-emerald-500"
      />
      <ProgressBar
        label="Leads"
        actual={target.actual_leads ?? 0}
        target={target.target_leads}
        pct={target.leads_pct ?? 0}
        color="bg-blue-500"
      />

      {canManage && (
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <Input
            type="number"
            min={0}
            value={confirmed}
            onChange={(e) => setConfirmed(e.target.value)}
            onBlur={() => {
              const n = Number(confirmed);
              if (n !== target.target_confirmed) onUpdate({ target_confirmed: n });
            }}
            disabled={saving}
          />
          <Input
            type="number"
            min={0}
            value={leads}
            onChange={(e) => setLeads(e.target.value)}
            onBlur={() => {
              const n = Number(leads);
              if (n !== target.target_leads) onUpdate({ target_leads: n });
            }}
            disabled={saving}
          />
          <p className="col-span-2 text-[10px] text-slate-400">Edit numbers and blur to save</p>
        </div>
      )}
    </Card>
  );
}

function ProgressBar({
  label, actual, target, pct, color,
}: {
  label: string;
  actual: number;
  target: number;
  pct: number;
  color: string;
}) {
  const width = Math.min(100, pct || 0);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-800">
          {actual} / {target || "—"} ({pct || 0}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
