/**
 * NH Production House CRM — PHP Backend API Service
 *
 * This service layer replaces all Supabase calls with PHP REST API calls.
 * The frontend calls this service, which talks to the PHP backend on cPanel.
 *
 * In development/preview mode (no PHP backend), the app continues to use
 * localStorage via the existing hooks. This file is used when VITE_API_URL is set.
 */

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/backend/api`
  : '';

const TOKEN_KEY = 'nhproductionhouse_api_token';

function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; total?: number; response: Response }> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers as Record<string, string>) },
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API Error ${res.status}`);
  }

  const data = await res.json();
  const total = res.headers.get('X-Total-Count');

  return { data, total: total ? parseInt(total) : undefined, response: res };
}

// ===================== AUTH =====================

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(body.error || 'Login failed');
  }

  const data = await res.json();
  setToken(data.token);
  return data;
}

export async function apiLogout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    clearToken();
  }
}

export async function apiValidateSession() {
  return apiRequest('/auth/session');
}

export async function apiResetPasswordRequest(email: string) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ action: 'request', email }),
  });
}

export async function apiResetPassword(token: string, password: string) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ action: 'reset', token, password }),
  });
}

// ===================== LEADS =====================

export interface LeadFilters {
  is_active?: string;
  industry?: string;
  company?: string;
  status?: string;
  work_email_verified?: string;
  work_esp?: string;
  search?: string;
  since?: string;
  limit?: number;
  offset?: number;
  order?: string;
  dir?: string;
}

export async function apiGetLeads(filters: LeadFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) params.set(k, String(v));
  });
  return apiRequest<any[]>(`/leads?${params.toString()}`);
}

export async function apiGetLead(id: number) {
  return apiRequest(`/leads/${id}`);
}

export async function apiCreateLead(lead: Record<string, any>) {
  return apiRequest('/leads', {
    method: 'POST',
    body: JSON.stringify(lead),
  });
}

export async function apiUpdateLead(id: number, data: Record<string, any>) {
  return apiRequest(`/leads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiDeleteLead(id: number) {
  return apiRequest(`/leads/${id}`, { method: 'DELETE' });
}

export async function apiBulkLeadAction(
  action: string,
  ids: number[],
  extra?: Record<string, any>
) {
  return apiRequest('/leads/bulk', {
    method: 'POST',
    body: JSON.stringify({ action, ids, ...extra }),
  });
}

// ===================== BULK DELETE =====================

export async function apiBulkDeleteLeads(
  type: 'selected' | 'page' | 'pages' | 'all',
  data?: { ids?: number[]; page?: number; pages?: number[]; per_page?: number }
) {
  return apiRequest('/leads/delete-bulk', {
    method: 'POST',
    body: JSON.stringify({ type, ...data }),
  });
}

// ===================== USERS =====================

export async function apiGetUsers() {
  return apiRequest<any[]>('/users');
}

export async function apiCreateUser(user: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  return apiRequest('/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
}

export async function apiUpdateUser(id: number, data: Record<string, any>) {
  return apiRequest(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiDeleteUser(id: number) {
  return apiRequest(`/users/${id}`, { method: 'DELETE' });
}

// ===================== BACKUP =====================

export async function apiGetBackups() {
  return apiRequest<any[]>('/backup');
}

export async function apiCreateBackup() {
  return apiRequest('/backup', { method: 'POST' });
}

export async function apiRestoreBackup(
  backupData: Record<string, any>,
  mode: 'overwrite' | 'merge' = 'overwrite',
  restoreLeads = true,
  restoreCache = true
) {
  return apiRequest('/backup/restore', {
    method: 'POST',
    body: JSON.stringify({
      backup_data: backupData,
      mode,
      restore_leads: restoreLeads,
      restore_cache: restoreCache,
    }),
  });
}

// ===================== EMAIL VERIFICATION =====================

export async function apiVerifyEmail(email: string, apiKey?: string) {
  return apiRequest('/verify/email', {
    method: 'POST',
    body: JSON.stringify({ email, api_key: apiKey }),
  });
}

// ===================== SECURITY =====================

export async function apiGetActivityLog(limit = 100, offset = 0) {
  return apiRequest<any[]>(`/security/activity?limit=${limit}&offset=${offset}`);
}

export async function apiGetBlockedIPs() {
  return apiRequest<any[]>('/security/blocked-ips');
}

export async function apiBlockIP(ip_address: string, reason: string, is_permanent = false) {
  return apiRequest('/security/blocked-ips', {
    method: 'POST',
    body: JSON.stringify({ ip_address, reason, is_permanent }),
  });
}

export async function apiUnblockIP(id: number) {
  return apiRequest('/security/blocked-ips', {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
}

// ===================== HEALTH =====================

export async function apiHealthCheck() {
  return apiRequest('/health');
}

// ===================== UTILITY =====================

export function isBackendConfigured(): boolean {
  return !!API_BASE;
}

export { getToken, setToken, clearToken };
