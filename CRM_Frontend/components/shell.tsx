"use client";

import { GlobalSearch } from "@/components/global-search";
import { LiveSyncProvider, liveScopeForRole } from "@/components/live-sync";
import { NotificationsBell } from "@/components/notifications-bell";
import { useTheme } from "@/app/providers";
import { api, clearTokens, getProjectId, onProjectChange, setProjectId, type User } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BellRing,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Columns3,
  Copy,
  Crosshair,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Shield,
  Sun,
  Target,
  UserCog,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Role = "Admin" | "Manager" | "TL" | "BDM";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
};

/** Strict role menus — Admin console ≠ field workdesk */
const NAV: NavItem[] = [
  // Admin console
  { href: "/admin", label: "Org Dashboard", icon: Shield, roles: ["Admin"] },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban, roles: ["Admin"] },
  { href: "/admin/users", label: "Users", icon: UserCog, roles: ["Admin"] },
  { href: "/admin/forms", label: "Form Builder", icon: FileText, roles: ["Admin"] },
  { href: "/admin/audit", label: "Audit Log", icon: ClipboardList, roles: ["Admin"] },
  { href: "/team", label: "Teams", icon: Users, roles: ["Admin"] },
  { href: "/reports", label: "Org Reports", icon: BarChart3, roles: ["Admin"] },

  // Manager hub
  { href: "/dashboard", label: "Team Hub", icon: LayoutDashboard, roles: ["Manager"] },
  { href: "/leads", label: "Team Leads", icon: Target, roles: ["Manager"] },
  { href: "/pipeline", label: "Pipeline", icon: Columns3, roles: ["Manager"] },
  { href: "/duplicates", label: "Duplicates", icon: Copy, roles: ["Manager"] },
  { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock, roles: ["Manager"] },
  { href: "/alerts", label: "Alerts", icon: BellRing, roles: ["Manager"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["Manager"] },
  { href: "/targets", label: "Targets", icon: Crosshair, roles: ["Manager"] },
  { href: "/visits", label: "Visits", icon: CalendarDays, roles: ["Manager"] },
  { href: "/team", label: "My Teams", icon: Users, roles: ["Manager"] },

  // TL desk
  { href: "/dashboard", label: "TL Desk", icon: LayoutDashboard, roles: ["TL"] },
  { href: "/leads", label: "Leads", icon: Target, roles: ["TL"] },
  { href: "/pipeline", label: "Pipeline", icon: Columns3, roles: ["TL"] },
  { href: "/duplicates", label: "Duplicates", icon: Copy, roles: ["TL"] },
  { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock, roles: ["TL"] },
  { href: "/alerts", label: "Alerts", icon: BellRing, roles: ["TL"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["TL"] },
  { href: "/targets", label: "Targets", icon: Crosshair, roles: ["TL"] },
  { href: "/visits", label: "Visits", icon: CalendarDays, roles: ["TL"] },
  { href: "/team", label: "Squad", icon: Users, roles: ["TL"] },

  // BDM field workdesk
  { href: "/dashboard", label: "My Workdesk", icon: LayoutDashboard, roles: ["BDM"] },
  { href: "/leads", label: "My Leads", icon: Target, roles: ["BDM"] },
  { href: "/pipeline", label: "Pipeline", icon: Columns3, roles: ["BDM"] },
  { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock, roles: ["BDM"] },
  { href: "/alerts", label: "Alerts", icon: BellRing, roles: ["BDM"] },
  { href: "/visits", label: "My Visits", icon: CalendarDays, roles: ["BDM"] },
  { href: "/reports", label: "My Reports", icon: BarChart3, roles: ["BDM"] },
  { href: "/targets", label: "My Targets", icon: Crosshair, roles: ["BDM"] },

  { href: "/profile", label: "Profile", icon: UserRound, roles: ["Admin", "Manager", "TL", "BDM"] },
];

const ROLE_THEME: Record<
  Role,
  {
    brand: string;
    eyebrow: string;
    sidebarFrom: string;
    active: string;
    activeDark: string;
    badge: string;
  }
> = {
  Admin: {
    brand: "Admin Console",
    eyebrow: "Organization",
    sidebarFrom: "from-slate-800 to-slate-950",
    active: "bg-slate-100 text-slate-900",
    activeDark: "dark:bg-slate-800 dark:text-white",
    badge: "bg-slate-700 text-slate-100",
  },
  Manager: {
    brand: "Manager Hub",
    eyebrow: "Team leadership",
    sidebarFrom: "from-emerald-700 to-teal-900",
    active: "bg-emerald-50 text-emerald-800",
    activeDark: "dark:bg-emerald-950/50 dark:text-emerald-200",
    badge: "bg-emerald-600 text-white",
  },
  TL: {
    brand: "Team Lead Desk",
    eyebrow: "Squad ops",
    sidebarFrom: "from-amber-600 to-orange-800",
    active: "bg-amber-50 text-amber-900",
    activeDark: "dark:bg-amber-950/40 dark:text-amber-200",
    badge: "bg-amber-600 text-white",
  },
  BDM: {
    brand: "Field Workdesk",
    eyebrow: "Sales CRM",
    sidebarFrom: "from-blue-600 to-blue-800",
    active: "bg-blue-50 text-blue-700",
    activeDark: "dark:bg-blue-950/60 dark:text-blue-300",
    badge: "bg-blue-600 text-white",
  },
};

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const { data: user, isError } = useQuery({ queryKey: ["me"], queryFn: api.me, retry: false });
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  const [activeProject, setActiveProject] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = (user?.role || "BDM") as Role;
  const themeCfg = ROLE_THEME[role] || ROLE_THEME.BDM;

  useEffect(() => {
    if (isError) router.replace("/");
  }, [isError, router]);

  useEffect(() => {
    if (user?.role === "Admin" && pathname === "/dashboard") router.replace("/admin");
  }, [user, pathname, router]);

  useEffect(() => {
    if (user && pathname.startsWith("/admin") && user.role !== "Admin") {
      router.replace("/dashboard");
    }
  }, [user, pathname, router]);

  useEffect(() => {
    if (!projects?.length) return;
    const saved = getProjectId();
    const valid = projects.find((p) => String(p.id) === saved && p.is_active);
    const pick = valid || projects.find((p) => p.is_active) || projects[0];
    if (pick) {
      const id = String(pick.id);
      setActiveProject(id);
      if (saved !== id) setProjectId(id);
    }
  }, [projects]);

  useEffect(
    () =>
      onProjectChange((id) => {
        setActiveProject(id);
        qc.invalidateQueries();
      }),
    [qc],
  );

  const switchProject = (id: string) => {
    if (!id || id === activeProject) return;
    setActiveProject(id);
    setProjectId(id);
  };

  const current = projects?.find((p) => String(p.id) === activeProject);
  const navItems = useMemo(
    () => NAV.filter((n) => user && n.roles.includes(user.role as Role)),
    [user],
  );

  const logout = () => {
    clearTokens();
    router.replace("/");
  };

  const parts = pathname.split("/").filter(Boolean);
  const titleKey = parts.length >= 2 && parts[0] === "admin" ? parts[1] : parts[0] || "dashboard";
  const isProjectDetail = parts.length >= 3 && parts[0] === "admin" && parts[1] === "projects";
  const pageTitle: Record<string, string> = {
    dashboard: role === "Manager" ? "Team Hub" : role === "TL" ? "TL Desk" : role === "BDM" ? "My Workdesk" : "Dashboard",
    leads: role === "Manager" ? "Team Leads" : role === "BDM" ? "My Leads" : "Leads",
    pipeline: "Pipeline",
    duplicates: "Duplicates",
    "follow-ups": "Follow-ups",
    alerts: "Ops Alerts",
    reports: role === "Admin" ? "Org Reports" : "Reports",
    targets: "Targets",
    visits: "Visits",
    team: role === "TL" ? "Squad" : "Teams",
    admin: "Org Dashboard",
    forms: "Form Builder",
    projects: isProjectDetail ? "Project Details" : "Projects",
    users: "Users",
    audit: "Audit Log",
    profile: "Profile",
  };

  /** Admin uses org filters on the dashboard — no forced project chip in the chrome */
  const showProjectSwitcher = role !== "Admin";
  const isAdminSurface = role === "Admin" && pathname.startsWith("/admin");

  return (
    <LiveSyncProvider scope={liveScopeForRole(user?.role)}>
      <div className={cn("flex min-h-screen", isAdminSurface ? "bg-slate-950" : "bg-slate-50 dark:bg-slate-950")}>
        {mobileOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[15] bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-slate-200 bg-white shadow-lg transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className={cn("border-b border-white/10 bg-gradient-to-br px-5 py-5 text-white", themeCfg.sidebarFrom)}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">{themeCfg.eyebrow}</p>
            <p className="mt-1 text-lg font-bold tracking-tight">{themeCfg.brand}</p>
            {role === "Admin" ? (
              <p className="mt-2 text-xs text-white/70">Full organization control · all projects</p>
            ) : (
              <>
                <p className="mt-2 truncate text-sm font-medium text-white/90">{current?.name || "Select project"}</p>
                {projects && projects.length > 0 && (
                  <select
                    value={activeProject}
                    onChange={(e) => switchProject(e.target.value)}
                    className="mt-3 w-full rounded-xl border-0 bg-white/15 px-3 py-2 text-sm font-medium text-white backdrop-blur [&>option]:text-slate-900"
                  >
                    {projects.filter((p) => p.is_active).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/admin" || item.href === "/dashboard"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? cn(themeCfg.active, themeCfg.activeDark)
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 border-t border-slate-200 p-4 dark:border-slate-800">
            <UserBadge user={user} roleBadge={themeCfg.badge} />
            <button
              type="button"
              onClick={toggleTheme}
              className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button
              type="button"
              onClick={logout}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 lg:ml-64">
          <header
            className={cn(
              "sticky top-0 z-10 border-b px-4 py-4 shadow-sm backdrop-blur-md sm:px-6 sm:py-5 lg:px-8",
              isAdminSurface
                ? "border-slate-800 bg-slate-950/90"
                : "border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                  type="button"
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
                  onClick={() => setMobileOpen(!mobileOpen)}
                >
                  {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
                <div className="min-w-0 shrink">
                  <p
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-[0.15em]",
                      isAdminSurface ? "text-sky-400/80" : "text-slate-400",
                    )}
                  >
                    {themeCfg.eyebrow}
                  </p>
                  <h1
                    className={cn(
                      "truncate text-xl font-bold tracking-tight sm:text-2xl",
                      isAdminSurface ? "text-white" : "text-slate-900 dark:text-slate-50",
                    )}
                  >
                    {pageTitle[titleKey] || titleKey}
                  </h1>
                </div>
                <GlobalSearch />
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  aria-label="Toggle theme"
                  onClick={toggleTheme}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <NotificationsBell />
                {showProjectSwitcher && projects && projects.filter((p) => p.is_active).length > 0 && (
                  <label className="relative hidden shrink-0 items-center sm:flex">
                    <span className="sr-only">Switch project</span>
                    <select
                      value={activeProject}
                      onChange={(e) => switchProject(e.target.value)}
                      className="h-9 max-w-[140px] appearance-none rounded-full border-0 py-1.5 pl-3 pr-8 text-xs font-semibold text-white shadow-sm outline-none ring-0 sm:max-w-[180px]"
                      style={{ backgroundColor: current?.color || "#4f46e5" }}
                    >
                      {projects.filter((p) => p.is_active).map((p) => (
                        <option key={p.id} value={p.id} className="text-slate-900">
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <FolderKanban className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-white/90" />
                  </label>
                )}
              </div>
            </div>
          </header>
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </LiveSyncProvider>
  );
}

function UserBadge({ user, roleBadge }: { user?: User; roleBadge: string }) {
  if (!user) return <div className="h-10 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
  return (
    <Link
      href="/profile"
      className="block rounded-xl bg-slate-50 px-3 py-2 transition hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {user.first_name || user.username}
        </p>
        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase", roleBadge)}>
          {user.role}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">View profile</p>
    </Link>
  );
}
