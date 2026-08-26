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
  ClipboardCheck,
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
    refetchInterval: 20_000,
  });
  const { data: managers } = useQuery({ queryKey: ["admin-managers"], queryFn: api.adminManagers });
  const { data: drillData } = useQuery({
    queryKey: ["manager-drill", drillManager],
    queryFn: () => api.managerDashboard(drillManager!),
    enabled: !!drillManager,
  });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const { data: recentForms } = useQuery({
    queryKey: ["form-submissions-recent", filters.project || "all"],
    queryFn: () =>
      api.formSubmissionsRecent({
        project: filters.project ? Number(filters.project) : undefined,
        limit: 12,
      }),
    refetchInterval: 15_000,
  });
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
  const recentSubmissions =
    (stats?.recent_submissions || []).length > 0
      ? stats!.recent_submissions
      : recentForms?.results || [];
  const pendingVerifications = stats?.pending_verifications || [];

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* Command header */}
      <section className="rounded-xl border border-slate-700/80 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#0f172a_100%)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
              <Shield className="h-3 w-3" />
              Admin console
            </div>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
              Organization command center
            </h2>
            <p className="mt-1 max-w-xl text-xs text-slate-400 sm:text-sm">
              Cross-project control for users, forms, managers and org KPIs.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <QuickLink href="/admin/projects" icon={FolderKanban} label="Projects" primary />
            <QuickLink href="/admin/users" icon={UserCog} label="Users" />
            <QuickLink href="/admin/permissions" icon={Shield} label="Roles" />
            <QuickLink href="/admin/forms" icon={FileText} label="Forms" />
            <QuickLink href="/admin/audit" icon={ClipboardList} label="Audit" />
            <QuickLink href="/team" icon={Users} label="Teams" />
            <QuickLink href="/verification" icon={CheckCircle2} label="Verify" />
            <QuickLink href="/visits" icon={CalendarClock} label="Visits" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          <KpiTile href="/admin/projects" label="Projects" value={stats?.active_projects ?? "—"} loading={statsLoading} />
          <KpiTile href="/admin/users" label="Managers" value={managers?.length ?? "—"} loading={!managers} />
          <KpiTile href="/admin/users" label="BDMs" value={stats?.total_bdm ?? "—"} loading={statsLoading} />
          <KpiTile href="/leads" label="Leads" value={stats?.total_leads ?? "—"} loading={statsLoading} />
          <KpiTile href="/leads?status=order_confirmed" label="Confirmed" value={stats?.orders_confirmed ?? "—"} loading={statsLoading} accent="text-emerald-300" />
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
              <KpiTile href="/follow-ups" label="Follow-ups" value={stats?.follow_ups_due_today ?? "—"} loading={statsLoading} accent="text-amber-300" />
              <KpiTile href="/leads?overdue=1" label="Overdue" value={stats?.overdue_follow_ups ?? "—"} loading={statsLoading} accent="text-rose-300" />
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
          <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-3.5 sm:p-4">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Org scope</h3>
                <p className="text-[11px] text-slate-500">Default: all projects — narrow when needed</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  className="h-8 gap-1 border-slate-600 bg-slate-950 px-2.5 text-xs text-slate-200 hover:bg-slate-800"
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
                  className="h-8 gap-1 border-slate-600 bg-slate-950 px-2.5 text-xs text-slate-200 hover:bg-slate-800"
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
                  className="h-8 gap-1 border-slate-600 bg-slate-950 px-2.5 text-xs text-slate-200 hover:bg-slate-800"
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

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-4">
              {/* Managers */}
              <Panel title="Managers" subtitle="Drill into team performance" action={<Link href="/admin/users" className="text-xs font-semibold text-sky-300 hover:underline">Manage users</Link>}>
                {(managers || []).length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {managers!.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setDrillManager(m.id)}
                        className="group rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-left transition hover:border-sky-500/50 hover:bg-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 transition group-hover:bg-sky-500/25">
                            <UserCog className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-100">{m.name}</p>
                            <p className="text-[11px] text-slate-500">{m.role}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-sky-300" />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-slate-300">{m.lead_count} leads</span>
                          <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-400">{m.confirmed} conf.</span>
                          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-amber-400">{m.follow_ups_today} FUs</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyBlock text="No managers yet — create users in Admin → Users" />
                )}
              </Panel>

              {/* KPI grid */}
              <Panel title={`${scopeLabel} metrics`} subtitle="Live KPIs for the selected org scope">
                {statsLoading && !stats ? (
                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-lg bg-slate-800" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                    <MetricBox href="/admin/projects" icon={Building2} label="Projects" value={stats?.total_projects ?? 0} />
                    <MetricBox href="/leads" icon={Factory} label="Companies" value={stats?.total_companies ?? 0} />
                    <MetricBox href="/admin/projects" icon={FolderKanban} label="Products" value={stats?.total_products ?? 0} />
                    <MetricBox href="/leads" icon={Users} label="Total leads" value={stats?.total_leads ?? 0} />
                    <MetricBox href="/leads?status=order_confirmed" icon={CheckCircle2} label="Confirmed" value={stats?.orders_confirmed ?? 0} tone="emerald" />
                    <MetricBox icon={TrendingUp} label="Conversion" value={`${stats?.conversion_rate ?? 0}%`} tone="sky" />
                    <MetricBox href="/follow-ups" icon={CalendarClock} label="Follow-ups today" value={stats?.follow_ups_due_today ?? 0} tone="amber" />
                    <MetricBox href="/leads?overdue=1" icon={ClipboardList} label="Overdue" value={stats?.overdue_follow_ups ?? 0} tone="rose" />
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

              <div className={cn("grid gap-4", projectChart.length && disposition.length ? "md:grid-cols-2" : "")}>
                {!!projectChart.length && (
                  <Panel title="Leads by project" subtitle="Total vs confirmed" action={<Link href="/admin/projects" className="text-xs font-semibold text-sky-300 hover:underline">Open</Link>}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={projectChart} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #334155",
                            background: "#0f172a",
                            color: "#e2e8f0",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="leads" fill="#64748b" name="Total" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="confirmed" name="Confirmed" radius={[4, 4, 0, 0]}>
                          {projectChart.map((p, i) => (
                            <Cell key={i} fill={p.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Panel>
                )}

                {!!disposition.length && (
                  <Panel title="Disposition" subtitle="Lead status mix" action={<Link href="/pipeline" className="text-xs font-semibold text-sky-300 hover:underline">Pipeline</Link>}>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={disposition} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={70} paddingAngle={3}>
                          {disposition.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: 10,
                            border: "1px solid #334155",
                            background: "#0f172a",
                            color: "#e2e8f0",
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Panel>
                )}
              </div>

              <div className={cn("grid gap-4", companyStats.length && productStats.length ? "md:grid-cols-2" : "")}>
                {!!companyStats.length && (
                  <DataTable
                    title="Companies"
                    href="/leads"
                    headers={["Company", "City", "Leads", "Conf.", "Conv."]}
                    rows={companyStats.slice(0, 8).map((c) => [
                      <span key="n" className="font-medium text-slate-100">{c.name}</span>,
                      <span key="c" className="text-slate-400">{c.city || "—"}</span>,
                      c.lead_count,
                      <span key="ok" className="text-emerald-400">{c.confirmed_count}</span>,
                      `${c.conversion}%`,
                    ])}
                  />
                )}
                {!!productStats.length && (
                  <DataTable
                    title="Products"
                    href="/admin/projects"
                    headers={["Product", "Project", "Leads", "Conf."]}
                    rows={productStats.slice(0, 8).map((p) => [
                      <span key="n" className="font-medium text-slate-100">{p.name}</span>,
                      <span key="p" className="text-slate-400">{p.project_name || "—"}</span>,
                      p.lead_count,
                      <span key="ok" className="text-emerald-400">{p.confirmed_count}</span>,
                    ])}
                  />
                )}
              </div>

              <div className={cn("grid gap-4", projectStats.length && teamStats.length ? "md:grid-cols-2" : "")}>
                {!!projectStats.length && (
                  <DataTable
                    title="Project performance"
                    href="/admin/projects"
                    headers={["Project", "Leads", "Conf.", "Conv.", "Status"]}
                    rows={projectStats.map((p) => [
                      <Link key="n" href={`/admin/projects/${p.id}`} className="flex items-center gap-2 font-medium text-slate-100 hover:text-sky-300">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </Link>,
                      p.lead_count,
                      <span key="ok" className="text-emerald-400">{p.confirmed_count}</span>,
                      `${p.conversion}%`,
                      <Badge key="s" status={p.is_active ? "approved" : "rejected"} label={p.is_active ? "Active" : "Off"} />,
                    ])}
                  />
                )}
                {!!teamStats.length && (
                  <DataTable
                    title="BDM leaderboard"
                    href="/admin/users"
                    headers={["BDM", "Leads", "Confirmed"]}
                    rows={teamStats.map((u) => [
                      <span key="n" className="font-medium text-slate-100">{u.name}</span>,
                      u.lead_count,
                      <span key="ok" className="text-emerald-400">{u.confirmed}</span>,
                    ])}
                  />
                )}
              </div>
            </div>

            {/* Fixed-width activity rail — never stretches full screen */}
            <aside className="space-y-3 lg:sticky lg:top-24">
              <Link
                href="/visits"
                className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3 transition hover:border-sky-500/40 hover:bg-slate-900/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visits today</p>
                  <p className="text-2xl font-bold tabular-nums text-sky-300">{stats?.visits_scheduled_today ?? 0}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-600" />
              </Link>

              {(stats?.upcoming_team_visits || []).length > 0 && (
                <SideCard
                  title="Upcoming visits"
                  icon={ClipboardList}
                  badge={stats?.upcoming_team_visits?.length ?? 0}
                  actionHref="/visits"
                  actionLabel="All"
                >
                  <div className="max-h-52 space-y-1 overflow-y-auto">
                    {stats!.upcoming_team_visits.map((v) => (
                      <VisitRow key={v.id} visit={v} />
                    ))}
                  </div>
                </SideCard>
              )}

              {(pendingVerifications || []).length > 0 && (
                <SideCard
                  title="Needs verification"
                  icon={ClipboardCheck}
                  badge={pendingVerifications?.length}
                  actionHref="/verification"
                  actionLabel="Desk"
                >
                  <div className="max-h-64 space-y-1.5 overflow-y-auto">
                    {pendingVerifications.map((w) => (
                      <Link
                        key={w.id}
                        href={`/verification`}
                        className="block rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 transition hover:border-amber-400/50"
                      >
                        <p className="truncate text-[13px] font-semibold text-slate-100">{w.lead_name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {w.project_name || "—"} · {w.status_display || w.status}
                        </p>
                        {(w.answer_preview || []).length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {w.answer_preview!.slice(0, 3).map((a) => (
                              <p key={a.field_id} className="truncate text-[10px] text-slate-400">
                                <span className="font-medium text-slate-300">{a.label}:</span> {a.value}
                              </p>
                            ))}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </SideCard>
              )}

              {recentSubmissions.length > 0 && (
                <SideCard
                  title="Recent submissions"
                  icon={History}
                  badge={recentSubmissions.length}
                  actionHref="/leads"
                  actionLabel="Leads"
                >
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {recentSubmissions.map((s) => (
                      <Link
                        key={s.id}
                        href={(s as { verification_work_id?: number }).verification_work_id ? "/verification" : `/leads?lead=${s.lead}`}
                        className="group flex items-start gap-2 rounded-lg border border-slate-700/80 bg-slate-950/50 px-2.5 py-2 transition hover:border-sky-500/40 hover:bg-slate-950"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-slate-100 group-hover:text-sky-200">{s.lead_name}</p>
                          <p className="truncate text-[11px] text-slate-500">
                            {s.submitted_by_name}
                            {s.project_name ? ` · ${s.project_name}` : ""}
                            {s.answer_count ? ` · ${s.answer_count} fields` : ""}
                          </p>
                          {(s.answer_preview || []).length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {s.answer_preview!.slice(0, 3).map((a) => (
                                <p key={a.field_id} className="truncate text-[10px] text-slate-500">
                                  <span className="font-medium text-slate-400">{a.label}:</span> {a.value}
                                </p>
                              ))}
                            </div>
                          )}
                          <p className="mt-0.5 text-[10px] text-slate-600">{new Date(s.submitted_at).toLocaleString()}</p>
                        </div>
                        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-700 opacity-0 transition group-hover:opacity-100 group-hover:text-sky-300" />
                      </Link>
                    ))}
                  </div>
                </SideCard>
              )}
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
        "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition",
        primary
          ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
          : "border border-slate-600 bg-slate-950/40 text-slate-200 hover:border-sky-500/40 hover:bg-slate-900",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Link>
  );
}

function KpiTile({
  label,
  value,
  loading,
  accent,
  href,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
  accent?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-6 w-10 animate-pulse rounded bg-white/10" />
      ) : (
        <p className={cn("mt-0.5 text-lg font-bold tabular-nums text-white", accent)}>{value}</p>
      )}
    </>
  );
  const cls = "rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 transition hover:border-sky-400/30 hover:bg-white/10";
  if (href) {
    return (
      <Link href={href} className={cn(cls, "block")}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function MetricBox({
  icon: Icon,
  label,
  value,
  tone = "slate",
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone?: "slate" | "emerald" | "sky" | "amber" | "rose";
  href?: string;
}) {
  const tones = {
    slate: "text-slate-300 bg-slate-800",
    emerald: "text-emerald-300 bg-emerald-500/15",
    sky: "text-sky-300 bg-sky-500/15",
    amber: "text-amber-300 bg-amber-500/15",
    rose: "text-rose-300 bg-rose-500/15",
  };
  const inner = (
    <>
      <div className="flex items-center gap-1.5">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", tones[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-50">{value}</p>
    </>
  );
  const cls =
    "rounded-lg border border-slate-700 bg-slate-950/70 p-2.5 transition hover:border-sky-500/40 hover:bg-slate-950";
  if (href) {
    return (
      <Link href={href} className={cn(cls, "block")}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
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
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-3.5 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-100">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
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
  actionHref,
  actionLabel,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  children: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-500/15 text-sky-300">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className="flex-1 truncate text-xs font-bold text-slate-100">{title}</h3>
        {badge !== undefined && (
          <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">{badge}</span>
        )}
        {actionHref && (
          <Link href={actionHref} className="text-[10px] font-semibold text-sky-300 hover:underline">
            {actionLabel || "View"}
          </Link>
        )}
      </div>
      <div className="p-2.5">{children}</div>
    </div>
  );
}

function VisitRow({ visit }: { visit: LeadVisit }) {
  return (
    <Link
      href={`/leads?lead=${visit.lead}`}
      className="group block rounded-lg border border-slate-700/80 bg-slate-950/50 px-2.5 py-2 transition hover:border-sky-500/40 hover:bg-slate-950"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[13px] font-semibold text-slate-100 group-hover:text-sky-200">{visit.lead_name}</p>
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-700 opacity-0 transition group-hover:opacity-100 group-hover:text-sky-300" />
      </div>
      <p className="truncate text-[11px] text-slate-500">
        {visit.scheduled_date} · {visit.assigned_to_name}
      </p>
      <p className="truncate text-[10px] text-slate-600">
        {visit.merchant_city} · {visit.visit_type.replace("_", " ")}
      </p>
    </Link>
  );
}

function EmptyBlock({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-dashed border-slate-700 text-center text-xs text-slate-500", compact ? "px-2 py-2" : "px-3 py-4")}>
      {text}
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
  href,
}: {
  title: string;
  headers: string[];
  rows: React.ReactNode[][];
  href?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-700 px-3 py-2.5">
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
        {href && (
          <Link href={href} className="text-[11px] font-semibold text-sky-300 hover:underline">
            View all
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-800 transition hover:bg-slate-800/40">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-slate-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-3 py-4 text-center text-slate-500">
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
