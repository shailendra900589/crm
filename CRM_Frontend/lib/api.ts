/**
 * API / WS base URLs.
 * - Local dev: http://127.0.0.1:8000
 * - Production (Docker/nginx): NEXT_PUBLIC_API_URL=same-origin → browser calls /api on crm.trackbook.co
 */
function resolveApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (raw === "same-origin" || raw === "/") return "";
  if (raw) return raw.replace(/\/$/, "");
  // Safety: never call the user's localhost when the app is opened on a real host
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h && h !== "localhost" && h !== "127.0.0.1") return "";
  }
  return "http://127.0.0.1:8000";
}

const API = resolveApiBase();

export function getWsUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_WS_URL || "").trim();
  if (raw && raw !== "same-origin") return raw.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    // same-origin or empty → use current host (crm.trackbook.co)
    if (!raw || raw === "same-origin" || API === "") {
      return `${proto}://${window.location.host}`;
    }
  }
  if (API === "") return "";
  return "ws://127.0.0.1:8000";
}


type Tokens = { access: string; refresh: string };

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access");
}

function getRefresh() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh");
}

export const PROJECT_CHANGE_EVENT = "crm-project-change";

export function getProjectId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("project");
}

export function setProjectId(id: string) {
  if (!id) return;
  const prev = typeof window !== "undefined" ? localStorage.getItem("project") : null;
  localStorage.setItem("project", id);
  if (typeof window !== "undefined" && prev !== id) {
    window.dispatchEvent(new CustomEvent(PROJECT_CHANGE_EVENT, { detail: { id } }));
  }
}

/** Subscribe to global project switches (header, filters, search, etc.). */
export function onProjectChange(handler: (id: string) => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (e: Event) => {
    const id = (e as CustomEvent<{ id: string }>).detail?.id;
    if (id) handler(id);
  };
  window.addEventListener(PROJECT_CHANGE_EVENT, listener);
  return () => window.removeEventListener(PROJECT_CHANGE_EVENT, listener);
}

export function mediaUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function fileUrl(path?: string | null, url?: string | null) {
  return mediaUrl(url || path || null);
}

