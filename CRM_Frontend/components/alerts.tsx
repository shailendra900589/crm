"use client";

import { Badge, Button, Card } from "@/components/ui";
import { api, getProjectId, onProjectChange } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Copy,
  Crosshair,
  FileWarning,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AlertSection = "overdue" | "due_today" | "documents" | "visits" | "targets" | "team";

export function AlertsPage() {
  const [projectId, setProjectId] = useState(() => getProjectId() || "");
  const [section, setSection] = useState<AlertSection>("overdue");

  useEffect(() => onProjectChange((id) => setProjectId(id)), []);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["alerts", projectId],
    queryFn: () => api.alertsHub(projectId || undefined),
  });

  const counts = useMemo(
    () =>
      data?.counts || {
        overdue_follow_ups: 0,
        due_today: 0,
        pending_documents: 0,
        missed_visits: 0,
        targets_at_risk: 0,
        duplicate_groups: 0,
      },
    [data?.counts],
  );

  const totalAlerts = useMemo(
    () =>
      counts.overdue_follow_ups +
      counts.due_today +
      counts.pending_documents +
      counts.missed_visits +
      counts.targets_at_risk,
    [counts],
  );

  const showTeam = !!me && me.role !== "BDM";
  const tabs: { key: AlertSection; label: string; count: number; icon: typeof AlertTriangle }[] = [
    { key: "overdue", label: "Overdue", count: counts.overdue_follow_ups, icon: AlertTriangle },
    { key: "due_today", label: "Due today", count: counts.due_today, icon: CalendarClock },
    { key: "documents", label: "Pending docs", count: counts.pending_documents, icon: FileWarning },
    { key: "visits", label: "Missed visits", count: counts.missed_visits, icon: MapPin },
    { key: "targets", label: "Targets at risk", count: counts.targets_at_risk, icon: Crosshair },
  ];
  if (showTeam) {
    tabs.push({ key: "team", label: "Team overdue", count: data?.team_overdue?.length || 0, icon: Users });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <BellRing className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Ops Alerts</h1>
              <p className="mt-1 text-sm text-slate-600">
                Action items across follow-ups, documents, visits, and sales targets in your scope.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {counts.duplicate_groups > 0 && (
              <Link
                href="/duplicates"
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
              >
                <Copy className="h-3.5 w-3.5" />
                {counts.duplicate_groups} duplicate group{counts.duplicate_groups !== 1 ? "s" : ""}
              </Link>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-amber-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total actionable", value: totalAlerts, tone: "text-amber-700 bg-amber-50 border-amber-200" },
            { label: "Overdue", value: counts.overdue_follow_ups, tone: "text-rose-700 bg-rose-50 border-rose-200" },
            { label: "Due today", value: counts.due_today, tone: "text-blue-700 bg-blue-50 border-blue-200" },
            { label: "Pending docs", value: counts.pending_documents, tone: "text-violet-700 bg-violet-50 border-violet-200" },
            { label: "Missed visits", value: counts.missed_visits, tone: "text-orange-700 bg-orange-50 border-orange-200" },
          ].map((kpi) => (
            <div key={kpi.label} className={cn("rounded-2xl border px-4 py-3", kpi.tone)}>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="text-xs uppercase tracking-wide opacity-80">{kpi.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSection(tab.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
                section === tab.key
                  ? "border-amber-300 bg-amber-100 text-amber-900"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  tab.count > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500",
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading alerts…</div>
        ) : section === "overdue" ? (
          <AlertLeadList leads={data?.overdue_follow_ups || []} empty="No overdue follow-ups — great job!" />
        ) : section === "due_today" ? (
          <AlertLeadList leads={data?.due_today || []} empty="Nothing due today." />
        ) : section === "documents" ? (
          <DocumentList items={data?.pending_documents || []} />
        ) : section === "visits" ? (
          <VisitList visits={data?.missed_visits || []} />
        ) : section === "targets" ? (
          <TargetList items={data?.targets_at_risk || []} />
        ) : (
          <TeamOverdueList items={data?.team_overdue || []} />
        )}
      </Card>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/follow-ups">
          <Button variant="outline">Open Follow-ups</Button>
        </Link>
        <Link href="/targets">
          <Button variant="outline">Open Targets</Button>
        </Link>
        <Link href="/visits">
          <Button variant="outline">Open Visits</Button>
        </Link>
      </div>
    </div>
  );
}

function AlertLeadList({ leads, empty }: { leads: { id: number; merchant_name: string; project_name: string; bdm_name: string; follow_up_date?: string | null; status: string; status_display?: string }[]; empty: string }) {
  if (!leads.length) {
    return <EmptyState message={empty} />;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {leads.map((lead) => (
        <li key={lead.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
          <div>
            <Link href={`/leads?lead=${lead.id}`} className="font-medium text-indigo-700 hover:underline">
              {lead.merchant_name}
            </Link>
            <p className="text-xs text-slate-500">
              {lead.project_name} · {lead.bdm_name}
              {lead.follow_up_date ? ` · due ${lead.follow_up_date}` : ""}
            </p>
          </div>
          <Badge status={lead.status} label={lead.status_display || lead.status.replace(/_/g, " ")} />
        </li>
      ))}
    </ul>
  );
}

function DocumentList({ items }: { items: { id: number; lead_id: number; merchant_name: string; project_name: string; bdm_name: string; uploaded_at: string }[] }) {
  if (!items.length) {
    return <EmptyState message="No documents awaiting verification." />;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((doc) => (
        <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
          <div>
            <Link href={`/leads?lead=${doc.lead_id}`} className="font-medium text-indigo-700 hover:underline">
              {doc.merchant_name}
            </Link>
            <p className="text-xs text-slate-500">
              {doc.project_name} · {doc.bdm_name} · uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
            </p>
          </div>
          <Badge status="pending" label="Pending review" />
        </li>
      ))}
    </ul>
  );
}

function VisitList({ visits }: { visits: { id: number; lead: number; lead_name: string; project_name: string; assigned_to_name: string; scheduled_date: string; status: string }[] }) {
  if (!visits.length) {
    return <EmptyState message="No missed or overdue visits in the last 14 days." />;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {visits.map((visit) => (
        <li key={visit.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
          <div>
            <Link href={`/leads?lead=${visit.lead}`} className="font-medium text-indigo-700 hover:underline">
              {visit.lead_name}
            </Link>
            <p className="text-xs text-slate-500">
              {visit.project_name} · {visit.assigned_to_name} · scheduled {visit.scheduled_date}
            </p>
          </div>
          <Badge status="rejected" label={visit.status} />
        </li>
      ))}
    </ul>
  );
}

function TargetList({ items }: { items: { user_name: string; project_name: string; target_confirmed: number; actual_confirmed: number; confirmed_pct: number }[] }) {
  if (!items.length) {
    return <EmptyState message="All targets on track this month." />;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((row) => (
        <li key={`${row.user_name}-${row.project_name}`} className="px-4 py-3 hover:bg-slate-50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{row.user_name}</p>
              <p className="text-xs text-slate-500">{row.project_name}</p>
            </div>
            <p className="text-sm text-slate-600">
              {row.actual_confirmed} / {row.target_confirmed} confirmed
              <span className="ml-2 font-semibold text-rose-600">{row.confirmed_pct}%</span>
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-rose-500"
              style={{ width: `${Math.min(row.confirmed_pct, 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TeamOverdueList({ items }: { items: { bdm_id: number; name: string; username: string; overdue: number }[] }) {
  if (!items.length) {
    return <EmptyState message="No team members with overdue follow-ups." />;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((row) => (
        <li key={row.bdm_id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            <p className="text-xs text-slate-500">@{row.username}</p>
          </div>
          <Badge status="rejected" label={`${row.overdue} overdue`} />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CalendarClock className="h-6 w-6" />
      </div>
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  );
}
