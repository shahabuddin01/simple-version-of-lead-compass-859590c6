import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Minimal user shape — works with both legacy AppUser and SupabaseAppUser
export interface TrackerUser {
  id: string;
  fullName: string;
  role: string;
}

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

// ── Storage Keys (config still local — same for everyone) ──
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

// ── Row mappers (DB ↔ frontend types) ──
function mapSessionRow(r: any): TimeSession {
  return {
    userId: r.user_id,
    userName: r.user_name,
    role: r.role,
    sessionId: r.session_id,
    date: r.date,
    startTime: new Date(r.start_time).getTime(),
    endTime: r.end_time ? new Date(r.end_time).getTime() : null,
    idlePeriods: Array.isArray(r.idle_periods) ? r.idle_periods : [],
    totalActions: r.total_actions || 0,
    totalClicks: r.total_clicks || 0,
  };
}

function mapLogRow(r: any): ActivityLog {
  return {
    userId: r.user_id,
    userName: r.user_name,
    role: r.role,
    action: r.action as ActivityAction,
    timestamp: new Date(r.created_at).getTime(),
    sessionId: r.session_id || "",
    date: r.date,
    meta: r.meta || undefined,
  };
}

function mapHourlyRow(r: any): HourlyStat {
  return {
    userId: r.user_id,
    date: r.date,
    hour: r.hour,
    clicks: r.clicks || 0,
    actions: r.actions || 0,
    actionBreakdown: r.action_breakdown || {},
  };
}

export interface DailyActivitySummary {
  userId: string;
  userName: string;
  role: string;
  date: string;
  sessions: TimeSession[];
  firstStart: number;
  lastActivity: number;
  totalDuration: number;
  activeTime: number;
  idleTime: number;
  totalActions: number;
  totalClicks: number;
}

export function buildDailyActivitySummaries(
  sessions: TimeSession[],
  hourly: HourlyStat[]
): DailyActivitySummary[] {
  const map = new Map<string, DailyActivitySummary>();

  sessions.forEach((session) => {
    const key = `${session.userId}_${session.date}`;
    const existing = map.get(key);
    const idleTime = session.idlePeriods.reduce((sum, period) => sum + (period.end - period.start), 0);

    if (!existing) {
      map.set(key, {
        userId: session.userId,
        userName: session.userName,
        role: session.role,
        date: session.date,
        sessions: [session],
        firstStart: session.startTime,
        lastActivity: session.startTime,
        totalDuration: 0,
        activeTime: 0,
        idleTime,
        totalActions: 0,
        totalClicks: 0,
      });
      return;
    }

    existing.sessions.push(session);
    existing.firstStart = Math.min(existing.firstStart, session.startTime);
    existing.lastActivity = Math.max(existing.lastActivity, session.startTime);
    existing.idleTime += idleTime;
  });

  hourly.forEach((stat) => {
    const key = `${stat.userId}_${stat.date}`;
    const entry = map.get(key);
    if (!entry) return;

    entry.totalClicks += stat.clicks;
    entry.totalActions += stat.actions;

    if (stat.clicks > 0 || stat.actions > 0) {
      const hourEnd = new Date(`${entry.date}T00:00:00`).getTime() + (stat.hour + 1) * 3600000;
      if (hourEnd > entry.lastActivity && hourEnd <= Date.now()) {
        entry.lastActivity = hourEnd;
      }
    }
  });

  map.forEach((entry) => {
    entry.totalDuration = Math.max(0, entry.lastActivity - entry.firstStart);
    entry.activeTime = Math.max(0, entry.totalDuration - entry.idleTime);
  });

  return [...map.values()];
}

// ── Public API (now async, Supabase-backed) ──
export async function getActivityLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error || !data) return [];
  return data.map(mapLogRow);
}

export async function getTimeSessions(): Promise<TimeSession[]> {
  const { data, error } = await supabase
    .from("time_sessions")
    .select("*")
    .order("start_time", { ascending: false })
    .limit(5000);
  if (error || !data) return [];
  return data.map(mapSessionRow);
}

export async function getHourlyStats(): Promise<HourlyStat[]> {
  const { data, error } = await supabase
    .from("hourly_stats")
    .select("*")
    .order("date", { ascending: false })
    .limit(5000);
  if (error || !data) return [];
  return data.map(mapHourlyRow);
}

