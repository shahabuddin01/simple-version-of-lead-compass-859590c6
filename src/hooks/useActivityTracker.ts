import { useEffect, useRef, useCallback } from "react";
import { AppUser } from "@/types/auth";

// ── Types ──
export type ActivityAction =
  | "session_start" | "session_end"
  | "lead_viewed" | "lead_added" | "lead_edited" | "lead_deleted"
  | "status_updated" | "bulk_action" | "csv_imported" | "csv_exported" | "crm_imported"
  | "search_performed" | "filter_applied" | "page_navigated";

export interface ActivityLog {
  userId: string;
  userName: string;
  role: string;
  action: ActivityAction;
  timestamp: number;
  sessionId: string;
  date: string;
  meta?: Record<string, any>;
}

export interface HourlyStat {
  userId: string;
  date: string;
  hour: number;
  clicks: number;
  actions: number;
  actionBreakdown: Record<string, number>;
}

export interface TimeSession {
  userId: string;
  userName: string;
  role: string;
  sessionId: string;
  date: string;
  startTime: number;
  endTime: number | null;
  idlePeriods: { start: number; end: number }[];
  totalActions: number;
  totalClicks: number;
}

export interface SalaryConfig {
  rates: Record<string, { hourly: number; monthlyBase: number }>;
  calcMethod: "hourly_active" | "hourly_total" | "monthly_bonus" | "hourly_bonus";
  bonusRules: { minScore: number; bonusPercent: number }[];
  currency: string;
}

export interface HourlyRateConfig {
  regular: number;
  overtime: number;
  holiday: number;
}

export interface PublicHoliday {
  name: string;
  date: string;
  repeatYearly: boolean;
}

export interface WorkforceSettings {
  idleThresholdMinutes: number;
  autoSessionEndMinutes: number;
  overtimeAfterHours: number;
  weeklyOffDays: number[];
  publicHolidays: PublicHoliday[];
  currency: string;
  payCycle: "monthly" | "weekly" | "biweekly";
  hourlyRates: Record<string, HourlyRateConfig>;
}

// ── Storage Keys ──
const LOGS_KEY = "nhproductionhouse_activity_logs";
const SESSIONS_KEY = "nhproductionhouse_time_sessions";
const HOURLY_KEY = "nhproductionhouse_hourly_stats";
const SALARY_KEY = "nhproductionhouse_salary_config";
const SETTINGS_KEY = "nhproductionhouse_workforce_settings";

// ── Helpers ──
function today(): string {
  return new Date().toISOString().split("T")[0];
}

function genSessionId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function compressOldLogs() {
  const logs: ActivityLog[] = loadJSON(LOGS_KEY, []);
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recent = logs.filter(l => l.timestamp >= cutoff);
  if (recent.length < logs.length) {
    saveJSON(LOGS_KEY, recent);
  }
}

// ── Public API ──
export function getActivityLogs(): ActivityLog[] {
  return loadJSON(LOGS_KEY, []);
}

export function getTimeSessions(): TimeSession[] {
  return loadJSON(SESSIONS_KEY, []);
}

export function getHourlyStats(): HourlyStat[] {
  return loadJSON(HOURLY_KEY, []);
}

export function getSalaryConfig(): SalaryConfig {
  return loadJSON(SALARY_KEY, {
    rates: {
      Manager: { hourly: 250, monthlyBase: 45000 },
      Employee: { hourly: 200, monthlyBase: 35000 },
      Viewer: { hourly: 150, monthlyBase: 25000 },
    },
    calcMethod: "hourly_active" as const,
    bonusRules: [
      { minScore: 90, bonusPercent: 15 },
      { minScore: 75, bonusPercent: 10 },
      { minScore: 60, bonusPercent: 5 },
    ],
    currency: "৳",
  });
}

export function saveSalaryConfig(config: SalaryConfig) {
  saveJSON(SALARY_KEY, config);
}