function buildQuery(params: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams();
  // Auto-inject shell project only when caller omitted the key entirely.
  // Explicit project: "" means "all projects" (Admin). Non-admin UIs must always pass a real id.
  if (!("project" in params)) {
    const pid = getProjectId();
    if (pid) sp.set("project", pid);
  } else if (params.project) {
    sp.set("project", String(params.project));
  }
  Object.entries(params).forEach(([k, v]) => {
    if (k === "project") return;
    if (v) sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function buildAdminQuery(filters?: AdminFilters) {
  const sp = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => { if (v) sp.set(k, v); });
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function refreshToken(): Promise<boolean> {
  const refresh = getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem("access", data.access);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401 && retry) {
    const ok = await refreshToken();
    if (ok) return request<T>(path, options, false);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d: { message?: string } | string) => (typeof d === "string" ? d : d.message || "")).filter(Boolean).join(", ")
      : typeof detail === "string"
        ? detail
        : detail && typeof detail === "object"
          ? JSON.stringify(detail)
          : err.message || "Request failed";
    throw new Error(msg || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestList<T>(path: string): Promise<T[]> {
  const data = await request<T[] | Paginated<T>>(path);
  return Array.isArray(data) ? data : data.results;
}

export const api = {
  login: (username: string, password: string) =>
    request<Tokens>("/api/auth/login/", { method: "POST", body: JSON.stringify({ username, password }) }),

  me: () => request<CrmUser>("/api/me/"),
  updateMe: (data: { first_name?: string; last_name?: string; email?: string; mobile_number?: string }) =>
    request<CrmUser>("/api/me/", { method: "PATCH", body: JSON.stringify(data) }),
  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    request<{ detail: string }>("/api/me/password/", { method: "POST", body: JSON.stringify(data) }),
  search: (q: string) => request<GlobalSearchResult>(`/api/search/?q=${encodeURIComponent(q)}`),
  projects: () => request<Project[]>("/api/projects/"),
  project: (id: number) => request<Project>(`/api/projects/${id}/`),
  createProject: (data: Partial<Project>) =>
    request<Project>("/api/projects/", { method: "POST", body: JSON.stringify(data) }),
  updateProject: (id: number, data: Partial<Project>) =>
    request<Project>(`/api/projects/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProject: (id: number) => request<void>(`/api/projects/${id}/`, { method: "DELETE" }),

  products: (projectId?: number) =>
    request<ProductItem[]>(`/api/products/${buildQuery({ project: projectId ? String(projectId) : undefined })}`),
  createProduct: (data: { project: number; name: string; description?: string; is_active?: boolean }) =>
    request<ProductItem>("/api/products/", { method: "POST", body: JSON.stringify(data) }),
  updateProduct: (id: number, data: Partial<ProductItem>) =>
    request<ProductItem>(`/api/products/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProduct: (id: number) => request<void>(`/api/products/${id}/`, { method: "DELETE" }),
  merchants: (projectId?: number) =>
    requestList<MerchantItem>(`/api/merchants/${buildQuery({ project: projectId ? String(projectId) : undefined })}`),

  customForm: (projectId: number) => request<CustomForm>(`/api/projects/${projectId}/custom-form/`),
  saveCustomForm: (projectId: number, data: Partial<CustomForm>) =>
    request<CustomForm>(`/api/projects/${projectId}/custom-form/`, { method: "PUT", body: JSON.stringify(data) }),

  dashboard: (filters?: DashboardFilters) =>
    request<DashboardStats>(`/api/dashboard/${buildQuery({
      // Always scope to shell project when filter project is empty (hierarchy users)
      project: filters?.project || getProjectId() || undefined,
      product: filters?.product,
      company: filters?.company,
      from: filters?.from,
      to: filters?.to,
    })}`),
  followUpsHub: () =>
    request<FollowUpsHub>(`/api/follow-ups/${buildQuery({})}`),
  alertsHub: (project?: string) =>
    request<AlertsHub>(`/api/alerts/${buildQuery({ project: project || getProjectId() || undefined })}`),
  reportsPerformance: (filters?: ReportFilters) =>
    request<PerformanceReport>(`/api/reports/performance/${buildQuery({
      project: filters?.project,
      product: filters?.product,
      company: filters?.company,
      from: filters?.from,
      to: filters?.to,
      team: filters?.team,
      bdm: filters?.bdm,
    })}`),
  salesTargets: (opts?: { year?: number; month?: number; project?: string; user?: number }) =>
    requestList<SalesTarget>(`/api/sales-targets/${buildQuery({
      year: opts?.year ? String(opts.year) : undefined,
      month: opts?.month ? String(opts.month) : undefined,
      project: opts?.project,
      user: opts?.user ? String(opts.user) : undefined,
    })}`),
  createSalesTarget: (data: CreateSalesTargetData) =>
    request<SalesTarget>("/api/sales-targets/", { method: "POST", body: JSON.stringify(data) }),
  updateSalesTarget: (id: number, data: Partial<CreateSalesTargetData>) =>
    request<SalesTarget>(`/api/sales-targets/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSalesTarget: (id: number) => request<void>(`/api/sales-targets/${id}/`, { method: "DELETE" }),
  adminDashboard: (filters?: AdminFilters) =>
    request<AdminDashboardStats>(`/api/admin/dashboard/${buildAdminQuery(filters)}`),
  adminManagers: () => request<ManagerSummary[]>("/api/admin/managers/"),
  managerDashboard: (id: number) => request<{ manager: User; stats: DashboardStats }>(`/api/admin/managers/${id}/dashboard/`),
  pagePermissions: () => request<PagePermissionMatrix>("/api/admin/page-permissions/"),
  updatePagePermissions: (permissions: { page_key: string; role: string; enabled: boolean }[]) =>
    request<PagePermissionMatrix>("/api/admin/page-permissions/", {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),

  teams: () => requestList<Team>(`/api/teams/${buildQuery()}`),
  createTeam: (data: Partial<Team> & { members?: number[] }) =>
    request<Team>("/api/teams/", { method: "POST", body: JSON.stringify(data) }),
  updateTeam: (id: number, data: Partial<Team> & { members?: number[] }) =>
    request<Team>(`/api/teams/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTeam: (id: number) => request<void>(`/api/teams/${id}/`, { method: "DELETE" }),
  teamReporting: (id: number) => request<TeamReport>(`/api/teams/${id}/reporting/`),
  users: (opts?: { role?: string; all?: boolean }) =>
    requestList<CrmUser>(`/api/users/${buildQuery({
      role: opts?.role,
      all: opts?.all ? "1" : undefined,
    })}`),
  createUser: (data: CreateUserData) =>
    request<CrmUser>("/api/users/", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: number, data: UpdateUserData) =>
    request<CrmUser>(`/api/users/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deactivateUser: (id: number) => request<void>(`/api/users/${id}/`, { method: "DELETE" }),

  leads: (opts?: {
    status?: string;
    overdue?: boolean;
    page?: number;
    project?: number;
    product?: string;
    company?: string;
    q?: string;
  }) =>
    request<Paginated<Lead>>(`/api/leads/${buildQuery({
      project: opts?.project ? String(opts.project) : undefined,
      status: opts?.status,
      overdue: opts?.overdue ? "1" : undefined,
      page: opts?.page ? String(opts.page) : undefined,
      product: opts?.product,
      company: opts?.company,
      q: opts?.q,
    })}`),
  pipeline: () =>
    request<{ columns: Record<string, Lead[]>; counts: Record<string, number>; total: number }>(
      `/api/leads/pipeline/${buildQuery({})}`
    ),
  checkDuplicate: (opts: { mobile: string; project?: number; exclude_lead?: number }) =>
    request<{ duplicate: boolean; count: number; leads: Lead[] }>(
      `/api/leads/check-duplicate/${buildQuery({
        mobile: opts.mobile,
        project: opts.project ? String(opts.project) : undefined,
        exclude_lead: opts.exclude_lead ? String(opts.exclude_lead) : undefined,
      })}`
    ),
  duplicateGroups: () =>
    request<{ count: number; duplicate_leads: number; groups: DuplicateGroup[] }>(
      `/api/leads/duplicates/${buildQuery({})}`
    ),
  mergeLeads: (primaryId: number, sourceIds: number[]) =>
    request<Lead>(`/api/leads/${primaryId}/merge/`, {
      method: "POST",
      body: JSON.stringify({ source_ids: sourceIds }),
    }),
  lead: (id: number) => request<Lead>(`/api/leads/${id}/`),
  leadActivity: (id: number) => request<{ lead_id: number; events: LeadActivityEvent[] }>(`/api/leads/${id}/activity/`),
  createLead: (data: CreateLeadData) => request<Lead>("/api/leads/", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id: number, data: Partial<UpdateLeadData>) =>
    request<Lead>(`/api/leads/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLead: (id: number) => request<void>(`/api/leads/${id}/`, { method: "DELETE" }),
  followUpLead: (id: number, data: { follow_up_date: string; notes?: string }) =>
    request<Lead>(`/api/leads/${id}/follow_up/`, { method: "PATCH", body: JSON.stringify(data) }),
  logCall: (id: number, data: { outcome: CallOutcome; notes?: string; follow_up_date?: string }) =>
    request<Lead>(`/api/leads/${id}/log-call/`, { method: "POST", body: JSON.stringify(data) }),
  reassignLead: (id: number, data: { bdm: number; notes?: string }) =>
    request<Lead>(`/api/leads/${id}/reassign/`, { method: "PATCH", body: JSON.stringify(data) }),
  submitForm: (id: number, answers: Record<string, unknown>, opts?: { visit_id?: number; remarks?: string }) =>
    request<FormSubmission>(`/api/leads/${id}/form_submission/`, {
      method: "POST",
      body: JSON.stringify({ answers, visit_id: opts?.visit_id, remarks: opts?.remarks }),
    }),
  uploadDocuments: (id: number, form: FormData) =>
    request<LeadDocument>(`/api/leads/${id}/upload_documents/`, { method: "POST", body: form }),
  uploadFormFile: async (leadId: number, fieldId: string, file: File) => {
    const form = new FormData();
    form.append("field_id", fieldId);
    form.append("file", file);
    const token = getToken();
    const res = await fetch(`${API}/api/leads/${leadId}/upload-form-file/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = err.detail;
      throw new Error(Array.isArray(detail) ? detail.join(", ") : detail || "Upload failed");
    }
    return res.json() as Promise<{ url: string; name: string; path: string }>;
  },
  verifyDocuments: (id: number, status: string) =>
    request<LeadDocument>(`/api/leads/${id}/verify_documents/`, { method: "PATCH", body: JSON.stringify({ verification_status: status }) }),
  downloadDocument: async (leadId: number, field: "gst_file" | "pan_file" | "cheque_file", filename?: string) => {
    const token = getToken();
    const res = await fetch(`${API}/api/leads/${leadId}/download-document/?field=${field}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `${field}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadBulkTemplate: async (projectId: number) => {
    const token = getToken();
    const res = await fetch(`${API}/api/projects/${projectId}/bulk-template/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  },
  bulkUpload: async (projectId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const token = getToken();
    const res = await fetch(`${API}/api/projects/${projectId}/bulk-upload/`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json() as Promise<BulkJob>;
  },
  bulkJob: (id: number) => request<BulkJob>(`/api/bulk-jobs/${id}/`),

  visits: (opts?: { upcoming?: boolean; status?: string; from?: string; to?: string; project?: string }) => {
    const params: Record<string, string | undefined> = {
      upcoming: opts?.upcoming ? "1" : undefined,
      status: opts?.status,
      from: opts?.from,
      to: opts?.to,
    };
    if (opts?.project) params.project = opts.project;
    return requestList<LeadVisit>(`/api/visits/${buildQuery(params)}`);
  },
  createVisit: (data: Partial<LeadVisit>) =>
    request<LeadVisit>("/api/visits/", { method: "POST", body: JSON.stringify(data) }),
  completeVisit: (id: number, remarks?: string) =>
    request<LeadVisit>(`/api/visits/${id}/complete/`, { method: "PATCH", body: JSON.stringify({ remarks }) }),
  cancelVisit: (id: number, remarks?: string) =>
    request<LeadVisit>(`/api/visits/${id}/`, {
      method: "PATCH",
      body: JSON.stringify({ status: "cancelled", ...(remarks ? { remarks } : {}) }),
    }),
  notifications: () => request<AppNotification[]>("/api/notifications/"),
  markNotificationRead: (id: number) =>
    request<AppNotification>(`/api/notifications/${id}/read/`, { method: "PATCH" }),
  markAllNotificationsRead: () =>
    request<{ detail: string }>("/api/notifications/read_all/", { method: "POST" }),

  exportLeads: async (opts?: {
    status?: string;
    overdue?: boolean;
    product?: string;
    company?: string;
    q?: string;
    format?: "xlsx" | "pdf";
  }) => {
    const token = getToken();
    const fmt = opts?.format || "xlsx";
    const q = buildQuery({
      status: opts?.status,
      overdue: opts?.overdue ? "1" : undefined,
      product: opts?.product,
      company: opts?.company,
      q: opts?.q,
      format: fmt,
    });
    const res = await fetch(`${API}/api/leads/export/${q}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.${fmt}`;
    a.click();
    URL.revokeObjectURL(url);
  },
  exportAdminReport: async (filters?: AdminFilters, format: "xlsx" | "pdf" = "xlsx") => {
    const token = getToken();
    const base = buildAdminQuery(filters);
    const join = base ? "&" : "?";
    const res = await fetch(`${API}/api/admin/export/${base}${join}format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm_report_${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  },
  sendDigest: (username?: string) =>
    request<{ sent: number; skipped: number; errors: { user?: string; error: string }[]; detail?: string }>(
      "/api/admin/digest/",
      {
        method: "POST",
        body: JSON.stringify(username ? { username } : {}),
      }
    ),
  auditLogs: (opts?: { action?: string; entity_type?: string; actor?: string; q?: string; from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    Object.entries(opts || {}).forEach(([k, v]) => { if (v) sp.set(k, v); });
    const q = sp.toString();
    return request<AuditLogEntry[]>(`/api/admin/audit-logs/${q ? `?${q}` : ""}`);
  },
};

export type AdminFilters = {
  project?: string;
  product?: string;
  company?: string;
  manager?: string;
  team?: string;
  from?: string;
  to?: string;
};
export type AuditLogEntry = {
  id: number;
  actor: number | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
};
export type DashboardFilters = Pick<AdminFilters, "project" | "product" | "company" | "from" | "to">;
export type ReportFilters = DashboardFilters & { team?: string; bdm?: string };
export type BdmStatRow = {
  id: number;
  name: string;
  username: string;
  role: string;
  lead_count: number;
  confirmed: number;
  conversion: number;
  follow_ups_today: number;
  overdue: number;
  target_confirmed?: number | null;
  target_leads?: number | null;
  actual_confirmed?: number;
  actual_leads?: number;
  confirmed_pct?: number | null;
  leads_pct?: number | null;
};
export type SalesTarget = {
  id: number;
  user: number;
  user_name: string;
  project: number | null;
  project_name: string | null;
  year: number;
  month: number;
  target_confirmed: number;
  target_leads: number;
  created_by?: number | null;
  created_by_name?: string | null;
  actual_confirmed?: number;
  actual_leads?: number;
  confirmed_pct?: number;
  leads_pct?: number;
  created_at?: string;
  updated_at?: string;
};
export type CreateSalesTargetData = {
  user: number;
  project?: number | null;
  year: number;
  month: number;
  target_confirmed: number;
  target_leads?: number;
};
export type PerformanceReport = {
  summary: {
    total_leads: number;
    orders_confirmed: number;
    conversion_rate: number;
    follow_ups_due_today: number;
    overdue_follow_ups: number;
  };
  disposition: { status: string; count: number }[];
  bdm_stats: BdmStatRow[];
  weekly_trend: { week: string | null; leads: number; confirmed: number }[];
  top_products: { id: number; name: string; lead_count: number; confirmed_count: number; conversion: number }[];
};
export type FollowUpsHub = {
  counts: { overdue: number; due_today: number; upcoming: number };
  overdue: Lead[];
  due_today: Lead[];
  upcoming: Lead[];
};
export type AlertsHub = {
  counts: {
    overdue_follow_ups: number;
    due_today: number;
    pending_documents: number;
    missed_visits: number;
    targets_at_risk: number;
    duplicate_groups: number;
  };
  team_overdue: { bdm_id: number; name: string; username: string; overdue: number }[];
  overdue_follow_ups: Lead[];
  due_today: Lead[];
  pending_documents: {
    id: number;
    lead_id: number;
    merchant_name: string;
    project_name: string;
    bdm_name: string;
    uploaded_at: string;
  }[];
  missed_visits: LeadVisit[];
  targets_at_risk: {
    user_id: number;
    user_name: string;
    project_name: string;
    target_confirmed: number;
    actual_confirmed: number;
    confirmed_pct: number;
  }[];
};
export type KpiRow = {
  id: number;
  name: string;
  lead_count: number;
  confirmed_count: number;
  conversion: number;
  city?: string;
  project_name?: string;
  project_id?: number;
};
export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "email"
  | "phone"
  | "url"
  | "date"
  | "time"
  | "datetime"
  | "dropdown"
  | "radio"
  | "multiselect"
  | "file";

/** Tags currency/number fields so dashboards can roll up Collection / Pending / Deal value */
export type FormMetricRole = "collection" | "pending_amount" | "deal_value";

export type FormField = {
  field_id: string;
  label: string;
  type: FormFieldType | string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help_text?: string;
  min?: number;
  max?: number;
  file_accept?: string;
  max_file_mb?: number;
  /** INR by default — used by currency fields */
  currency?: string;
  /** When set, field values feed dashboard money KPIs */
  metric_role?: FormMetricRole | string;
};

export type MoneyMetric = {
  role: string;
  label: string;
  total: number;
  currency: string;
};

export type MoneyMetrics = {
  has_money: boolean;
  metrics: MoneyMetric[];
  total_collection: number;
  total_pending: number;
  total_deal_value: number;
};
export type CustomForm = { id: number; project: number; project_name: string; title: string; schema: FormField[]; is_active: boolean };
export type TeamMember = { id: number; name: string; role: string; username: string };
export type Team = {
  id: number; name: string; project: number; project_name: string;
  manager: number; manager_name: string;
  members: number[]; member_names: string[]; member_details?: TeamMember[];
};
export type CrmUser = User & {
  reports_to?: number | null;
  reports_to_name?: string | null;
  assigned_project_ids?: number[];
  email?: string;
  is_active_user?: boolean;
  allowed_pages?: string[];
};
export type PagePermissionRow = {
  page_key: string;
  label: string;
  href: string;
  description?: string;
  locked?: boolean;
  roles: { Manager: boolean; TL: boolean; BDM: boolean };
};
export type PagePermissionMatrix = { pages: PagePermissionRow[] };
export type CreateUserData = {
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role: User["role"];
  mobile_number?: string;
  reports_to?: number | null;
  assigned_projects?: number[];
};
export type UpdateUserData = Partial<Omit<CreateUserData, "username" | "password">> & {
  password?: string;
  is_active_user?: boolean;
};
export type TeamReport = { team: Team; total_leads: number; confirmed: number; conversion: number; leaderboard: { bdm__first_name: string; bdm__username: string; total: number; confirmed: number }[] };
export type ManagerSummary = { id: number; name: string; role: string; lead_count: number; confirmed: number; follow_ups_today: number };
export type BulkJob = { id: number; status: string; total_rows: number; success_rows: number; error_log: { row?: number; error: string }[] };
export type FormSubmission = {
  id: number; lead: number; lead_name: string; project_name: string;
  submitted_by: number; submitted_by_name: string; answers: Record<string, unknown>; submitted_at: string;
};
export type LeadVisit = {
  id: number; lead: number; lead_name: string; merchant_city: string; project_name: string;
  bdm_name: string; assigned_to: number; assigned_to_name: string;
  assigned_by: number | null; assigned_by_name: string | null;
  scheduled_date: string; status: string; visit_type: string; remarks: string;
  completed_at: string | null; created_at: string;
};
export type RevisitLead = {
  id: number; merchant_name: string; merchant_city: string;
  bdm_name: string; bdm_id: number; last_visit: string | null; status: string;
};

export type Project = {
  id: number; name: string; slug: string; description: string; color: string;
  is_active: boolean; lead_count?: number; product_count?: number; created_at: string;
};
export type ProductItem = {
  id: number; project: number; project_name: string; name: string; slug: string;
  description: string; is_active: boolean; lead_count?: number; created_at: string;
};
export type MerchantItem = {
  id: number; project: number; name: string; mobile: string; email: string;
  brand_name: string; city: string; created_at: string;
};
export type User = {
  id: number; username: string; first_name: string; last_name: string;
  role: "Admin" | "BDM" | "TL" | "Manager"; mobile_number: string;
};
export type LeadDocument = {
  id: number;
  gst_file: string | null;
  pan_file: string | null;
  cheque_file: string | null;
  gst_file_url?: string | null;
  pan_file_url?: string | null;
  cheque_file_url?: string | null;
  verification_status: "pending" | "approved" | "rejected";
  verified_by?: number | null;
  verified_by_name?: string | null;
  uploaded_at: string;
};
export type Lead = {
  id: number; project?: number; project_name: string; product?: number | null; product_name?: string | null;
  merchant_name: string;
  merchant_mobile?: string; merchant_email?: string; brand_name?: string; merchant_city: string;
  bdm: number; bdm_name: string; status: string; status_display: string;
  follow_up_date: string | null; notes: string; custom_data?: Record<string, unknown>;
  documents: LeadDocument[];
};
export type LeadActivityEvent = {
  id: string;
  type: "lead_created" | "visit" | "form" | "document" | "note" | string;
  title: string;
  detail: string;
  actor: string;
  at: string;
  meta?: Record<string, string>;
};
export type CallOutcome = "answered" | "no_answer" | "busy" | "callback" | "interested" | "not_interested";
export type CreateLeadData = {
  project: number; merchant_name: string; merchant_mobile: string;
  merchant_email?: string; brand_name?: string; city?: string;
  product?: number | null;
  status?: string; follow_up_date?: string; notes?: string;
  force?: boolean;
};
export type DuplicateGroup = {
  merchant_id: number;
  merchant_name: string;
  mobile: string;
  project_id: number;
  project_name: string;
  lead_count: number;
  leads: Lead[];
};
export type UpdateLeadData = Partial<CreateLeadData> & { custom_data?: Record<string, unknown> };
export const LEAD_STATUSES = [
  { value: "interested", label: "Interested" }, { value: "follow_up", label: "Follow Up" },
  { value: "callback", label: "Callback" }, { value: "order_confirmed", label: "Order Confirmed" },
  { value: "not_interested", label: "Not Interested" },
] as const;
export type DashboardStats = {
  total_leads: number; orders_confirmed: number; follow_ups_due_today: number;
  overdue_follow_ups?: number; conversion_rate: number;
  total_companies?: number; total_products?: number;
  disposition: { status: string; count: number }[];
  leaderboard: { bdm__username: string; bdm__first_name: string; confirmed: number }[];
  company_stats?: KpiRow[];
  product_stats?: KpiRow[];
  filter_summary?: FilterSummary;
  money_metrics?: MoneyMetrics;
  project_form: CustomForm | null;
  forms_filled_today: number;
  next_visit: LeadVisit | null;
  upcoming_visits: LeadVisit[];
  recent_submissions: FormSubmission[];
  revisit_leads: RevisitLead[];
  team_form_activity: FormSubmission[];
};
export type AdminDashboardStats = {
  total_projects: number; active_projects: number; total_companies: number; total_products: number;
  total_bdm: number; total_tl: number;
  total_leads: number; orders_confirmed: number; follow_ups_due_today: number;
  overdue_follow_ups?: number; conversion_rate: number;
  disposition: { status: string; count: number }[];
  project_stats: { id: number; name: string; color: string; is_active: boolean; lead_count: number; confirmed_count: number; conversion: number }[];
  company_stats: KpiRow[];
  product_stats: KpiRow[];
  team_stats: { id: number; name: string; role: string; lead_count: number; confirmed: number }[];
  filter_summary?: FilterSummary;
  money_metrics?: MoneyMetrics;
  forms_filled_today: number;
  visits_scheduled_today: number;
  upcoming_team_visits: LeadVisit[];
  recent_submissions: FormSubmission[];
};
export type FilterSummary = {
  project_id?: number | null;
  project_name?: string | null;
  product_id?: number | null;
  company_id?: number | null;
  manager_id?: number | null;
  from?: string | null;
  to?: string | null;
};
export type AppNotification = {
  id: number;
  message: string;
  is_read: boolean;
  link: string;
  created_at: string;
};
export type GlobalSearchResult = {
  leads: {
    id: number;
    merchant_name: string;
    city: string;
    project_name: string;
    product_name?: string | null;
    status: string;
    bdm_name: string;
  }[];
  companies: {
    id: number;
    name: string;
    city: string;
    mobile: string;
    project_id: number;
    project_name: string;
  }[];
  products: { id: number; name: string; project_id: number; project_name: string }[];
  projects: { id: number; name: string; color: string; description: string }[];
};
type Paginated<T> = { results: T[]; count: number; next?: string; previous?: string };

export function saveTokens(tokens: Tokens) {
  localStorage.setItem("access", tokens.access);
  localStorage.setItem("refresh", tokens.refresh);
}
export function clearTokens() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  localStorage.removeItem("project");
}
export function isLoggedIn() {
  return typeof window !== "undefined" && !!localStorage.getItem("access");
}
