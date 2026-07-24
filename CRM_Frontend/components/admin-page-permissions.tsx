"use client";

import { Button } from "@/components/ui";
import { api, type PagePermissionMatrix } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, RotateCcw, Save, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ROLES = ["Manager", "TL", "BDM"] as const;

export function AdminPagePermissions() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["page-permissions"],
    queryFn: api.pagePermissions,
  });
  const [draft, setDraft] = useState<PagePermissionMatrix | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (data) setDraft(structuredClone(data));
  }, [data]);

  const dirty = useMemo(() => {
    if (!data || !draft) return false;
    return JSON.stringify(data) !== JSON.stringify(draft);
  }, [data, draft]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return null;
      const permissions = draft.pages.flatMap((page) =>
        ROLES.map((role) => ({
          page_key: page.page_key,
          role,
          enabled: page.locked ? true : !!page.roles[role],
        })),
      );
      return api.updatePagePermissions(permissions);
    },
    onSuccess: (result) => {
      if (result) {
        qc.setQueryData(["page-permissions"], result);
        setDraft(structuredClone(result));
      }
      qc.invalidateQueries({ queryKey: ["me"] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    },
  });

  const toggle = (pageKey: string, role: (typeof ROLES)[number]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        pages: prev.pages.map((p) => {
          if (p.page_key !== pageKey || p.locked) return p;
          return {
            ...p,
            roles: { ...p.roles, [role]: !p.roles[role] },
          };
        }),
      };
    });
  };

  const setRoleColumn = (role: (typeof ROLES)[number], enabled: boolean) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        pages: prev.pages.map((p) =>
          p.locked
            ? p
            : {
                ...p,
                roles: { ...p.roles, [role]: enabled },
              },
        ),
      };
    });
  };

  if (isLoading || !draft) {
    return <div className="h-72 animate-pulse rounded-2xl bg-slate-900" />;
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-8 text-center">
        <p className="font-semibold text-rose-300">Could not load permissions</p>
        <button type="button" onClick={() => refetch()} className="mt-2 text-sm text-rose-200 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-700/80 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#0f172a_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-300">
              <KeyRound className="h-3.5 w-3.5" />
              Access control
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">Page permissions</h2>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-400">
              Decide which CRM pages Manager, TL and BDM can open. Admin console stays Admin-only.
              Changes apply to sidebar and page access immediately after save.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!dirty || save.isPending}
              onClick={() => data && setDraft(structuredClone(data))}
              className="h-10 gap-1.5 border-slate-600 bg-slate-950 text-slate-200 hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate()}
              className="h-10 gap-1.5 bg-sky-500 text-slate-950 hover:bg-sky-400"
            >
              {savedFlash ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {save.isPending ? "Saving…" : savedFlash ? "Saved" : "Save permissions"}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
          <Shield className="h-4 w-4 text-sky-300" />
          <p className="text-sm font-semibold text-slate-100">Role × page matrix</p>
          <p className="text-xs text-slate-500">Profile is always on · Admin pages are not listed here</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Page</th>
                {ROLES.map((role) => (
                  <th key={role} className="px-4 py-3 text-center font-semibold">
                    <div className="space-y-2">
                      <div>{role}</div>
                      <div className="flex justify-center gap-1 normal-case tracking-normal">
                        <button
                          type="button"
                          onClick={() => setRoleColumn(role, true)}
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/10"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setRoleColumn(role, false)}
                          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-800"
                        >
                          None
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.pages.map((page) => (
                <tr key={page.page_key} className="border-t border-slate-800">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-slate-100">{page.label}</p>
                    <p className="text-xs text-slate-500">
                      {page.href}
                      {page.locked ? " · always allowed" : ""}
                    </p>
                    {page.description && <p className="mt-0.5 text-xs text-slate-600">{page.description}</p>}
                  </td>
                  {ROLES.map((role) => {
                    const on = !!page.roles[role];
                    return (
                      <td key={role} className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          disabled={page.locked}
                          onClick={() => toggle(page.page_key, role)}
                          className={cn(
                            "relative inline-flex h-7 w-12 items-center rounded-full transition",
                            page.locked && "cursor-not-allowed opacity-70",
                            on ? "bg-emerald-500" : "bg-slate-700",
                          )}
                          aria-label={`${page.label} for ${role}`}
                        >
                          <span
                            className={cn(
                              "inline-block h-5 w-5 rounded-full bg-white transition",
                              on ? "translate-x-6" : "translate-x-1",
                            )}
                          />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
