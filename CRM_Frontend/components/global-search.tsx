"use client";

import { api, setProjectId } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, FolderKanban, Loader2, Package, Search, Target, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export function GlobalSearch() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const isAdmin = me?.role === "Admin";

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length >= 2,
  });

  const empty = useMemo(() => {
    if (!data) return true;
    return !data.leads.length && !data.companies.length && !data.products.length && !data.projects.length;
  }, [data]);

  const switchProject = (projectId: number) => {
    setProjectId(String(projectId));
    qc.invalidateQueries();
  };

  const goLead = (id: number) => {
    setOpen(false);
    setQ("");
    router.push(`/leads?lead=${id}`);
  };

  const goProject = (id: number) => {
    switchProject(id);
    setOpen(false);
    setQ("");
    router.push(isAdmin ? `/admin/projects/${id}` : "/dashboard");
  };

  const goCompany = (projectId: number) => {
    switchProject(projectId);
    setOpen(false);
    setQ("");
    router.push("/leads");
  };

  const goProduct = (projectId: number) => {
    switchProject(projectId);
    setOpen(false);
    setQ("");
    router.push(isAdmin ? `/admin/projects/${projectId}` : "/dashboard");
  };

  return (
    <div className={cn("relative min-w-0 flex-1", "md:max-w-md lg:max-w-lg")} ref={ref}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search leads, companies, products... (Ctrl+K)"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-16 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {q && (
            <button type="button" onClick={() => setQ("")} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">⌘K</kbd>
        </div>
      </div>

      {open && (q.length >= 2 || isFetching) && (
        <div className="absolute z-40 mt-2 max-h-[70vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {isFetching && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </div>
          )}
          {!isFetching && debounced.length >= 2 && empty && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No results for “{debounced}”</p>
          )}
          {data && !empty && (
            <div className="py-2">
              <ResultGroup title="Leads" icon={Target} items={data.leads} render={(l) => (
                <button key={l.id} type="button" onClick={() => goLead(l.id)} className={rowCls}>
                  <p className="truncate font-medium text-slate-900">{l.merchant_name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {l.project_name}{l.product_name ? ` · ${l.product_name}` : ""} · {l.city || "—"} · {l.status}
                  </p>
                </button>
              )} />
              <ResultGroup title="Companies" icon={Building2} items={data.companies} render={(c) => (
                <button key={c.id} type="button" onClick={() => goCompany(c.project_id)} className={rowCls}>
                  <p className="truncate font-medium text-slate-900">{c.name}</p>
                  <p className="truncate text-xs text-slate-500">{c.project_name} · {c.city || "—"} · {c.mobile}</p>
                </button>
              )} />
              <ResultGroup title="Products" icon={Package} items={data.products} render={(p) => (
                <button key={p.id} type="button" onClick={() => goProduct(p.project_id)} className={rowCls}>
                  <p className="truncate font-medium text-slate-900">{p.name}</p>
                  <p className="truncate text-xs text-slate-500">{p.project_name}</p>
                </button>
              )} />
              <ResultGroup title="Projects" icon={FolderKanban} items={data.projects} render={(p) => (
                <button key={p.id} type="button" onClick={() => goProject(p.id)} className={rowCls}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <p className="truncate font-medium text-slate-900">{p.name}</p>
                  </div>
                  <p className="truncate text-xs text-slate-500">{p.description || "Project"}</p>
                </button>
              )} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const rowCls = "block w-full px-4 py-2.5 text-left hover:bg-slate-50";

function ResultGroup<T>({
  title,
  icon: Icon,
  items,
  render,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {items.map(render)}
    </div>
  );
}
