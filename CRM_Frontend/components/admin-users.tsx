"use client";

import { Badge, Button, Card, Input } from "@/components/ui";
import { api, type CreateUserData, type CrmUser, type UpdateUserData } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Shield, UserCog, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";

const ROLES: CrmUser["role"][] = ["Admin", "Manager", "TL", "BDM"];

const emptyCreate = (): CreateUserData => ({
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  role: "BDM",
  mobile_number: "",
  reports_to: null,
  assigned_projects: [],
});

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<CrmUser | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserData>(emptyCreate());
  const [editForm, setEditForm] = useState<UpdateUserData>({});
  const [error, setError] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users", "all"],
    queryFn: () => api.users({ all: true }),
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.projects });

  const managers = useMemo(
    () => users.filter((u) => ["Admin", "Manager", "TL"].includes(u.role) && u.is_active_user !== false),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        (u.first_name || "").toLowerCase().includes(q) ||
        (u.last_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.mobile_number || "").includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.is_active_user !== false).length,
    managers: users.filter((u) => u.role === "Manager").length,
    bdms: users.filter((u) => u.role === "BDM").length,
  }), [users]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["users"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    qc.invalidateQueries({ queryKey: ["admin-managers"] });
  };

  const create = useMutation({
    mutationFn: () => api.createUser(createForm),
    onSuccess: () => {
      invalidate();
      setModal(null);
      setCreateForm(emptyCreate());
      setError("");
    },
    onError: (e: Error) => setError(e.message || "Failed to create user"),
  });

  const update = useMutation({
    mutationFn: () => {
      const payload: UpdateUserData = { ...editForm };
      if (!payload.password) delete payload.password;
      return api.updateUser(editing!.id, payload);
    },
    onSuccess: () => {
      invalidate();
      setModal(null);
      setEditing(null);
      setError("");
    },
    onError: (e: Error) => setError(e.message || "Failed to update user"),
  });

  const deactivate = useMutation({
    mutationFn: (id: number) => api.deactivateUser(id),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setCreateForm(emptyCreate());
    setError("");
    setModal("create");
  };

  const openEdit = (u: CrmUser) => {
    setEditing(u);
    setEditForm({
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      email: u.email || "",
      role: u.role,
      mobile_number: u.mobile_number || "",
      reports_to: u.reports_to ?? null,
      assigned_projects: u.assigned_project_ids || [],
      is_active_user: u.is_active_user !== false,
      password: "",
    });
    setError("");
    setModal("edit");
  };

  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || `#${id}`;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 shadow-sm">
              <UserCog className="h-7 w-7 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Create employees, set roles, reporting line and project access.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total" value={stats.total} />
            <Stat label="Active" value={stats.active} accent="text-emerald-600" />
            <Stat label="Managers" value={stats.managers} />
            <Stat label="BDMs" value={stats.bdms} accent="text-indigo-600" />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-64 pl-9"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All Roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={openCreate}>
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Reports To</th>
              <th className="px-5 py-3">Projects</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : !filtered.length ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No users found</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-5 py-3">
                  <p className="font-semibold text-slate-900">{u.first_name || u.username}</p>
                  <p className="text-xs text-slate-500">@{u.username}{u.mobile_number ? ` · ${u.mobile_number}` : ""}</p>
                </td>
                <td className="px-5 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-5 py-3 text-slate-600">{u.reports_to_name || "—"}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(u.assigned_project_ids || []).slice(0, 3).map((id) => (
                      <span key={id} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {projectName(id)}
                      </span>
                    ))}
                    {(u.assigned_project_ids || []).length > 3 && (
                      <span className="text-[10px] text-slate-400">+{(u.assigned_project_ids || []).length - 3}</span>
                    )}
                    {!(u.assigned_project_ids || []).length && <span className="text-slate-400">—</span>}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge
                    status={u.is_active_user === false ? "rejected" : "approved"}
                    label={u.is_active_user === false ? "Inactive" : "Active"}
                  />
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEdit(u)} className="rounded-lg p-1.5 hover:bg-slate-100">
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </button>
                    {u.is_active_user !== false && (
                      <button
                        type="button"
                        onClick={() => confirm(`Deactivate ${u.username}?`) && deactivate.mutate(u.id)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal === "create" && (
        <UserModal
          title="Add User"
          error={error}
          onClose={() => setModal(null)}
          onSave={() => create.mutate()}
          saving={create.isPending}
          disabled={!createForm.username || !createForm.password}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Username *">
              <Input value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} />
            </Field>
            <Field label="Password *">
              <Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
            </Field>
            <Field label="First Name">
              <Input value={createForm.first_name} onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })} />
            </Field>
            <Field label="Last Name">
              <Input value={createForm.last_name} onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <Input value={createForm.mobile_number} onChange={(e) => setCreateForm({ ...createForm, mobile_number: e.target.value })} />
            </Field>
            <Field label="Role">
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as CrmUser["role"] })}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Reports To">
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={createForm.reports_to ?? ""}
                onChange={(e) => setCreateForm({ ...createForm, reports_to: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">None</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.first_name || m.username} ({m.role})</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Assigned Projects">
            <ProjectChecks
              projects={projects}
              selected={createForm.assigned_projects || []}
              onChange={(ids) => setCreateForm({ ...createForm, assigned_projects: ids })}
            />
          </Field>
        </UserModal>
      )}

      {modal === "edit" && editing && (
        <UserModal
          title={`Edit ${editing.username}`}
          error={error}
          onClose={() => setModal(null)}
          onSave={() => update.mutate()}
          saving={update.isPending}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First Name">
              <Input value={editForm.first_name || ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
            </Field>
            <Field label="Last Name">
              <Input value={editForm.last_name || ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <Input value={editForm.mobile_number || ""} onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value })} />
            </Field>
            <Field label="Role">
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as CrmUser["role"] })}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Reports To">
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={editForm.reports_to ?? ""}
                onChange={(e) => setEditForm({ ...editForm, reports_to: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">None</option>
                {managers.filter((m) => m.id !== editing.id).map((m) => (
                  <option key={m.id} value={m.id}>{m.first_name || m.username} ({m.role})</option>
                ))}
              </select>
            </Field>
            <Field label="New Password (optional)">
              <Input
                type="password"
                value={editForm.password || ""}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Leave blank to keep"
              />
            </Field>
            <Field label="Status">
              <label className="flex h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.is_active_user !== false}
                  onChange={(e) => setEditForm({ ...editForm, is_active_user: e.target.checked })}
                />
                Active user
              </label>
            </Field>
          </div>
          <Field label="Assigned Projects">
            <ProjectChecks
              projects={projects}
              selected={editForm.assigned_projects || []}
              onChange={(ids) => setEditForm({ ...editForm, assigned_projects: ids })}
            />
          </Field>
        </UserModal>
      )}
    </div>
  );
}

function UserModal({
  title, children, onClose, onSave, saving, disabled, error,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <div className="space-y-4">{children}</div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-5 flex gap-2">
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={onSave} disabled={saving || disabled}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}

function ProjectChecks({
  projects,
  selected,
  onChange,
}: {
  projects: { id: number; name: string; is_active: boolean }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
      {projects.filter((p) => p.is_active).map((p) => {
        const checked = selected.includes(p.id);
        return (
          <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))
              }
            />
            {p.name}
          </label>
        );
      })}
      {!projects.length && <p className="text-xs text-slate-400">No projects yet</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
      <p className={cn("text-xl font-bold", accent || "text-slate-900")}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    Admin: "bg-violet-100 text-violet-700",
    Manager: "bg-indigo-100 text-indigo-700",
    TL: "bg-blue-100 text-blue-700",
    BDM: "bg-slate-100 text-slate-700",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold", colors[role] || "bg-slate-100")}>
      {role === "Admin" ? <Shield className="h-3 w-3" /> : role === "Manager" ? <UserCog className="h-3 w-3" /> : <Users className="h-3 w-3" />}
      {role}
    </span>
  );
}
