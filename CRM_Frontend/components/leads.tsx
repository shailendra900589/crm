"use client";

import { Badge, Button, Card, Input } from "@/components/ui";
import { BulkUpload } from "@/components/bulk-upload";
import { DocumentsPanel } from "@/components/documents-panel";
import { DynamicForm } from "@/components/dynamic-form";
import { LeadActivityTimeline } from "@/components/lead-activity";
import { api, getProjectId, onProjectChange, LEAD_STATUSES, type CallOutcome, type CreateLeadData, type Lead, type UpdateLeadData } from "@/lib/api";
import { LogCallForm } from "@/components/log-call";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Calendar, Download, Eye, FileSpreadsheet, FileText, Filter, Pencil, Phone, PhoneCall, Plus, Search, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
type ModalMode = "add" | "edit" | "followup" | "reassign" | "call" | null;

const emptyForm = (): CreateLeadData => ({
  project: Number(getProjectId()) || 0,
  merchant_name: "",
  merchant_mobile: "",
  merchant_email: "",
  brand_name: "",
  city: "",
  product: null,
  status: "interested",
  follow_up_date: "",
  notes: "",
});

export function LeadsView() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const [projectId, setLocalProjectId] = useState(() => getProjectId() || "");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [productFilter, setProductFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(1);
  const [viewTab, setViewTab] = useState<"list" | "bulk">("list");
  const [modal, setModal] = useState<ModalMode>(null);
  const [form, setForm] = useState<CreateLeadData>(emptyForm);
  const [followNote, setFollowNote] = useState("");
  const [reassignBdm, setReassignBdm] = useState("");
  const [reassignNote, setReassignNote] = useState("");
  const [exporting, setExporting] = useState(false);
  const [mobileCheck, setMobileCheck] = useState("");
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const canReassign = !!me && (me.role === "Admin" || me.role === "Manager" || me.role === "TL");
  const { data: assignees = [] } = useQuery({
    queryKey: ["users-reassign"],
    queryFn: () => api.users(),
    enabled: canReassign,
  });

  useEffect(() => {
    if (params.get("overdue") === "1") setOverdueFilter(true);
  }, [params]);

  useEffect(() => onProjectChange((id) => {
    setLocalProjectId(id);
    setPage(1);
    setProductFilter("");
    setCompanyFilter("");
  }), []);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (modal !== "add") {
      setMobileCheck("");
      return;
    }
    const t = setTimeout(() => setMobileCheck(form.merchant_mobile.trim()), 400);
    return () => clearTimeout(t);
  }, [form.merchant_mobile, modal]);

  const { data: duplicateCheck } = useQuery({
    queryKey: ["check-duplicate", projectId, mobileCheck],
    queryFn: () => api.checkDuplicate({ mobile: mobileCheck, project: Number(projectId) || undefined }),
    enabled: modal === "add" && mobileCheck.replace(/\D/g, "").length >= 10 && !!projectId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["leads", projectId, statusFilter, overdueFilter, productFilter, companyFilter, searchQ, page],
    queryFn: () =>
      api.leads({
        project: projectId ? Number(projectId) : undefined,
        status: statusFilter || undefined,
        overdue: overdueFilter,
        product: productFilter || undefined,
        company: companyFilter || undefined,
        q: searchQ || undefined,
        page,
      }),
  });
  const { data: products } = useQuery({
    queryKey: ["products", projectId],
    queryFn: () => api.products(Number(projectId) || undefined),
  });
  const { data: companies } = useQuery({
    queryKey: ["merchants", projectId],
    queryFn: () => api.merchants(Number(projectId) || undefined),
  });

  const leads = data?.results || [];
  const totalPages = data ? Math.ceil(data.count / 20) : 1;
  const today = new Date().toISOString().split("T")[0];
  const activeFilters = [statusFilter, overdueFilter || "", productFilter, companyFilter, searchQ].filter(Boolean).length;

  useEffect(() => {
    const leadId = Number(params.get("lead"));
    if (!leadId) return;
    const found = data?.results?.find((l) => l.id === leadId);
    if (found) setSelected(found);
    else api.lead(leadId).then((l) => setSelected(l)).catch(() => undefined);
  }, [params, data?.results]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["leads"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["duplicate-groups"] });
  };

  const clearFilters = () => {
    setStatusFilter("");
    setOverdueFilter(false);
    setProductFilter("");
    setCompanyFilter("");
    setSearchInput("");
    setSearchQ("");
    setPage(1);
  };

  const exportOpts = {
    status: statusFilter || undefined,
    overdue: overdueFilter,
    product: productFilter || undefined,
    company: companyFilter || undefined,
    q: searchQ || undefined,
  };

  const create = useMutation({
    mutationFn: (opts?: { force?: boolean }) =>
      api.createLead({ ...form, project: Number(getProjectId()), force: opts?.force }),
    onSuccess: () => { invalidate(); setModal(null); setForm(emptyForm()); },
  });

  const handleCreateLead = () => {
    if (duplicateCheck?.duplicate) {
      const ok = confirm(
        `This mobile already has ${duplicateCheck.count} lead(s) in this project. Create another anyway?`
      );
      if (!ok) return;
      create.mutate({ force: true });
      return;
    }
    create.mutate({});
  };

  const update = useMutation({
    mutationFn: (data: UpdateLeadData) => api.updateLead(selected!.id, data),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["lead", selected?.id] }); setModal(null); },
  });

  const followUp = useMutation({
    mutationFn: () => api.followUpLead(selected!.id, { follow_up_date: form.follow_up_date!, notes: followNote }),
    onSuccess: () => { invalidate(); setModal(null); setFollowNote(""); },
  });

  const logCall = useMutation({
    mutationFn: (data: { outcome: CallOutcome; notes: string; follow_up_date?: string }) =>
      api.logCall(selected!.id, data),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["lead", selected?.id] });
      qc.invalidateQueries({ queryKey: ["lead-activity", selected?.id] });
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      setModal(null);
    },
  });

  const reassign = useMutation({
    mutationFn: () => api.reassignLead(selected!.id, { bdm: Number(reassignBdm), notes: reassignNote || undefined }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["lead", selected?.id] });
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setModal(null);
      setReassignBdm("");
      setReassignNote("");
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteLead(id),
    onSuccess: () => { invalidate(); setSelected(null); },
  });

  const openAdd = () => {
    setForm(emptyForm());
    setModal("add");
  };

  const openEdit = (lead: Lead) => {
    setSelected(lead);
    setForm({
      project: lead.project || Number(getProjectId()),
      merchant_name: lead.merchant_name,
      merchant_mobile: lead.merchant_mobile || "",
      merchant_email: lead.merchant_email || "",
      brand_name: lead.brand_name || "",
      city: lead.merchant_city,
      product: lead.product ?? null,
      status: lead.status,
      follow_up_date: lead.follow_up_date || "",
      notes: lead.notes,
    });
    setModal("edit");
  };

  const openFollowUp = (lead: Lead) => {
    setSelected(lead);
    setForm({ ...emptyForm(), follow_up_date: today });
    setFollowNote("");
    setModal("followup");
  };

  const openLogCall = (lead: Lead) => {
    setSelected(lead);
    setModal("call");
  };

  const openReassign = (lead: Lead) => {
    setSelected(lead);
    setReassignBdm("");
    setReassignNote("");
    setModal("reassign");
  };

  const isOverdue = (date: string | null) => date && date < today;
  const [exportOpen, setExportOpen] = useState(false);

  const selectCls =
    "h-9 appearance-none rounded-lg border border-slate-200/80 bg-transparent pl-2.5 pr-7 text-[13px] font-medium text-slate-700 outline-none transition hover:border-blue-300 hover:bg-blue-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:text-slate-200 dark:hover:border-blue-400/40 dark:hover:bg-blue-500/10 dark:focus:border-blue-400/50";

  return (
    <>
      {/* Professional command bar */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/60 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-white/[0.08] dark:bg-slate-900/90 dark:shadow-none sm:p-3.5">
          {/* Primary strip */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="inline-flex shrink-0 self-start rounded-lg bg-slate-100 p-0.5 dark:bg-white/[0.06]">
              {(["list", "bulk"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setViewTab(t)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[13px] font-semibold transition",
                    viewTab === t
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white",
                  )}
                >
                  {t === "list" ? "List" : "Bulk"}
                </button>
              ))}
            </div>

            {viewTab === "list" && (
              <>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Filter by merchant, mobile, city, product…"
                    className="h-9 w-full rounded-lg border border-slate-200/80 bg-slate-50/80 pl-9 pr-9 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400/50 dark:focus:bg-slate-950"
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      aria-label="Clear"
                      onClick={() => setSearchInput("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      disabled={exporting}
                      onClick={() => setExportOpen((v) => !v)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200/80 px-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </button>
                    {exportOpen && (
                      <>
                        <button type="button" className="fixed inset-0 z-10 cursor-default" aria-label="Close" onClick={() => setExportOpen(false)} />
                        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-emerald-500/10"
                            onClick={async () => {
                              setExportOpen(false);
                              setExporting(true);
                              try {
                                await api.exportLeads({ ...exportOpts, format: "xlsx" });
                              } finally {
                                setExporting(false);
                              }
                            }}
                          >
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-rose-50 dark:text-slate-200 dark:hover:bg-rose-500/10"
                            onClick={async () => {
                              setExportOpen(false);
                              setExporting(true);
                              try {
                                await api.exportLeads({ ...exportOpts, format: "pdf" });
                              } finally {
                                setExporting(false);
                              }
                            }}
                          >
                            <FileText className="h-4 w-4 text-rose-600" /> PDF
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={openAdd}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-500"
                  >
                    <Plus className="h-4 w-4" /> Add Lead
                  </button>
                </div>
              </>
            )}
          </div>

          {viewTab === "list" && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
              <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Filter className="h-3 w-3" /> Filter
              </span>
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Status</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Product</option>
                {(products || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); }} className={cn(selectCls, "max-w-[160px]")}>
                <option value="">Company</option>
                {(companies || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { setOverdueFilter(!overdueFilter); setPage(1); }}
                className={cn(
                  "inline-flex h-9 items-center rounded-lg px-2.5 text-[13px] font-semibold transition",
                  overdueFilter
                    ? "bg-rose-600 text-white"
                    : "border border-slate-200/80 text-slate-600 hover:bg-rose-50 hover:text-rose-700 dark:border-white/10 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-300",
                )}
              >
                Overdue
              </button>
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" /> Reset
                </button>
              )}
              <div className="ml-auto text-[12px] tabular-nums text-slate-400">
                {data ? (
                  <>
                    <span className="font-semibold text-slate-600 dark:text-slate-200">{data.count}</span> leads
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {viewTab === "bulk" ? <BulkUpload /> : (
      <>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80 dark:shadow-none dark:ring-1 dark:ring-white/5">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-white text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700/80 dark:from-slate-900 dark:to-slate-900 dark:text-slate-400">
              <th className="px-4 py-3.5">Merchant</th>
              <th className="px-4 py-3.5">Product</th>
              <th className="px-4 py-3.5">BDM</th>
              <th className="px-4 py-3.5">City</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Follow-up</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No leads found</td></tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className={cn(
                    "group bg-transparent transition-colors",
                    "hover:bg-blue-50/70 dark:hover:bg-blue-500/[0.07]",
                    selected?.id === lead.id && "bg-blue-50/50 dark:bg-blue-500/10",
                  )}
                >
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => setSelected(lead)}
                      className="text-left font-semibold text-slate-900 transition group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300"
                    >
                      {lead.merchant_name}
                    </button>
                    {lead.brand_name ? (
                      <p className="mt-0.5 text-xs text-slate-400">{lead.brand_name}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{lead.product_name || "—"}</td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{lead.bdm_name}</td>
                  <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{lead.merchant_city || "—"}</td>
                  <td className="px-4 py-3.5"><Badge status={lead.status} label={lead.status_display} /></td>
                  <td className={cn(
                    "px-4 py-3.5 tabular-nums",
                    isOverdue(lead.follow_up_date)
                      ? "font-semibold text-rose-600 dark:text-rose-400"
                      : "text-slate-600 dark:text-slate-300",
                  )}>
                    {lead.follow_up_date || "—"}
                    {isOverdue(lead.follow_up_date) && (
                      <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                        Overdue
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-0.5 opacity-80 transition group-hover:opacity-100">
                      <ActionBtn icon={Eye} title="View" onClick={() => setSelected(lead)} />
                      <ActionBtn icon={Calendar} title="Follow-up" onClick={() => openFollowUp(lead)} />
                      <ActionBtn icon={PhoneCall} title="Log call" onClick={() => openLogCall(lead)} />
                      {canReassign && (
                        <ActionBtn icon={ArrowRightLeft} title="Reassign" onClick={() => openReassign(lead)} />
                      )}
                      <ActionBtn icon={Pencil} title="Revise" onClick={() => openEdit(lead)} />
                      <ActionBtn icon={Trash2} title="Delete" danger onClick={() => confirm("Delete this lead?") && remove.mutate(lead.id)} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">{data?.count} leads total</p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span className="flex items-center px-3 text-sm">Page {page} / {totalPages}</span>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
      </>
      )}
      <LeadDetailModal
        lead={selected}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onFollowUp={openFollowUp}
        onLogCall={openLogCall}
        onReassign={canReassign ? openReassign : undefined}
      />

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              {modal === "add" && "Add New Lead"}
              {modal === "edit" && "Revise Lead"}
              {modal === "followup" && "Schedule Follow-up"}
              {modal === "reassign" && "Reassign Lead"}
              {modal === "call" && "Log Call"}
            </h3>

            {modal === "call" ? (
              <LogCallForm
                saving={logCall.isPending}
                defaultFollowUpDate={today}
                onCancel={() => setModal(null)}
                onSubmit={(data) => logCall.mutate(data)}
              />
            ) : modal === "reassign" ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Merchant: <strong>{selected?.merchant_name}</strong>
                  <span className="ml-2 text-slate-400">· Current BDM: {selected?.bdm_name}</span>
                </p>
                <Field label="Assign to">
                  <select
                    value={reassignBdm}
                    onChange={(e) => setReassignBdm(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Select user...</option>
                    {assignees
                      .filter((u) => u.role !== "Admin" && u.id !== selected?.bdm)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name || u.username} ({u.role})
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Note (optional)">
                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    rows={3}
                    placeholder="Reason for reassignment..."
                    value={reassignNote}
                    onChange={(e) => setReassignNote(e.target.value)}
                  />
                </Field>
                {reassign.isError && (
                  <p className="text-sm text-rose-600">{(reassign.error as Error)?.message || "Reassign failed"}</p>
                )}
                <ModalActions
                  onCancel={() => setModal(null)}
                  onSave={() => reassign.mutate()}
                  saving={reassign.isPending}
                  label="Reassign Lead"
                  disabled={!reassignBdm}
                />
              </div>
            ) : modal === "followup" ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Merchant: <strong>{selected?.merchant_name}</strong></p>
                <Field label="Follow-up Date">
                  <Input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
                </Field>
                <Field label="Follow-up Note">
                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    rows={3}
                    placeholder="What to discuss on follow-up..."
                    value={followNote}
                    onChange={(e) => setFollowNote(e.target.value)}
                  />
                </Field>
                <ModalActions
                  onCancel={() => setModal(null)}
                  onSave={() => followUp.mutate()}
                  saving={followUp.isPending}
                  label="Schedule Follow-up"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Merchant Name *">
                    <Input value={form.merchant_name} onChange={(e) => setForm({ ...form, merchant_name: e.target.value })} />
                  </Field>
                  <Field label="Mobile *">
                    <Input value={form.merchant_mobile} onChange={(e) => setForm({ ...form, merchant_mobile: e.target.value })} placeholder={modal === "edit" ? "Leave blank to keep" : ""} />
                  </Field>
                  {modal === "add" && duplicateCheck?.duplicate && (
                    <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                      <p className="font-medium">Possible duplicate — {duplicateCheck.count} existing lead(s) with this mobile</p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {duplicateCheck.leads.map((l) => (
                          <li key={l.id}>
                            <Link href={`/leads?lead=${l.id}`} className="underline hover:text-amber-700" onClick={() => setModal(null)}>
                              {l.merchant_name} · {l.status_display} · {l.bdm_name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Field label="Brand Name">
                    <Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
                  </Field>
                  <Field label="City">
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </Field>
                  <Field label="Product">
                    <select
                      value={form.product ?? ""}
                      onChange={(e) => setForm({ ...form, product: e.target.value ? Number(e.target.value) : null })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Select product</option>
                      {(products || []).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Email">
                    <Input value={form.merchant_email} onChange={(e) => setForm({ ...form, merchant_email: e.target.value })} />
                  </Field>
                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Follow-up Date">
                    <Input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </Field>
                <ModalActions
                  onCancel={() => setModal(null)}
                  onSave={() => modal === "add" ? handleCreateLead() : update.mutate({
                    merchant_name: form.merchant_name,
                    merchant_mobile: form.merchant_mobile || undefined,
                    merchant_email: form.merchant_email,
                    brand_name: form.brand_name,
                    city: form.city,
                    product: form.product ?? null,
                    status: form.status,
                    follow_up_date: form.follow_up_date || undefined,
                    notes: form.notes,
                  })}
                  saving={create.isPending || update.isPending}
                  label={modal === "add" ? "Add Lead" : "Save Changes"}
                  disabled={modal === "add" && (!form.merchant_name || !form.merchant_mobile)}
                />
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function LeadDetailModal({
  lead, onClose, onEdit, onFollowUp, onLogCall, onReassign,
}: {
  lead: Lead | null;
  onClose: () => void;
  onEdit: (l: Lead) => void;
  onFollowUp: (l: Lead) => void;
  onLogCall: (l: Lead) => void;
  onReassign?: (l: Lead) => void;
}) {
  const [tab, setTab] = useState("profile");
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const pid = lead?.project || Number(getProjectId());
  const { data: customForm } = useQuery({
    queryKey: ["custom-form", pid],
    queryFn: () => api.customForm(pid),
    enabled: !!pid && !!lead,
  });
  const { data: detail } = useQuery({
    queryKey: ["lead", lead?.id],
    queryFn: () => api.lead(lead!.id),
    enabled: !!lead,
  });

  const submitForm = useMutation({
    mutationFn: () => api.submitForm(lead!.id, formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", lead?.id] });
      qc.invalidateQueries({ queryKey: ["lead-activity", lead?.id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["visits"] });
    },
  });

  const l = detail || lead;

  useEffect(() => {
    if (l?.custom_data) setFormData(l.custom_data as Record<string, unknown>);
  }, [l]);

  useEffect(() => {
    if (lead) setTab("profile");
  }, [lead?.id]);

  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lead, onClose]);

  if (!lead || !l) return null;
  const doc = l.documents?.[0];

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "form", label: "Form" },
    { id: "documents", label: "Docs" },
    { id: "notes", label: "Activity" },
  ] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-detail-title"
    >
      <motion.button
        type="button"
        aria-label="Close backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/70"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/50"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-white px-5 py-4 dark:border-slate-800 dark:from-blue-600/15 dark:via-slate-900 dark:to-slate-900 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600/80 dark:text-blue-300/80">Lead detail</p>
              <h2 id="lead-detail-title" className="mt-0.5 truncate text-xl font-bold text-slate-900 dark:text-white">
                {l.merchant_name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge status={l.status} label={l.status_display} />
                {l.product_name && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10">
                    {l.product_name}
                  </span>
                )}
                {l.merchant_city && (
                  <span className="text-[12px] text-slate-500 dark:text-slate-400">{l.merchant_city}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <QuickAction icon={Phone} label="Follow-up" onClick={() => { onClose(); onFollowUp(l); }} />
            <QuickAction icon={PhoneCall} label="Log call" onClick={() => { onClose(); onLogCall(l); }} />
            {onReassign && (
              <QuickAction icon={ArrowRightLeft} label="Reassign" onClick={() => { onClose(); onReassign(l); }} />
            )}
            <QuickAction icon={Pencil} label="Revise" onClick={() => { onClose(); onEdit(l); }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 border-b border-slate-100 px-5 pt-3 dark:border-slate-800 sm:px-6">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative shrink-0 rounded-t-lg px-3.5 py-2 text-[13px] font-semibold transition",
                  tab === t.id
                    ? "text-blue-600 dark:text-blue-300"
                    : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300",
                )}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue-500 dark:bg-blue-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {tab === "profile" && (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
              <ProfileField label="BDM" value={l.bdm_name} />
              <ProfileField label="Product" value={l.product_name || "Not assigned"} />
              <ProfileField label="City" value={l.merchant_city || "—"} />
              <ProfileField label="Status" value={l.status_display} />
              <ProfileField label="Follow-up" value={l.follow_up_date || "Not set"} />
              <ProfileField label="Mobile" value={l.merchant_mobile || "—"} />
              {l.brand_name ? <ProfileField label="Brand" value={l.brand_name} /> : null}
              {l.merchant_email ? <ProfileField label="Email" value={l.merchant_email} /> : null}
            </dl>
          )}

          {tab === "form" && customForm && (
            <div>
              <DynamicForm schema={customForm.schema} values={formData} onChange={setFormData} leadId={l.id} />
              <Button className="mt-4" onClick={() => submitForm.mutate()} disabled={submitForm.isPending}>
                {submitForm.isPending ? "Saving..." : "Save Form"}
              </Button>
            </div>
          )}

          {tab === "form" && !customForm && (
            <p className="text-sm text-slate-500">No custom form configured for this project.</p>
          )}

          {tab === "documents" && (
            <DocumentsPanel
              leadId={l.id}
              doc={doc}
              canVerify={!!me && (me.role === "Admin" || me.role === "TL" || me.role === "Manager")}
            />
          )}
          {tab === "notes" && <LeadActivityTimeline leadId={l.id} />}
        </div>
      </motion.div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-blue-400/40 dark:hover:bg-blue-500/15 dark:hover:text-blue-200"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-3 dark:border-white/[0.06]">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function ActionBtn({ icon: Icon, title, onClick, danger }: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "rounded-lg p-1.5 transition",
        danger
          ? "text-rose-500 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/15"
          : "text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-blue-500/15 dark:hover:text-blue-300",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, onSave, saving, label, disabled }: {
  onCancel: () => void; onSave: () => void; saving: boolean; label: string; disabled?: boolean;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <Button onClick={onSave} disabled={saving || disabled}>{saving ? "Saving..." : label}</Button>
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
    </div>
  );
}