export function getWorkforceSettings(): WorkforceSettings {
  return loadJSON(SETTINGS_KEY, {
    idleThresholdMinutes: 5,
    autoSessionEndMinutes: 30,
    overtimeAfterHours: 8,
    weeklyOffDays: [] as number[],
    publicHolidays: [] as PublicHoliday[],
    currency: "৳",
    payCycle: "monthly" as const,
    hourlyRates: {
      Manager: { regular: 300, overtime: 450, holiday: 600 },
      Employee: { regular: 150, overtime: 225, holiday: 300 },
      Viewer: { regular: 80, overtime: 120, holiday: 160 },
    },
  });
}

export function isWorkingDay(date: Date, settings: WorkforceSettings): boolean {
  const dayOfWeek = date.getDay();
  if (settings.weeklyOffDays.includes(dayOfWeek)) return false;
  const dateStr = date.toISOString().split("T")[0];
  return !settings.publicHolidays.some(h => {
    if (h.repeatYearly) return h.date.slice(5) === dateStr.slice(5);
    return h.date === dateStr;
  });
}

export function saveWorkforceSettings(settings: WorkforceSettings) {
  saveJSON(SETTINGS_KEY, settings);
}

export function logActivity(log: ActivityLog) {
  const logs = getActivityLogs();
  logs.push(log);
  saveJSON(LOGS_KEY, logs);
}

function updateHourlyStat(userId: string, date: string, hour: number, isClick: boolean, action?: ActivityAction) {
  const stats = getHourlyStats();
  let stat = stats.find(s => s.userId === userId && s.date === date && s.hour === hour);
  if (!stat) {
    stat = { userId, date, hour, clicks: 0, actions: 0, actionBreakdown: {} };
    stats.push(stat);
  }
  if (isClick) stat.clicks++;
  if (action && action !== "session_start" && action !== "session_end") {
    stat.actions++;
    stat.actionBreakdown[action] = (stat.actionBreakdown[action] || 0) + 1;
  }
  saveJSON(HOURLY_KEY, stats);
}

function startSession(user: AppUser): string {
  const sessionId = genSessionId();
  const now = Date.now();
  const session: TimeSession = {
    userId: user.id, userName: user.name, role: user.role,
    sessionId, date: today(), startTime: now, endTime: null,
    idlePeriods: [], totalActions: 0, totalClicks: 0,
  };
  const sessions = getTimeSessions();
  sessions.push(session);
  saveJSON(SESSIONS_KEY, sessions);

  logActivity({
    userId: user.id, userName: user.name, role: user.role,
    action: "session_start", timestamp: now, sessionId, date: today(),
  });

  return sessionId;
}

function endSession(sessionId: string) {
  const sessions = getTimeSessions();
  const session = sessions.find(s => s.sessionId === sessionId);
  if (session && !session.endTime) {
    session.endTime = Date.now();
    saveJSON(SESSIONS_KEY, sessions);
    logActivity({
      userId: session.userId, userName: session.userName, role: session.role,
      action: "session_end", timestamp: Date.now(), sessionId, date: today(),
    });
  }
}

function updateSessionStats(sessionId: string, clicks: number) {
  const sessions = getTimeSessions();
  const session = sessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.totalClicks += clicks;
    saveJSON(SESSIONS_KEY, sessions);
  }
}

function markSessionIdle(sessionId: string, idleStart: number) {
  const sessions = getTimeSessions();
  const session = sessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.idlePeriods.push({ start: idleStart, end: Date.now() });
    saveJSON(SESSIONS_KEY, sessions);
  }
}

// ── Productivity Score ──
export function calcProductivityScore(
  activeMinutes: number, totalMinutes: number,
  actions: number, clicks: number,
  leadsAddedEdited: number
): number {
  if (totalMinutes <= 0) return 0;
  const activeHours = activeMinutes / 60;
  const activeRatio = Math.min(activeMinutes / totalMinutes, 1);
  const actionsPerHour = activeHours > 0 ? actions / activeHours : 0;
  const clicksPerHour = activeHours > 0 ? clicks / activeHours : 0;

  const score =
    activeRatio * 35 +
    Math.min(actionsPerHour / 10, 1) * 25 +
    Math.min(clicksPerHour / 100, 1) * 15 +
    Math.min(leadsAddedEdited / 20, 1) * 25;

  return Math.round(Math.min(score, 100));
}

