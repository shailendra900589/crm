"use client";

import { Button, Input } from "@/components/ui";
import { api, type OrgRole, type OrgRolePage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Shield, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const BASE_ROLES = ["Manager", "TL", "BDM", "Ops"] as const;

type Draft = {
  name: string;
  description: string;
  base_role: string;
  is_active: boolean;
  pages: OrgRolePage[];
};

function emptyDraft(catalog: OrgRolePage[] = []): Draft {
  return {
    name: "",
    description: "",
    base_role: "BDM",
    is_active: true,
    pages: catalog.map((p) => ({ ...p, enabled: p.locked ? true : !!p.enabled })),
  };
}

export function AdminRolesPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["org-roles"],
    queryFn: () => api.orgRoles(),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<"view" | "create" | "edit">("view");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const roles = data?.results || [];
  const catalog = useMemo(() => {
    const fromRole = roles[0]?.pages;
    if (fromRole?.length) {
      return fromRole.map((p) => ({ ...p, enabled: !!p.locked }));
    }
    return (data?.page_catalog || []).map((p) => ({
      page_key: p.page_key,
      label: p.label,
      href: p.href,
      description: p.description || "",
      locked: !!p.locked,
      enabled: !!p.locked,
    }));
  }, [data, roles]);

  const selected = roles.find((r) => r.id === selectedId) || roles[0] || null;

  useEffect(() => {
    if (!selectedId && roles.length) setSelectedId(roles[0].id);
  }, [roles, selectedId]);

  useEffect(() => {
    if (mode === "view" && selected) {
      setDraft({
        name: selected.name,
        description: selected.description || "",
        base_role: selected.base_role,
        is_active: selected.is_active !== false,
        pages: (selected.pages || []).map((p) => ({ ...p })),
      });
    }
  }, [selected, mode]);

  const patchRolesCache = (updater: (results: OrgRole[]) => OrgRole[]) => {
    qc.setQueryData(["org-roles"], (old: unknown) => {
      const base =
        old && typeof old === "object"
          ? (old as {
              results?: OrgRole[];
              page_catalog?: OrgRolePage[];
              base_roles?: { value: string; label: string }[];
            })
          : {};
      return {
        results: updater(Array.isArray(base.results) ? base.results : []),
        page_catalog: base.page_catalog || data?.page_catalog || [],
        base_roles: base.base_roles || data?.base_roles || [],
      };
    });
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["org-roles"] });
    void qc.invalidateQueries({ queryKey: ["me"] });
    void qc.invalidateQueries({ queryKey: ["users"] });
  };

  const create = useMutation({
    mutationFn: () =>
      api.createOrgRole({
        name: draft!.name.trim(),
        description: draft!.description,
        base_role: draft!.base_role,
        pages: draft!.pages.map((p) => ({ page_key: p.page_key, enabled: p.locked ? true : !!p.enabled })),
      }),
    onSuccess: (role) => {
      patchRolesCache((results) => [...results.filter((r) => r.id !== role.id), role]);
      invalidate();
      setSelectedId(role.id);
      setMode("view");
      setFlash("Role created");
      setTimeout(() => setFlash(""), 2000);
      setError("");
    },
    onError: (e: Error) => setError(e.message || "Create failed"),
  });

  const update = useMutation({
    mutationFn: () =>
      api.updateOrgRole(selectedId!, {
        name: draft!.name.trim(),
        description: draft!.description,
        base_role: draft!.base_role,
        is_active: draft!.is_active,
        pages: draft!.pages.map((p) => ({ page_key: p.page_key, enabled: p.locked ? true : !!p.enabled })),
      }),
    onSuccess: (role) => {
      patchRolesCache((results) => results.map((r) => (r.id === role.id ? role : r)));
      invalidate();
      setMode("view");
      setFlash("Role updated");
      setTimeout(() => setFlash(""), 2000);
      setError("");
    },
    onError: (e: Error) => setError(e.message || "Update failed"),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteOrgRole(id),
    onSuccess: (_data, id) => {
      patchRolesCache((results) => results.filter((r) => r.id !== id));
      invalidate();
      setSelectedId(null);
      setMode("view");
      setFlash("Role deleted");
      setTimeout(() => setFlash(""), 2000);
    },
    onError: (e: Error) => setError(e.message || "Delete failed"),
  });

  const startCreate = () => {
    setMode("create");
    setDraft(emptyDraft(catalog as OrgRolePage[]));
    setError("");
  };

  const startEdit = () => {
    if (!selected) return;
    setMode("edit");
    setDraft({
      name: selected.name,
      description: selected.description || "",
      base_role: selected.base_role,
      is_active: selected.is_active !== false,
      pages: (selected.pages || []).map((p) => ({ ...p })),
    });
    setError("");
  };

  const togglePage = (pageKey: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((p) =>
          p.page_key === pageKey || p.locked ? p : { ...p, enabled: !p.enabled },
        ),
      };
    });
  };

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-8 text-center">
        <p className="font-semibold text-rose-300">Could not load roles</p>
        <button type="button" onClick={() => refetch()} className="mt-2 text-sm underline">
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="h-72 animate-pulse rounded-2xl bg-slate-900" />;
  }

  const editing = mode === "create" || mode === "edit";
  const showRole: OrgRole | null = mode === "create" ? null : selected;

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <section className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-500/20">
              <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Roles & permissions</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
                Create custom roles, update page access for Manager / TL / BDM / Ops, then assign roles on Users.
              </p>
            </div>
          </div>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={startCreate}>
            <Plus className="h-4 w-4" /> Create role
          </Button>
        </div>
        {flash && <p className="mt-3 text-sm font-medium text-emerald-600">{flash}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Roles</p>
          <div className="space-y-1">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedId(r.id);
                  setMode("view");
                  setError("");
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
                  selectedId === r.id && mode !== "create"
                    ? "bg-indigo-50 font-semibold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800",
                )}
              >
                <span>
                  {r.name}
                  {r.is_system ? (
                    <span className="ml-1 text-[10px] font-medium text-slate-400">system</span>
                  ) : null}
                </span>
                <span className="text-[10px] text-slate-400">{r.users_count || 0}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          {!draft ? (
            <p className="text-sm text-slate-400">Select or create a role.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {mode === "create" ? "New role" : showRole?.name || "Role"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {!editing && showRole && (
                    <>
                      <Button variant="outline" className="gap-1" onClick={startEdit}>
                        <Pencil className="h-3.5 w-3.5" /> Update
                      </Button>
                      {!showRole.is_system && (
                        <Button
                          variant="outline"
                          className="gap-1 text-rose-600"
                          onClick={() =>
                            confirm(`Delete role “${showRole.name}”?`) && remove.mutate(showRole.id)
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      )}
                    </>
                  )}
                  {editing && (
                    <>
                      <Button
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setMode("view");
                          setError("");
                        }}
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                      <Button
                        className="gap-1 bg-indigo-600 hover:bg-indigo-700"
                        disabled={
                          !draft.name.trim() || create.isPending || update.isPending
                        }
                        onClick={() => (mode === "create" ? create.mutate() : update.mutate())}
                      >
                        <Save className="h-3.5 w-3.5" />
                        {mode === "create" ? "Create" : "Save"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Role name *</span>
                  <Input
                    value={draft.name}
                    disabled={!editing || (!!showRole?.is_system && mode === "edit")}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="e.g. Senior BDM / HR Ops"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">
                    Base capability *
                  </span>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50 dark:border-slate-600 dark:bg-slate-950"
                    value={draft.base_role}
                    disabled={!editing || !!showRole?.is_system}
                    onChange={(e) => setDraft({ ...draft, base_role: e.target.value })}
                  >
                    {BASE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Controls hierarchy (leads, assign, verify). Pages below control menu access.
                  </span>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Description</span>
                  <Input
                    value={draft.description}
                    disabled={!editing}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Optional"
                  />
                </label>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Page permissions
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {draft.pages.map((p) => (
                    <label
                      key={p.page_key}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
                        p.enabled
                          ? "border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/30 dark:bg-indigo-500/10"
                          : "border-slate-200 dark:border-slate-700",
                        p.locked || !editing ? "opacity-80" : "cursor-pointer",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={!!p.enabled}
                        disabled={!editing || !!p.locked}
                        onChange={() => togglePage(p.page_key)}
                      />
                      <span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{p.label}</span>
                        {p.locked && (
                          <span className="ml-1 text-[10px] text-slate-400">always on</span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-slate-500">{p.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
