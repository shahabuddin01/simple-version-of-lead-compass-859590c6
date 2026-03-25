import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getActivityLogs, getTimeSessions, getHourlyStats,
  calcProductivityScore, getScoreBadge, getSalaryConfig,
} from "@/hooks/useActivityTracker";

export function MyActivity() {
  const { currentUser } = useAuth();

  const dateStr = new Date().toISOString().split("T")[0];
  const monthPrefix = dateStr.slice(0, 7);

  const logs = useMemo(() => getActivityLogs(), []);
  const sessions = useMemo(() => getTimeSessions(), []);
  const hourly = useMemo(() => getHourlyStats(), []);
  const config = useMemo(() => getSalaryConfig(), []);

  // Today
  const todayLogs = useMemo(() => logs.filter(l => l.userId === currentUser.id && l.date === dateStr), [logs, currentUser.id, dateStr]);
  const todaySessions = useMemo(() => sessions.filter(s => s.userId === currentUser.id && s.date === dateStr), [sessions, currentUser.id, dateStr]);
  const todayHourly = useMemo(() => hourly.filter(h => h.userId === currentUser.id && h.date === dateStr), [hourly, currentUser.id, dateStr]);

  const todayClicks = todayHourly.reduce((s, h) => s + h.clicks, 0);
  const todayActions = todayLogs.filter(l => l.action !== "session_start" && l.action !== "session_end").length;

  let todayActiveMs = 0;
  let todayTotalMs = 0;
  todaySessions.forEach(s => {
    const end = s.endTime || Date.now();
    todayTotalMs += end - s.startTime;
    const idle = s.idlePeriods.reduce((sum, p) => sum + (p.end - p.start), 0);
    todayActiveMs += (end - s.startTime) - idle;
  });

  const leadsAdded = todayLogs.filter(l => l.action === "lead_added").length;
  const leadsEdited = todayLogs.filter(l => l.action === "lead_edited").length;
  const smsSent = todayLogs.filter(l => l.action === "sms_sent").length;

  const todayScore = calcProductivityScore(
    todayActiveMs / 60000, todayTotalMs / 60000,
    todayActions, todayClicks,
    leadsAdded + leadsEdited, smsSent
  );
  const todayBadge = getScoreBadge(todayScore);

  // This month
  const monthSessions = useMemo(() => sessions.filter(s => s.userId === currentUser.id && s.date.startsWith(monthPrefix)), [sessions, currentUser.id, monthPrefix]);
  const monthLogs = useMemo(() => logs.filter(l => l.userId === currentUser.id && l.date.startsWith(monthPrefix)), [logs, currentUser.id, monthPrefix]);

  const workingDays = new Set(monthSessions.map(s => s.date)).size;
  let monthActiveMs = 0;
  monthSessions.forEach(s => {
    const end = s.endTime || Date.now();
    const idle = s.idlePeriods.reduce((sum, p) => sum + (p.end - p.start), 0);
    monthActiveMs += (end - s.startTime) - idle;
  });

  const monthActions = monthLogs.filter(l => l.action !== "session_start" && l.action !== "session_end").length;
  const monthClicks = monthSessions.reduce((s, sess) => s + sess.totalClicks, 0);
  const mLeadsAdded = monthLogs.filter(l => l.action === "lead_added").length;
  const mLeadsEdited = monthLogs.filter(l => l.action === "lead_edited").length;
  const mSmsSent = monthLogs.filter(l => l.action === "sms_sent").length;
  let monthTotalMs = 0;
  monthSessions.forEach(s => { monthTotalMs += (s.endTime || Date.now()) - s.startTime; });

  const monthScore = calcProductivityScore(
    monthActiveMs / 60000, monthTotalMs / 60000,
    monthActions, monthClicks,
    mLeadsAdded + mLeadsEdited, mSmsSent
  );

  const activeHours = monthActiveMs / 3600000;
  const roleConfig = config.rates[currentUser.role] || { hourly: 0, monthlyBase: 0 };
  const estimatedSalary = Math.round(
    config.calcMethod === "hourly_active" ? activeHours * roleConfig.hourly :
    config.calcMethod === "hourly_total" ? (monthTotalMs / 3600000) * roleConfig.hourly :
    roleConfig.monthlyBase
  );

  // Activity feed (today, recent first)
  const activityFeed = todayLogs
    .filter(l => l.action !== "session_start" && l.action !== "session_end")
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  if (!currentUser) return null;

  const fmtMs = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.round((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const actionLabel = (a: string, meta?: Record<string, any>) => {
    const labels: Record<string, string> = {
      lead_added: "Added a lead", lead_edited: "Edited a lead", lead_deleted: "Deleted a lead",
      lead_viewed: "Viewed a lead", status_updated: "Updated lead status",
      bulk_action: `Bulk action on ${meta?.count || "?"} leads`,
      csv_imported: `Imported CSV (${meta?.count || "?"} leads)`,
      csv_exported: "Exported data", sms_sent: `Sent SMS to ${meta?.count || "?"} contacts`,
      search_performed: "Searched leads", filter_applied: "Applied filter",
      page_navigated: `Navigated to ${meta?.page || "a page"}`,
    };
    return labels[a] || a;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">My Activity</h2>
        <p className="text-sm text-muted-foreground">Your personal activity and performance stats</p>
      </div>

      {/* Today's Summary */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">Today's Summary</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">⏱ Active</p>
            <p className="text-lg font-bold tabular-nums">{fmtMs(todayActiveMs)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">🖱 Clicks</p>
            <p className="text-lg font-bold tabular-nums">{todayClicks}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">⚡ Actions</p>
            <p className="text-lg font-bold tabular-nums">{todayActions}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">📊 Score</p>
            <p className={`text-lg font-bold ${todayBadge.color}`}>{todayScore}/100</p>
            <p className="text-xs">{todayBadge.emoji} {todayBadge.label}</p>
          </div>
        </div>
      </div>

      {/* This Month */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">This Month</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Working days</p>
            <p className="font-bold text-lg tabular-nums">{workingDays}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Active hours</p>
            <p className="font-bold text-lg tabular-nums">{activeHours.toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-muted-foreground">Avg score</p>
            <p className="font-bold text-lg tabular-nums">{monthScore}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Est. salary</p>
            <p className="font-bold text-lg tabular-nums">{config.currency}{estimatedSalary.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3">My Activity Feed (today)</h3>
        {activityFeed.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {activityFeed.map((log, i) => (
              <li key={i} className="flex items-baseline gap-2 text-muted-foreground">
                <span className="tabular-nums text-xs w-20 shrink-0">{fmtTime(log.timestamp)}</span>
                <span>— {actionLabel(log.action, log.meta)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No activity yet today</p>
        )}
      </div>
    </div>
  );
}
