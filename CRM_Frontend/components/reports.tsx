"use client";

import { DashboardFilters } from "@/components/dashboard-filters";
import { api, getProjectId, onProjectChange, type ReportFilters } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button, Card, MetricCard } from "@/components/ui";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, RefreshCw, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const STATUS_LABELS: Record<string, string> = {
  order_confirmed: "Confirmed",
  interested: "Interested",
  follow_up: "Follow Up",
  not_interested: "Not Interested",
  callback: "Callback",
};

export function ReportsPage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: api.teams,
    enabled: !!me && ["Admin", "Manager", "TL"].includes(me.role),
  });

  const [filters, setFilters] = useState<ReportFilters>(() => ({
    project: getProjectId() || undefined,
  }));
  const [exporting, setExporting] = useState(false);
  const [teamFilter, setTeamFilter] = useState("");

  useEffect(() => onProjectChange((id) => {
    setFilters((f) => ({ ...f, project: id || undefined }));
    setTeamFilter("");
  }), []);

  const queryFilters = useMemo(
    () => ({ ...filters, team: teamFilter || undefined }),
    [filters, teamFilter],
  );

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["reports-performance", queryFilters],
    queryFn: () => api.reportsPerformance(queryFilters),
  });

  const { data: products } = useQuery({
    queryKey: ["products", filters.project],
    queryFn: () => api.products(filters.project ? Number(filters.project) : undefined),
  });
  const { data: companies } = useQuery({
    queryKey: ["merchants", filters.project],
    queryFn: () => api.merchants(filters.project ? Number(filters.project) : undefined),
  });

  const disposition = useMemo(
    () =>
      (data?.disposition || []).map((d) => ({
        name: STATUS_LABELS[d.status] || d.status,
        count: d.count,
      })),
    [data],
  );

  const trend = useMemo(
    () =>
      (data?.weekly_trend || []).map((w) => ({
        week: w.week ? w.week.slice(5) : "—",
        leads: w.leads,
        confirmed: w.confirmed,
      })),
    [data],
  );

  const handleExport = async (fmt: "xlsx" | "pdf") => {
    setExporting(true);
    try {
      await api.exportLeads({
        product: filters.product,
        company: filters.company,
        format: fmt,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <BarChart3 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Performance Reports</h1>
              <p className="mt-1 text-sm text-slate-600">
                BDM leaderboard, conversion trends, and product breakdown for your scope.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Refresh
            </button>
            <Button variant="outline" className="gap-1 text-xs" disabled={exporting} onClick={() => handleExport("xlsx")}>
              <Download className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button variant="outline" className="gap-1 text-xs" disabled={exporting} onClick={() => handleExport("pdf")}>
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </div>
      </section>

      <DashboardFilters
        filters={filters}
        onChange={setFilters}
        projects={(projects || []).map((p) => ({ id: p.id, name: p.name }))}
        products={(products || []).map((p) => ({ id: p.id, name: p.name }))}
        companies={(companies || []).map((c) => ({ id: c.id, name: c.name, extra: c.city }))}
        showManager={false}
      />

      {me && ["Admin", "Manager", "TL"].includes(me.role) && (teams || []).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Team</span>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All teams</option>
            {(teams || []).map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.project_name})</option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <Card><p className="text-sm text-slate-400">Loading reports…</p></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Total Leads" value={data?.summary.total_leads ?? 0} icon={Users} />
            <MetricCard label="Confirmed" value={data?.summary.orders_confirmed ?? 0} icon={TrendingUp} variant="emerald" />
            <MetricCard label="Conversion" value={`${data?.summary.conversion_rate ?? 0}%`} icon={BarChart3} variant="violet" />
            <MetricCard label="Follow-ups Today" value={data?.summary.follow_ups_due_today ?? 0} icon={BarChart3} variant="amber" />
            <MetricCard label="Overdue" value={data?.summary.overdue_follow_ups ?? 0} icon={BarChart3} variant="blue" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 font-semibold text-slate-900">Weekly Trend (8 weeks)</h3>
              <div className="h-64">
                {trend.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-slate-400">No data in range</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="leads" stroke="#6366f1" strokeWidth={2} name="Leads" />
                      <Line type="monotone" dataKey="confirmed" stroke="#10b981" strokeWidth={2} name="Confirmed" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
            <Card>
              <h3 className="mb-4 font-semibold text-slate-900">Lead Disposition</h3>
              <div className="h-64">
                {disposition.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-slate-400">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={disposition} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <h3 className="font-semibold text-slate-900">BDM Leaderboard</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">BDM</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Leads</th>
                    <th className="px-4 py-3 text-right">Confirmed</th>
                    <th className="px-4 py-3 text-right">Conversion</th>
                    <th className="px-4 py-3">Month target</th>
                    <th className="px-4 py-3 text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.bdm_stats || []).length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No BDM data</td></tr>
                  ) : (
                    data!.bdm_stats.map((row, i) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {i < 3 && <span className="mr-1 text-amber-500">#{i + 1}</span>}
                          {row.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.role}</td>
                        <td className="px-4 py-3 text-right">{row.lead_count}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{row.confirmed}</td>
                        <td className="px-4 py-3 text-right">{row.conversion}%</td>
                        <td className="px-4 py-3">
                          {row.target_confirmed != null ? (
                            <div className="min-w-[120px]">
                              <div className="mb-0.5 flex justify-between text-[10px] text-slate-500">
                                <span>{row.actual_confirmed ?? 0}/{row.target_confirmed}</span>
                                <span>{row.confirmed_pct ?? 0}%</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-emerald-500"
                                  style={{ width: `${Math.min(100, row.confirmed_pct || 0)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No target</span>
                          )}
                        </td>
                        <td className={cn("px-4 py-3 text-right", row.overdue > 0 && "font-medium text-rose-600")}>
                          {row.overdue}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {(data?.top_products || []).length > 0 && (
            <Card>
              <h3 className="mb-4 font-semibold text-slate-900">Top Products</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data!.top_products.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.lead_count} leads · {p.confirmed_count} confirmed · {p.conversion}%
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
