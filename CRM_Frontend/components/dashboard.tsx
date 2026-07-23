"use client";

import { DashboardFilters, FilterSummaryBanner } from "@/components/dashboard-filters";
import { DynamicForm, FormLabel, formTextareaCls } from "@/components/dynamic-form";
import { SearchableSelect } from "@/components/searchable-select";
import { api, getProjectId, onProjectChange, setProjectId, type DashboardFilters as DashboardFilterState, type LeadVisit, type RevisitLead } from "@/lib/api";
import { useLivePulse } from "@/components/live-sync";
import { cn } from "@/lib/utils";
import { Button, Input, MetricCard, Skeleton } from "@/components/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  FileText,
  History,
  MapPin,
  Phone,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#f43f5e"];
const STATUS_LABELS: Record<string, string> = {
  order_confirmed: "Order Confirmed", interested: "Interested", follow_up: "Follow Up",
  not_interested: "Not Interested", callback: "Callback",
};

export function DashboardView() {
  const { pulse } = useLivePulse();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const [filters, setFilters] = useState<DashboardFilterState>(() => ({
    project: getProjectId() || undefined,
  }));
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", filters],
    queryFn: () => api.dashboard(filters),
  });
  const { data: products } = useQuery({
    queryKey: ["products", filters.project],
    queryFn: () => api.products(filters.project ? Number(filters.project) : undefined),
  });
  const { data: companies } = useQuery({
    queryKey: ["merchants", filters.project],
    queryFn: () => api.merchants(filters.project ? Number(filters.project) : undefined),
  });
  const { data: myLeads } = useQuery({
    queryKey: ["leads", "workdesk"],
    queryFn: () => api.leads({ page: 1 }),
  });

  const [selectedLead, setSelectedLead] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [remarks, setRemarks] = useState("");
  const [assignLead, setAssignLead] = useState<RevisitLead | null>(null);
  const [activeVisit, setActiveVisit] = useState<LeadVisit | null>(null);
  const [visitModalFormData, setVisitModalFormData] = useState<Record<string, unknown>>({});
  const [visitModalRemarks, setVisitModalRemarks] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitRemarks, setVisitRemarks] = useState("");
  const [assignTo, setAssignTo] = useState("");

  const { data: modalLead } = useQuery({
    queryKey: ["lead", activeVisit?.lead],
    queryFn: () => api.lead(activeVisit!.lead),
    enabled: !!activeVisit,
  });

  const isSupervisor = me && ["Admin", "Manager", "TL"].includes(me.role);
  const leads = useMemo(() => myLeads?.results || [], [myLeads?.results]);
  const [activeProjectId, setActiveProjectId] = useState(() => getProjectId() || "");
  const currentProject = useMemo(
    () => projects?.find((p) => String(p.id) === (filters.project || activeProjectId)),
    [projects, filters.project, activeProjectId]
  );
  const selectedLeadInfo = useMemo(
    () => leads.find((l) => l.id === selectedLead),
    [leads, selectedLead]
  );
  const leadOptions = useMemo(
    () =>
      leads.map((l) => ({
        value: String(l.id),
        label: `${l.merchant_name} — ${l.merchant_city}`,
        description: `Lead #${l.id}`,
      })),
    [leads]
  );

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    []
  );

  // Keep filters in sync when project is switched from header / elsewhere — do NOT
  // force-reset when the user changes the filter (that was blocking other projects).
  useEffect(() => {
    return onProjectChange((id) => {
      setActiveProjectId(id);
      setFilters((f) => (f.project === id ? f : { ...f, project: id, product: "", company: "" }));
    });
  }, []);

  const onFiltersChange = (next: DashboardFilterState) => {
    const pid = next.project || getProjectId() || "";
    // Hierarchy users always stay scoped to an active project
    const scoped = { ...next, project: pid || next.project };
    if (scoped.project && scoped.project !== filters.project) {
      setProjectId(scoped.project);
      setActiveProjectId(scoped.project);
    }
    setFilters(scoped);
  };

  useEffect(() => {
    if (leads.length && !selectedLead) setSelectedLead(leads[0].id);
  }, [leads, selectedLead]);

  useEffect(() => {
    if (modalLead?.custom_data) {
      setVisitModalFormData(modalLead.custom_data as Record<string, unknown>);
    } else {
      setVisitModalFormData({});
    }
  }, [modalLead]);

  useEffect(() => {
    if (activeVisit) setVisitModalRemarks("");
  }, [activeVisit]);

  useEffect(() => {
    const lead = leads.find((l) => l.id === selectedLead);
    if (lead?.custom_data) setFormData(lead.custom_data as Record<string, unknown>);
    else setFormData({});
  }, [selectedLead, leads]);

  const submitForm = useMutation({
    mutationFn: () =>
      api.submitForm(selectedLead!, formData, {
        visit_id: data?.upcoming_visits?.find((v) => v.lead === selectedLead)?.id,
        remarks,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["visits"] });
      setRemarks("");
    },
  });

  const submitVisitModal = useMutation({
    mutationFn: () =>
      api.submitForm(activeVisit!.lead, visitModalFormData, {
        visit_id: activeVisit!.id,
        remarks: visitModalRemarks,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["visits"] });
      setActiveVisit(null);
      setVisitModalRemarks("");
    },
  });

  const assignVisit = useMutation({
    mutationFn: () =>
      api.createVisit({
        lead: assignLead!.id,
        assigned_to: Number(assignTo) || assignLead!.bdm_id,
        scheduled_date: visitDate,
        visit_type: "revisit",
        remarks: visitRemarks,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setAssignLead(null);
      setVisitDate("");
      setVisitRemarks("");
    },
  });

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  const disposition = data.disposition.map((d) => ({
    name: STATUS_LABELS[d.status] || d.status, value: d.count,
  }));
  const leaderboard = data.leaderboard.map((l) => ({
    name: l.bdm__first_name || l.bdm__username, confirmed: l.confirmed,
  }));

  return (
    <div className="space-y-6">
      {/* Hero welcome strip */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white dark:border-slate-700 sm:p-6">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                <Sparkles className="h-3 w-3 text-blue-300" />
                Workdesk
              </span>
              {pulse && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Welcome back, {me?.first_name || me?.username || "there"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {todayLabel} · {currentProject?.name || "Project"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <QuickStatPill label="Confirmed" value={data.orders_confirmed} />
            <QuickStatPill label="Overdue" value={data.overdue_follow_ups} warn />
            <QuickStatPill label="Forms today" value={data.forms_filled_today} />
          </div>
        </div>
      </section>

      {/* Filters */}
      <DashboardFilters
        filters={filters}
        onChange={onFiltersChange}
        showManager={false}
        allowAllProjects={false}
        projects={(projects || []).filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.name }))}
        products={(products || []).map((p) => ({ id: p.id, name: p.name, extra: p.project_name }))}
        companies={(companies || []).map((c) => ({ id: c.id, name: c.name, extra: c.city }))}
      />
      <FilterSummaryBanner summary={data?.filter_summary} />

      {/* KPI row */}
      <section>
        <SectionHeading
          title={data?.filter_summary?.project_name ? `${data.filter_summary.project_name} Performance` : "Performance Snapshot"}
          subtitle="Real-time metrics filtered by project, company & product"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Total Leads" value={data.total_leads} icon={Target} variant="slate" pulse={pulse} hint="In your scope" />
          <MetricCard label="Companies" value={data.total_companies ?? 0} icon={Factory} variant="blue" accent="text-blue-700" pulse={pulse} />
          <MetricCard label="Products" value={data.total_products ?? 0} icon={FileText} variant="violet" accent="text-violet-700" pulse={pulse} />
          <MetricCard label="Forms Today" value={data.forms_filled_today} icon={FileText} variant="violet" accent="text-violet-700" pulse={pulse} />
          <MetricCard label="Conversion" value={`${data.conversion_rate}%`} icon={TrendingUp} variant="emerald" accent="text-emerald-700" pulse={pulse} />
        </div>
      </section>

      {(data.company_stats?.length || data.product_stats?.length) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {!!data.company_stats?.length && (
            <KpiTable title="Companies" rows={data.company_stats} columns={["name", "city", "lead_count", "confirmed_count", "conversion"]} />
          )}
          {!!data.product_stats?.length && (
            <KpiTable title="Products" rows={data.product_stats} columns={["name", "lead_count", "confirmed_count", "conversion"]} />
          )}
        </div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-3">
        {/* Main workdesk */}
        <div className="space-y-5 xl:col-span-2">
          <SectionHeading title="Onboarding Form" subtitle="Fill merchant details and complete the visit" />

          {data.project_form ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              {/* Form header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-700 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/15">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-50">{data.project_form.title}</h2>
                    <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{data.project_form.project_name}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>

              {/* Lead picker */}
              <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <FormLabel>Select Lead / Merchant</FormLabel>
                    <SearchableSelect
                      value={selectedLead ? String(selectedLead) : ""}
                      onChange={(val) => setSelectedLead(val ? Number(val) : null)}
                      options={leadOptions}
                      placeholder="Search merchant name or city..."
                      searchPlaceholder="Type merchant name, city or lead #..."
                      emptyText="No matching leads found"
                    />
                  </div>
                  {selectedLeadInfo && (
                    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] dark:border-slate-600 dark:bg-slate-950/60 sm:mb-0.5">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {selectedLeadInfo.merchant_city || "—"}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">#{selectedLeadInfo.id}</span>
                      {selectedLeadInfo.status_display && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500 dark:text-slate-400">{selectedLeadInfo.status_display}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Fields + submit */}
              {selectedLead ? (
                <div className="px-4 py-4 sm:px-5 sm:py-5">
                  <SectionDivider label="Form Details" />
                  <DynamicForm
                    schema={data.project_form.schema}
                    values={formData}
                    onChange={setFormData}
                    leadId={selectedLead ?? undefined}
                  />

                  <div className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                    <FormLabel>Visit Remarks</FormLabel>
                    <textarea
                      className={formTextareaCls}
                      rows={3}
                      placeholder="Notes from this visit — follow-ups, feedback, next steps…"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        onClick={() => submitForm.mutate()}
                        disabled={submitForm.isPending}
                        className="h-10 gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold hover:bg-blue-700"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {submitForm.isPending ? "Submitting…" : "Submit & Complete"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="px-5 py-10 text-center text-sm text-slate-400">Select a lead to open the form.</p>
              )}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No form published yet"
              description="Your admin hasn't published a form for this project."
              action={isSupervisor ? <Link href="/admin/forms" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-300">Build form in Admin →</Link> : undefined}
            />
          )}

          {isSupervisor && data.revisit_leads.length > 0 && (
            <Panel title="Assign Next Visit" icon={UserPlus} subtitle="Previously visited leads — schedule re-visit">
              <div className="space-y-2">
                {data.revisit_leads.slice(0, 6).map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5 transition hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-500/40">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{l.merchant_name}</p>
                      <p className="text-xs text-slate-500">{l.merchant_city} · BDM: {l.bdm_name} · Last: {l.last_visit || "—"}</p>
                    </div>
                    <Button variant="outline" className="text-xs" onClick={() => { setAssignLead(l); setAssignTo(String(l.bdm_id)); }}>
                      Assign Visit
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {isSupervisor && data.team_form_activity.length > 0 && (
            <Panel title="Team Form Activity Today" icon={Users}>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.team_form_activity.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{s.lead_name}</p>
                      <p className="text-xs text-slate-500">by {s.submitted_by_name}</p>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {new Date(s.submitted_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <section>
            <SectionHeading title="Analytics" subtitle="Disposition breakdown and team performance" />
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <ChartCard title="Lead Disposition" subtitle="Status distribution across pipeline">
                {disposition.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={disposition} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {disposition.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-sm text-slate-400">No disposition data yet</p>
                )}
              </ChartCard>
              <ChartCard title="BDM Leaderboard" subtitle="Orders confirmed by team member">
                {leaderboard.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={leaderboard} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                      <Bar dataKey="confirmed" fill="#2563eb" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-12 text-center text-sm text-slate-400">No leaderboard data yet</p>
                )}
              </ChartCard>
            </div>
          </section>
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4 xl:sticky xl:top-20">
          <Panel title="Next Visit" icon={CalendarClock} featured>
            {data.next_visit ? (
              <button
                type="button"
                onClick={() => setActiveVisit(data.next_visit)}
                className="group w-full text-left"
              >
                <div className="rounded-xl border border-slate-200 p-3.5 transition group-hover:border-blue-400 dark:border-slate-700 dark:group-hover:border-blue-500/50">
                  <p className="text-[15px] font-bold text-slate-900 dark:text-slate-50">{data.next_visit.lead_name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                    <MapPin className="h-3.5 w-3.5" />
                    {data.next_visit.merchant_city}
                  </p>
                  <p className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {data.next_visit.scheduled_date}
                  </p>
                  {data.next_visit.remarks && (
                    <p className="mt-2 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {data.next_visit.remarks}
                    </p>
                  )}
                  <span className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white transition group-hover:bg-blue-700">
                    Open Visit Form
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            ) : (
              <EmptyMini icon={CalendarClock} text="No upcoming visits scheduled" />
            )}
          </Panel>

          <Panel title="Upcoming Visits" icon={ClipboardCheck} badge={data.upcoming_visits.length}>
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
              {data.upcoming_visits.length ? data.upcoming_visits.map((v) => (
                <VisitRow key={v.id} visit={v} onSelect={() => setActiveVisit(v)} />
              )) : <EmptyMini icon={ClipboardCheck} text="No visits in queue" />}
            </div>
          </Panel>

          <Panel title="Form History" icon={History}>
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
              {data.recent_submissions.length ? data.recent_submissions.map((s) => (
                <div key={s.id} className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{s.lead_name}</p>
                      <p className="text-[11px] text-slate-500">{s.submitted_by_name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{new Date(s.submitted_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )) : <EmptyMini icon={History} text="No submissions yet" />}
            </div>
          </Panel>

          <div className="grid grid-cols-2 gap-2">
            <Link href="/leads" className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-center text-[13px] font-semibold text-white transition hover:bg-blue-700">
              <Target className="h-3.5 w-3.5" />
              All Leads
            </Link>
            <Link href="/leads?overdue=1" className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-[13px] font-semibold text-slate-700 transition hover:border-amber-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-amber-500/40">
              <Phone className="h-3.5 w-3.5 text-amber-600" />
              Overdue
            </Link>
          </div>
        </aside>
      </div>

      {/* Visit form modal */}
      {activeVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-slate-900 dark:text-slate-50">{activeVisit.lead_name}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{activeVisit.merchant_city}</span>
                    <span className="font-medium text-blue-600 dark:text-blue-300">{activeVisit.scheduled_date}</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium capitalize text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                      {activeVisit.visit_type.replace("_", " ")}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveVisit(null)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>
              {activeVisit.remarks && (
                <p className="mt-3 rounded-xl border border-slate-100 bg-white p-3 text-xs text-slate-600">{activeVisit.remarks}</p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {data.project_form ? (
                <div className="divide-y divide-slate-100">
                  <div className="px-6 py-6">
                    <SectionDivider label="Form Details" />
                    <DynamicForm schema={data.project_form.schema} values={visitModalFormData} onChange={setVisitModalFormData} leadId={activeVisit?.lead} />
                  </div>
                  <div className="bg-slate-50/60 px-6 py-5">
                    <FormLabel>Visit Remarks</FormLabel>
                    <textarea
                      className={formTextareaCls}
                      rows={3}
                      placeholder="Add notes from this visit..."
                      value={visitModalRemarks}
                      onChange={(e) => setVisitModalRemarks(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <p className="p-6 text-sm text-slate-500">No form published for this project yet.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-white px-6 py-4">
              {data.project_form && (
                <Button
                  onClick={() => submitVisitModal.mutate()}
                  disabled={submitVisitModal.isPending}
                  className="h-11 gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                  {submitVisitModal.isPending ? "Submitting..." : "Submit & Complete"}
                </Button>
              )}
              <Button variant="outline" className="h-11" onClick={() => setActiveVisit(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {assignLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Assign Next Visit</h3>
            <p className="mt-1 text-sm text-slate-500">{assignLead.merchant_name} — {assignLead.merchant_city}</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Assign to (Employee ID)</label>
                <Input value={assignTo} onChange={(e) => setAssignTo(e.target.value)} placeholder="BDM user id" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Visit Date</label>
                <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Remarks</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                  rows={2}
                  value={visitRemarks}
                  onChange={(e) => setVisitRemarks(e.target.value)}
                  placeholder="Reason for re-visit..."
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Button onClick={() => assignVisit.mutate()} disabled={!visitDate || assignVisit.isPending} className="bg-blue-600 hover:bg-blue-700">
                {assignVisit.isPending ? "Assigning..." : "Assign Visit"}
              </Button>
              <Button variant="outline" onClick={() => setAssignLead(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
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

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</span>
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}

function QuickStatPill({ label, value, warn }: { label: string; value?: number; warn?: boolean }) {
  return (
    <div className={cn(
      "rounded-2xl px-4 py-3 backdrop-blur",
      warn ? "bg-amber-500/20 ring-1 ring-amber-400/30" : "bg-white/10 ring-1 ring-white/20"
    )}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{label}</p>
      <p className={cn("mt-0.5 text-xl font-bold", warn ? "text-amber-200" : "text-white")}>{value ?? 0}</p>
    </div>
  );
}

function Panel({
  title, icon: Icon, subtitle, badge, featured, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  badge?: number;
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border bg-white dark:bg-slate-900",
      featured
        ? "border-blue-200/80 dark:border-blue-500/25"
        : "border-slate-200 dark:border-slate-700",
    )}>
      <div className={cn(
        "flex items-center gap-2 border-b px-3.5 py-3",
        featured
          ? "border-blue-200/80 dark:border-blue-500/20"
          : "border-slate-200 dark:border-slate-700",
      )}>
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md",
          featured
            ? "bg-blue-50 dark:bg-blue-500/15"
            : "bg-slate-100 dark:bg-slate-800",
        )}>
          <Icon className={cn("h-3.5 w-3.5", featured ? "text-blue-600 dark:text-blue-300" : "text-slate-600 dark:text-slate-300")} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          {subtitle && <p className="truncate text-[10px] text-slate-400">{subtitle}</p>}
        </div>
        {badge !== undefined && (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>
        )}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function VisitRow({ visit, onSelect }: { visit: LeadVisit; onSelect: () => void }) {
  const isToday = visit.scheduled_date === new Date().toISOString().split("T")[0];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group w-full rounded-lg border px-3 py-2.5 text-left transition",
        isToday
          ? "border-blue-300/70 bg-blue-50/40 hover:border-blue-400 dark:border-blue-500/35 dark:bg-blue-500/10 dark:hover:border-blue-400/50"
          : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950/50 dark:hover:border-blue-500/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{visit.lead_name}</p>
        {isToday && (
          <span className="shrink-0 rounded border border-blue-300/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700 dark:border-blue-400/40 dark:text-blue-300">
            Today
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{visit.scheduled_date} · {visit.visit_type.replace("_", " ")}</p>
      {visit.remarks && <p className="mt-1 truncate text-[10px] text-slate-400">{visit.remarks}</p>}
    </button>
  );
}

function KpiTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: { name: string; city?: string; lead_count: number; confirmed_count: number; conversion: number }[];
  columns: string[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 className="font-bold text-slate-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              {columns.includes("city") && <th className="px-5 py-3">City</th>}
              <th className="px-5 py-3">Leads</th>
              <th className="px-5 py-3">Confirmed</th>
              <th className="px-5 py-3">Conv.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-slate-100">
                <td className="px-5 py-3 font-medium">{r.name}</td>
                {columns.includes("city") && <td className="px-5 py-3 text-slate-600">{r.city || "—"}</td>}
                <td className="px-5 py-3">{r.lead_count}</td>
                <td className="px-5 py-3 text-emerald-600">{r.confirmed_count}</td>
                <td className="px-5 py-3">{r.conversion}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function EmptyMini({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
        <Icon className="h-5 w-5 text-slate-300" />
      </div>
      <p className="mt-2 text-sm text-slate-400">{text}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon, title, description, action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
        <Icon className="h-7 w-7 text-slate-300" />
      </div>
      <p className="mt-4 text-base font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-36 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid gap-8 xl:grid-cols-3">
        <Skeleton className="h-[500px] rounded-3xl xl:col-span-2" />
        <div className="space-y-5">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
