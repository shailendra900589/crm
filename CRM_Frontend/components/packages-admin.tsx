"use client";

import { Button, Input } from "@/components/ui";
import { api, type ModuleCatalogItem, type SubscriptionPackage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const emptyForm = (): Partial<SubscriptionPackage> => ({
  name: "",
  description: "",
  price: "4999",
  currency: "INR",
  trial_days: 15,
  module_keys: [],
  is_active: true,
  is_default: false,
  sort_order: 0,
});

export function PackagesAdminView() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const isSuper = me?.role === "SuperAdmin" || me?.is_superadmin;
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["packages"],
    queryFn: api.packages,
    enabled: !!isSuper,
  });
  const { data: catalog } = useQuery({
    queryKey: ["package-module-catalog"],
    queryFn: api.packageModuleCatalog,
    enabled: !!isSuper,
  });

  const modules = catalog?.modules || [];
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<Partial<SubscriptionPackage>>(emptyForm());

  const selected = useMemo(
    () => (typeof selectedId === "number" ? packages.find((p) => p.id === selectedId) : null),
    [packages, selectedId],
  );

  useEffect(() => {
    if (selectedId === "new") {
      const defaults = modules.filter((m) => m.default).map((m) => m.key);
      setForm({ ...emptyForm(), module_keys: defaults.length ? defaults : ["profile"] });
      return;
    }
    if (selected) {
      setForm({
        name: selected.name,
        description: selected.description || "",
        price: selected.price,
        currency: selected.currency || "INR",
        trial_days: selected.trial_days || 15,
        module_keys: selected.module_keys || [],
        is_active: selected.is_active,
        is_default: selected.is_default,
        sort_order: selected.sort_order || 0,
      });
    }
  }, [selectedId, selected, modules]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["packages"] });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: String(form.name || "").trim(),
        description: String(form.description || "").trim(),
        price: form.price,
        currency: form.currency || "INR",
        trial_days: Number(form.trial_days) || 15,
        module_keys: form.module_keys || [],
        is_active: !!form.is_active,
        is_default: !!form.is_default,
        sort_order: Number(form.sort_order) || 0,
      };
      if (!payload.name) throw new Error("Package name is required");
      if (selectedId === "new") return api.createPackage(payload);
      if (typeof selectedId === "number") return api.updatePackage(selectedId, payload);
      throw new Error("Select a package");
    },
    onSuccess: (pkg) => {
      invalidate();
      setSelectedId(pkg.id);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deletePackage(selectedId as number),
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
    },
  });

  const toggleModule = (key: string, locked?: boolean) => {
    if (locked) return;
    setForm((f) => {
      const cur = new Set(f.module_keys || []);
      if (cur.has(key)) cur.delete(key);
      else cur.add(key);
      if (!cur.has("profile")) cur.add("profile");
      return { ...f, module_keys: Array.from(cur) };
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ModuleCatalogItem[]>();
    for (const m of modules) {
      const g = m.group || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    }
    return Array.from(map.entries());
  }, [modules]);

  if (!isSuper) {
    return <p className="text-sm text-slate-500">Only Super Admin can manage packages.</p>;
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 text-white sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-300">Super Admin</p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Subscription packages</h1>
            <p className="mt-1 max-w-xl text-xs text-slate-300 sm:text-sm">
              Set budget, trial days, and which modules each company can open after subscribe / payment.
            </p>
          </div>
          <Button
            className="h-9 gap-1.5 bg-white text-slate-900 hover:bg-slate-100"
            onClick={() => setSelectedId("new")}
          >
            <Plus className="h-4 w-4" /> New package
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          {isLoading ? (
            <div className="h-40 animate-pulse bg-slate-100 dark:bg-slate-800" />
          ) : !packages.length ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">No packages yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {packages.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "flex w-full items-start gap-2 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60",
                      selectedId === p.id && "bg-indigo-50 dark:bg-indigo-500/10",
                    )}
                  >
                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {p.name}
                        {p.is_default ? (
                          <span className="ml-1 text-[10px] font-bold text-emerald-600">DEFAULT</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        ₹{Number(p.price).toLocaleString("en-IN")} · {p.trial_days}d trial · {(p.module_keys || []).length} modules
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedId == null ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400 dark:border-slate-700">
            Select a package or create a new one
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="mb-1 text-[11px] font-semibold text-slate-500">Package name</p>
                <Input value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1 text-[11px] font-semibold text-slate-500">Description</p>
                <Input
                  value={form.description || ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold text-slate-500">Budget / price (₹)</p>
                <Input
                  value={String(form.price ?? "")}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold text-slate-500">Trial days</p>
                <Input
                  value={String(form.trial_days ?? 15)}
                  onChange={(e) => setForm((f) => ({ ...f, trial_days: Number(e.target.value) || 15 }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={!!form.is_default}
                  onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                />
                Default for new trials
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={form.is_active !== false}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Active
              </label>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Modules included</p>
              <div className="space-y-3">
                {grouped.map(([group, items]) => (
                  <div key={group}>
                    <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">{group}</p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {items.map((m) => {
                        const on = (form.module_keys || []).includes(m.key);
                        return (
                          <label
                            key={m.key}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm",
                              on
                                ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                                : "border-slate-200 dark:border-slate-700",
                              m.locked && "opacity-80",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={on || !!m.locked}
                              disabled={!!m.locked}
                              onChange={() => toggleModule(m.key, m.locked)}
                            />
                            <span className="font-medium text-slate-800 dark:text-slate-100">{m.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(save.isError || remove.isError) && (
              <p className="text-sm text-rose-600">
                {((save.error || remove.error) as Error)?.message || "Save failed"}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button className="gap-1.5" onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="h-4 w-4" />
                {save.isPending ? "Saving…" : selectedId === "new" ? "Create package" : "Save package"}
              </Button>
              {typeof selectedId === "number" && !selected?.is_default && (
                <Button
                  variant="danger"
                  className="gap-1.5"
                  onClick={() => {
                    if (confirm("Delete this package?")) remove.mutate();
                  }}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
