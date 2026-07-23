"use client";

import { Badge, Button, Card } from "@/components/ui";
import { api, type DuplicateGroup, type Lead } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, GitMerge, Phone, RefreshCw, User } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Copy className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Duplicate Leads</h1>
              <p className="mt-1 text-sm text-slate-600">
                Merchants with more than one lead in the same project — pick a primary record and merge the rest.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-amber-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Duplicate merchants" value={data?.count ?? 0} />
          <Stat label="Extra lead records" value={(data?.duplicate_leads ?? 0) - (data?.count ?? 0)} />
          <Stat label="Total leads in groups" value={data?.duplicate_leads ?? 0} />
        </div>
      </section>

      {isLoading ? (
        <Card><p className="text-sm text-slate-400">Scanning for duplicates…</p></Card>
      ) : groups.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No duplicate leads found in your current project scope.</p>
          <p className="mt-1 text-xs text-slate-400">New leads with an existing mobile are blocked at creation.</p>
        </Card>
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
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">{group.merchant_name}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {group.project_name} · <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{group.mobile}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              {group.lead_count} leads
            </span>
            {canMerge && sourceCount > 0 && (
              <Button
                className="h-8 gap-1 px-3 text-xs"
                disabled={merge.isPending}
                onClick={handleMerge}
              >
                <GitMerge className="h-3.5 w-3.5" />
                {merge.isPending ? "Merging…" : `Merge into #${primaryId}`}
              </Button>
            )}
          </div>
        </div>
        {merge.isError && (
          <p className="mt-2 text-xs text-rose-600">{(merge.error as Error).message || "Merge failed"}</p>
        )}
        {merge.isSuccess && (
          <p className="mt-2 text-xs text-emerald-700">Merged successfully — refresh if the group still appears.</p>
        )}
      </div>
      <div className="divide-y divide-slate-100">
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
  lead, canMerge, isPrimary, radioName, onSelectPrimary,
}: {
  lead: Lead;
  canMerge: boolean;
  isPrimary: boolean;
  radioName: string;
  onSelectPrimary: () => void;
}) {
  return (
    <div className={cn(
      "flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5",
      isPrimary && "bg-blue-50/50",
    )}>
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
            <span className="text-xs font-medium text-slate-700">#{lead.id}</span>
            {isPrimary && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
                Primary
              </span>
            )}
            <Badge status={lead.status} label={lead.status_display} />
            <span className="text-xs text-slate-500">{lead.product_name || "No product"}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{lead.bdm_name}</span>
            {lead.follow_up_date && <span className="ml-3">Follow-up: {lead.follow_up_date}</span>}
          </p>
        </div>
      </div>
      <Link
        href={`/leads?lead=${lead.id}`}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Open lead
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
