"use client";

import { DashboardFilters, FilterSummaryBanner } from "@/components/dashboard-filters";
import { Badge, Button, Skeleton } from "@/components/ui";
import { api, type AdminFilters, type LeadVisit } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  Factory,
  FileText,
  FolderKanban,
  History,
  IndianRupee,
  Mail,
  Shield,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR } from "@/lib/form-fields";

const STATUS_LABELS: Record<string, string> = {
  order_confirmed: "Order Confirmed",
  interested: "Interested",
  follow_up: "Follow Up",
  not_interested: "Not Interested",
  callback: "Callback",
};

const COLORS = ["#38bdf8", "#34d399", "#fbbf24", "#a78bfa", "#fb7185"];

export function AdminPanel() {
  const [filters, setFilters] = useState<AdminFilters>({});
  const [drillManager, setDrillManager] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [digesting, setDigesting] = useState(false);
  const [digestMsg, setDigestMsg] = useState("");

  const { data: stats, isLoading: statsLoading, isError, refetch, isFetching } = useQuery({
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
    queryKey: ["products", filters.project || "all"],
    queryFn: () => api.products(filters.project ? Number(filters.project) : undefined),
  });
  const { data: companies } = useQuery({
    queryKey: ["merchants", filters.project || "all"],
    queryFn: () => api.merchants(filters.project ? Number(filters.project) : undefined),
  });

  const projectStats = stats?.project_stats || [];
  const companyStats = stats?.company_stats || [];
  const productStats = stats?.product_stats || [];
  const teamStats = stats?.team_stats || [];
  const disposition = useMemo(
    () =>
      (stats?.disposition || []).map((d) => ({
        name: STATUS_LABELS[d.status] || d.status,
        value: d.count,
      })),
    [stats?.disposition],
  );
  const projectChart = useMemo(
    () =>
      projectStats.map((p) => ({
        name: p.name,
        leads: p.lead_count,
        confirmed: p.confirmed_count,
        fill: p.color || "#64748b",
      })),
    [projectStats],
  );

  const scopeLabel = stats?.filter_summary?.project_name || (filters.project ? "Filtered" : "All projects");

  return (
    <div className="space-y-6">
      {/* Command header */}
      <section className="rounded-2xl border border-slate-700/80 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#0f172a_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">
              <Shield className="h-3.5 w-3.5" />
              Admin console
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Organization command center
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-400">
              Cross-project control for users, forms, managers and org KPIs — separate from field workdesks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickLink href="/admin/projects" icon={FolderKanban} label="Projects" primary />
            <QuickLink href="/admin/users" icon={UserCog} label="Users" />
            <QuickLink href="/admin/permissions" icon={Shield} label="Permissions" />
            <QuickLink href="/admin/forms" icon={FileText} label="Forms" />
            <QuickLink href="/admin/audit" icon={ClipboardList} label="Audit" />
            <QuickLink href="/team" icon={Users} label="Teams" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
          <KpiTile label="Projects" value={stats?.active_projects ?? "—"} loading={statsLoading} />
          <KpiTile label="Managers" value={managers?.length ?? "—"} loading={!managers} />
          <KpiTile label="BDMs" value={stats?.total_bdm ?? "—"} loading={statsLoading} />
          <KpiTile label="Leads" value={stats?.total_leads ?? "—"} loading={statsLoading} />
          <KpiTile label="Confirmed" value={stats?.orders_confirmed ?? "—"} loading={statsLoading} accent="text-emerald-300" />
          <KpiTile label="Conversion" value={stats ? `${stats.conversion_rate}%` : "—"} loading={statsLoading} accent="text-sky-300" />
          {stats?.money_metrics?.has_money ? (
            <>
              <KpiTile
                label="Pending ₹"
                value={formatINR(stats.money_metrics.total_pending)}
                loading={statsLoading}
                accent="text-amber-300"
              />
              <KpiTile
                label="Collected ₹"
                value={formatINR(stats.money_metrics.total_collection)}
                loading={statsLoading}
                accent="text-emerald-300"
              />
            </>
          ) : (
            <>
              <KpiTile label="Follow-ups" value={stats?.follow_ups_due_today ?? "—"} loading={statsLoading} accent="text-amber-300" />
              <KpiTile label="Overdue" value={stats?.overdue_follow_ups ?? "—"} loading={statsLoading} accent="text-rose-300" />
            </>
          )}
        </div>
      </section>

      {drillManager && drillData ? (
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <button
            type="button"
            onClick={() => setDrillManager(null)}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 hover:text-sky-200"
          >
            <ArrowLeft className="h-4 w-4" /> Back to org dashboard
          </button>
          <h3 className="text-lg font-bold text-white">
            {drillData.manager.first_name || drillData.manager.username}&apos;s team
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Leads" value={drillData.stats.total_leads} />
            <KpiTile label="Confirmed" value={drillData.stats.orders_confirmed} accent="text-emerald-300" />
            <KpiTile label="Follow-ups today" value={drillData.stats.follow_ups_due_today} accent="text-amber-300" />
            <KpiTile label="Conversion" value={`${drillData.stats.conversion_rate}%`} accent="text-sky-300" />
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 border-slate-600 bg-slate-950 text-slate-200 hover:bg-slate-800"
                  disabled={exporting || isFetching}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      await api.exportAdminReport(filters, "xlsx");
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Excel
                </Button>
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 border-slate-600 bg-slate-950 text-slate-200 hover:bg-slate-800"
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
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 border-slate-600 bg-slate-950 text-slate-200 hover:bg-slate-800"
                  disabled={digesting}
                  onClick={async () => {
                    setDigesting(true);
                    setDigestMsg("");
                    try {
                      const result = await api.sendDigest();
                      setDigestMsg(
                        `Digest sent to ${result.sent}` +
                          (result.skipped ? `, skipped ${result.skipped}` : "") +
                          (result.errors?.length ? `, ${result.errors.length} errors` : ""),
                      );
                    } catch (e) {
                      setDigestMsg(e instanceof Error ? e.message : "Digest failed");
                    } finally {
                      setDigesting(false);
                    }
                  }}
                >
                  <Mail className="h-3.5 w-3.5" /> Digest
                </Button>
              </div>
            </div>

            <DashboardFilters
              filters={filters}
              onChange={setFilters}
              allowAllProjects
              className="border-slate-700 bg-slate-950 shadow-none"
              projects={(projects || []).filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }))}
              products={(products || []).map((p) => ({ id: p.id, name: p.name, extra: p.project_name }))}
              companies={(companies || []).map((c) => ({ id: c.id, name: c.name, extra: c.city }))}
              managers={(managers || []).map((m) => ({ id: m.id, name: m.name }))}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <FilterSummaryBanner summary={stats?.filter_summary} />
              {digestMsg && <p className="text-sm text-slate-400">{digestMsg}</p>}
            </div>
          </section>

          {isError && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-6 text-center">
              <p className="font-semibold text-rose-300">Could not load admin dashboard</p>
              <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-semibold text-rose-200 underline">
                Retry
              </button>
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              {/* Managers */}
              <Panel title="Managers" subtitle="Drill into team performance" action={<Link href="/admin/users" className="text-xs font-semibold text-sky-300 hover:underline">Manage users</Link>}>
                {(managers || []).length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {managers!.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setDrillManager(m.id)}
                        className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-left transition hover:border-sky-500/40 hover:bg-slate-950"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
                            <UserCog className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-slate-100">{m.name}</p>
                            <p className="text-xs text-slate-500">{m.role}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          <span className="text-slate-400">{m.lead_count} leads</span>
                          <span className="font-semibold text-emerald-400">{m.confirmed} confirmed</span>
                          <span className="text-amber-400">{m.follow_ups_today} follow-ups</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock text="No managers yet — create users in Admin → Users" />
                )}
              </Panel>

              {/* KPI grid — never crash */}
              <Panel title={`${scopeLabel} metrics`} subtitle="Live KPIs for the selected org scope">
                {statsLoading && !stats ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl bg-slate-800" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricBox icon={Building2} label="Projects" value={stats?.total_projects ?? 0} />
                    <MetricBox icon={Factory} label="Companies" value={stats?.total_companies ?? 0} />
                    <MetricBox icon={FolderKanban} label="Products" value={stats?.total_products ?? 0} />
                    <MetricBox icon={Users} label="Total leads" value={stats?.total_leads ?? 0} />
                    <MetricBox icon={CheckCircle2} label="Confirmed" value={stats?.orders_confirmed ?? 0} tone="emerald" />
                    <MetricBox icon={TrendingUp} label="Conversion" value={`${stats?.conversion_rate ?? 0}%`} tone="sky" />
                    <MetricBox icon={CalendarClock} label="Follow-ups today" value={stats?.follow_ups_due_today ?? 0} tone="amber" />
                    <MetricBox icon={ClipboardList} label="Overdue" value={stats?.overdue_follow_ups ?? 0} tone="rose" />
                    {(stats?.money_metrics?.metrics || []).map((m) => (
                      <MetricBox
                        key={m.role}
                        icon={IndianRupee}
                        label={m.label}
                        value={formatINR(m.total)}
                        tone={m.role === "pending_amount" ? "amber" : m.role === "collection" ? "emerald" : "sky"}
                      />
                    ))}
                  </div>
                )}
              </Panel>

              <div className="grid gap-5 lg:grid-cols-2">
                <Panel title="Leads by project" subtitle="Total vs confirmed">
                  {projectChart.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={projectChart} barSize={22}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #334155",
                            background: "#0f172a",
                            color: "#e2e8f0",
                          }}
                        />
                        <Bar dataKey="leads" fill="#64748b" name="Total" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="confirmed" name="Confirmed" radius={[6, 6, 0, 0]}>
                          {projectChart.map((p, i) => (
                            <Cell key={i} fill={p.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyBlock text="No project lead data" />
                  )}
                </Panel>

                <Panel title="Disposition" subtitle="Lead status mix">
                  {disposition.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={disposition} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3}>
                          {disposition.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #334155",
                            background: "#0f172a",
                            color: "#e2e8f0",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyBlock text="No disposition data" />
                  )}
                </Panel>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <DataTable
                  title="Companies"
                  headers={["Company", "City", "Leads", "Conf.", "Conv."]}
                  rows={companyStats.map((c) => [
                    <span key="n" className="font-medium text-slate-100">{c.name}</span>,
                    <span key="c" className="text-slate-400">{c.city || "—"}</span>,
                    c.lead_count,
                    <span key="ok" className="text-emerald-400">{c.confirmed_count}</span>,
                    `${c.conversion}%`,
                  ])}
                />
                <DataTable
                  title="Products"
                  headers={["Product", "Project", "Leads", "Conf."]}
                  rows={productStats.slice(0, 12).map((p) => [
                    <span key="n" className="font-medium text-slate-100">{p.name}</span>,
                    <span key="p" className="text-slate-400">{p.project_name || "—"}</span>,
                    p.lead_count,
                    <span key="ok" className="text-emerald-400">{p.confirmed_count}</span>,
                  ])}
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <DataTable
                  title="Project performance"
                  headers={["Project", "Leads", "Conf.", "Conv.", "Status"]}
                  rows={projectStats.map((p) => [
                    <span key="n" className="flex items-center gap-2 font-medium text-slate-100">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>,
                    p.lead_count,
                    <span key="ok" className="text-emerald-400">{p.confirmed_count}</span>,
                    `${p.conversion}%`,
                    <Badge key="s" status={p.is_active ? "approved" : "rejected"} label={p.is_active ? "Active" : "Off"} />,
                  ])}
                />
                <DataTable
                  title="BDM leaderboard"
                  headers={["BDM", "Leads", "Confirmed"]}
                  rows={teamStats.map((u) => [
                    <span key="n" className="font-medium text-slate-100">{u.name}</span>,
                    u.lead_count,
                    <span key="ok" className="text-emerald-400">{u.confirmed}</span>,
                  ])}
                />
              </div>
            </div>

            <aside className="space-y-4">
              <SideCard title="Visits today" icon={CalendarClock} badge={stats?.visits_scheduled_today ?? 0}>
                <p className="text-4xl font-bold text-sky-300">{stats?.visits_scheduled_today ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">Across all BDMs & projects</p>
              </SideCard>

              <SideCard title="Upcoming visits" icon={ClipboardList} badge={stats?.upcoming_team_visits?.length ?? 0}>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {(stats?.upcoming_team_visits || []).length ? (
                    stats!.upcoming_team_visits.map((v) => <VisitRow key={v.id} visit={v} />)
                  ) : (
                    <EmptyBlock text="No upcoming visits" compact />
                  )}
                </div>
              </SideCard>

              <SideCard title="Recent submissions" icon={History}>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {(stats?.recent_submissions || []).length ? (
                    stats!.recent_submissions.map((s) => (
                      <div key={s.id} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2.5">
                        <p className="truncate text-sm font-semibold text-slate-100">{s.lead_name}</p>
                        <p className="text-xs text-slate-500">{s.submitted_by_name}</p>
                        <p className="mt-0.5 text-[10px] text-slate-600">{new Date(s.submitted_at).toLocaleString()}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyBlock text="No submissions yet" compact />
                  )}
                </div>
              </SideCard>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition",
        primary
          ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
          : "border border-slate-600 bg-slate-950/40 text-slate-200 hover:border-slate-500 hover:bg-slate-900",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

function KpiTile({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-12 animate-pulse rounded bg-white/10" />
      ) : (
        <p className={cn("mt-1 text-xl font-bold text-white", accent)}>{value}</p>
      )}
    </div>
  );
}

function MetricBox({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "slate" | "emerald" | "sky" | "amber" | "rose";
}) {
  const tones = {
    slate: "text-slate-300 bg-slate-800",
    emerald: "text-emerald-300 bg-emerald-500/15",
    sky: "text-sky-300 bg-sky-500/15",
    amber: "text-amber-300 bg-amber-500/15",
    rose: "text-rose-300 bg-rose-500/15",
  };
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3.5">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-50">{value}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SideCard({
  title,
  icon: Icon,
  badge,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="flex-1 text-sm font-bold text-slate-100">{title}</h3>
        {badge !== undefined && (
          <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[11px] font-bold text-slate-950">{badge}</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function VisitRow({ visit }: { visit: LeadVisit }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2.5">
      <p className="text-sm font-semibold text-slate-100">{visit.lead_name}</p>
      <p className="text-xs text-slate-500">
        {visit.scheduled_date} · {visit.assigned_to_name}
      </p>
      <p className="text-[10px] text-slate-600">
        {visit.merchant_city} · {visit.visit_type.replace("_", " ")}
      </p>
    </div>
  );
}

function EmptyBlock({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-dashed border-slate-700 text-center text-sm text-slate-500", compact ? "px-3 py-6" : "px-4 py-10")}>
      {text}
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
      <div className="border-b border-slate-700 px-4 py-3">
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2.5 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-800">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2.5 text-slate-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center text-slate-500">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
