import { useState, useMemo } from "react";
import { useSupabaseUsers } from "@/hooks/useSupabaseUsers";
import {
  getTimeSessions, getHourlyStats, getActivityLogs, getWorkforceSettings, isWorkingDay,
  calcProductivityScore, getScoreBadge, TimeSession,
} from "@/hooks/useActivityTracker";
import { X } from "lucide-react";

export function TimeLogs() {
  const { users: supabaseUsers } = useSupabaseUsers();
  const users = supabaseUsers.map(u => ({ id: u.userId, name: u.fullName, role: u.role }));
  const [filterUser, setFilterUser] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [detailSession, setDetailSession] = useState<string | null>(null);

  const sessions = useMemo(() => getTimeSessions(), []);
  const hourly = useMemo(() => getHourlyStats(), []);
  const logs = useMemo(() => getActivityLogs(), []);
  const wfSettings = useMemo(() => getWorkforceSettings(), []);

  // Group sessions by userId+date
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

  // Detail modal data
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

  const nonAdminUsers = users.filter(u => u.role !== "Admin");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Time Logs</h2>
        <p className="text-sm text-muted-foreground">Session history and time tracking</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All Employees</option>
          {nonAdminUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All Roles</option>
          <option value="Manager">Manager</option>
          <option value="Employee">Employee</option>
          <option value="Viewer">Viewer</option>
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="To"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Clock In</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Clock Out</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Duration</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Active</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Idle</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Clicks</th>
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
                  className={`border-b border-border hover:bg-accent/50 cursor-pointer transition-colors ${isHoliday ? "bg-amber-500/5" : ""}`}
                >
                  <td className="px-4 py-3 font-medium">
                    {d.userName}
                    {isHoliday && <span className="ml-2 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold">Holiday</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{d.role}</td>
                  <td className="px-4 py-3 tabular-nums">{d.date}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtTime(firstSession.startTime)}</td>
                  <td className="px-4 py-3 tabular-nums">{lastSession.endTime ? fmtTime(lastSession.endTime) : "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtMs(d.totalDuration)}</td>
                  <td className="px-4 py-3 tabular-nums text-green-600">{fmtMs(d.activeTime)}</td>
                  <td className="px-4 py-3 tabular-nums text-amber-600">{fmtMs(d.idleTime)}</td>
                  <td className="px-4 py-3 tabular-nums">{d.totalActions}</td>
                  <td className="px-4 py-3 tabular-nums">{d.totalClicks}</td>
                </tr>
              );
            })}
            {dailySummaries.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-muted-foreground">No time logs found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDetailSession(null)}>
          <div className="w-full max-w-2xl rounded-lg bg-background border border-border p-6 shadow-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{detailData.userName} — {detailData.date}</h3>
              <button onClick={() => setDetailSession(null)} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>

            {/* Hourly breakdown */}
            <div className="rounded-lg border border-border overflow-hidden mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Hour</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Clicks</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Actions</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {detailData.dayHourly.map(h => (
                    <tr key={h.hour} className="border-b border-border">
                      <td className="px-3 py-2 font-medium">{formatHour(h.hour)}</td>
                      <td className="px-3 py-2 tabular-nums">{h.clicks}</td>
                      <td className="px-3 py-2 tabular-nums">{h.actions}</td>
                      <td className="px-3 py-2 text-muted-foreground">
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

            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">Productivity Score:</span>
              <span className={`font-bold ${detailData.badge.color}`}>
                {detailData.score}/100 {detailData.badge.emoji} {detailData.badge.label}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
