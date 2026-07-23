"use client";

import { Badge, Button, Card } from "@/components/ui";
import { api, type DuplicateGroup, type Lead } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, GitMerge, Phone, RefreshCw, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function DuplicatesPage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const canMerge = !!me && (me.role === "Admin" || me.role === "Manager" || me.role === "TL");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["duplicate-groups"],
    queryFn: api.duplicateGroups,
  });

  const groups = data?.groups || [];
  const merchantCount = data?.count ?? 0;
  const totalInGroups = data?.duplicate_leads ?? 0;
  const extraRecords = Math.max(0, totalInGroups - merchantCount);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 p-5 shadow-sm ring-1 ring-white/5 sm:p-6 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-400/30">
              <Copy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Duplicate Leads</h1>
              <p className="mt-1 max-w-xl text-sm text-slate-400">
                Merchants with more than one lead in the same project — pick a primary and merge the rest.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex h-10 items-center gap-1.5 self-start rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Duplicate merchants" value={merchantCount} accent="text-amber-300" />
          <Stat label="Extra lead records" value={extraRecords} accent="text-orange-300" />
          <Stat label="Total in groups" value={totalInGroups} accent="text-sky-300" />
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-8 text-center text-sm text-slate-400">
          Scanning for duplicates…
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-8 text-center ring-1 ring-emerald-500/10">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-200">No duplicate leads in this project scope</p>
          <p className="mt-1 text-xs text-slate-500">New leads with an existing mobile are blocked at creation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <DuplicateGroupCard
              key={`${group.project_id}-${group.merchant_id}`}
              group={group}
              canMerge={canMerge}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DuplicateGroupCard({ group, canMerge }: { group: DuplicateGroup; canMerge: boolean }) {
  const qc = useQueryClient();
  const [primaryId, setPrimaryId] = useState(group.leads[0]?.id ?? 0);

  const merge = useMutation({
    mutationFn: () => {
      const sourceIds = group.leads.filter((l) => l.id !== primaryId).map((l) => l.id);
      return api.mergeLeads(primaryId, sourceIds);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["duplicate-groups"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["pipeline"] });
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      qc.invalidateQueries({ queryKey: ["visits"] });
      qc.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });

  const sourceCount = group.leads.filter((l) => l.id !== primaryId).length;

  const handleMerge = () => {
    if (!confirm(`Merge ${sourceCount} duplicate lead(s) into lead #${primaryId}? This cannot be undone.`)) return;
    merge.mutate();
  };

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/70 p-0 dark:ring-1 dark:ring-white/5">
      <div className="border-b border-slate-800 bg-slate-950/50 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-100">{group.merchant_name}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {group.project_name} ·{" "}
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {group.mobile}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/25">
              {group.lead_count} leads
            </span>
            {canMerge && sourceCount > 0 && (
              <Button className="h-8 gap-1 px-3 text-xs" disabled={merge.isPending} onClick={handleMerge}>
                <GitMerge className="h-3.5 w-3.5" />
                {merge.isPending ? "Merging…" : `Merge into #${primaryId}`}
              </Button>
            )}
          </div>
        </div>
        {merge.isError && (
          <p className="mt-2 text-xs text-rose-400">{(merge.error as Error).message || "Merge failed"}</p>
        )}
        {merge.isSuccess && (
          <p className="mt-2 text-xs text-emerald-400">Merged successfully — refresh if the group still appears.</p>
        )}
      </div>
      <div className="divide-y divide-slate-800">
        {group.leads.map((lead) => (
          <LeadRow
            key={lead.id}
            lead={lead}
            canMerge={canMerge}
            isPrimary={lead.id === primaryId}
            radioName={`primary-${group.project_id}-${group.merchant_id}`}
            onSelectPrimary={() => setPrimaryId(lead.id)}
          />
        ))}
      </div>
    </Card>
  );
}

function LeadRow({
  lead,
  canMerge,
  isPrimary,
  radioName,
  onSelectPrimary,
}: {
  lead: Lead;
  canMerge: boolean;
  isPrimary: boolean;
  radioName: string;
  onSelectPrimary: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition sm:px-5",
        isPrimary ? "bg-blue-500/10" : "hover:bg-white/[0.03]",
      )}
    >
      <div className="flex items-start gap-3">
        {canMerge && (
          <input
            type="radio"
            name={radioName}
            checked={isPrimary}
            onChange={onSelectPrimary}
            className="mt-1"
            title="Keep this as primary lead"
          />
        )}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-300">#{lead.id}</span>
            {isPrimary && (
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
                Primary
              </span>
            )}
            <Badge status={lead.status} label={lead.status_display} />
            <span className="text-xs text-slate-500">{lead.product_name || "No product"}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {lead.bdm_name}
            </span>
            {lead.follow_up_date && <span className="ml-3">Follow-up: {lead.follow_up_date}</span>}
          </p>
        </div>
      </div>
      <Link
        href={`/leads?lead=${lead.id}`}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-300"
      >
        Open lead
      </Link>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums tracking-tight", accent)}>{value}</p>
    </div>
  );
}
