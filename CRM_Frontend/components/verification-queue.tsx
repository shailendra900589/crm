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
  const [notes, setNotes] = useState("");
  const [allowEdit, setAllowEdit] = useState(true);

  const canAssign = !!me && ["Admin", "SuperAdmin", "Manager", "TL"].includes(me.role);
  const list = useMemo(() => works || [], [works]);

  const canVerifyWork = (w: VerificationWork) => {
    if (["done", "rejected"].includes(w.status)) return false;
    if (canAssign) return true; // Admin / Manager / TL can verify any open work
    return !!w.assigned_to && (w.assigned_to === me?.id || w.status === "in_progress" || w.status === "assigned");
  };

  const assign = useMutation({
    mutationFn: () =>
      api.assignVerification(selected!.id, {
        assigned_to: Number(assigneeId),
        assign_notes: notes,
        allow_edit: allowEdit,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification-works"] });
      qc.invalidateQueries({ queryKey: ["verification-summary"] });
      setSelected(null);
      setAssigneeId("");
      setNotes("");
    },
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "start" | "complete" | "reject" | "reopen" }) => {
      if (action === "start") return api.startVerification(id);
      if (action === "complete") return api.completeVerification(id, { completion_notes: notes, approve_documents: true });
      if (action === "reject") return api.rejectVerification(id, { completion_notes: notes });
      return api.reopenVerification(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification-works"] });
      qc.invalidateQueries({ queryKey: ["verification-summary"] });
      setSelected(null);
      setNotes("");
    },
  });

  const assigneeOptions = [...(assignees?.ops || []), ...(assignees?.team || [])];
  const showVerifyActions =
    !!selected &&
    canVerifyWork(selected) &&
    ["open", "reopened", "assigned", "in_progress"].includes(selected.status);

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-4 text-white shadow-lg dark:border-slate-700 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200/80">Workflow</p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Verification desk</h1>
            <p className="mt-1 max-w-xl text-xs text-slate-300 sm:text-sm">
              Review submitted forms, verify leads here, or assign Ops. Open lead opens the full lead record.
            </p>
          </div>
          <ClipboardCheck className="h-10 w-10 text-blue-300/70" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { k: "open", label: "Open", v: summary?.open ?? 0 },
            { k: "assigned", label: "Assigned", v: summary?.assigned ?? 0 },
            { k: "in_progress", label: "In progress", v: summary?.in_progress ?? 0 },
            { k: "done", label: "Done", v: summary?.done ?? 0 },
            { k: "mine", label: "My queue", v: summary?.mine ?? 0 },
          ].map((m) => (
            <div key={m.k} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">{m.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              filter === key
                ? "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-200"
                : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {isLoading ? (
          <div className="h-40 animate-pulse bg-slate-100 dark:bg-slate-800" />
        ) : list.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-400">No verification tasks in this view.</p>
            <button
              type="button"
              className="mt-3 text-xs font-semibold text-sky-400 hover:underline"
              onClick={() => {
                void refetchSummary();
                void refetchWorks();
              }}
            >
              Refresh queue
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-50">{w.title}</p>
                    <Badge
                      status={w.status === "done" ? "approved" : w.status === "rejected" ? "rejected" : "pending"}
                      label={w.status_display || w.status}
                    />
                    {w.priority !== "normal" && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                        {w.priority}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {w.lead_name} · {w.project_name || "—"}
                    {w.assigned_to_name ? ` · → ${w.assigned_to_name}` : " · Unassigned"}
                    {(w.answer_preview || []).length > 0 ? ` · ${w.answer_preview!.length} answers` : ""}
                  </p>
                  {(w.answer_preview || []).length > 0 && (
                    <p className="mt-1 truncate text-[11px] text-slate-400">
                      {w.answer_preview!.slice(0, 2).map((a) => `${a.label}: ${a.value}`).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canVerifyWork(w) && (
                    <Button
                      className="h-8 gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700"
                      onClick={() => {
                        setNotes("");
                        setSelected(w);
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verify
                    </Button>
                  )}
                  <Link
                    href={`/leads?lead=${w.lead}`}
                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Open lead
                  </Link>
                  <Button
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      setNotes("");
                      setSelected(w);
                    }}
                  >
                    Actions
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selected.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{selected.lead_name} · {selected.status_display}</p>

            {(selected.answer_preview || []).length > 0 && (
              <div className="mt-4 max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">BDM submitted data</p>
                {(selected.form_schema || []).length > 0
                  ? selected.form_schema!.map((f) => {
                      const raw = selected.answers?.[f.field_id];
                      const preview = (selected.answer_preview || []).find((a) => a.field_id === f.field_id);
                      const val =
                        preview?.value ??
                        (raw == null || raw === "" ? "—" : typeof raw === "string" ? raw : JSON.stringify(raw));
                      return (
                        <div key={f.field_id} className="flex items-start justify-between gap-2 text-xs">
                          <span className="shrink-0 font-medium text-slate-600 dark:text-slate-400">{f.label}</span>
                          <span className="min-w-0 truncate text-right text-slate-900 dark:text-slate-100">{val}</span>
                        </div>
                      );
                    })
                  : selected.answer_preview!.map((a) => (
                      <div key={a.field_id} className="flex items-start justify-between gap-2 text-xs">
                        <span className="shrink-0 font-medium text-slate-600 dark:text-slate-400">{a.label}</span>
                        <span className="min-w-0 truncate text-right text-slate-900 dark:text-slate-100">{a.value}</span>
                      </div>
                    ))}
              </div>
            )}

            {showVerifyActions && (
              <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                  Verify this lead
                </p>
                <Input
                  placeholder="Verification notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: selected.id, action: "complete" })}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {act.isPending ? "Saving…" : "Approve / Verify"}
                  </Button>
                  <Button
                    variant="danger"
                    className="gap-1.5"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: selected.id, action: "reject" })}
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            )}

            {canAssign && ["open", "reopened", "assigned"].includes(selected.status) && (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Or assign to Ops / team</p>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-950"
                >
                  <option value="">Select Ops / team member…</option>
                  {assigneeOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name || u.username} ({u.role})
                    </option>
                  ))}
                </select>
                <Input placeholder="Assign notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={allowEdit} onChange={(e) => setAllowEdit(e.target.checked)} />
                  Allow assignee to edit form answers
                </label>
                <Button className="w-full gap-2" disabled={!assigneeId || assign.isPending} onClick={() => assign.mutate()}>
                  <UserPlus className="h-4 w-4" />
                  {assign.isPending ? "Assigning…" : "Assign now"}
                </Button>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {selected.assigned_to && selected.status === "assigned" && (
                <Button className="gap-1.5" onClick={() => act.mutate({ id: selected.id, action: "start" })}>
                  <Play className="h-4 w-4" /> Start
                </Button>
              )}
              {canAssign && ["done", "rejected"].includes(selected.status) && (
                <Button variant="outline" className="gap-1.5" onClick={() => act.mutate({ id: selected.id, action: "reopen" })}>
                  <RotateCcw className="h-4 w-4" /> Reopen
                </Button>
              )}
              <Link
                href={`/leads?lead=${selected.lead}`}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200"
              >
                Open lead
              </Link>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
            {(assign.isError || act.isError) && (
              <p className="mt-2 text-sm text-rose-600">
                {(assign.error as Error)?.message || (act.error as Error)?.message || "Action failed"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
