"use client";

import { Button, Card, Input } from "@/components/ui";
import { api, type CrmUser } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Shield, UserRound } from "lucide-react";
import { useEffect, useState } from "react";

export function ProfilePage() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: api.me });

  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    mobile_number: "",
  });
  const [pwd, setPwd] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  useEffect(() => {
    if (!me) return;
    setProfile({
      first_name: me.first_name || "",
      last_name: me.last_name || "",
      email: me.email || "",
      mobile_number: me.mobile_number || "",
    });
  }, [me]);

  const saveProfile = useMutation({
    mutationFn: () => api.updateMe(profile),
    onSuccess: (user) => {
      qc.setQueryData(["me"], user);
      qc.invalidateQueries({ queryKey: ["me"] });
      setProfileMsg("Profile saved");
      setProfileErr("");
    },
    onError: (e: Error) => {
      setProfileErr(e.message || "Failed to save profile");
      setProfileMsg("");
    },
  });

  const changePassword = useMutation({
    mutationFn: () => api.changePassword(pwd),
    onSuccess: (res) => {
      setPwdMsg(res.detail || "Password updated");
      setPwdErr("");
      setPwd({ current_password: "", new_password: "", confirm_password: "" });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => {
      setPwdErr(e.message || "Failed to change password");
      setPwdMsg("");
    },
  });

  if (isLoading || !me) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold backdrop-blur">
              {(me.first_name || me.username || "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{me.first_name || me.username}</h2>
              <p className="mt-1 text-sm text-slate-300">@{me.username}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold">
                <Shield className="h-3.5 w-3.5" /> {me.role}
              </div>
            </div>
          </div>
          <ProfileMeta me={me} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Profile details</h3>
          </div>
          <div className="space-y-3">
            <Field label="Username">
              <Input value={me.username} disabled className="opacity-70" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <Input
                  value={profile.first_name}
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                />
              </Field>
              <Field label="Last name">
                <Input
                  value={profile.last_name}
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </Field>
            <Field label="Mobile">
              <Input
                value={profile.mobile_number}
                onChange={(e) => setProfile({ ...profile, mobile_number: e.target.value })}
              />
            </Field>
            {profileMsg && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> {profileMsg}
              </p>
            )}
            {profileErr && <p className="text-sm text-rose-600">{profileErr}</p>}
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={saveProfile.isPending}
              onClick={() => saveProfile.mutate()}
            >
              {saveProfile.isPending ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Change password</h3>
          </div>
          <div className="space-y-3">
            <Field label="Current password">
              <Input
                type="password"
                value={pwd.current_password}
                onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password">
              <Input
                type="password"
                value={pwd.new_password}
                onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
                autoComplete="new-password"
                placeholder="Min 6 characters"
              />
            </Field>
            <Field label="Confirm new password">
              <Input
                type="password"
                value={pwd.confirm_password}
                onChange={(e) => setPwd({ ...pwd, confirm_password: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
            {pwdMsg && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> {pwdMsg}
              </p>
            )}
            {pwdErr && <p className="text-sm text-rose-600">{pwdErr}</p>}
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={
                changePassword.isPending ||
                !pwd.current_password ||
                !pwd.new_password ||
                !pwd.confirm_password
              }
              onClick={() => changePassword.mutate()}
            >
              {changePassword.isPending ? "Updating..." : "Update password"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProfileMeta({ me }: { me: CrmUser }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <Meta label="Reports to" value={me.reports_to_name || "—"} />
      <Meta label="Projects" value={String((me.assigned_project_ids || []).length)} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}