export function getScoreBadge(score: number): { label: string; emoji: string; color: string } {
  if (score >= 90) return { label: "Excellent", emoji: "🌟", color: "text-yellow-600" };
  if (score >= 75) return { label: "Good", emoji: "✅", color: "text-green-600" };
  if (score >= 60) return { label: "Average", emoji: "📊", color: "text-blue-600" };
  if (score >= 40) return { label: "Below Average", emoji: "⚠️", color: "text-amber-600" };
  return { label: "Low Activity", emoji: "🔴", color: "text-red-600" };
}

// ── Hook ──
export function useActivityTracker(user: AppUser | null) {
  const sessionIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isIdleRef = useRef(false);
  const idleStartRef = useRef<number>(0);
  const clickBufferRef = useRef(0);

  const trackAction = useCallback((action: ActivityAction, meta?: Record<string, any>) => {
    if (!user || !sessionIdRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;

    if (isIdleRef.current) {
      markSessionIdle(sessionIdRef.current, idleStartRef.current);
      isIdleRef.current = false;
    }

    logActivity({
      userId: user.id, userName: user.name, role: user.role,
      action, timestamp: now, sessionId: sessionIdRef.current, date: today(), meta,
    });

    const hour = new Date().getHours();
    updateHourlyStat(user.id, today(), hour, false, action);

    const sessions = getTimeSessions();
    const session = sessions.find(s => s.sessionId === sessionIdRef.current);
    if (session) {
      session.totalActions++;
      saveJSON(SESSIONS_KEY, sessions);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    compressOldLogs();
    const sid = startSession(user);
    sessionIdRef.current = sid;
    lastActivityRef.current = Date.now();

    const handleClick = () => {
      lastActivityRef.current = Date.now();
      clickBufferRef.current++;
      if (isIdleRef.current && sessionIdRef.current) {
        markSessionIdle(sessionIdRef.current, idleStartRef.current);
        isIdleRef.current = false;
      }
      const hour = new Date().getHours();
      updateHourlyStat(user.id, today(), hour, true);
      updateSessionStats(sessionIdRef.current!, 1);
    };

    document.addEventListener("click", handleClick, true);

    const settings = getWorkforceSettings();
    const idleMs = settings.idleThresholdMinutes * 60 * 1000;
    const autoEndMs = settings.autoSessionEndMinutes * 60 * 1000;

    const idleInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= autoEndMs && sessionIdRef.current) {
        if (isIdleRef.current) {
          markSessionIdle(sessionIdRef.current, idleStartRef.current);
        }
        endSession(sessionIdRef.current);
        sessionIdRef.current = null;
      } else if (elapsed >= idleMs && !isIdleRef.current) {
        isIdleRef.current = true;
        idleStartRef.current = lastActivityRef.current;
      }
    }, 30000);

    const handleUnload = () => {
      if (sessionIdRef.current) {
        if (isIdleRef.current) {
          markSessionIdle(sessionIdRef.current, idleStartRef.current);
        }
        endSession(sessionIdRef.current);
      }
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      document.removeEventListener("click", handleClick, true);
      clearInterval(idleInterval);
      window.removeEventListener("beforeunload", handleUnload);
      if (sessionIdRef.current) {
        if (isIdleRef.current) {
          markSessionIdle(sessionIdRef.current, idleStartRef.current);
        }
        endSession(sessionIdRef.current);
      }
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const handleResume = () => {
      if (!sessionIdRef.current) {
        const sid = startSession(user);
        sessionIdRef.current = sid;
        lastActivityRef.current = Date.now();
        isIdleRef.current = false;
      }
    };
    document.addEventListener("click", handleResume);
    return () => document.removeEventListener("click", handleResume);
  }, [user]);

  return { trackAction };
}
