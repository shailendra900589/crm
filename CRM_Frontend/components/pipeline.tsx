"use client";

import { Badge } from "@/components/ui";
import { api, getProjectId, onProjectChange, LEAD_STATUSES, type Lead } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, MapPin, RefreshCw, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const COLUMN_TINT: Record<string, string> = {
  interested: "border-sky-200 bg-sky-50/60",
  follow_up: "border-amber-200 bg-amber-50/60",
  callback: "border-violet-200 bg-violet-50/60",
  order_confirmed: "border-emerald-200 bg-emerald-50/60",
  not_interested: "border-slate-200 bg-slate-50/80",
};

export function PipelineBoard() {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState(() => getProjectId() || "");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);

  useEffect(() => onProjectChange((id) => setProjectId(id)), []);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["pipeline", projectId],
    queryFn: api.pipeline,
  });

  const columns = useMemo(() => {
    const base: Record<string, Lead[]> = {};
    LEAD_STATUSES.forEach((s) => { base[s.value] = data?.columns?.[s.value] || []; });
    return base;
  }, [data]);

  const move = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.updateLead(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["pipeline", projectId] });
      const prev = qc.getQueryData<{ columns: Record<string, Lead[]>; counts: Record<string, number>; total: number }>(["pipeline", projectId]);
      if (prev) {
        const nextCols: Record<string, Lead[]> = {};
        Object.keys(prev.columns || {}).forEach((k) => { nextCols[k] = [...(prev.columns[k] || [])]; });
        let moved: Lead | undefined;
        Object.keys(nextCols).forEach((k) => {
          const i = nextCols[k].findIndex((l) => l.id === id);
          if (i >= 0) {
            moved = { ...nextCols[k][i], status, status_display: LEAD_STATUSES.find((s) => s.value === status)?.label || status };
            nextCols[k].splice(i, 1);
          }
        });
        if (moved) {
          nextCols[status] = [moved, ...(nextCols[status] || [])];
          const counts: Record<string, number> = {};
          Object.keys(nextCols).forEach((k) => { counts[k] = nextCols[k].length; });
          qc.setQueryData(["pipeline", projectId], { ...prev, columns: nextCols, counts, total: sumCounts(counts) });
        }
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pipeline", projectId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
    },
  });

  const onDrop = (status: string) => {
    if (dragId == null) return;
    const from = LEAD_STATUSES.find((s) => (columns[s.value] || []).some((l) => l.id === dragId));
    if (from && from.value !== status) {
      move.mutate({ id: dragId, status });
    }
    setDragId(null);
    setOverStatus(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pipeline</h1>
          <p className="mt-1 text-sm text-slate-500">
            Drag leads across stages · {data?.total ?? 0} in view
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400">Loading pipeline…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {LEAD_STATUSES.map((col) => {
            const leads = columns[col.value] || [];
            return (
              <div
                key={col.value}
                onDragOver={(e) => { e.preventDefault(); setOverStatus(col.value); }}
                onDragLeave={() => setOverStatus((s) => (s === col.value ? null : s))}
                onDrop={(e) => { e.preventDefault(); onDrop(col.value); }}
                className={cn(
                  "flex w-[280px] shrink-0 flex-col rounded-2xl border",
                  COLUMN_TINT[col.value] || "border-slate-200 bg-slate-50",
                  overStatus === col.value && dragId != null && "ring-2 ring-blue-400 ring-offset-2",
                )}
              >
                <div className="flex items-center justify-between px-3 py-3">
                  <h2 className="text-sm font-semibold text-slate-800">{col.label}</h2>
                  <span className="rounded-lg bg-white/80 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {leads.length}
                  </span>
                </div>
                <div className="flex max-h-[calc(100vh-220px)] flex-col gap-2 overflow-y-auto px-2 pb-3">
                  {leads.length === 0 && (
                    <p className="px-2 py-8 text-center text-xs text-slate-400">Drop leads here</p>
                  )}
                  {leads.map((lead) => (
                    <article
                      key={lead.id}
                      draggable
                      onDragStart={() => setDragId(lead.id)}
                      onDragEnd={() => { setDragId(null); setOverStatus(null); }}
                      className={cn(
                        "cursor-grab rounded-xl border border-white/80 bg-white p-3 shadow-sm active:cursor-grabbing",
                        dragId === lead.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/leads?lead=${lead.id}`}
                            className="block truncate text-sm font-medium text-slate-900 hover:text-blue-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {lead.merchant_name}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {lead.product_name || "No product"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-0.5">
                              <User className="h-3 w-3" /> {lead.bdm_name}
                            </span>
                            {lead.merchant_city && (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin className="h-3 w-3" /> {lead.merchant_city}
                              </span>
                            )}
                          </div>
                          {lead.follow_up_date && (
                            <div className="mt-2">
                              <Badge status={lead.status} label={`FU ${lead.follow_up_date}`} />
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function sumCounts(counts: Record<string, number>) {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}
