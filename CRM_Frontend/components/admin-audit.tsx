"use client";

import { Button, Card, Input } from "@/components/ui";
import { api, type AuditLogEntry } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

const ENTITY_OPTIONS = ["", "Lead", "LeadVisit", "FormSubmission", "LeadDocument", "User", "Team", "BulkUploadJob"];

export function AdminAuditPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: logs = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["audit-logs", search, entityType, action, from, to],
    queryFn: () =>
      api.auditLogs({
        q: search || undefined,
        entity_type: entityType || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const log of logs) {
      byType[log.entity_type] = (byType[log.entity_type] || 0) + 1;
    }
    return {
      total: logs.length,
      users: new Set(logs.map((l) => l.actor).filter(Boolean)).size,
      types: Object.keys(byType).length,
    };
  }, [logs]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <ClipboardList className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Audit Log</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-300">
                Trail of lead, visit, form, user and bulk-upload activity across the CRM.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Events" value={stats.total} />
            <Stat label="Actors" value={stats.users} />
            <Stat label="Types" value={stats.types} />
          </div>
        </div>
      </section>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Search</label>
            <Search className="pointer-events-none absolute left-3 top-9 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(q.trim())}
              placeholder="Message, action, username..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Entity</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="">All</option>
              {ENTITY_OPTIONS.filter(Boolean).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Action contains</label>
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="lead.created" className="w-40" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setSearch(q.trim())}>
            Apply
          </Button>
          <Button variant="outline" className="gap-1" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Refresh
          </Button>
        </div>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : !logs.length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No audit events yet</td></tr>
            ) : logs.map((log) => (
              <AuditRow key={log.id} log={log} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Showing latest {logs.length} matching events (max 200).</p>
    </div>
  );
}

function AuditRow({ log }: { log: AuditLogEntry }) {
  const when = new Date(log.created_at).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40">
      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{when}</td>
      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{log.actor_name}</td>
      <td className="px-4 py-3">
        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          {log.action}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {log.entity_type}{log.entity_id != null ? ` #${log.entity_id}` : ""}
      </td>
      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{log.message}</td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2 text-center backdrop-blur">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-300">{label}</p>
    </div>
  );
}
