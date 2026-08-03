"use client";

import { Badge, Button, Input } from "@/components/ui";
import { api, fileUrl, type Organization, type PlatformSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  FolderKanban,
  Link2,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type StatusFilter = "all" | Organization["status"];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "trial", label: "Trial" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "rejected", label: "Rejected" },
];

function statusBadge(status: Organization["status"]) {
  if (status === "active" || status === "trial") return "approved" as const;
  if (status === "rejected" || status === "suspended") return "rejected" as const;
  return "pending" as const;
}

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent || "text-slate-900 dark:text-slate-50"}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function OrganizationsAdminView() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { data: orgs, isLoading } = useQuery({ queryKey: ["organizations"], queryFn: api.organizations });
  const isSuper = me?.role === "SuperAdmin" || me?.is_superadmin;
  const { data: summary } = useQuery({
    queryKey: ["platform-summary"],
    queryFn: api.platformSummary,
    enabled: !!isSuper,
  });

  const [selected, setSelected] = useState<Organization | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [trialDays, setTrialDays] = useState("15");
  const [plan, setPlan] = useState("Trial");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [packageId, setPackageId] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [hrmsToken, setHrmsToken] = useState("");
  const [hrmsCompanyId, setHrmsCompanyId] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    admin_name: "",
    plan_label: "Trial",
    status: "trial" as Organization["status"],
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["packages"],
    queryFn: api.packages,
    enabled: !!isSuper,
  });
  const { data: catalog } = useQuery({
    queryKey: ["package-module-catalog"],
    queryFn: api.packageModuleCatalog,
    enabled: !!isSuper,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["organizations"] });
    qc.invalidateQueries({ queryKey: ["platform-summary"] });
  };

  const filtered = useMemo(() => {
    const list = orgs || [];
    const needle = q.trim().toLowerCase();
    return list.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!needle) return true;
      return [o.name, o.email, o.city, o.admin_name, o.plan_label, o.slug]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [orgs, filter, q]);

  const openManage = (o: Organization) => {
    setSelected(o);
    setPlan(o.plan_label || "Trial");
    setPaymentNotes(o.payment_notes || "");
    setHrmsCompanyId(o.hrms_company_id || "");
    setPackageId(o.package ? String(o.package) : "");
    setModules(o.enabled_modules || []);
    const pkg = packages.find((p) => p.id === o.package);
    setTrialDays(String(pkg?.trial_days || 15));
  };

  const packagePayload = () => ({
    package_id: packageId ? Number(packageId) : undefined,
    modules: modules.length ? modules : undefined,
  });

  const approve = useMutation({
    mutationFn: (mode: "trial" | "active") =>
      api.approveOrganization(selected!.id, {
        mode,
        trial_days: Number(trialDays) || 15,
        plan_label: plan,
        payment_notes: paymentNotes,
        is_public: true,
        ...packagePayload(),
      }),
    onSuccess: (org) => {
      invalidate();
      setSelected(org);
      setModules(org.enabled_modules || []);
      setPackageId(org.package ? String(org.package) : "");
    },
  });

  const reject = useMutation({
    mutationFn: () => api.rejectOrganization(selected!.id, { reason: paymentNotes || "Rejected" }),
    onSuccess: () => {
      invalidate();
      setSelected(null);
    },
  });

  const suspend = useMutation({
    mutationFn: () => api.suspendOrganization(selected!.id, { reason: paymentNotes || "Suspended by Super Admin" }),
    onSuccess: (org) => {
      invalidate();
      setSelected(org);
    },
  });

  const reactivate = useMutation({
    mutationFn: (mode: "trial" | "active") =>
      api.reactivateOrganization(selected!.id, {
        mode,
        trial_days: Number(trialDays) || 15,
        plan_label: plan,
        payment_notes: paymentNotes,
        is_public: true,
        ...packagePayload(),
      }),
    onSuccess: (org) => {
      invalidate();
      setSelected(org);
      setModules(org.enabled_modules || []);
      setPackageId(org.package ? String(org.package) : "");
    },
  });

  const setPay = useMutation({
    mutationFn: () =>
      api.setOrganizationPayment(selected!.id, {
        status: selected?.status === "trial" ? "trial" : "active",
        plan_label: plan || "Paid",
        payment_notes: paymentNotes,
        hrms_connected: !!hrmsCompanyId,
        hrms_company_id: hrmsCompanyId,
        ...packagePayload(),
      }),
    onSuccess: (org) => {
      invalidate();
      setSelected(org);
      setModules(org.enabled_modules || []);
    },
  });

  const adjustTrial = useMutation({
    mutationFn: (delta_days: number) =>
      api.adjustOrganizationTrial(selected!.id, { delta_days, payment_notes: paymentNotes }),
    onSuccess: (org) => {
      invalidate();
      setSelected(org);
    },
  });

  const saveModules = useMutation({
    mutationFn: () =>
      api.setOrganizationModules(selected!.id, {
        modules,
        package_id: packageId ? Number(packageId) : undefined,
      }),
    onSuccess: (org) => {
      invalidate();
      setSelected(org);
      setModules(org.enabled_modules || []);
    },
  });

  const recordPayment = useMutation({
    mutationFn: () =>
      api.recordOrganizationPayment(selected!.id, {
        plan_label: plan || "Paid",
        payment_notes: paymentNotes,
        package_id: packageId ? Number(packageId) : undefined,
        modules: modules.length ? modules : undefined,
        is_public: true,
      }),
    onSuccess: (org) => {
      invalidate();
      setSelected(org);
      setModules(org.enabled_modules || []);
      setPackageId(org.package ? String(org.package) : "");
    },
  });

  const verifyDocs = useMutation({
    mutationFn: (status: "verified" | "rejected") =>
      api.verifyOrganizationDocuments(selected!.id, {
        status,
        reason: paymentNotes || undefined,
        force: status === "verified" && !(selected?.documents?.length || selected?.document_count),
      }),
    onSuccess: (org) => {
      invalidate();
      setSelected(org);
    },
  });

  const reviewDoc = useMutation({
    mutationFn: (opts: { docId: number; status: "approved" | "rejected" }) =>
      api.reviewOrganizationDocument(selected!.id, opts.docId, { status: opts.status }),
    onSuccess: (res) => {
      invalidate();
      setSelected(res.organization);
    },
  });

  const uploadDocs = useMutation({
    mutationFn: (fileList: FileList) => {
      const fd = new FormData();
      Array.from(fileList).forEach((f, i) => fd.append(`doc_${i}`, f));
      return api.uploadOrganizationDocuments(selected!.id, fd);
    },
    onSuccess: (res) => {
      invalidate();
      setSelected(res.organization);
    },
  });

  const sync = useMutation({
    mutationFn: () => api.syncHrmsEmployees(selected!.id, { hrms_token: hrmsToken, force: true }),
  });

  const createOrg = useMutation({
    mutationFn: () =>
      api.createOrganization({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
        city: createForm.city.trim(),
        admin_name: createForm.admin_name.trim(),
        plan_label: createForm.plan_label.trim() || "Trial",
        status: createForm.status,
        is_public: createForm.status === "active" || createForm.status === "trial",
      }),
    onSuccess: () => {
      invalidate();
      setShowCreate(false);
      setCreateForm({
        name: "",
        email: "",
        phone: "",
        city: "",
        admin_name: "",
        plan_label: "Trial",
        status: "trial",
      });
    },
  });

  if (!isSuper) {
    return <p className="text-sm text-slate-500">Only Super Admin can manage platform companies.</p>;
  }

  const s: PlatformSummary | undefined = summary;

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4 text-white sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300">Super Admin</p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Platform dashboard</h1>
            <p className="mt-1 max-w-xl text-xs text-slate-300 sm:text-sm">
              Manage every tenant — packages, modules, 15-day trial, payment unlock, HRMS sync.
            </p>
          </div>
          {isSuper && (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/packages"
                className="inline-flex h-9 items-center rounded-lg border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                Packages
              </Link>
              <Button
                className="h-9 gap-1.5 bg-white text-slate-900 hover:bg-slate-100"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4" /> Add company
              </Button>
            </div>
          )}
        </div>
      </div>

      {isSuper && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Companies" value={s?.companies_total ?? "—"} hint="All tenants" />
          <KpiCard label="Pending" value={s?.by_status.pending ?? "—"} accent="text-amber-600" hint="Awaiting approval" />
          <KpiCard label="Trial" value={s?.by_status.trial ?? "—"} accent="text-sky-600" />
          <KpiCard label="Active" value={s?.by_status.active ?? "—"} accent="text-emerald-600" />
          <KpiCard
            label="Users"
            value={s?.users_total ?? "—"}
            hint="Across tenants"
            accent="text-indigo-600"
          />
          <KpiCard label="Projects" value={s?.projects_total ?? "—"} hint="Active projects" />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.key === "all"
                ? orgs?.length ?? 0
                : orgs?.filter((o) => o.status === f.key).length ?? 0;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {f.label}
                <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-9 pl-8 text-sm"
            placeholder="Search company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {isLoading ? (
          <div className="h-40 animate-pulse bg-slate-100 dark:bg-slate-800" />
        ) : !filtered.length ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">No companies match this filter.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{o.name}</p>
                    <Badge status={statusBadge(o.status)} label={o.status_display || o.status} />
                    {o.docs_verification_status && o.docs_verification_status !== "verified" && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        Docs: {o.docs_verification_status_display || o.docs_verification_status}
                      </span>
                    )}
                    {o.docs_verification_status === "verified" && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Docs verified
                      </span>
                    )}
                    {o.access_allowed === false && o.status !== "rejected" && (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        Access off
                      </span>
                    )}
                    {o.hrms_connected && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        HRMS
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span>{o.email}</span>
                    {o.city ? <span>{o.city}</span> : null}
                    <span>{o.plan_label || "—"}</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {o.user_count ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <FolderKanban className="h-3 w-3" /> {o.project_count ?? 0}
                    </span>
                  </p>
                </div>
                <Button variant="outline" className="h-8 text-xs" onClick={() => openManage(o)}>
                  Manage
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && isSuper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setShowCreate(false)}>
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">Add company / tenant</h3>
            <p className="text-sm text-slate-500">Creates a tenant immediately (no registration wait).</p>
            <div className="mt-4 space-y-2">
              <Input
                placeholder="Company name *"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                placeholder="Company email *"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Phone"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                />
                <Input
                  placeholder="City"
                  value={createForm.city}
                  onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Admin contact name"
                value={createForm.admin_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, admin_name: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Plan label"
                  value={createForm.plan_label}
                  onChange={(e) => setCreateForm((f) => ({ ...f, plan_label: e.target.value }))}
                />
                <select
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={createForm.status}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, status: e.target.value as Organization["status"] }))
                  }
                >
                  <option value="trial">Trial</option>
                  <option value="active">Active (paid)</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            {createOrg.isError && (
              <p className="mt-2 text-xs text-rose-600">{(createOrg.error as Error).message}</p>
            )}
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                disabled={!createForm.name.trim() || !createForm.email.trim() || createOrg.isPending}
                onClick={() => createOrg.mutate()}
              >
                {createOrg.isPending ? "Creating…" : "Create tenant"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setSelected(null)}>
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">{selected.name}</h3>
            <p className="text-sm text-slate-500">
              {selected.email} · {selected.status_display || selected.status}
              {selected.city ? ` · ${selected.city}` : ""}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {selected.user_count ?? 0} users · {selected.project_count ?? 0} projects
              {selected.approved_by_name ? ` · Approved by ${selected.approved_by_name}` : ""}
            </p>

            {isSuper && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">Trial days (on approve)</p>
                    <Input value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">Plan label</p>
                    <Input value={plan} onChange={(e) => setPlan(e.target.value)} />
                  </div>
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-semibold text-slate-500">Package</p>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
                    value={packageId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPackageId(id);
                      const pkg = packages.find((p) => String(p.id) === id);
                      if (pkg) {
                        setPlan(pkg.name);
                        setTrialDays(String(pkg.trial_days || 15));
                        setModules(pkg.module_keys || []);
                      }
                    }}
                  >
                    <option value="">Default / current</option>
                    {packages.filter((p) => p.is_active).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ₹{Number(p.price).toLocaleString("en-IN")} ({p.trial_days}d)
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  placeholder="Payment / commercial notes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />

                {(selected.status === "trial" || selected.trial_ends_at) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/50">
                    <p className="text-[11px] font-semibold text-slate-500">Trial ends</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {selected.trial_ends_at
                        ? new Date(selected.trial_ends_at).toLocaleString()
                        : "Not set — use + days to start a trial window"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        disabled={adjustTrial.isPending}
                        onClick={() => adjustTrial.mutate(1)}
                      >
                        <Plus className="h-3 w-3" /> +1 day
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        disabled={adjustTrial.isPending}
                        onClick={() => adjustTrial.mutate(7)}
                      >
                        <Plus className="h-3 w-3" /> +7 days
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        disabled={adjustTrial.isPending}
                        onClick={() => adjustTrial.mutate(-1)}
                      >
                        <Minus className="h-3 w-3" /> −1 day
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        disabled={adjustTrial.isPending}
                        onClick={() => adjustTrial.mutate(-7)}
                      >
                        <Minus className="h-3 w-3" /> −7 days
                      </Button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Modules for this company</p>
                    <Button
                      variant="outline"
                      className="h-7 text-[11px]"
                      disabled={saveModules.isPending}
                      onClick={() => saveModules.mutate()}
                    >
                      Save modules
                    </Button>
                  </div>
                  <div className="grid max-h-40 gap-1 overflow-y-auto sm:grid-cols-2">
                    {(catalog?.modules || []).map((m) => {
                      const on = modules.includes(m.key);
                      return (
                        <label
                          key={m.key}
                          className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px]",
                            on
                              ? "border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                              : "border-slate-200 dark:border-slate-700",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on || !!m.locked}
                            disabled={!!m.locked}
                            onChange={() => {
                              if (m.locked) return;
                              setModules((prev) =>
                                prev.includes(m.key) ? prev.filter((k) => k !== m.key) : [...prev, m.key],
                              );
                            }}
                          />
                          {m.label}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    Company Admin / users only see pages enabled here (package + Super Admin).
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Corporate documents</p>
                      <p className="text-xs text-slate-500">
                        Status:{" "}
                        <strong>
                          {selected.docs_verification_status_display || selected.docs_verification_status || "—"}
                        </strong>
                        {selected.document_count != null ? ` · ${selected.document_count} file(s)` : ""}
                      </p>
                      {selected.docs_rejection_reason ? (
                        <p className="mt-1 text-xs text-rose-600">{selected.docs_rejection_reason}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        className="h-8 gap-1 text-xs"
                        disabled={verifyDocs.isPending}
                        onClick={() => verifyDocs.mutate("verified")}
                      >
                        Mark docs verified
                      </Button>
                      <Button
                        variant="danger"
                        className="h-8 text-xs"
                        disabled={verifyDocs.isPending}
                        onClick={() => verifyDocs.mutate("rejected")}
                      >
                        Reject docs
                      </Button>
                    </div>
                  </div>
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                    {(selected.documents || []).length === 0 ? (
                      <li className="text-xs text-slate-400">No documents uploaded yet — upload below.</li>
                    ) : (
                      (selected.documents || []).map((d) => (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-xs dark:border-slate-800"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                              {d.doc_type_display || d.doc_type}
                              {d.label ? ` · ${d.label}` : ""}
                            </p>
                            <p className="text-slate-400">{d.status_display || d.status}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {d.file_url ? (
                              <a
                                href={d.file_url.startsWith("http") ? d.file_url : fileUrl(d.file_url) || d.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded px-1.5 py-0.5 font-semibold text-blue-600 hover:underline"
                              >
                                View
                              </a>
                            ) : null}
                            {d.status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700"
                                  onClick={() => reviewDoc.mutate({ docId: d.id, status: "approved" })}
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700"
                                  onClick={() => reviewDoc.mutate({ docId: d.id, status: "rejected" })}
                                >
                                  No
                                </button>
                              </>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                  <label className="mt-2 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
                    {uploadDocs.isPending ? "Uploading…" : "Upload / add documents"}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) uploadDocs.mutate(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {(selected.status === "pending" || selected.status === "rejected") && (
                  <div className="space-y-2">
                    {selected.docs_verification_status !== "verified" && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                        Verify corporate documents before Approve. Or use force override if needed.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="gap-1.5"
                        onClick={() => approve.mutate("trial")}
                        disabled={approve.isPending || selected.docs_verification_status !== "verified"}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve + Trial
                      </Button>
                      <Button
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => approve.mutate("active")}
                        disabled={approve.isPending || selected.docs_verification_status !== "verified"}
                      >
                        Approve + Paid
                      </Button>
                      <Button
                        variant="outline"
                        className="text-xs"
                        disabled={approve.isPending}
                        onClick={() => {
                          if (!confirm("Force approve without document verification?")) return;
                          api
                            .approveOrganization(selected.id, {
                              mode: "trial",
                              force: true,
                              trial_days: Number(trialDays) || 15,
                              plan_label: plan,
                              payment_notes: paymentNotes,
                              ...packagePayload(),
                            })
                            .then((org) => {
                              invalidate();
                              setSelected(org);
                            });
                        }}
                      >
                        Force approve
                      </Button>
                      {selected.status === "pending" && (
                        <Button variant="danger" className="gap-1.5" onClick={() => reject.mutate()} disabled={reject.isPending}>
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {(selected.status === "trial" || selected.status === "active") && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-1.5" onClick={() => setPay.mutate()} disabled={setPay.isPending}>
                      Save plan / notes
                    </Button>
                    {selected.status === "trial" && (
                      <Button
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                        disabled={recordPayment.isPending}
                        onClick={() => recordPayment.mutate()}
                      >
                        Payment success → Unlock
                      </Button>
                    )}
                    <Button variant="danger" className="gap-1.5" onClick={() => suspend.mutate()} disabled={suspend.isPending}>
                      <PauseCircle className="h-4 w-4" /> Suspend tenant
                    </Button>
                  </div>
                )}

                {selected.status === "suspended" && (
                  <div className="flex flex-wrap gap-2">
                    <Button className="gap-1.5" onClick={() => reactivate.mutate("trial")} disabled={reactivate.isPending}>
                      <PlayCircle className="h-4 w-4" /> Reactivate + Trial
                    </Button>
                    <Button
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => reactivate.mutate("active")}
                      disabled={reactivate.isPending}
                    >
                      <PlayCircle className="h-4 w-4" /> Reactivate + Paid
                    </Button>
                  </div>
                )}

                {(adjustTrial.isError || saveModules.isError || recordPayment.isError) && (
                  <p className="text-xs text-rose-600">
                    {(
                      (adjustTrial.error || saveModules.error || recordPayment.error) as Error
                    )?.message || "Action failed"}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">HRMS employee sync</p>
              <Input
                placeholder="HRMS company id"
                value={hrmsCompanyId}
                onChange={(e) => setHrmsCompanyId(e.target.value)}
              />
              <Input
                placeholder="HRMS JWT (company admin)"
                value={hrmsToken}
                onChange={(e) => setHrmsToken(e.target.value)}
              />
              <Button
                className="w-full gap-2"
                variant="outline"
                disabled={!hrmsToken || sync.isPending}
                onClick={() => sync.mutate()}
              >
                <Link2 className="h-4 w-4" />
                {sync.isPending ? "Syncing…" : "Fetch employees from HRMS"}
              </Button>
              {sync.isSuccess && (
                <p className="text-xs text-emerald-600">
                  Fetched {sync.data.fetched}: +{sync.data.created} created, {sync.data.updated} updated
                </p>
              )}
              {sync.isError && <p className="text-xs text-rose-600">{(sync.error as Error).message}</p>}
            </div>

            <Button variant="outline" className="mt-4 w-full" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
