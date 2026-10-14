"use client";

import { Badge, Button, Input } from "@/components/ui";
import { api, type VerificationWork } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, Play, RotateCcw, UserPlus, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export function VerificationQueueView() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ["verification-summary"],
    queryFn: api.verificationSummary,
    refetchInterval: 15_000,
  });
  const [filter, setFilter] = useState<"open" | "mine" | "all">("open");
  const { data: works, isLoading, refetch: refetchWorks } = useQuery({
    queryKey: ["verification-works", filter],
    queryFn: () =>
      api.verificationWorks(
        filter === "mine" ? { mine: true } : filter === "open" ? { open: true } : undefined,
      ),
    refetchInterval: 15_000,
  });
  const { data: assignees } = useQuery({
    queryKey: ["verification-assignees"],
    queryFn: api.verificationAssignees,
    enabled: !!me && ["Admin", "SuperAdmin", "Manager", "TL"].includes(me.role),
  });

  const [selected, setSelected] = useState<VerificationWork | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [allowEdit, setAllowEdit] = useState(true);

  const canAssign = !!me && ["Admin", "SuperAdmin", "Manager", "TL"].includes(me.role);
  const list = useMemo(() => works || [], [works]);

  const assign = useMutation({
    mutationFn: () =>
      api.assignVerification(selected!.id, {
        assigned_to: Number(assigneeId),
        assign_notes: assignNotes,
        allow_edit: allowEdit,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification-works"] });
      qc.invalidateQueries({ queryKey: ["verification-summary"] });
      setSelected(null);
      setAssigneeId("");
      setAssignNotes("");
    },
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "start" | "complete" | "reject" | "reopen" }) => {
      if (action === "start") return api.startVerification(id);
      if (action === "complete") return api.completeVerification(id, { completion_notes: decisionNotes, approve_documents: true });
      if (action === "reject") return api.rejectVerification(id, { completion_notes: decisionNotes });
      return api.reopenVerification(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification-works"] });
      qc.invalidateQueries({ queryKey: ["verification-summary"] });
      setSelected(null);
      setDecisionNotes("");
    },
  });

  const canDecide = (w: VerificationWork) => {
    if (w.status === "done" || w.status === "rejected") return false;
    if (canAssign) return true;
    return w.assigned_to === me?.id && ["assigned", "in_progress", "reopened"].includes(w.status);
  };

  const openReview = (w: VerificationWork) => {
    setSelected(w);
    setAssigneeId("");
    setAssignNotes("");
    setDecisionNotes("");
    setAllowEdit(true);
  };

  const assigneeOptions = [...(assignees?.ops || []), ...(assignees?.team || [])];

  const previewRows = (w: VerificationWork) => {
    if ((w.form_schema || []).length > 0) {
      return w.form_schema!.map((f) => {
        const raw = w.answers?.[f.field_id];
        const preview = (w.answer_preview || []).find((a) => a.field_id === f.field_id);
        const val =
          preview?.value ??
          (raw == null || raw === "" ? "—" : typeof raw === "string" ? raw : JSON.stringify(raw));
        return { key: f.field_id, label: f.label, value: val };
      });
    }
    return (w.answer_preview || []).map((a) => ({ key: a.field_id, label: a.label, value: a.value }));
  };

  return (
    <div className="mx-auto max-w-[1080px] space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Verification</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Desk</h1>
            <p className="mt-1 text-sm text-slate-500">Review a submission, approve it, or assign it to Ops.</p>
          </div>
          <ClipboardCheck className="hidden h-8 w-8 text-slate-300 dark:text-slate-600 sm:block" />
        </div>
        <div className="grid grid-cols-2 divide-slate-100 sm:grid-cols-5 sm:divide-x dark:divide-slate-800">
          {[
            { k: "open", label: "Open", v: summary?.open ?? 0 },
            { k: "assigned", label: "Assigned", v: summary?.assigned ?? 0 },
            { k: "in_progress", label: "In progress", v: summary?.in_progress ?? 0 },
            { k: "done", label: "Approved", v: summary?.done ?? 0 },
            { k: "mine", label: "My queue", v: summary?.mine ?? 0 },
          ].map((m) => (
            <div key={m.k} className="px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{m.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{m.v}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {([
          ["open", "Needs action"],
          ["mine", "Assigned to me"],
          ["all", "All"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              filter === key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="h-40 animate-pulse bg-slate-50 dark:bg-slate-800" />
        ) : list.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-500">Nothing in this queue.</p>
            <button
              type="button"
              className="mt-3 text-xs font-semibold text-slate-700 underline dark:text-slate-300"
              onClick={() => {
                void refetchSummary();
                void refetchWorks();
              }}
            >
              Refresh
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((w) => (
              <li key={w.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{w.title}</p>
                    <Badge
                      status={w.status === "done" ? "approved" : w.status === "rejected" ? "rejected" : "pending"}
                      label={w.status === "done" ? "Approved" : w.status_display || w.status}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {w.lead_name} · {w.project_name || "—"}
                    {w.assigned_to_name ? ` · ${w.assigned_to_name}` : " · Unassigned"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {canDecide(w) && (
                    <Button
                      className="h-8 gap-1.5 bg-emerald-600 px-3 text-xs hover:bg-emerald-700"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ id: w.id, action: "complete" })}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                  )}
                  <Link href={`/leads?lead=${w.lead}`} className="inline-flex h-8 items-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                    Open lead
                  </Link>
                  <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => openReview(w)}>
                    Review
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 sm:items-center" onClick={() => setSelected(null)}>
          <div
            className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{selected.title}</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {selected.lead_name} · {selected.status === "done" ? "Approved" : selected.status_display}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                Close
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-4">
              {previewRows(selected).length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
                    Submitted data
                  </p>
                  <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewRows(selected).map((row) => (
                      <div key={row.key} className="grid grid-cols-[minmax(0,42%)_1fr] gap-3 px-3 py-2 text-sm">
                        <dt className="text-slate-500">{row.label}</dt>
                        <dd className="truncate text-right font-medium text-slate-900 dark:text-slate-100">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {canAssign && ["open", "reopened", "assigned"].includes(selected.status) && (
                <div className="space-y-2.5 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assign</p>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                  >
                    <option value="">Select Ops / team member…</option>
                    {assigneeOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name || u.username} ({u.role})
                      </option>
                    ))}
                  </select>
                  <Input placeholder="Note for assignee" value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} />
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={allowEdit} onChange={(e) => setAllowEdit(e.target.checked)} />
                    Allow assignee to edit answers
                  </label>
                  <Button className="w-full gap-2" disabled={!assigneeId || assign.isPending} onClick={() => assign.mutate()}>
                    <UserPlus className="h-4 w-4" />
                    {assign.isPending ? "Assigning…" : "Assign"}
                  </Button>
                </div>
              )}

              {selected.status !== "done" && selected.status !== "rejected" && (
                <Input
                  placeholder="Note (optional)"
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                />
              )}
              {(assign.isError || act.isError) && (
                <p className="text-sm text-rose-600">
                  {(assign.error as Error)?.message || (act.error as Error)?.message || "Action failed"}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
              {canDecide(selected) && (
                <Button
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ id: selected.id, action: "complete" })}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {act.isPending ? "Saving…" : "Approve"}
                </Button>
              )}
              {selected.assigned_to && selected.status === "assigned" && (
                <Button variant="outline" className="gap-1.5" onClick={() => act.mutate({ id: selected.id, action: "start" })}>
                  <Play className="h-4 w-4" /> Start
                </Button>
              )}
              {selected.status !== "rejected" && selected.status !== "done" && (
                <Button variant="danger" className="gap-1.5" disabled={act.isPending} onClick={() => act.mutate({ id: selected.id, action: "reject" })}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              )}
              {canAssign && ["done", "rejected"].includes(selected.status) && (
                <Button variant="outline" className="gap-1.5" onClick={() => act.mutate({ id: selected.id, action: "reopen" })}>
                  <RotateCcw className="h-4 w-4" /> Reopen
                </Button>
              )}
              <Button variant="ghost" className="ml-auto" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
