"use client";

import { DashboardFilters, FilterSummaryBanner } from "@/components/dashboard-filters";
import { Badge, Button, Card, MetricCard, Skeleton } from "@/components/ui";
import { api, onProjectChange, setProjectId, type AdminFilters, type LeadVisit } from "@/lib/api";
import { useLivePulse } from "@/components/live-sync";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  Factory,
  FolderKanban,
  History,
  Mail,
  Shield,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  order_confirmed: "Order Confirmed",
  interested: "Interested",
  follow_up: "Follow Up",
  not_interested: "Not Interested",
  callback: "Callback",
};

const COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#f43f5e"];

export function AdminPanel() {
  const { pulse } = useLivePulse();
  const [filters, setFilters] = useState<AdminFilters>({});
  const [drillManager, setDrillManager] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [digesting, setDigesting] = useState(false);
  const [digestMsg, setDigestMsg] = useState("");

  useEffect(() => {
    return onProjectChange((id) => {
      setFilters((f) => (f.project === id ? f : { ...f, project: id, product: "", company: "" }));
    });
  }, []);

  const onFiltersChange = (next: AdminFilters) => {
    if (next.project && next.project !== filters.project) {
      setProjectId(next.project);
    }
    setFilters(next);
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-dashboard", filters],
    queryFn: () => api.adminDashboard(filters),
  });
  const { data: managers } = useQuery({ queryKey: ["admin-managers"], queryFn: api.adminManagers });
  const { data: drillData } = useQuery({
    queryKey: ["manager-drill", drillManager],
    queryFn: () => api.managerDashboard(drillManager!),
    enabled: !!drillManager,
  });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const { data: products } = useQuery({
    queryKey: ["products", filters.project],
    queryFn: () => api.products(filters.project ? Number(filters.project) : undefined),
  });
  const { data: companies } = useQuery({
    queryKey: ["merchants", filters.project],
    queryFn: () => api.merchants(filters.project ? Number(filters.project) : undefined),
  });

  const isFiltered = !!(filters.project || filters.product || filters.company || filters.manager || filters.from || filters.to);
  const metricsTitle = isFiltered
    ? stats?.filter_summary?.project_name
      ? `${stats.filter_summary.project_name} Metrics`
      : "Filtered Metrics"
    : "Organization Metrics";
  const metricsSubtitle = isFiltered
    ? "KPIs based on your active filters"
    : "System-wide KPIs across all projects";

  const disposition = (stats?.disposition || []).map((d) => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count,
  }));

  const projectChart = (stats?.project_stats || []).map((p) => ({
    name: p.name,
    leads: p.lead_count,
    confirmed: p.confirmed_count,
    fill: p.color,
  }));

  return (
    <div className="space-y-8">
      {/* Admin hero */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Shield className="h-3.5 w-3.5 text-indigo-300" />
              Admin Control Center
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Organization Overview</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Monitor all projects, managers, field teams, visits and conversions across the CRM.
            </p>
          </div>
          {stats && (
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <AdminHeroStat label="Projects" value={stats.active_projects} />
              <AdminHeroStat label="Companies" value={stats.total_companies ?? 0} />
              <AdminHeroStat label="Conversion" value={`${stats.conversion_rate}%`} />
            </div>
          )}
        </div>
      </section>

      {drillManager && drillData && (
        <Card>
          <button onClick={() => setDrillManager(null)} className="mb-4 flex items-center gap-2 text-sm font-medium text-indigo-600">
            <ArrowLeft className="h-4 w-4" /> Back to all managers
          </button>
          <h3 className="text-lg font-bold">{drillData.manager.first_name || drillData.manager.username}&apos;s Team</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <MetricCard label="Total Leads" value={drillData.stats.total_leads} icon={Users} variant="slate" />
            <MetricCard label="Confirmed" value={drillData.stats.orders_confirmed} icon={CheckCircle2} variant="emerald" accent="text-emerald-700" />
            <MetricCard label="Follow-ups Today" value={drillData.stats.follow_ups_due_today} icon={CalendarClock} variant="amber" accent="text-amber-700" />
            <MetricCard label="Conversion" value={`${drillData.stats.conversion_rate}%`} icon={TrendingUp} variant="blue" accent="text-blue-700" />
          </div>
        </Card>
      )}

      {!drillManager && (
        <>
          <DashboardFilters
            filters={filters}
            onChange={onFiltersChange}
            projects={(projects || []).filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }))}
            products={(products || []).map((p) => ({ id: p.id, name: p.name, extra: p.project_name }))}
            companies={(companies || []).map((c) => ({ id: c.id, name: c.name, extra: c.city }))}
            managers={(managers || []).map((m) => ({ id: m.id, name: m.name }))}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterSummaryBanner summary={stats?.filter_summary} />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await api.exportAdminReport(filters, "xlsx");
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download className="h-4 w-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await api.exportAdminReport(filters, "pdf");
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download className="h-4 w-4" />
                {exporting ? "Exporting..." : "PDF Report"}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={digesting}
                onClick={async () => {
                  setDigesting(true);
                  setDigestMsg("");
                  try {
                    const result = await api.sendDigest();
                    setDigestMsg(
                      `Digest sent to ${result.sent} user(s)` +
                        (result.skipped ? `, skipped ${result.skipped}` : "") +
                        (result.errors?.length ? `, ${result.errors.length} error(s)` : "")
                    );
                  } catch (e) {
                    setDigestMsg(e instanceof Error ? e.message : "Digest failed");
                  } finally {
                    setDigesting(false);
                  }
                }}
              >
                <Mail className="h-4 w-4" />
                {digesting ? "Sending..." : "Send Email Digest"}
              </Button>
            </div>
            {digestMsg && <p className="w-full text-sm text-slate-600">{digestMsg}</p>}
          </div>

          <div className="grid gap-8 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              {managers && managers.length > 0 && (
                <section>
                  <SectionHeading title="Managers" subtitle="Click a manager to drill into team performance" />
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {managers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setDrillManager(m.id)}
                        className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                            <UserCog className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{m.name}</h4>
                            <p className="text-xs text-slate-500">{m.role}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-4 text-sm">
                          <span className="text-slate-600">{m.lead_count} leads</span>
                          <span className="font-medium text-emerald-600">{m.confirmed} confirmed</span>
                          <span className="text-amber-600">{m.follow_ups_today} follow-ups</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {statsLoading || !stats ? (
                <Skeleton className="h-48 rounded-2xl" />
              ) : (
                <>
                  <section>
                    <SectionHeading title={metricsTitle} subtitle={metricsSubtitle} />
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricCard label="Total Projects" value={stats.total_projects} icon={Building2} variant="blue" accent="text-blue-700" pulse={pulse} />
                      <MetricCard label="Companies" value={stats.total_companies ?? 0} icon={Factory} variant="slate" pulse={pulse} />
                      <MetricCard label="Products" value={stats.total_products ?? 0} icon={FolderKanban} variant="violet" accent="text-violet-700" pulse={pulse} />
                      <MetricCard label="Total Leads" value={stats.total_leads} icon={Users} variant="slate" pulse={pulse} />
                      <MetricCard label="Orders Confirmed" value={stats.orders_confirmed} icon={CheckCircle2} variant="emerald" accent="text-emerald-700" pulse={pulse} />
                      <MetricCard label="Conversion Rate" value={`${stats.conversion_rate}%`} icon={TrendingUp} variant="violet" accent="text-violet-700" pulse={pulse} />
                      <MetricCard label="Follow-ups Today" value={stats.follow_ups_due_today} icon={CalendarClock} variant="amber" accent="text-amber-700" pulse={pulse} />
                      <MetricCard label="Overdue Follow-ups" value={stats.overdue_follow_ups ?? 0} icon={ClipboardList} variant="slate" accent="text-rose-600" pulse={pulse} />
                    </div>
                  </section>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <DataTable
                      title="Companies (Merchants)"
                      icon={Factory}
                      headers={["Company", "City", "Leads", "Confirmed", "Conv."]}
                      rows={(stats.company_stats || []).map((c) => [
                        <span key="n" className="font-medium text-slate-900">{c.name}</span>,
                        c.city || "—",
                        c.lead_count,
                        <span key="c" className="text-emerald-600">{c.confirmed_count}</span>,
                        `${c.conversion}%`,
                      ])}
                      emptyText="No companies in this filter"
                    />
                    <DataTable
                      title="Products"
                      icon={FolderKanban}
                      headers={["Product", "Project", "Leads", "Confirmed", "Conv."]}
                      rows={(stats.product_stats || []).map((p) => [
                        <span key="n" className="font-medium text-slate-900">{p.name}</span>,
                        p.project_name || "—",
                        p.lead_count,
                        <span key="c" className="text-emerald-600">{p.confirmed_count}</span>,
                        `${p.conversion}%`,
                      ])}
                      emptyText="No products in this filter"
                    />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <ChartCard title="Leads by Project" subtitle="Total vs confirmed per project">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={projectChart} barSize={24}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                          <Bar dataKey="leads" fill="#94a3b8" name="Total Leads" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="confirmed" name="Confirmed" radius={[6, 6, 0, 0]}>
                            {projectChart.map((p, i) => <Cell key={i} fill={p.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard title="Overall Disposition" subtitle="Lead status distribution">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie data={disposition} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                            {disposition.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <DataTable
                      title="Project Performance"
                      icon={FolderKanban}
                      headers={["Project", "Leads", "Confirmed", "Conv.", "Status"]}
                      rows={stats.project_stats.map((p) => [
                        <span key="n" className="flex items-center gap-2 font-medium">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </span>,
                        p.lead_count,
                        <span key="c" className="text-emerald-600">{p.confirmed_count}</span>,
                        `${p.conversion}%`,
                        <Badge key="s" status={p.is_active ? "approved" : "rejected"} label={p.is_active ? "Active" : "Inactive"} />,
                      ])}
                    />
                    <DataTable
                      title="BDM Leaderboard"
                      icon={Users}
                      headers={["BDM", "Leads", "Confirmed"]}
                      rows={stats.team_stats.map((u) => [
                        <span key="n" className="font-medium">{u.name}</span>,
                        u.lead_count,
                        <span key="c" className="text-emerald-600">{u.confirmed}</span>,
                      ])}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Admin sidebar — team ops, NOT personal visits */}
            <div className="space-y-5">
              <AdminPanelCard title="Team Visits Today" icon={CalendarClock} badge={stats?.visits_scheduled_today}>
                {stats?.visits_scheduled_today ? (
                  <p className="text-3xl font-bold text-indigo-700">{stats.visits_scheduled_today}</p>
                ) : (
                  <EmptyMini icon={CalendarClock} text="No team visits scheduled today" />
                )}
                <p className="mt-2 text-xs text-slate-500">Across all BDMs and projects</p>
              </AdminPanelCard>

              <AdminPanelCard title="Upcoming Team Visits" icon={ClipboardList} badge={stats?.upcoming_team_visits?.length ?? 0}>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {stats?.upcoming_team_visits?.length ? stats.upcoming_team_visits.map((v) => (
                    <TeamVisitRow key={v.id} visit={v} />
                  )) : <EmptyMini icon={ClipboardList} text="No scheduled team visits" />}
                </div>
              </AdminPanelCard>

              <AdminPanelCard title="Recent Submissions" icon={History}>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {stats?.recent_submissions?.length ? stats.recent_submissions.map((s) => (
                    <div key={s.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <p className="text-sm font-semibold text-slate-900">{s.lead_name}</p>
                      <p className="text-xs text-slate-500">{s.submitted_by_name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{new Date(s.submitted_at).toLocaleString()}</p>
                    </div>
                  )) : <EmptyMini icon={History} text="No submissions yet" />}
                </div>
              </AdminPanelCard>

              <div className="grid grid-cols-2 gap-3">
                <Link href="/admin/projects" className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-md hover:bg-indigo-700">
                  <FolderKanban className="h-4 w-4" />
                  Projects
                </Link>
                <Link href="/admin/forms" className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <ClipboardList className="h-4 w-4 text-indigo-600" />
                  Forms
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

function AdminHeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 text-center ring-1 ring-white/20 backdrop-blur">
      <p className="text-xl font-bold sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">{label}</p>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

function AdminPanelCard({
  title, icon: Icon, badge, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-white px-4 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100">
          <Icon className="h-4 w-4 text-indigo-600" />
        </div>
        <h3 className="flex-1 text-sm font-bold text-slate-800">{title}</h3>
        {badge !== undefined && (
          <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-bold text-white">{badge}</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function TeamVisitRow({ visit }: { visit: LeadVisit }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-3">
      <p className="text-sm font-semibold text-slate-900">{visit.lead_name}</p>
      <p className="text-xs text-slate-500">{visit.scheduled_date} · {visit.assigned_to_name}</p>
      <p className="text-[10px] text-slate-400">{visit.merchant_city} · {visit.visit_type.replace("_", " ")}</p>
    </div>
  );
}

function EmptyMini({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center py-5 text-center">
      <Icon className="h-8 w-8 text-slate-200" />
      <p className="mt-2 text-sm text-slate-400">{text}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DataTable({
  title, icon: Icon, headers, rows, emptyText,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  headers: string[];
  rows: React.ReactNode[][];
  emptyText?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <Icon className="h-4 w-4 text-indigo-600" />
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{headers.map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100">
                {row.map((cell, j) => <td key={j} className="px-5 py-3">{cell}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={headers.length} className="px-5 py-8 text-center text-slate-400">{emptyText || "No data"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
