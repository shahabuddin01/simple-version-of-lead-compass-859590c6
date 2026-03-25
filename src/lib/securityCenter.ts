// ── Security Center Data Layer ──
// Uses localStorage (nhproductionhouse_ prefix) matching existing architecture.
// All security data is stored obfuscated via the storeSecure/loadSecure helpers.

import { storeSecure, loadSecure } from "@/lib/security";

// ── Keys ──
const PREFIX = "nhproductionhouse_sec_";
const BLOCKED_IPS_KEY = PREFIX + "blocked_ips";
const LOGIN_ATTEMPTS_LOG_KEY = PREFIX + "login_attempts_log";
const IP_WHITELIST_KEY = PREFIX + "ip_whitelist";
const ACTIVITY_LOG_KEY = PREFIX + "activity_log";
const SCAN_LOGS_KEY = PREFIX + "scan_logs";
const SESSIONS_KEY = PREFIX + "sessions";
const SETTINGS_KEY = PREFIX + "settings";

// ── Types ──
export interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_at: string;
  expires_at: string | null;
  is_permanent: boolean;
  created_by: string;
}

export interface LoginAttemptLog {
  id: string;
  email_attempted: string;
  ip_address: string;
  user_agent: string;
  attempted_at: string;
  was_successful: boolean;
  blocked: boolean;
}

export interface WhitelistedIP {
  id: string;
  ip_address: string;
  label: string;
  added_at: string;
  added_by: string;
}

export interface ActivityLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource: string;
  details: string;
  ip_address: string;
  device_info: string;
  created_at: string;
  flagged?: boolean;
}

export interface ScanLog {
  id: string;
  scanned_at: string;
  threats_found: number;
  warnings_found: number;
  status: "clean" | "warning" | "critical";
  scan_report: ScanFinding[];
  duration_seconds: number;
}

export interface ScanFinding {
  severity: "critical" | "warning" | "info";
  description: string;
  table?: string;
  field?: string;
  record?: string;
  action?: string;
}

export interface SecuritySession {
  id: string;
  user_id: string;
  user_email: string;
  ip_address: string;
  device_info: string;
  location: string;
  last_active: string;
  is_active: boolean;
}

export interface SecuritySettings {
  auto_block_enabled: boolean;
  max_failed_attempts: number;
  block_window_minutes: number;
  block_duration: string; // "1hr" | "6hr" | "24hr" | "7days" | "permanent"
  ip_whitelist_enabled: boolean;
  blocked_countries: string[];
  min_password_length: number;
  require_uppercase: boolean;
  require_number: boolean;
  require_special_char: boolean;
  password_expiry_days: number; // 0 = never
  session_timeout_minutes: number;
  require_2fa_admin: boolean;
  weekly_report_enabled: boolean;
  auto_scan_enabled: boolean;
}

const DEFAULT_SETTINGS: SecuritySettings = {
  auto_block_enabled: true,
  max_failed_attempts: 5,
  block_window_minutes: 15,
  block_duration: "24hr",
  ip_whitelist_enabled: false,
  blocked_countries: [],
  min_password_length: 8,
  require_uppercase: true,
  require_number: true,
  require_special_char: true,
  password_expiry_days: 0,
  session_timeout_minutes: 60,
  require_2fa_admin: false,
  weekly_report_enabled: false,
  auto_scan_enabled: false,
};

// ── CRUD Helpers ──
export function getSecuritySettings(): SecuritySettings {
  return loadSecure(SETTINGS_KEY, DEFAULT_SETTINGS);
}
export function saveSecuritySettings(s: SecuritySettings): void {
  storeSecure(SETTINGS_KEY, s);
}

export function getBlockedIPs(): BlockedIP[] {
  const ips = loadSecure<BlockedIP[]>(BLOCKED_IPS_KEY, []);
  const now = new Date();
  // Filter out expired non-permanent blocks
  return ips.filter(ip => {
    if (ip.is_permanent) return true;
    if (!ip.expires_at) return true;
    return new Date(ip.expires_at) > now;
  });
}
export function saveBlockedIPs(ips: BlockedIP[]): void {
  storeSecure(BLOCKED_IPS_KEY, ips);
}
export function addBlockedIP(ip: Omit<BlockedIP, "id">): BlockedIP {
  const ips = loadSecure<BlockedIP[]>(BLOCKED_IPS_KEY, []);
  const entry: BlockedIP = { ...ip, id: crypto.randomUUID() };
  ips.unshift(entry);
  saveBlockedIPs(ips);
  return entry;
}
export function removeBlockedIP(id: string): void {
  const ips = loadSecure<BlockedIP[]>(BLOCKED_IPS_KEY, []);
  saveBlockedIPs(ips.filter(ip => ip.id !== id));
}

export function getLoginAttemptsLog(): LoginAttemptLog[] {
  return loadSecure<LoginAttemptLog[]>(LOGIN_ATTEMPTS_LOG_KEY, []).slice(0, 200);
}
export function addLoginAttemptLog(entry: Omit<LoginAttemptLog, "id">): void {
  const logs = loadSecure<LoginAttemptLog[]>(LOGIN_ATTEMPTS_LOG_KEY, []);
  logs.unshift({ ...entry, id: crypto.randomUUID() });
  if (logs.length > 200) logs.length = 200;
  storeSecure(LOGIN_ATTEMPTS_LOG_KEY, logs);
}

