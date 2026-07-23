"use client";

import { Badge, Button, Card, Input } from "@/components/ui";
import { api, type Project } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FolderKanban,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function AdminProjectsPage() {
  const qc = useQueryClient();
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const [form, setForm] = useState({ name: "", description: "", color: "#2563eb" });
  const [editing, setEditing] = useState<Project | null>(null);

  const stats = useMemo(() => {
    const list = projects || [];
    return {
      total: list.length,
      active: list.filter((p) => p.is_active).length,
      leads: list.reduce((sum, p) => sum + (p.lead_count ?? 0), 0),
    };
  }, [projects]);

  const create = useMutation({
    mutationFn: () => api.createProject(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setForm({ name: "", description: "", color: "#2563eb" });
    },
  });

  const update = useMutation({
    mutationFn: () =>
      api.updateProject(editing!.id, {
        name: editing!.name,
        description: editing!.description,
        color: editing!.color,
        is_active: editing!.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const toggleActive = (p: Project) => {
    api.updateProject(p.id, { is_active: !p.is_active }).then(() => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    });
  };

  return (
    <div className="space-y-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 shadow-sm">
              <FolderKanban className="h-7 w-7 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Project Management</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Create projects, set brand colors, activate or deactivate onboarding pipelines.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatPill label="Total" value={stats.total} />
            <StatPill label="Active" value={stats.active} accent="text-emerald-600" />
            <StatPill label="Leads" value={stats.leads} accent="text-indigo-600" />
          </div>
        </div>
      </section>

      <Card>
        <div className="mb-5 flex items-center gap-2">
          <FolderPlus className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Add New Project</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Project Name</label>
            <Input placeholder="e.g. Amazon, Flipkart" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Description</label>
            <Input placeholder="Merchant onboarding" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Brand Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-11 w-12 cursor-pointer rounded-xl border border-slate-200"
              />
              <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={!form.name || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Adding..." : "Add Project"}
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <h3 className="mb-4 text-lg font-bold text-slate-900">All Projects ({projects?.length || 0})</h3>
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-slate-400 shadow-sm">
            Loading projects...
          </div>
        ) : !(projects || []).length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-12 text-center text-slate-400">
            No projects yet. Add your first project above.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(projects || []).map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onEdit={() => setEditing(p)}
                onDelete={() => confirm(`Delete ${p.name}?`) && remove.mutate(p.id)}
                onToggleActive={() => toggleActive(p)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <h3 className="mb-4 text-lg font-bold">Edit Project</h3>
            <div className="space-y-3">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <Input value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => update.mutate()} disabled={update.isPending}>
                Save
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project: p,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const router = useRouter();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/admin/projects/${p.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/admin/projects/${p.id}`)}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md"
    >
      <div className="h-1.5 transition group-hover:h-2" style={{ backgroundColor: p.color }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-bold text-slate-900 group-hover:text-indigo-600">{p.name}</h4>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{p.description || "No description"}</p>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
          >
            <Badge status={p.is_active ? "approved" : "rejected"} label={p.is_active ? "Active" : "Inactive"} />
          </button>
        </div>
        <p className="mt-4 text-2xl font-bold text-slate-900">{p.lead_count ?? 0}</p>
        <p className="text-xs text-slate-500">Total leads</p>
        <p className="mt-2 text-[11px] font-medium text-indigo-500 opacity-0 transition group-hover:opacity-100">
          Click to view details →
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-xs"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-xs text-rose-600 hover:bg-rose-50"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
      <p className={cn("text-xl font-bold", accent || "text-slate-900")}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}
