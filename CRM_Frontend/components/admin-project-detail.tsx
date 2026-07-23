"use client";

import { Badge, Button, Card, Input, MetricCard, Skeleton } from "@/components/ui";
import { api, setProjectId, type ProductItem, type Project } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  Package,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const STATUS_LABELS: Record<string, string> = {
  order_confirmed: "Order Confirmed",
  interested: "Interested",
  follow_up: "Follow Up",
  not_interested: "Not Interested",
  callback: "Callback",
};

const COLORS = ["#7c3aed", "#2563eb", "#10b981", "#f59e0b", "#f43f5e"];

export function AdminProjectDetailPage({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Project | null>(null);
  const [productForm, setProductForm] = useState({ name: "", description: "" });
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.project(projectId),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-dashboard", { project: String(projectId) }],
    queryFn: () => api.adminDashboard({ project: String(projectId) }),
  });

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads", { project: projectId }],
    queryFn: () => api.leads({ project: projectId, page: 1 }),
  });

  const { data: form } = useQuery({
    queryKey: ["custom-form", projectId],
    queryFn: () => api.customForm(projectId),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users(),
  });

  const { data: products } = useQuery({
    queryKey: ["products", projectId],
    queryFn: () => api.products(projectId),
  });

  useEffect(() => {
    setProjectId(String(projectId));
  }, [projectId]);

  const update = useMutation({
    mutationFn: () =>
      api.updateProject(editing!.id, {
        name: editing!.name,
        description: editing!.description,
        color: editing!.color,
        is_active: editing!.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setEditing(null);
    },
  });

  const createProduct = useMutation({
    mutationFn: () => api.createProduct({ project: projectId, name: productForm.name, description: productForm.description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", projectId] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setProductForm({ name: "", description: "" });
    },
  });

  const updateProduct = useMutation({
    mutationFn: () =>
      api.updateProduct(editingProduct!.id, {
        name: editingProduct!.name,
        description: editingProduct!.description,
        is_active: editingProduct!.is_active,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", projectId] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setEditingProduct(null);
    },
  });

  const removeProduct = useMutation({
    mutationFn: (id: number) => api.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", projectId] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  const toggleActive = () => {
    if (!project) return;
    api.updateProject(project.id, { is_active: !project.is_active }).then(() => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    });
  };

  const assignedUsers = (users || []).filter((u) =>
    u.assigned_project_ids?.includes(projectId)
  );

  const disposition = (stats?.disposition || []).map((d) => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count,
  }));

  const projectSubmissions = (stats?.recent_submissions || []).filter(
    (s) => s.project_name === project?.name
  );

  if (projectLoading) {
    return <Skeleton className="h-96 rounded-3xl" />;
  }

  if (!project) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-500">Project not found.</p>
        <Link href="/admin/projects" className="mt-4 inline-block text-sm font-medium text-indigo-600">
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link
        href="/admin/projects"
        className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      <section
        className="relative overflow-hidden rounded-3xl border border-slate-200/80 p-6 text-white shadow-xl sm:p-8"
        style={{ background: `linear-gradient(135deg, ${project.color} 0%, #1e293b 100%)` }}
      >
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <FolderKanban className="h-7 w-7" />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button onClick={toggleActive}>
                  <Badge
                    status={project.is_active ? "approved" : "rejected"}
                    label={project.is_active ? "Active" : "Inactive"}
                  />
                </button>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium">
                  {project.slug}
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{project.name}</h2>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                {project.description || "No description provided."}
              </p>
              <p className="mt-2 text-xs text-white/60">
                Created {new Date(project.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setEditing(project)}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit Project
            </Button>
            <Link href="/admin/forms">
              <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <FileText className="mr-1.5 h-4 w-4" />
                Form Builder
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {statsLoading || !stats ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : (
        <>
          <section>
            <h3 className="text-base font-bold text-slate-900">Project Metrics</h3>
            <p className="mt-0.5 text-sm text-slate-500">Live stats for {project.name}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total Leads" value={stats.total_leads} icon={Users} variant="slate" />
              <MetricCard label="Orders Confirmed" value={stats.orders_confirmed} icon={CheckCircle2} variant="emerald" accent="text-emerald-700" />
              <MetricCard label="Conversion Rate" value={`${stats.conversion_rate}%`} icon={TrendingUp} variant="violet" accent="text-violet-700" />
              <MetricCard label="Follow-ups Today" value={stats.follow_ups_due_today} icon={CalendarClock} variant="amber" accent="text-amber-700" />
              <MetricCard label="Overdue Follow-ups" value={stats.overdue_follow_ups ?? 0} icon={ClipboardList} variant="slate" accent="text-rose-600" />
              <MetricCard label="Visits Today" value={stats.visits_scheduled_today} icon={CalendarClock} variant="blue" accent="text-blue-700" />
              <MetricCard label="Forms Filled Today" value={stats.forms_filled_today} icon={FileText} variant="violet" accent="text-violet-700" />
              <MetricCard label="Assigned Team" value={assignedUsers.length} icon={Users} variant="emerald" accent="text-emerald-700" />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800">Lead Disposition</h3>
              <p className="mt-0.5 text-xs text-slate-400">Status breakdown for this project</p>
              <div className="mt-4">
                {disposition.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={disposition} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                        {disposition.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-8 text-center text-sm text-slate-400">No leads yet</p>
                )}
              </div>
            </div>

            <Card>
              <h3 className="text-sm font-bold text-slate-800">Custom Form</h3>
              <p className="mt-0.5 text-xs text-slate-400">Onboarding form for this project</p>
              {form ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{form.title}</p>
                      <p className="text-xs text-slate-500">{form.schema?.length || 0} fields configured</p>
                    </div>
                    <Badge status={form.is_active ? "approved" : "rejected"} label={form.is_active ? "Active" : "Inactive"} />
                  </div>
                  <Link href="/admin/forms" className="inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Open in Form Builder →
                  </Link>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">No form configured yet.</p>
              )}
            </Card>
          </div>
        </>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-900">Products</h3>
              <p className="text-xs text-slate-500">Manage products under {project.name}</p>
            </div>
          </div>
        </div>
        <div className="border-b border-slate-100 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Product name (e.g. FBA)"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
            />
            <Input
              placeholder="Description"
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
            />
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!productForm.name || createProduct.isPending}
              onClick={() => createProduct.mutate()}
            >
              <Plus className="mr-1 h-4 w-4" />
              {createProduct.isPending ? "Adding..." : "Add Product"}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Leads</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!(products || []).length ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No products yet — add one above</td></tr>
              ) : (products || []).map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.description || "—"}</p>
                  </td>
                  <td className="px-5 py-3">{p.lead_count ?? 0}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        api.updateProduct(p.id, { is_active: !p.is_active }).then(() => {
                          qc.invalidateQueries({ queryKey: ["products", projectId] });
                          qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
                        })
                      }
                    >
                      <Badge status={p.is_active ? "approved" : "rejected"} label={p.is_active ? "Active" : "Inactive"} />
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditingProduct(p)} className="rounded-lg p-1.5 hover:bg-slate-100">
                        <Pencil className="h-4 w-4 text-slate-500" />
                      </button>
                      <button
                        type="button"
                        onClick={() => confirm(`Delete ${p.name}?`) && removeProduct.mutate(p.id)}
                        className="rounded-lg p-1.5 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-bold text-slate-900">Recent Leads</h3>
            <p className="text-xs text-slate-500">Latest merchants in {project.name}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Merchant</th>
                  <th className="px-5 py-3">City</th>
                  <th className="px-5 py-3">BDM</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {leadsLoading ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">Loading...</td></tr>
                ) : !(leadsData?.results || []).length ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No leads yet</td></tr>
                ) : (leadsData?.results || []).slice(0, 8).map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-900">{l.merchant_name}</td>
                    <td className="px-5 py-3 text-slate-600">{l.merchant_city}</td>
                    <td className="px-5 py-3 text-slate-600">{l.bdm_name}</td>
                    <td className="px-5 py-3">
                      <Badge status="pending" label={l.status_display || l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-5 py-3">
            <Link href="/leads" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View all leads →
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-bold text-slate-900">Assigned Team</h3>
            <p className="text-xs text-slate-500">Users working on this project</p>
          </div>
          <div className="divide-y divide-slate-100">
            {!assignedUsers.length ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">No users assigned yet</p>
            ) : assignedUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="font-medium text-slate-900">{u.first_name || u.username}</p>
                  <p className="text-xs text-slate-500">{u.role}</p>
                </div>
                <span className="text-xs text-slate-400">@{u.username}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {projectSubmissions.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="font-bold text-slate-900">Recent Form Submissions</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {projectSubmissions.slice(0, 5).map((s) => (
              <div key={s.id} className="px-5 py-3">
                <p className="font-medium text-slate-900">{s.lead_name}</p>
                <p className="text-xs text-slate-500">
                  {s.submitted_by_name} · {new Date(s.submitted_at).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <h3 className="mb-4 text-lg font-bold">Edit Project</h3>
            <div className="space-y-3">
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <div className="flex gap-2">
                <input
                  type="color"
                  value={editing.color}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                  className="h-11 w-12 cursor-pointer rounded-xl border border-slate-200"
                />
                <Input value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => update.mutate()} disabled={update.isPending}>
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <h3 className="mb-4 text-lg font-bold">Edit Product</h3>
            <div className="space-y-3">
              <Input value={editingProduct.name} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              <Input
                value={editingProduct.description}
                onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => updateProduct.mutate()} disabled={updateProduct.isPending}>
                Save
              </Button>
              <Button variant="outline" onClick={() => setEditingProduct(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