export function getIPWhitelist(): WhitelistedIP[] {
  return loadSecure<WhitelistedIP[]>(IP_WHITELIST_KEY, []);
}
export function saveIPWhitelist(list: WhitelistedIP[]): void {
  storeSecure(IP_WHITELIST_KEY, list);
}
export function addToWhitelist(ip: Omit<WhitelistedIP, "id">): void {
  const list = getIPWhitelist();
  list.push({ ...ip, id: crypto.randomUUID() });
  saveIPWhitelist(list);
}
export function removeFromWhitelist(id: string): void {
  saveIPWhitelist(getIPWhitelist().filter(w => w.id !== id));
}

export function getActivityLog(): ActivityLogEntry[] {
  return loadSecure<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []).slice(0, 500);
}
export function addActivityLog(entry: Omit<ActivityLogEntry, "id" | "created_at">): void {
  const logs = loadSecure<ActivityLogEntry[]>(ACTIVITY_LOG_KEY, []);
  logs.unshift({ ...entry, id: crypto.randomUUID(), created_at: new Date().toISOString() });
  if (logs.length > 500) logs.length = 500;
  storeSecure(ACTIVITY_LOG_KEY, logs);
}

export function getScanLogs(): ScanLog[] {
  return loadSecure<ScanLog[]>(SCAN_LOGS_KEY, []);
}
export function addScanLog(entry: Omit<ScanLog, "id">): ScanLog {
  const logs = loadSecure<ScanLog[]>(SCAN_LOGS_KEY, []);
  const log: ScanLog = { ...entry, id: crypto.randomUUID() };
  logs.unshift(log);
  if (logs.length > 50) logs.length = 50;
  storeSecure(SCAN_LOGS_KEY, logs);
  return log;
}

export function getSecuritySessions(): SecuritySession[] {
  return loadSecure<SecuritySession[]>(SESSIONS_KEY, []);
}
export function saveSecuritySessions(s: SecuritySession[]): void {
  storeSecure(SESSIONS_KEY, s);
}

// ── Security Score Calculation ──
export function calculateSecurityScore(settings: SecuritySettings, scanLogs: ScanLog[], loginLogs: LoginAttemptLog[], blockedIPs: BlockedIP[]): { score: number; checks: { label: string; pass: boolean; points: number }[] } {
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;
  const recentFailed = loginLogs.filter(l => !l.was_successful && new Date(l.attempted_at).getTime() > last24h);
  const lastScan = scanLogs[0];
  const activeBlocked = blockedIPs.filter(ip => ip.is_permanent || (ip.expires_at && new Date(ip.expires_at).getTime() > now));

  const checks = [
    { label: "Auto IP blocking enabled", pass: settings.auto_block_enabled, points: 10 },
    { label: "2FA required for admins", pass: settings.require_2fa_admin, points: 15 },
    { label: "Weekly malware scan enabled", pass: settings.auto_scan_enabled, points: 10 },
    { label: "Password policy enforced", pass: settings.require_uppercase && settings.require_number && settings.require_special_char && settings.min_password_length >= 8, points: 10 },
    { label: "No failed logins in last 24hr", pass: recentFailed.length === 0, points: 10 },
    { label: "No blocked IPs currently", pass: activeBlocked.length === 0, points: 5 },
    { label: "No threats in last scan", pass: !lastScan || lastScan.threats_found === 0, points: 10 },
    { label: "Session timeout configured", pass: settings.session_timeout_minutes <= 60, points: 10 },
    { label: "Strong password length (≥10)", pass: settings.min_password_length >= 10, points: 10 },
    { label: "IP whitelist enabled", pass: settings.ip_whitelist_enabled, points: 10 },
  ];

  const score = checks.reduce((sum, c) => sum + (c.pass ? c.points : 0), 0);
  return { score, checks };
}

// ── Malware Scan Engine ──
const MALICIOUS_PATTERNS = [
  /<script/i, /javascript:/i, /onerror\s*=/i,
  /DROP\s+TABLE/i, /UNION\s+SELECT/i, /1\s*=\s*1/i,
  /<iframe/i, /eval\s*\(/i, /document\.cookie/i,
  /onload\s*=/i, /onclick\s*=/i, /onmouseover\s*=/i,
];

export function scanLeadData(leads: any[]): ScanFinding[] {
  const findings: ScanFinding[] = [];
  leads.forEach(lead => {
    const fields = ["name", "email", "personalEmail", "personalEmail2", "company", "position", "notes", "phone", "address"];
    fields.forEach(field => {
      const value = lead[field];
      if (typeof value !== "string" || !value) return;
      MALICIOUS_PATTERNS.forEach(pattern => {
        if (pattern.test(value)) {
          findings.push({
            severity: "critical",
            description: `Suspicious pattern found: ${pattern.source}`,
            table: "leads",
            field,
            record: lead.name || lead.id,
            action: "Review and sanitize this field",
          });
        }
      });
    });
  });
  return findings;
}

export function scanUserAccounts(users: any[]): ScanFinding[] {
  const findings: ScanFinding[] = [];
  // Check for accounts created in rapid succession (same IP not available client-side, check for duplicate patterns)
  const emailDomains = new Map<string, number>();
  users.forEach(u => {
    const domain = u.email?.split("@")[1];
    if (domain) emailDomains.set(domain, (emailDomains.get(domain) || 0) + 1);
  });
  emailDomains.forEach((count, domain) => {
    if (count > 10) {
      findings.push({
        severity: "warning",
        description: `${count} accounts from domain ${domain}`,
        table: "users",
        action: "Verify these accounts are legitimate",
      });
    }
  });
  return findings;
}

// ── IP Fetch Helper ──
export async function fetchCurrentIP(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip || "Unknown";
  } catch {
    return "Unknown";
  }
}
