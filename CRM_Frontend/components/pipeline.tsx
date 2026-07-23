"use client";

import { api, getProjectId, onProjectChange, LEAD_STATUSES, type Lead } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  GripVertical,
  MapPin,
  RefreshCw,
  Search,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type PipelineData = {
  columns: Record<string, Lead[]>;
  counts: Record<string, number>;
  total: number;
};

const COLUMN_META: Record<
  string,
  { accent: string; dot: string; ring: string; empty: string }
> = {
  interested: {
    accent: "from-sky-500 to-sky-400",
    dot: "bg-sky-500",
    ring: "ring-sky-400/50",
    empty: "border-sky-500/20",
  },
  follow_up: {
    accent: "from-amber-500 to-amber-400",
    dot: "bg-amber-500",
    ring: "ring-amber-400/50",
    empty: "border-amber-500/20",
  },
  callback: {
    accent: "from-violet-500 to-violet-400",
    dot: "bg-violet-500",
    ring: "ring-violet-400/50",
    empty: "border-violet-500/20",
  },
  order_confirmed: {
    accent: "from-emerald-500 to-emerald-400",
    dot: "bg-emerald-500",
    ring: "ring-emerald-400/50",
    empty: "border-emerald-500/20",
  },
  not_interested: {
    accent: "from-slate-400 to-slate-500",
    dot: "bg-slate-400",
    ring: "ring-slate-400/50",
    empty: "border-slate-500/20",
  },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyColumns(): Record<string, Lead[]> {
  const base: Record<string, Lead[]> = {};
  LEAD_STATUSES.forEach((s) => {
    base[s.value] = [];
  });
  return base;
}

export function PipelineBoard() {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState(() => getProjectId() || "");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => onProjectChange((id) => setProjectId(id)), []);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["pipeline", projectId],
    queryFn: api.pipeline,
  });

  const columns = useMemo(() => {
    const base = emptyColumns();
    LEAD_STATUSES.forEach((s) => {
      base[s.value] = data?.columns?.[s.value] || [];
    });
    return base;
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return columns;
    const next = emptyColumns();
    LEAD_STATUSES.forEach((s) => {
      next[s.value] = (columns[s.value] || []).filter((l) => {
        const hay = [
          l.merchant_name,
          l.product_name,
          l.bdm_name,
          l.merchant_city,
          l.merchant_mobile,
          l.brand_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    });
    return next;
  }, [columns, query]);

  const visibleTotal = useMemo(
    () => LEAD_STATUSES.reduce((n, s) => n + (filtered[s.value]?.length || 0), 0),
    [filtered],
  );

  const move = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.updateLead(id, { status }),
    onMutate: async ({ id, status }) => {
      setMoveError(null);
      await qc.cancelQueries({ queryKey: ["pipeline", projectId] });
      const prev = qc.getQueryData<PipelineData>(["pipeline", projectId]);
      if (prev) {
        const nextCols = emptyColumns();
        Object.keys(prev.columns || {}).forEach((k) => {
          nextCols[k] = [...(prev.columns[k] || [])];
        });
        LEAD_STATUSES.forEach((s) => {
          if (!nextCols[s.value]) nextCols[s.value] = [];
        });

        let moved: Lead | undefined;
        Object.keys(nextCols).forEach((k) => {
          const i = nextCols[k].findIndex((l) => l.id === id);
          if (i >= 0) {
            moved = {
              ...nextCols[k][i],
              status,
              status_display: LEAD_STATUSES.find((s) => s.value === status)?.label || status,
            };
            nextCols[k].splice(i, 1);
          }
        });
        if (moved) {
          nextCols[status] = [moved, ...(nextCols[status] || [])];
          const counts: Record<string, number> = {};
          Object.keys(nextCols).forEach((k) => {
            counts[k] = nextCols[k].length;
          });
          qc.setQueryData<PipelineData>(["pipeline", projectId], {
            ...prev,
            columns: nextCols,
            counts,
            total: Object.values(counts).reduce((a, b) => a + b, 0),
          });
        }
      }
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["pipeline", projectId], ctx.prev);
      setMoveError(err instanceof Error ? err.message : "Could not move lead. Try again.");
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
    const from = LEAD_STATUSES.find((s) =>
      (columns[s.value] || []).some((l) => l.id === dragId),
    );
    if (from && from.value !== status) {
      move.mutate({ id: dragId, status });
    }
    setDragId(null);
    setOverStatus(null);
    draggingRef.current = false;
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Drag cards between stages
            {data != null && (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {query ? `${visibleTotal} of ${data.total}` : data.total}
                </span>{" "}
                in view
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter board…"
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400/50"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear filter"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stage summary */}
      {!isLoading && data && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {LEAD_STATUSES.map((col) => {
            const meta = COLUMN_META[col.value];
            const count = filtered[col.value]?.length ?? 0;
            return (
              <div
                key={col.value}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <span className={cn("h-2 w-2 rounded-full", meta?.dot)} />
                {col.label}
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {moveError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{moveError}</p>
          <button type="button" onClick={() => setMoveError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Failed to load pipeline</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-sm font-semibold text-rose-600 underline dark:text-rose-300"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="min-w-[240px] flex-1 animate-pulse rounded-2xl border border-slate-200 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="h-12 border-b border-slate-200/80 dark:border-slate-800" />
              <div className="space-y-2 p-3">
                <div className="h-20 rounded-xl bg-slate-200/80 dark:bg-slate-800" />
                <div className="h-20 rounded-xl bg-slate-200/60 dark:bg-slate-800/70" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
          {LEAD_STATUSES.map((col) => {
            const leads = filtered[col.value] || [];
            const meta = COLUMN_META[col.value] || COLUMN_META.not_interested;
            const isOver = overStatus === col.value && dragId != null;

            return (
              <section
                key={col.value}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverStatus(col.value);
                }}
                onDragLeave={() => setOverStatus((s) => (s === col.value ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(col.value);
                }}
                className={cn(
                  "flex min-h-[420px] w-[min(100%,280px)] min-w-[240px] max-w-[320px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/70 transition dark:border-slate-800 dark:bg-slate-900/40",
                  isOver && cn("ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950", meta.ring),
                )}
              >
                <header className="relative shrink-0 px-3 pb-2.5 pt-3">
                  <div
                    className={cn(
                      "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
                      meta.accent,
                    )}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                      <h2 className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">
                        {col.label}
                      </h2>
                    </div>
                    <span className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                      {leads.length}
                    </span>
                  </div>
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-3">
                  {leads.length === 0 && (
                    <div
                      className={cn(
                        "flex flex-1 items-center justify-center rounded-xl border border-dashed px-3 py-10 text-center text-[12px] text-slate-400 dark:text-slate-500",
                        meta.empty,
                      )}
                    >
                      {query ? "No matches" : "Drop leads here"}
                    </div>
                  )}

                  {leads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      dragging={dragId === lead.id}
                      onDragStart={() => {
                        draggingRef.current = true;
                        setDragId(lead.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStatus(null);
                        // allow link clicks again after drag ends
                        setTimeout(() => {
                          draggingRef.current = false;
                        }, 50);
                      }}
                      shouldBlockNav={() => draggingRef.current}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeadCard({
  lead,
  dragging,
  onDragStart,
  onDragEnd,
  shouldBlockNav,
}: {
  lead: Lead;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  shouldBlockNav: () => boolean;
}) {
  const overdue = !!lead.follow_up_date && lead.follow_up_date < todayISO();
  const dueToday = lead.follow_up_date === todayISO();

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(lead.id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm transition active:cursor-grabbing dark:border-slate-700/80 dark:bg-slate-950/80 dark:shadow-none",
        "hover:border-blue-300/70 hover:shadow-md dark:hover:border-blue-500/40 dark:hover:bg-slate-900",
        dragging && "opacity-40 ring-2 ring-blue-400/40",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400 dark:text-slate-600 dark:group-hover:text-slate-400" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/leads?lead=${lead.id}`}
            className="block truncate text-[13px] font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-50 dark:hover:text-blue-300"
            onClick={(e) => {
              if (shouldBlockNav()) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            draggable={false}
          >
            {lead.merchant_name}
          </Link>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {lead.product_name || "No product"}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 truncate">
              <User className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate">{lead.bdm_name || "—"}</span>
            </span>
            {lead.merchant_city ? (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                <span className="truncate">{lead.merchant_city}</span>
              </span>
            ) : null}
          </div>

          {lead.follow_up_date ? (
            <div
              className={cn(
                "mt-2.5 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold",
                overdue
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                  : dueToday
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              <Calendar className="h-3 w-3" />
              {overdue ? "Overdue" : dueToday ? "Today" : "FU"} {lead.follow_up_date}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
