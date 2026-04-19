import { useState, useEffect, useMemo } from "react";
import { useSupabaseUsers } from "@/hooks/useSupabaseUsers";
import {
  getTimeSessions, getHourlyStats, getActivityLogs, getWorkforceSettings, isWorkingDay,
  calcProductivityScore, getScoreBadge, TimeSession, ActivityLog, HourlyStat,
} from "@/hooks/useActivityTracker";
import { X, Clock, Zap, MousePointerClick, CalendarDays } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function TimeLogs() {
  const { users: supabaseUsers } = useSupabaseUsers();
  const users = supabaseUsers.map(u => ({ id: u.userId, name: u.fullName, role: u.role }));
  const isMobile = useIsMobile();
  const [filterUser, setFilterUser] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [detailSession, setDetailSession] = useState<string | null>(null);

  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [hourly, setHourly] = useState<HourlyStat[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const wfSettings = useMemo(() => getWorkforceSettings(), []);

  useEffect(() => {
    Promise.all([getTimeSessions(), getHourlyStats(), getActivityLogs()])
      .then(([s, h, l]) => { setSessions(s); setHourly(h); setLogs(l); });
  }, []);

  const dailySummaries = useMemo(() => {
    const map = new Map<string, {
      userId: string; userName: string; role: string; date: string;
      sessions: TimeSession[];
      totalDuration: number; activeTime: number; idleTime: number;
      totalActions: number; totalClicks: number;
    }>();

    sessions.forEach(s => {
      const key = `${s.userId}_${s.date}`;
      if (!map.has(key)) {
        map.set(key, {
          userId: s.userId, userName: s.userName, role: s.role, date: s.date,
          sessions: [], totalDuration: 0, activeTime: 0, idleTime: 0,
          totalActions: 0, totalClicks: 0,
        });
      }
      const entry = map.get(key)!;
      entry.sessions.push(s);
      const end = s.endTime || Date.now();
      const dur = end - s.startTime;
      entry.totalDuration += dur;
      const idle = s.idlePeriods.reduce((sum, p) => sum + (p.end - p.start), 0);
      entry.idleTime += idle;
      entry.activeTime += dur - idle;
      entry.totalActions += s.totalActions;
      entry.totalClicks += s.totalClicks;
    });

    let results = [...map.values()].sort((a, b) => b.date.localeCompare(a.date));

    if (filterUser) results = results.filter(r => r.userId === filterUser);
    if (filterRole) results = results.filter(r => r.role === filterRole);
    if (filterDateFrom) results = results.filter(r => r.date >= filterDateFrom);
    if (filterDateTo) results = results.filter(r => r.date <= filterDateTo);

    return results;
  }, [sessions, filterUser, filterRole, filterDateFrom, filterDateTo]);

  const fmtMs = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const detailData = useMemo(() => {
    if (!detailSession) return null;
    const entry = dailySummaries.find(d => `${d.userId}_${d.date}` === detailSession);
    if (!entry) return null;

    const dayHourly = hourly.filter(h => h.userId === entry.userId && h.date === entry.date).sort((a, b) => a.hour - b.hour);
    const dayLogs = logs.filter(l => l.userId === entry.userId && l.date === entry.date);

    const leadsAdded = dayLogs.filter(l => l.action === "lead_added").length;
    const leadsEdited = dayLogs.filter(l => l.action === "lead_edited").length;

    const score = calcProductivityScore(
      entry.activeTime / 60000, entry.totalDuration / 60000,
      entry.totalActions, entry.totalClicks,
      leadsAdded + leadsEdited
    );

    return { ...entry, dayHourly, score, badge: getScoreBadge(score) };
  }, [detailSession, dailySummaries, hourly, logs]);

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hr = h % 12 || 12;
    return `${hr}${ampm}`;
  };

  const nonAdminUsers = users.filter(u => u.role !== "admin");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground tracking-tight">Time Logs</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Session history and time tracking</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs h-8">
          <option value="">All Employees</option>
          {nonAdminUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs h-8">
          <option value="">All Roles</option>
          <option value="Manager">Manager</option>
          <option value="Employee">Employee</option>
          <option value="Viewer">Viewer</option>
        </select>
        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs h-8" />
        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs h-8" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Employee</th>
                {!isMobile && <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">In/Out</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Duration</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Active</th>
                {!isMobile && <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {dailySummaries.map(d => {
                const firstSession = d.sessions.sort((a, b) => a.startTime - b.startTime)[0];
                const lastSession = d.sessions.sort((a, b) => (b.endTime || Date.now()) - (a.endTime || Date.now()))[0];
                const dateObj = new Date(d.date + "T00:00:00");
                const isHoliday = !isWorkingDay(dateObj, wfSettings);
                return (
                  <tr
                    key={`${d.userId}_${d.date}`}
                    onClick={() => setDetailSession(`${d.userId}_${d.date}`)}
                    className={cn("border-b border-border/40 hover:bg-muted/20 cursor-pointer transition-colors", isHoliday && "bg-amber-500/5")}
                  >
                    <td className="px-3 py-2.5">
                      <div>
                        <span className="font-medium text-foreground text-xs">{d.userName}</span>
                        {isHoliday && <span className="ml-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold">Holiday</span>}
                        {isMobile && <p className="text-[10px] text-muted-foreground">{d.date}</p>}
                      </div>
                    </td>
                    {!isMobile && <td className="px-3 py-2.5 tabular-nums text-xs">{d.date}</td>}
                    <td className="px-3 py-2.5 tabular-nums text-xs text-muted-foreground">
                      {fmtTime(firstSession.startTime)} — {lastSession.endTime ? fmtTime(lastSession.endTime) : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-xs">{fmtMs(d.totalDuration)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-xs text-emerald-600 dark:text-emerald-400">{fmtMs(d.activeTime)}</td>
                    {!isMobile && <td className="px-3 py-2.5 tabular-nums text-xs text-muted-foreground">{d.totalActions}a · {d.totalClicks}c</td>}
                  </tr>
                );
              })}
              {dailySummaries.length === 0 && (
                <tr><td colSpan={isMobile ? 4 : 6} className="px-4 py-12 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No time logs found</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setDetailSession(null)}>
          <div className="w-full max-w-2xl mx-4 rounded-xl bg-card border border-border p-5 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">{detailData.userName} — {detailData.date}</h3>
              <button onClick={() => setDetailSession(null)} className="rounded-lg p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>

            <div className="rounded-lg border border-border/60 overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hour</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Clicks</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Actions</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {detailData.dayHourly.map(h => (
                    <tr key={h.hour} className="border-b border-border/40">
                      <td className="px-3 py-1.5 font-medium">{formatHour(h.hour)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{h.clicks}</td>
                      <td className="px-3 py-1.5 tabular-nums">{h.actions}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {h.actions === 0 ? "Idle" : Object.entries(h.actionBreakdown).map(([a, c]) => `${a.replace("lead_", "").replace("_", " ")} ${c}`).join(", ")}
                      </td>
                    </tr>
                  ))}
                  {detailData.dayHourly.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
              <span className="text-xs font-medium">Score:</span>
              <span className={cn("text-xs font-bold", detailData.badge.color)}>
                {detailData.score}/100 {detailData.badge.emoji} {detailData.badge.label}
              </span>
              <div className="ml-auto flex-1 max-w-[100px]">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full", detailData.score >= 70 ? "bg-emerald-500" : detailData.score >= 40 ? "bg-amber-500" : "bg-destructive")}
                    style={{ width: `${detailData.score}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
