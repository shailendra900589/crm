"use client";

import { api, type Team, type TeamMember } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLivePulse } from "@/components/live-sync";
import { Button, Input, MetricCard } from "@/components/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Plus,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

export function TeamView() {
  const { pulse } = useLivePulse();
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const { data: teams, isLoading } = useQuery({ queryKey: ["teams"], queryFn: api.teams });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const { data: allUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users(),
    enabled: !!me && ["Admin", "Manager", "TL"].includes(me.role),
  });

  const isAdmin = me?.role === "Admin";
  const canManage = me && ["Admin", "Manager", "TL"].includes(me.role);

  const [form, setForm] = useState({ name: "", project: "", manager: "" });
  const [reportId, setReportId] = useState<number | null>(null);
  const [manageTeam, setManageTeam] = useState<Team | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  const managers = useMemo(
    () => (allUsers || []).filter((u) => ["Manager", "TL", "Admin"].includes(u.role)),
    [allUsers]
  );

  const assignableEmployees = useMemo(() => {
    if (!allUsers) return [];
    const employees = allUsers.filter((u) => ["BDM", "TL"].includes(u.role));
    if (isAdmin) return employees;
    return employees;
  }, [allUsers, isAdmin]);

  const create = useMutation({
    mutationFn: () =>
      api.createTeam({
        name: form.name,
        project: Number(form.project),
        manager: isAdmin && form.manager ? Number(form.manager) : undefined,
        members: [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      setForm({ name: "", project: "", manager: "" });
    },
  });

  const updateMembers = useMutation({
    mutationFn: () =>
      api.updateTeam(manageTeam!.id, { members: selectedMembers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      setManageTeam(null);
    },
  });

  const removeTeam = useMutation({
    mutationFn: (id: number) => api.deleteTeam(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });

  const { data: report } = useQuery({
    queryKey: ["team-report", reportId],
    queryFn: () => api.teamReporting(reportId!),
    enabled: !!reportId,
  });

  const openManage = (team: Team) => {
    setManageTeam(team);
    setSelectedMembers(team.members || []);
    setMemberSearch("");
  };

  const filteredEmployees = assignableEmployees.filter((u) => {
    const q = memberSearch.toLowerCase();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      (u.first_name || "").toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <Users className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-slate-500">Team management is available for Admin, Manager and TL roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100">
            <Users className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Team Management</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isAdmin
                ? "Create teams under any manager and assign employees across the organization."
                : "Create teams and assign employees from your reporting hierarchy."}
            </p>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-indigo-600" />
          <h3 className="font-bold text-slate-900">Create New Team</h3>
        </div>
        <div className={cn("grid gap-3", isAdmin ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
          <Input
            placeholder="Team name (e.g. Amazon Field Team)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            value={form.project}
            onChange={(e) => setForm({ ...form, project: e.target.value })}
          >
            <option value="">Select project</option>
            {(projects || []).filter((p) => p.is_active).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {isAdmin && (
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              value={form.manager}
              onChange={(e) => setForm({ ...form, manager: e.target.value })}
            >
              <option value="">Assign manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name || m.username} ({m.role})
                </option>
              ))}
            </select>
          )}
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={!form.name || !form.project || (isAdmin && !form.manager) || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Creating..." : "Create Team"}
          </Button>
        </div>
        {isAdmin && (
          <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
            <Shield className="h-3.5 w-3.5" />
            As Admin, select which manager this team belongs to, then add employees below.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(Array.isArray(teams) ? teams : []).map((t) => (
          <TeamCard
            key={t.id}
            team={t}
            canDelete={isAdmin || t.manager === me?.id}
            onManage={() => openManage(t)}
            onReport={() => setReportId(t.id)}
            onDelete={() => {
              if (confirm(`Delete team "${t.name}"?`)) removeTeam.mutate(t.id);
            }}
          />
        ))}
        {isLoading && <p className="text-slate-400">Loading teams...</p>}
        {!isLoading && (!teams || teams.length === 0) && (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
            No teams yet. Create your first team above.
          </div>
        )}
      </div>

      {report && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900">{report.team.name} — Reporting</h3>
            </div>
            <Button variant="outline" onClick={() => setReportId(null)}>Close</Button>
          </div>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Total Leads" value={report.total_leads} pulse={pulse} />
            <MetricCard label="Confirmed" value={report.confirmed} variant="emerald" accent="text-emerald-700" />
            <MetricCard label="Conversion" value={`${report.conversion}%`} variant="blue" accent="text-blue-700" />
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-2 text-left">BDM</th><th className="py-2 text-left">Leads</th><th className="py-2 text-left">Confirmed</th></tr>
            </thead>
            <tbody>
              {report.leaderboard.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2">{r.bdm__first_name || r.bdm__username}</td>
                  <td className="py-2">{r.total}</td>
                  <td className="py-2 text-emerald-600">{r.confirmed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {manageTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Assign Team Members</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {manageTeam.name} · {manageTeam.project_name}
                  </p>
                  <p className="text-xs text-indigo-600">Manager: {manageTeam.manager_name}</p>
                </div>
                <button type="button" onClick={() => setManageTeam(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <Input
                placeholder="Search employees by name or role..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="mb-4"
              />
              <div className="space-y-2">
                {filteredEmployees.map((u) => {
                  const checked = selectedMembers.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition",
                        checked
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedMembers((prev) =>
                            e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{u.first_name || u.username}</p>
                        <p className="text-xs text-slate-500">{u.role} · @{u.username}</p>
                      </div>
                    </label>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-400">No employees found</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
              <Button
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                disabled={updateMembers.isPending}
                onClick={() => updateMembers.mutate()}
              >
                <UserPlus className="h-4 w-4" />
                {updateMembers.isPending ? "Saving..." : `Save (${selectedMembers.length} members)`}
              </Button>
              <Button variant="outline" onClick={() => setManageTeam(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamCard({
  team,
  canDelete,
  onManage,
  onReport,
  onDelete,
}: {
  team: Team;
  canDelete: boolean;
  onManage: () => void;
  onReport: () => void;
  onDelete: () => void;
}) {
  const members: TeamMember[] = team.member_details || team.members.map((id, i) => ({
    id,
    name: team.member_names?.[i] || `User #${id}`,
    role: "BDM",
    username: "",
  }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900">{team.name}</h3>
          <p className="text-sm text-slate-500">{team.project_name}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-indigo-600">
            <UserCog className="h-3.5 w-3.5" />
            Manager: {team.manager_name}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
          {members.length} members
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {members.length ? members.map((m) => (
          <span key={m.id} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {m.name} <span className="text-slate-400">({m.role})</span>
          </span>
        )) : (
          <span className="text-xs text-slate-400">No members assigned yet</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="gap-1 bg-indigo-600 text-xs hover:bg-indigo-700" onClick={onManage}>
          <UserPlus className="h-3.5 w-3.5" />
          Assign Members
        </Button>
        <Button variant="outline" className="text-xs" onClick={onReport}>Reporting</Button>
        {canDelete && (
          <Button variant="outline" className="gap-1 text-xs text-rose-600 hover:bg-rose-50" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