export function getSalaryConfig(): SalaryConfig {
  return loadJSON(SALARY_KEY, {
    rates: {
      admin: { hourly: 350, monthlyBase: 60000 },
      manager: { hourly: 250, monthlyBase: 45000 },
      user: { hourly: 200, monthlyBase: 35000 },
      viewer: { hourly: 150, monthlyBase: 25000 },
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
      admin: { regular: 400, overtime: 600, holiday: 800 },
      manager: { regular: 300, overtime: 450, holiday: 600 },
      user: { regular: 150, overtime: 225, holiday: 300 },
      viewer: { regular: 80, overtime: 120, holiday: 160 },
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

// ── Internal write helpers (Supabase) ──
async function insertLog(user: TrackerUser, action: ActivityAction, sessionId: string, meta?: Record<string, any>) {
  await supabase.from("activity_logs").insert({
    user_id: user.id,
    user_name: user.fullName,
    role: user.role,
    action,
    session_id: sessionId,
    date: today(),
    meta: meta || null,
  });
}

async function upsertHourlyStat(userId: string, date: string, hour: number, isClick: boolean, action?: ActivityAction) {
  // Read existing
  const { data: existing } = await supabase
    .from("hourly_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("hour", hour)
    .maybeSingle();

  const breakdown: Record<string, number> = (existing?.action_breakdown as Record<string, number>) || {};
  let clicks = existing?.clicks || 0;
  let actions = existing?.actions || 0;

  if (isClick) clicks++;
  if (action && action !== "session_start" && action !== "session_end") {
    actions++;
    breakdown[action] = (breakdown[action] || 0) + 1;
  }

  if (existing) {
    await supabase
      .from("hourly_stats")
      .update({ clicks, actions, action_breakdown: breakdown, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("hourly_stats").insert({
      user_id: userId, date, hour, clicks, actions, action_breakdown: breakdown,
    });
  }
}

async function startSessionDB(user: TrackerUser): Promise<string> {
  const sessionId = genSessionId();
  const now = new Date().toISOString();
  await supabase.from("time_sessions").insert({
    user_id: user.id,
    user_name: user.fullName,
    role: user.role,
    session_id: sessionId,
    date: today(),
    start_time: now,
    idle_periods: [],
    total_actions: 0,
    total_clicks: 0,
  });
  await insertLog(user, "session_start", sessionId);
  return sessionId;
}

async function endSessionDB(sessionId: string, user: TrackerUser) {
  const { data: session } = await supabase
    .from("time_sessions")
    .select("end_time")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (session && !session.end_time) {
    await supabase
      .from("time_sessions")
      .update({ end_time: new Date().toISOString() })
      .eq("session_id", sessionId);
    await insertLog(user, "session_end", sessionId);
  }
}

async function updateSessionClicks(sessionId: string, increment: number) {
  const { data: s } = await supabase
    .from("time_sessions")
    .select("total_clicks")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (s) {
    await supabase
      .from("time_sessions")
      .update({ total_clicks: (s.total_clicks || 0) + increment })
      .eq("session_id", sessionId);
  }
}

async function incrementSessionActions(sessionId: string) {
  const { data: s } = await supabase
    .from("time_sessions")
    .select("total_actions")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (s) {
    await supabase
      .from("time_sessions")
      .update({ total_actions: (s.total_actions || 0) + 1 })
      .eq("session_id", sessionId);
  }
}

async function appendIdlePeriod(sessionId: string, idleStart: number) {
  const { data: s } = await supabase
    .from("time_sessions")
    .select("idle_periods")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (s) {
    const periods = Array.isArray(s.idle_periods) ? s.idle_periods : [];
    periods.push({ start: idleStart, end: Date.now() });
    await supabase
      .from("time_sessions")
      .update({ idle_periods: periods })
      .eq("session_id", sessionId);
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
// Per-tab session storage key — survives StrictMode double-mount, route changes, and remounts.
// Cleared only on real tab close / logout.
const TAB_SESSION_KEY = "nh_active_session_id";
const TAB_SESSION_USER_KEY = "nh_active_session_user";
const TAB_SESSION_DATE_KEY = "nh_active_session_date";

async function ensureSession(user: TrackerUser): Promise<string> {
  // Try to reuse existing tab session if same user & same date & still open in DB
  const existingSid = sessionStorage.getItem(TAB_SESSION_KEY);
  const existingUser = sessionStorage.getItem(TAB_SESSION_USER_KEY);
  const existingDate = sessionStorage.getItem(TAB_SESSION_DATE_KEY);

  if (existingSid && existingUser === user.id && existingDate === today()) {
    // Verify it still exists and is open in DB
    const { data } = await supabase
      .from("time_sessions")
      .select("session_id, end_time")
      .eq("session_id", existingSid)
      .maybeSingle();
    if (data && !data.end_time) {
      return existingSid;
    }
  }

  // Otherwise create a new one and remember it for this tab
  const sid = await startSessionDB(user);
  sessionStorage.setItem(TAB_SESSION_KEY, sid);
  sessionStorage.setItem(TAB_SESSION_USER_KEY, user.id);
  sessionStorage.setItem(TAB_SESSION_DATE_KEY, today());
  return sid;
}

function clearTabSession() {
  sessionStorage.removeItem(TAB_SESSION_KEY);
  sessionStorage.removeItem(TAB_SESSION_USER_KEY);
  sessionStorage.removeItem(TAB_SESSION_DATE_KEY);
}

export function useActivityTracker(user: TrackerUser | null) {
  const sessionIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isIdleRef = useRef(false);
  const idleStartRef = useRef<number>(0);

  const trackAction = useCallback((action: ActivityAction, meta?: Record<string, any>) => {
    if (!user || !sessionIdRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;

    if (isIdleRef.current) {
      appendIdlePeriod(sessionIdRef.current, idleStartRef.current);
      isIdleRef.current = false;
    }

    const sid = sessionIdRef.current;
    insertLog(user, action, sid, meta);
    const hour = new Date().getHours();
    upsertHourlyStat(user.id, today(), hour, false, action);
    incrementSessionActions(sid);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const sid = await ensureSession(user);
      if (cancelled) return;
      sessionIdRef.current = sid;
      lastActivityRef.current = Date.now();
    })();

    const handleClick = () => {
      lastActivityRef.current = Date.now();
      if (isIdleRef.current && sessionIdRef.current) {
        appendIdlePeriod(sessionIdRef.current, idleStartRef.current);
        isIdleRef.current = false;
      }
      if (sessionIdRef.current) {
        const hour = new Date().getHours();
        upsertHourlyStat(user.id, today(), hour, true);
        updateSessionClicks(sessionIdRef.current, 1);
      } else {
        // Session was auto-ended due to inactivity — restart
        ensureSession(user).then(sid => {
          if (!cancelled) {
            sessionIdRef.current = sid;
            lastActivityRef.current = Date.now();
            isIdleRef.current = false;
          }
        });
      }
    };

    document.addEventListener("click", handleClick, true);

    const settings = getWorkforceSettings();
    const idleMs = settings.idleThresholdMinutes * 60 * 1000;
    const autoEndMs = settings.autoSessionEndMinutes * 60 * 1000;

    const idleInterval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= autoEndMs && sessionIdRef.current) {
        if (isIdleRef.current) appendIdlePeriod(sessionIdRef.current, idleStartRef.current);
        endSessionDB(sessionIdRef.current, user);
        clearTabSession();
        sessionIdRef.current = null;
      } else if (elapsed >= idleMs && !isIdleRef.current) {
        isIdleRef.current = true;
        idleStartRef.current = lastActivityRef.current;
      }
    }, 30000);

    // Reliable session-end on real tab close. visibilitychange+pagehide are
    // more reliable than beforeunload on mobile/modern browsers.
    const closeSessionSync = () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      // Use sendBeacon-style fire-and-forget; supabase client doesn't expose beacon,
      // but the update fires before tab dies in most cases.
      if (isIdleRef.current) appendIdlePeriod(sid, idleStartRef.current);
      endSessionDB(sid, user);
      clearTabSession();
      sessionIdRef.current = null;
    };

    const handlePageHide = () => closeSessionSync();
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      cancelled = true;
      document.removeEventListener("click", handleClick, true);
      clearInterval(idleInterval);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      // IMPORTANT: do NOT end session on React unmount (StrictMode, route change,
      // remounts). Session is only ended on real tab close (pagehide) or auto-idle.
    };
  }, [user]);

  return { trackAction };
}
