"use client";

import { Button, Card } from "@/components/ui";
import { api, getProjectId, onProjectChange, type LeadVisit } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  missed: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

function monthBounds(year: number, month: number) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    to: `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`,
  };
}

function toKey(d: Date | string) {
  if (typeof d === "string") return d.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function VisitsCalendarPage() {
  const qc = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => toKey(today));
  const [statusFilter, setStatusFilter] = useState("");
  const [projectId, setLocalProject] = useState(() => getProjectId() || "");

  useEffect(() => onProjectChange((id) => setLocalProject(id)), []);

  const bounds = useMemo(
    () => monthBounds(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["visits", "calendar", bounds.from, bounds.to, statusFilter, projectId],
    queryFn: () =>
      api.visits({
        from: bounds.from,
        to: bounds.to,
        status: statusFilter || undefined,
        project: projectId || undefined,
      }),
  });

  const byDay = useMemo(() => {
    const map: Record<string, LeadVisit[]> = {};
    for (const v of visits) {
      const key = toKey(v.scheduled_date);
      (map[key] ||= []).push(v);
    }
    return map;
  }, [visits]);

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid: ({ date: Date; inMonth: boolean } | null)[] = [];
    for (let i = 0; i < firstDow; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      grid.push({ date: new Date(year, month, d), inMonth: true });
    }
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [cursor]);

  const dayVisits = byDay[selectedDay] || [];
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const stats = useMemo(() => ({
    total: visits.length,
    scheduled: visits.filter((v) => v.status === "scheduled").length,
    completed: visits.filter((v) => v.status === "completed").length,
    today: (byDay[toKey(today)] || []).length,
  }), [visits, byDay, today]);

  const complete = useMutation({
    mutationFn: (id: number) => api.completeVisit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visits"] }),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => api.cancelVisit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visits"] }),
  });

  const shiftMonth = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-white p-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 shadow-sm dark:bg-blue-950">
              <CalendarDays className="h-7 w-7 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Visit Calendar</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Month view of scheduled field visits — click a day to manage visits.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="This month" value={stats.total} />
            <Stat label="Scheduled" value={stats.scheduled} accent="text-blue-600" />
            <Stat label="Completed" value={stats.completed} accent="text-emerald-600" />
            <Stat label="Today" value={stats.today} accent="text-indigo-600" />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-9 w-9 px-0" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-[160px] text-center text-base font-bold text-slate-900 dark:text-slate-50">{monthLabel}</p>
          <Button variant="outline" className="h-9 w-9 px-0" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-9 text-xs"
            onClick={() => {
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
              setSelectedDay(toKey(today));
            }}
          >
            Today
          </Button>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="missed">Missed</option>
        </select>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden p-0 xl:col-span-2">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              if (!cell) {
                return <div key={`e-${idx}`} className="min-h-[88px] border-b border-r border-slate-100 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/40" />;
              }
              const key = toKey(cell.date);
              const list = byDay[key] || [];
              const isToday = key === toKey(today);
              const isSelected = key === selectedDay;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={cn(
                    "min-h-[88px] border-b border-r border-slate-100 p-2 text-left transition hover:bg-blue-50/60 dark:border-slate-800 dark:hover:bg-blue-950/30",
                    isSelected && "bg-blue-50 dark:bg-blue-950/40",
                    isToday && "ring-2 ring-inset ring-blue-400"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                      isToday ? "bg-blue-600 text-white" : "text-slate-700 dark:text-slate-200"
                    )}>
                      {cell.date.getDate()}
                    </span>
                    {list.length > 0 && (
                      <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                        {list.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {list.slice(0, 2).map((v) => (
                      <div
                        key={v.id}
                        className={cn("truncate rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_STYLE[v.status] || STATUS_STYLE.scheduled)}
                      >
                        {v.lead_name}
                      </div>
                    ))}
                    {list.length > 2 && (
                      <p className="text-[10px] text-slate-400">+{list.length - 2} more</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {isLoading && (
            <p className="border-t border-slate-100 p-4 text-center text-sm text-slate-400 dark:border-slate-800">Loading visits…</p>
          )}
        </Card>

        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-IN", {
                weekday: "long", day: "numeric", month: "short", year: "numeric",
              })}
            </h3>
            <p className="text-sm text-slate-500">{dayVisits.length} visit{dayVisits.length === 1 ? "" : "s"}</p>
          </div>

          <div className="space-y-3">
            {!dayVisits.length && (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400 dark:border-slate-700">
                No visits on this day
              </p>
            )}
            {dayVisits.map((v) => (
              <div key={v.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/leads?lead=${v.lead}`} className="font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-50">
                      {v.lead_name}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3" /> {v.merchant_city || "—"} · {v.project_name}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <User className="h-3 w-3" /> {v.assigned_to_name} · {v.visit_type}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_STYLE[v.status] || STATUS_STYLE.scheduled)}>
                    {v.status}
                  </span>
                </div>
                {v.remarks && <p className="mt-2 text-xs text-slate-500">{v.remarks}</p>}
                {v.status === "scheduled" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      className="h-8 gap-1 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
                      disabled={complete.isPending}
                      onClick={() => complete.mutate(v.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs text-rose-600"
                      disabled={cancel.isPending}
                      onClick={() => confirm("Cancel this visit?") && cancel.mutate(v.id)}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className={cn("text-xl font-bold", accent || "text-slate-900 dark:text-slate-50")}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}
