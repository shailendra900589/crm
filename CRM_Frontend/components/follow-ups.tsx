"use client";

import { LogCallForm } from "@/components/log-call";
import { Badge, Button, Card, Input } from "@/components/ui";
import { api, type CallOutcome, type Lead } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Phone,
  PhoneCall,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type Tab = "overdue" | "due_today" | "upcoming";

export function FollowUpsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overdue");
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [logCallId, setLogCallId] = useState<number | null>(null);
  const [nextDate, setNextDate] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["follow-ups"],
    queryFn: api.followUpsHub,
  });

  const counts = data?.counts || { overdue: 0, due_today: 0, upcoming: 0 };
  const list = useMemo(() => {
    if (!data) return [];
    if (tab === "overdue") return data.overdue;
    if (tab === "due_today") return data.due_today;
    return data.upcoming;
  }, [data, tab]);

  const reschedule = useMutation({
    mutationFn: () =>
      api.followUpLead(rescheduleId!, {
        follow_up_date: nextDate,
        notes: note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setRescheduleId(null);
      setNextDate("");
      setNote("");
    },
  });

  const doneToday = useMutation({
    mutationFn: (lead: Lead) =>
      api.updateLead(lead.id, { status: "order_confirmed" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const logCall = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { outcome: CallOutcome; notes: string; follow_up_date?: string } }) =>
      api.logCall(id, data),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["lead-activity", vars.id] });
      setLogCallId(null);
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-white p-6 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 shadow-sm dark:bg-amber-950">
              <CalendarClock className="h-7 w-7 text-amber-600 dark:text-amber-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Follow-ups Hub</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Overdue, due today and next 7 days — reschedule or open the lead in one click.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Stat label="Overdue" value={counts.overdue} accent="text-rose-600" />
            <Stat label="Due today" value={counts.due_today} accent="text-amber-600" />
            <Stat label="Next 7 days" value={counts.upcoming} accent="text-blue-600" />
            <Button variant="outline" className="gap-1" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <TabBtn active={tab === "overdue"} onClick={() => setTab("overdue")} count={counts.overdue} danger>
          <AlertTriangle className="h-4 w-4" /> Overdue
        </TabBtn>
        <TabBtn active={tab === "due_today"} onClick={() => setTab("due_today")} count={counts.due_today}>
          <CalendarClock className="h-4 w-4" /> Due today
        </TabBtn>
        <TabBtn active={tab === "upcoming"} onClick={() => setTab("upcoming")} count={counts.upcoming}>
          <CalendarDays className="h-4 w-4" /> Upcoming
        </TabBtn>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <Card><p className="text-sm text-slate-400">Loading follow-ups…</p></Card>
        ) : !list.length ? (
          <Card>
            <p className="py-8 text-center text-sm text-slate-400">
              No {tab === "due_today" ? "follow-ups due today" : tab === "overdue" ? "overdue follow-ups" : "upcoming follow-ups"}
            </p>
          </Card>
        ) : list.map((lead) => (
          <Card key={lead.id} className="!p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/leads?lead=${lead.id}`} className="truncate text-base font-bold text-slate-900 hover:text-indigo-600 dark:text-slate-50">
                    {lead.merchant_name}
                  </Link>
                  <Badge status={lead.status} label={lead.status_display || lead.status} />
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{lead.merchant_city || "—"}</span>
                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{lead.merchant_mobile || "—"}</span>
                  <span>{lead.project_name}{lead.product_name ? ` · ${lead.product_name}` : ""}</span>
                  <span className={cn("font-semibold", tab === "overdue" ? "text-rose-600" : "text-slate-600")}>
                    Due {lead.follow_up_date}
                    {tab === "overdue" && lead.follow_up_date ? ` · ${daysLate(lead.follow_up_date)}d late` : ""}
                  </span>
                </p>
                {lead.notes && <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{lead.notes}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/leads?lead=${lead.id}`}>
                  <Button variant="outline" className="h-9 text-xs">Open</Button>
                </Link>
                <Button
                  variant="outline"
                  className="h-9 gap-1 text-xs"
                  onClick={() => {
                    setLogCallId(lead.id);
                    setRescheduleId(null);
                  }}
                >
                  <PhoneCall className="h-3.5 w-3.5" /> Log call
                </Button>
                <Button
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={() => {
                    setRescheduleId(lead.id);
                    setLogCallId(null);
                    setNextDate(today);
                    setNote("");
                  }}
                >
                  Reschedule
                </Button>
                <Button
                  className="h-9 gap-1 bg-emerald-600 text-xs hover:bg-emerald-700"
                  disabled={doneToday.isPending}
                  onClick={() => confirm("Mark as Order Confirmed?") && doneToday.mutate(lead)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                </Button>
              </div>
            </div>

            {logCallId === lead.id && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <LogCallForm
                  saving={logCall.isPending}
                  defaultFollowUpDate={lead.follow_up_date || today}
                  onCancel={() => setLogCallId(null)}
                  onSubmit={(data) => logCall.mutate({ id: lead.id, data })}
                />
              </div>
            )}

            {rescheduleId === lead.id && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Next follow-up</label>
                    <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Note</label>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    className="h-9 bg-indigo-600 text-xs hover:bg-indigo-700"
                    disabled={!nextDate || reschedule.isPending}
                    onClick={() => reschedule.mutate()}
                  >
                    {reschedule.isPending ? "Saving…" : "Save follow-up"}
                  </Button>
                  <Button variant="outline" className="h-9 text-xs" onClick={() => setRescheduleId(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function daysLate(dateStr: string) {
  const due = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - due.getTime()) / 86400000));
}

function TabBtn({
  active, onClick, children, count, danger,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count: number;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition",
        active
          ? danger
            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
            : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      )}
    >
      {children}
      <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-slate-100 dark:text-slate-900">
        {count}
      </span>
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className={cn("text-xl font-bold", accent || "text-slate-900")}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}
