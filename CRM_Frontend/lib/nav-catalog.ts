import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BellRing,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  Copy,
  Crosshair,
  FileText,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Shield,
  Target,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";

export type AppRole = "SuperAdmin" | "Admin" | "Manager" | "TL" | "BDM" | "Ops";
export type FieldPageKey =
  | "dashboard"
  | "verification"
  | "leads"
  | "pipeline"
  | "duplicates"
  | "follow-ups"
  | "alerts"
  | "reports"
  | "targets"
  | "visits"
  | "team"
  | "profile";

export type NavEntry = {
  pageKey: string;
  href: string;
  icon: LucideIcon;
  labels: Partial<Record<AppRole, string>> & { default: string };
};

/** Admin console — not toggleable by permissions matrix */
export const ADMIN_NAV: NavEntry[] = [
  { pageKey: "admin", href: "/admin", icon: Shield, labels: { default: "Org Dashboard" } },
  { pageKey: "admin.projects", href: "/admin/projects", icon: FolderKanban, labels: { default: "Projects" } },
  { pageKey: "admin.users", href: "/admin/users", icon: UserCog, labels: { default: "Users" } },
  { pageKey: "admin.forms", href: "/admin/forms", icon: FileText, labels: { default: "Form Builder" } },
  { pageKey: "admin.permissions", href: "/admin/permissions", icon: KeyRound, labels: { default: "Permissions" } },
  { pageKey: "admin.audit", href: "/admin/audit", icon: ClipboardList, labels: { default: "Audit Log" } },
  { pageKey: "verification", href: "/verification", icon: ClipboardCheck, labels: { default: "Verification" } },
  { pageKey: "team", href: "/team", icon: Users, labels: { default: "Teams" } },
  { pageKey: "reports", href: "/reports", icon: BarChart3, labels: { default: "Org Reports" } },
  { pageKey: "profile", href: "/profile", icon: UserRound, labels: { default: "Profile" } },
];

/** Platform Super Admin — tenants + packages (never org Users) */
export const SUPER_ADMIN_NAV: NavEntry[] = [
  { pageKey: "admin.organizations", href: "/admin/organizations", icon: LayoutDashboard, labels: { default: "Platform" } },
  { pageKey: "admin.packages", href: "/admin/packages", icon: KeyRound, labels: { default: "Packages" } },
  { pageKey: "profile", href: "/profile", icon: UserRound, labels: { default: "Profile" } },
];

/** Field pages — Admin toggles Manager / TL / BDM / Ops access */
export const FIELD_NAV: NavEntry[] = [
  {
    pageKey: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    labels: { default: "Dashboard", Manager: "Team Hub", TL: "TL Desk", BDM: "My Workdesk", Ops: "Ops Desk" },
  },
  {
    pageKey: "verification",
    href: "/verification",
    icon: ClipboardCheck,
    labels: { default: "Verification", Ops: "My Queue", Manager: "Assign Verify", TL: "Assign Verify" },
  },
  {
    pageKey: "leads",
    href: "/leads",
    icon: Target,
    labels: { default: "Leads", Manager: "Team Leads", BDM: "My Leads", Ops: "Lead Docs" },
  },
  { pageKey: "pipeline", href: "/pipeline", icon: Columns3, labels: { default: "Pipeline" } },
  { pageKey: "duplicates", href: "/duplicates", icon: Copy, labels: { default: "Duplicates" } },
  { pageKey: "follow-ups", href: "/follow-ups", icon: CalendarClock, labels: { default: "Follow-ups" } },
  { pageKey: "alerts", href: "/alerts", icon: BellRing, labels: { default: "Alerts" } },
  {
    pageKey: "reports",
    href: "/reports",
    icon: BarChart3,
    labels: { default: "Reports", BDM: "My Reports" },
  },
  {
    pageKey: "targets",
    href: "/targets",
    icon: Crosshair,
    labels: { default: "Targets", BDM: "My Targets" },
  },
  {
    pageKey: "visits",
    href: "/visits",
    icon: CalendarDays,
    labels: { default: "Visits", BDM: "My Visits" },
  },
  {
    pageKey: "team",
    href: "/team",
    icon: Users,
    labels: { default: "Teams", Manager: "My Teams", TL: "Squad" },
  },
  { pageKey: "profile", href: "/profile", icon: UserRound, labels: { default: "Profile" } },
];

export function navLabel(entry: NavEntry, role: AppRole) {
  return entry.labels[role] || entry.labels.default;
}

export function hrefToPageKey(pathname: string): string | null {
  if (pathname.startsWith("/admin/organizations")) return "admin.organizations";
  if (pathname.startsWith("/admin/packages")) return "admin.packages";
  if (pathname.startsWith("/admin/projects")) return "admin.projects";
  if (pathname.startsWith("/admin/users")) return "admin.users";
  if (pathname.startsWith("/admin/forms")) return "admin.forms";
  if (pathname.startsWith("/admin/permissions")) return "admin.permissions";
  if (pathname.startsWith("/admin/audit")) return "admin.audit";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  const first = pathname.split("/").filter(Boolean)[0];
  return first || "dashboard";
}

export function homeHrefForUser(role: AppRole, allowedPages?: string[] | null) {
  if (role === "SuperAdmin") return "/admin/organizations";
  const pages = allowedPages || [];
  if (role === "Admin") {
    const hit = ADMIN_NAV.find((n) => n.pageKey !== "profile" && pages.includes(n.pageKey));
    return hit?.href || "/profile";
  }
  if (role === "Ops" && pages.includes("verification")) return "/verification";
  if (pages.includes("dashboard")) return "/dashboard";
  const preferred = FIELD_NAV.find((n) => n.pageKey !== "profile" && pages.includes(n.pageKey));
  return preferred?.href || "/profile";
}

export function canAccessPage(role: AppRole, pageKey: string, allowedPages?: string[] | null) {
  if (role === "SuperAdmin") {
    return pageKey === "admin.organizations" || pageKey === "admin.packages" || pageKey === "profile";
  }
  // Company Admin + field roles: Super Admin package / module entitlements via allowed_pages
  if (!allowedPages) return false;
  return allowedPages.includes(pageKey);
}
