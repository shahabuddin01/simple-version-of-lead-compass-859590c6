import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { AppUser, UserRole, Permissions, DEFAULT_ROLE_PERMISSIONS } from "@/types/auth";
import {
  storeSecure, loadSecure, hashPassword, verifyPassword,
  generateSessionToken, isAccountLocked, recordFailedLogin,
  clearLoginAttempts, logAudit, registerSession, isSessionValid,
  clearActiveSession, runSecurityCheck,
} from "@/lib/security";

const USERS_KEY = "nhproductionhouse_users";
const SESSION_KEY = "nhproductionhouse_session";
const USERS_INIT_KEY = "nhproductionhouse_users_initialized";
const PERMISSIONS_KEY = "nhproductionhouse_permissions";

const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_IDLE_MS = 60 * 60 * 1000; // 60 minutes inactivity

const defaultUsers: AppUser[] = [
  { id: "u1", name: "Admin User", email: "admin@nsproduction.com", password: hashPassword("Admin@1234"), role: "Admin", active: true },
  { id: "u2", name: "Manager", email: "manager@nsproduction.com", password: hashPassword("Manager@1234"), role: "Manager", active: true },
  { id: "u3", name: "Employee", email: "employee@nsproduction.com", password: hashPassword("Employee@1234"), role: "Employee", active: true },
  { id: "u4", name: "Viewer", email: "viewer@nsproduction.com", password: hashPassword("Viewer@1234"), role: "Viewer", active: true },
];

function loadUsers(): AppUser[] {
  try {
    const init = localStorage.getItem(USERS_INIT_KEY);
    if (init === "v2") {
      const stored = loadSecure<AppUser[]>(USERS_KEY, []);
      if (stored.length > 0) return stored;
    }
    localStorage.setItem(USERS_INIT_KEY, "v2");
    storeSecure(USERS_KEY, defaultUsers);
    return defaultUsers;
  } catch {
    return defaultUsers;
  }
}

interface SessionData {
  user: AppUser;
  token: string;
  loginAt: number;
  lastActivity: number;
}

function loadSession(): SessionData | null {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    if (!s) return null;
    const data: SessionData = JSON.parse(s);
    if (!data.token) return null;
    if (Date.now() - data.loginAt > SESSION_MAX_AGE_MS) return null;
    if (Date.now() - data.lastActivity > SESSION_IDLE_MS) return null;
    if (!isSessionValid(data.user.id, data.token)) return null;
    return data;
  } catch {
    return null;
  }
}

