"use client";

import { Badge, Button, Input } from "@/components/ui";
import { api, type Organization } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Link2, XCircle } from "lucide-react";
import { useState } from "react";

export function OrganizationsAdminView() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { data: orgs, isLoading } = useQuery({ queryKey: ["organizations"], queryFn: api.organizations });
  const [selected, setSelected] = useState<Organization | null>(null);
  const [trialDays, setTrialDays] = useState("14");
  const [plan, setPlan] = useState("Trial");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [hrmsToken, setHrmsToken] = useState("");
  const [hrmsCompanyId, setHrmsCompanyId] = useState("");
  const isSuper = me?.role === "SuperAdmin" || me?.is_superadmin;

  const approve = useMutation({
    mutationFn: (mode: "trial" | "active") =>
      api.approveOrganization(selected!.id, {
        mode,
        trial_days: Number(trialDays) || 14,
        plan_label: plan,
        payment_notes: paymentNotes,
        is_public: true,
      }),
    onSuccess: (org) => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      setSelected(org);
    },
  });

  const reject = useMutation({
    mutationFn: () => api.rejectOrganization(selected!.id, { reason: paymentNotes || "Rejected" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      setSelected(null);
    },
  });

  const setPay = useMutation({
    mutationFn: () =>
      api.setOrganizationPayment(selected!.id, {
        status: "active",
        plan_label: plan || "Paid",
        payment_notes: paymentNotes,
        hrms_connected: !!hrmsCompanyId,
        hrms_company_id: hrmsCompanyId,
      }),
    onSuccess: (org) => {
      qc.invalidateQueries({ queryKey: ["organizations"] });
      setSelected(org);
    },
  });

  const sync = useMutation({
    mutationFn: () => api.syncHrmsEmployees(selected!.id, { hrms_token: hrmsToken, force: true }),
  });

  if (!isSuper && me?.role !== "Admin") {
    return <p className="text-sm text-slate-500">Only Super Admin / Admin can manage companies.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-300">Super Admin</p>
            <h1 className="mt-1 text-2xl font-bold">Companies</h1>
            <p className="mt-1 text-sm text-slate-300">
              Approve registration · set trial / payment · publish · sync HRMS employees in one place.
            </p>
          </div>
          <Building2 className="h-10 w-10 text-indigo-300/60" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {isLoading ? (
          <div className="h-40 animate-pulse bg-slate-100" />
        ) : !(orgs || []).length ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">No companies yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(orgs || []).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{o.name}</p>
                    <Badge
                      status={o.status === "active" || o.status === "trial" ? "approved" : o.status === "rejected" ? "rejected" : "pending"}
                      label={o.status_display || o.status}
                    />
                    {o.hrms_connected && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">HRMS</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {o.email} · {o.plan_label || "—"} · {o.user_count ?? 0} users · {o.project_count ?? 0} projects
                  </p>
                </div>
                <Button variant="outline" className="h-8 text-xs" onClick={() => {
                  setSelected(o);
                  setPlan(o.plan_label || "Trial");
                  setPaymentNotes(o.payment_notes || "");
                  setHrmsCompanyId(o.hrms_company_id || "");
                }}>
                  Manage
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{selected.name}</h3>
            <p className="text-sm text-slate-500">{selected.email} · {selected.status_display}</p>

            {isSuper && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">Trial days</p>
                    <Input value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">Plan label</p>
                    <Input value={plan} onChange={(e) => setPlan(e.target.value)} />
                  </div>
                </div>
                <Input placeholder="Payment / commercial notes" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button className="gap-1.5" onClick={() => approve.mutate("trial")} disabled={approve.isPending}>
                    <CheckCircle2 className="h-4 w-4" /> Approve + Trial
                  </Button>
                  <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => approve.mutate("active")} disabled={approve.isPending}>
                    Approve + Paid
                  </Button>
                  <Button variant="danger" className="gap-1.5" onClick={() => reject.mutate()} disabled={reject.isPending}>
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                </div>
                <Button variant="outline" className="w-full" onClick={() => setPay.mutate()} disabled={setPay.isPending}>
                  Save payment / plan decision
                </Button>
              </div>
            )}

            <div className="mt-5 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">HRMS employee sync</p>
              <Input placeholder="HRMS company id" value={hrmsCompanyId} onChange={(e) => setHrmsCompanyId(e.target.value)} />
              <Input placeholder="HRMS JWT (company admin)" value={hrmsToken} onChange={(e) => setHrmsToken(e.target.value)} />
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

            <Button variant="outline" className="mt-4 w-full" onClick={() => setSelected(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
