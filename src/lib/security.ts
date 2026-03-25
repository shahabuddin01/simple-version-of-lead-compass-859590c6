// ── Security Utilities for NH Production House CRM ──
// NOTE: This is a demo-grade client-side security layer.
// For production, use server-side auth (e.g., Supabase Auth) + bcrypt.

// ── Input Sanitization (XSS Prevention) ──
export function sanitize(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ── Secure localStorage (obfuscated) ──
export function storeSecure(key: string, data: any): void {
  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    localStorage.setItem(key, encoded);
  } catch {
    // Storage full or encoding error
  }
}

export function loadSecure<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    // Data integrity error — remove corrupted key
    localStorage.removeItem(key);
    return fallback;
  }
}

// ── Password Hashing (demo-grade, NOT bcrypt) ──
export function hashPassword(password: string): string {
  return btoa(password + '_nsp_salt_2025');
}

export function verifyPassword(password: string, hash: string): boolean {
  return btoa(password + '_nsp_salt_2025') === hash;
}

// ── Password Policy ──
export interface PasswordStrength {
  score: number; // 0-4
  label: 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
  errors: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Minimum 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least 1 uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least 1 lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least 1 number');
  if (!/[!@#$%^&*]/.test(password)) errors.push('At least 1 special character (!@#$%^&*)');

  const score = 4 - Math.min(errors.length, 4);
  const labels: Record<number, PasswordStrength['label']> = {
    0: 'Weak', 1: 'Weak', 2: 'Fair', 3: 'Strong', 4: 'Very Strong',
  };
  const colors: Record<number, string> = {
    0: 'bg-destructive', 1: 'bg-destructive', 2: 'bg-amber-500', 3: 'bg-green-500', 4: 'bg-green-600',
  };

  return { score, label: labels[score], color: colors[score], errors };
}

export function isPasswordValid(password: string): boolean {
  return checkPasswordStrength(password).errors.length === 0;
}

// ── Session Token ──
export function generateSessionToken(): string {
  return crypto.randomUUID() + '_' + Date.now();
}

// ── Brute Force Protection ──
const LOGIN_ATTEMPTS_KEY = 'nhproductionhouse_login_attempts';

interface LoginAttempts {
  [email: string]: {
    count: number;
    lockedUntil: number | null;
    lastAttempt: number;
  };
}

export function getLoginAttempts(): LoginAttempts {
  return loadSecure(LOGIN_ATTEMPTS_KEY, {});
}

export function recordFailedLogin(email: string): { locked: boolean; remainingMinutes: number } {
  const attempts = getLoginAttempts();
  const now = Date.now();
  const entry = attempts[email] || { count: 0, lockedUntil: null, lastAttempt: 0 };

  // If lock has expired, reset
  if (entry.lockedUntil && now > entry.lockedUntil) {
    entry.count = 0;
    entry.lockedUntil = null;
  }

  entry.count++;
  entry.lastAttempt = now;

  if (entry.count >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000; // 15 minutes
  }

  attempts[email] = entry;
  storeSecure(LOGIN_ATTEMPTS_KEY, attempts);

  return {
    locked: entry.count >= 5,
    remainingMinutes: entry.lockedUntil ? Math.ceil((entry.lockedUntil - now) / 60000) : 0,
  };
}

export function isAccountLocked(email: string): { locked: boolean; remainingSeconds: number } {
  const attempts = getLoginAttempts();
  const entry = attempts[email];
  if (!entry || !entry.lockedUntil) return { locked: false, remainingSeconds: 0 };

  const now = Date.now();
  if (now > entry.lockedUntil) {
    // Lock expired, reset
    entry.count = 0;
    entry.lockedUntil = null;
    attempts[email] = entry;
    storeSecure(LOGIN_ATTEMPTS_KEY, attempts);
    return { locked: false, remainingSeconds: 0 };
  }

  return { locked: true, remainingSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
}

export function clearLoginAttempts(email: string): void {
  const attempts = getLoginAttempts();
  delete attempts[email];
  storeSecure(LOGIN_ATTEMPTS_KEY, attempts);
}

// ── Audit Log ──
const AUDIT_KEY = 'nhproductionhouse_audit';

export interface AuditEntry {
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
}

export function getAuditLog(): AuditEntry[] {
  return loadSecure(AUDIT_KEY, []);
}

export function logAudit(userEmail: string, userId: string, action: string, details: string): void {
  const log = getAuditLog();
  log.unshift({
    timestamp: new Date().toISOString(),
    userId,
    userEmail,
    action,
    details,
  });
  // Keep only 500 most recent
  if (log.length > 500) log.length = 500;
  storeSecure(AUDIT_KEY, log);
}

export function exportAuditCSV(): void {
  const log = getAuditLog();
  const headers = "Timestamp,User,Action,Details";
  const rows = log.map(e =>
    `"${e.timestamp}","${e.userEmail}","${e.action}","${(e.details || '').replace(/"/g, '""')}"`
  );
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ns-production-audit-log.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Concurrent Session Detection ──
const ACTIVE_SESSIONS_KEY = 'nhproductionhouse_active_sessions';

interface ActiveSessionInfo {
  userId: string;
  sessionToken: string;
  loginTimestamp: number;
}

export function registerSession(userId: string, sessionToken: string): void {
  const sessions: Record<string, ActiveSessionInfo> = loadSecure(ACTIVE_SESSIONS_KEY, {});
  sessions[userId] = { userId, sessionToken, loginTimestamp: Date.now() };
  storeSecure(ACTIVE_SESSIONS_KEY, sessions);
}

export function isSessionValid(userId: string, sessionToken: string): boolean {
  const sessions: Record<string, ActiveSessionInfo> = loadSecure(ACTIVE_SESSIONS_KEY, {});
  const session = sessions[userId];
  return session?.sessionToken === sessionToken;
}

export function clearActiveSession(userId: string): void {
  const sessions: Record<string, ActiveSessionInfo> = loadSecure(ACTIVE_SESSIONS_KEY, {});
  delete sessions[userId];
  storeSecure(ACTIVE_SESSIONS_KEY, sessions);
}

// ── Security Check (runs on load) ──
export function runSecurityCheck(): void {
  const checks = [
    { name: 'Session storage available', pass: typeof sessionStorage !== 'undefined' },
    { name: 'Local storage available', pass: typeof localStorage !== 'undefined' },
    { name: 'Crypto available', pass: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' },
  ];
  const failed = checks.filter(c => !c.pass);
  if (failed.length > 0 && import.meta.env.DEV) {
    console.warn('[NH Production House] Security check failed:', failed.map(f => f.name));
  }
}

// ── Permission Check Helper ──
import { Permissions } from "@/types/auth";

export function canPerformAction(
  action: keyof Permissions,
  rolePermissions: Record<string, Permissions>,
  userRole: string,
  permissionOverrides?: Partial<Record<keyof Permissions, boolean>>
): boolean {
  // Check user-level override first
  if (permissionOverrides && action in permissionOverrides) {
    return permissionOverrides[action] === true;
  }
  // Fall back to role default
  const perms = rolePermissions[userRole];
  return perms?.[action] === true;
}

// Check for script tags in stored data
export function checkForScriptTags(): boolean {
  const keysToCheck = [
    'nhproductionhouse_crm_leads',
    'nhproductionhouse_users',
  ];
  for (const key of keysToCheck) {
    const raw = localStorage.getItem(key);
    if (raw && (/<script/i.test(raw) || /javascript:/i.test(raw))) {
      return false;
    }
  }
  return true;
}