function saveSession(data: SessionData | null) {
  if (data) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function loadRolePermissions(): Record<UserRole, Permissions> {
  try {
    const stored = loadSecure<Record<UserRole, Permissions> | null>(PERMISSIONS_KEY, null);
    if (stored) {
      const roles: UserRole[] = ["Admin", "Manager", "Employee", "Viewer"];
      const result = { ...DEFAULT_ROLE_PERMISSIONS };
      roles.forEach(role => {
        if (stored[role]) {
          result[role] = { ...DEFAULT_ROLE_PERMISSIONS[role], ...stored[role] };
        }
      });
      return result;
    }
  } catch {}
  return { ...DEFAULT_ROLE_PERMISSIONS };
}

const EMPTY_PERMISSIONS: Permissions = {
  canViewLeads: false, canAddLead: false, canEditAnyLead: false, canEditOwnLead: false,
  canDeleteLead: false, canImport: false, canExport: false,
  canAccessSMS: false, canSendSMS: false, canConfigureSMSGateway: false,
  canAddIndustry: false, canDeleteIndustry: false, canRenameIndustry: false,
  canMergeCompany: false, canAddCompany: false, canDeleteCompany: false, canRenameCompany: false,
  canBulkStatusUpdate: false, canToggleActive: false, canViewDashboard: false,
  canManageUsers: false, canEditPermissions: false,
};

function resolvePermissions(user: AppUser, rolePerms: Record<UserRole, Permissions>): Permissions {
  const base = rolePerms[user.role];
  if (!user.permissionOverrides) return base;
  return { ...base, ...user.permissionOverrides };
}

interface AuthContextType {
  currentUser: AppUser | null;
  permissions: Permissions;
  users: AppUser[];
  rolePermissions: Record<UserRole, Permissions>;
  sessionExpired: boolean;
  sessionWarning: boolean;
  concurrentSessionKicked: boolean;
  login: (email: string, password: string) => string | null;
  logout: () => void;
  addUser: (user: Omit<AppUser, "id">) => string | null;
  updateUser: (id: string, updates: Partial<AppUser>) => void;
  toggleUserActive: (id: string) => void;
  setRolePermissions: (perms: Record<UserRole, Permissions>) => void;
  resetRolePermissions: () => void;
  dismissSessionExpired: () => void;
  dismissConcurrentKick: () => void;
  extendSession: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(loadUsers);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const session = loadSession();
    return session?.user ?? null;
  });
  const [rolePermissions, setRolePermsState] = useState<Record<UserRole, Permissions>>(loadRolePermissions);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [concurrentSessionKicked, setConcurrentSessionKicked] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionTokenRef = useRef<string | null>(loadSession()?.token ?? null);

  // Run security check on mount
  useEffect(() => { runSecurityCheck(); }, []);

  // Persist users
  useEffect(() => { storeSecure(USERS_KEY, users); }, [users]);

  // Track user activity for idle timeout
  useEffect(() => {
    if (!currentUser) return;
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      const session = loadSession();
      if (session) {
        session.lastActivity = Date.now();
        saveSession(session);
      }
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }));
    return () => { events.forEach(e => document.removeEventListener(e, handleActivity)); };
  }, [currentUser]);

  // Session validity check interval + warning
  useEffect(() => {
    if (!currentUser) return;
    const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry
    const interval = setInterval(() => {
      const session = loadSession();
      if (!session) {
        setSessionWarning(false);
        setSessionExpired(true);
        setCurrentUser(null);
        sessionTokenRef.current = null;
        return;
      }
      // Check idle warning (5 min before timeout)
      const idleTime = Date.now() - session.lastActivity;
      if (idleTime >= SESSION_IDLE_MS - WARNING_THRESHOLD_MS && idleTime < SESSION_IDLE_MS) {
        setSessionWarning(true);
      } else {
        setSessionWarning(false);
      }
      // Check concurrent session
      if (sessionTokenRef.current && !isSessionValid(currentUser.id, sessionTokenRef.current as string)) {
        setConcurrentSessionKicked(true);
        setCurrentUser(null);
        saveSession(null);
        sessionTokenRef.current = null;
      }
    }, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, [currentUser]);

  const permissions = currentUser ? resolvePermissions(currentUser, rolePermissions) : EMPTY_PERMISSIONS;

  const login = useCallback((email: string, password: string): string | null => {
    const lowerEmail = email.toLowerCase();

    const lockStatus = isAccountLocked(lowerEmail);
    if (lockStatus.locked) {
      const mins = Math.floor(lockStatus.remainingSeconds / 60);
      const secs = lockStatus.remainingSeconds % 60;
      logAudit(lowerEmail, '', 'LOGIN_FAILED', `Account locked. ${mins}:${String(secs).padStart(2, '0')} remaining`);
      return `Account locked. Try again in ${mins}:${String(secs).padStart(2, '0')}`;
    }

    const user = users.find((u) => u.email.toLowerCase() === lowerEmail);
    if (!user) {
      const result = recordFailedLogin(lowerEmail);
      logAudit(lowerEmail, '', 'LOGIN_FAILED', `Invalid email. Attempt ${result.locked ? '5/5 - LOCKED' : ''}`);
      return "Invalid email or password.";
    }
    if (!user.active) {
      logAudit(user.email, user.id, 'LOGIN_FAILED', 'Account deactivated');
      return "Account deactivated.";
    }
    if (!verifyPassword(password, user.password)) {
      const result = recordFailedLogin(lowerEmail);
      logAudit(user.email, user.id, 'LOGIN_FAILED', `Wrong password. Attempt ${result.locked ? '5/5 - LOCKED' : ''}`);
      if (result.locked) {
        return `Account locked for 15 minutes after 5 failed attempts.`;
      }
      return "Invalid email or password.";
    }

    // Success
    clearLoginAttempts(lowerEmail);
    const token = generateSessionToken();
    const sd: SessionData = { user, token, loginAt: Date.now(), lastActivity: Date.now() };
    saveSession(sd);
    registerSession(user.id, token);
    sessionTokenRef.current = token;
    setCurrentUser(user);
    logAudit(user.email, user.id, 'LOGIN', 'Success');
    return null;
  }, [users]);

  const logout = useCallback(() => {
    if (currentUser) {
      logAudit(currentUser.email, currentUser.id, 'LOGOUT', '');
      clearActiveSession(currentUser.id);
    }
    saveSession(null);
    sessionTokenRef.current = null;
    setCurrentUser(null);
  }, [currentUser]);

  const addUser = useCallback((user: Omit<AppUser, "id">): string | null => {
    const exists = users.some((u) => u.email.toLowerCase() === user.email.toLowerCase());
    if (exists) return "A user with this email already exists.";
    const newUser: AppUser = { ...user, id: crypto.randomUUID() };
    setUsers((prev) => [...prev, newUser]);
    if (currentUser) {
      logAudit(currentUser.email, currentUser.id, 'USER_ADDED', user.email);
    }
    return null;
  }, [users, currentUser]);

  const updateUser = useCallback((id: string, updates: Partial<AppUser>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
    if (currentUser?.id === id) {
      const updated = { ...currentUser, ...updates };
      setCurrentUser(updated);
      const sd = loadSession();
      if (sd) {
        sd.user = updated;
        saveSession(sd);
      }
    }
    if (currentUser) {
      logAudit(currentUser.email, currentUser.id, 'USER_EDITED', `User ID: ${id}`);
    }
  }, [currentUser]);

  const toggleUserActive = useCallback((id: string) => {
    setUsers((prev) => {
      const user = prev.find(u => u.id === id);
      if (currentUser && user) {
        logAudit(currentUser.email, currentUser.id, 'USER_TOGGLED', `${user.email} → ${user.active ? 'Deactivated' : 'Activated'}`);
      }
      return prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u));
    });
  }, [currentUser]);

  const setRolePermissions = useCallback((perms: Record<UserRole, Permissions>) => {
    setRolePermsState(perms);
    storeSecure(PERMISSIONS_KEY, perms);
    if (currentUser) {
      logAudit(currentUser.email, currentUser.id, 'PERMISSION_CHANGED', 'Role permissions updated');
    }
  }, [currentUser]);

  const resetRolePermissions = useCallback(() => {
    const defaults = { ...DEFAULT_ROLE_PERMISSIONS };
    setRolePermsState(defaults);
    storeSecure(PERMISSIONS_KEY, defaults);
    if (currentUser) {
      logAudit(currentUser.email, currentUser.id, 'PERMISSION_CHANGED', 'Reset to defaults');
    }
  }, [currentUser]);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);
  const dismissConcurrentKick = useCallback(() => setConcurrentSessionKicked(false), []);

  const extendSession = useCallback(() => {
    setSessionWarning(false);
    lastActivityRef.current = Date.now();
    const session = loadSession();
    if (session) {
      session.lastActivity = Date.now();
      saveSession(session);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      currentUser, permissions, users, rolePermissions,
      sessionExpired, sessionWarning, concurrentSessionKicked,
      login, logout, addUser, updateUser, toggleUserActive,
      setRolePermissions, resetRolePermissions,
      dismissSessionExpired, dismissConcurrentKick, extendSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
