import { useMemo } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getActivityLogs, getTimeSessions, getHourlyStats,
  calcProductivityScore, getScoreBadge, getSalaryConfig,
} from "@/hooks/useActivityTracker";
import { Clock, MousePointerClick, Zap, TrendingUp, CalendarDays, Timer, BarChart3, Wallet, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function MyActivity() {
  const { appUser } = useSupabaseAuth();
  const isMobile = useIsMobile();

  const userId = appUser?.id || "";
  const userRole = appUser?.role || "user";

  const dateStr = new Date().toISOString().split("T")[0];
  const monthPrefix = dateStr.slice(0, 7);

  const logs = useMemo(() => getActivityLogs(), []);
  const sessions = useMemo(() => getTimeSessions(), []);
  const hourly = useMemo(() => getHourlyStats(), []);
  const config = useMemo(() => getSalaryConfig(), []);

  // Today
  const todayLogs = useMemo(() => logs.filter(l => l.userId === userId && l.date === dateStr), [logs, userId, dateStr]);
  const todaySessions = useMemo(() => sessions.filter(s => s.userId === userId && s.date === dateStr), [sessions, userId, dateStr]);
  const todayHourly = useMemo(() => hourly.filter(h => h.userId === userId && h.date === dateStr), [hourly, userId, dateStr]);

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

  const todayScore = calcProductivityScore(
    todayActiveMs / 60000, todayTotalMs / 60000,
    todayActions, todayClicks,
    leadsAdded + leadsEdited
  );
  const todayBadge = getScoreBadge(todayScore);

  // This month
  const monthSessions = useMemo(() => sessions.filter(s => s.userId === userId && s.date.startsWith(monthPrefix)), [sessions, userId, monthPrefix]);
  const monthLogs = useMemo(() => logs.filter(l => l.userId === userId && l.date.startsWith(monthPrefix)), [logs, userId, monthPrefix]);

  const workingDays = new Set(monthSessions.map(s => s.date)).size;
  let monthActiveMs = 0;
  monthSessions.forEach(s => {
    const end = s.endTime || Date.now();
    const idle = s.idlePeriods.reduce((sum, p) => sum + (p.end - p.start), 0);
    monthActiveMs += (end - s.startTime) - idle;
  });

  const monthActions = monthLogs.filter(l => l.action !== "session_start" && l.action !== "session_end").length;
  const mLeadsAdded = monthLogs.filter(l => l.action === "lead_added").length;
  const mLeadsEdited = monthLogs.filter(l => l.action === "lead_edited").length;
  let monthTotalMs = 0;
  monthSessions.forEach(s => { monthTotalMs += (s.endTime || Date.now()) - s.startTime; });

  const monthScore = calcProductivityScore(
    monthActiveMs / 60000, monthTotalMs / 60000,
    monthActions, 0,
    mLeadsAdded + mLeadsEdited
  );

  const activeHours = monthActiveMs / 3600000;
  const roleConfig = config.rates[userRole] || { hourly: 0, monthlyBase: 0 };
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
      csv_exported: "Exported data",
      search_performed: "Searched leads", filter_applied: "Applied filter",
      page_navigated: `Navigated to ${meta?.page || "a page"}`,
    };
    return labels[a] || a;
  };

  const actionIcon = (a: string) => {
    const icons: Record<string, string> = {
      lead_added: "➕", lead_edited: "✏️", lead_deleted: "🗑", lead_viewed: "👁",
      status_updated: "🔄", csv_imported: "📥", csv_exported: "📤",
      search_performed: "🔍", filter_applied: "🏷",
    };
    return icons[a] || "•";
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-foreground tracking-tight">My Activity</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Your personal performance overview</p>
      </div>

      {/* Today's Summary */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Activity className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Today's Summary</h3>
        </div>
        <div className={cn("grid gap-2.5", isMobile ? "grid-cols-2" : "grid-cols-4")}>
          {[
            { label: "Active Time", value: fmtMs(todayActiveMs), icon: Clock, color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10" },
            { label: "Clicks", value: String(todayClicks), icon: MousePointerClick, color: "text-violet-500 dark:text-violet-400", bg: "bg-violet-500/10" },
            { label: "Actions", value: String(todayActions), icon: Zap, color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10" },
            { label: "Score", value: `${todayScore}/100`, icon: TrendingUp, color: todayScore >= 70 ? "text-green-600 dark:text-green-400" : todayScore >= 40 ? "text-amber-500" : "text-destructive", bg: todayScore >= 70 ? "bg-green-500/10" : todayScore >= 40 ? "bg-amber-500/10" : "bg-destructive/10" },
          ].map(s => (
            <div key={s.label} className={cn("flex items-center gap-2.5 rounded-xl border border-border/40 px-3 py-2.5", s.bg)}>
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm", s.color)}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground leading-none">{s.label}</p>
                <p className="text-base font-bold text-foreground leading-tight tabular-nums">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
        {todayScore > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-sm">{todayBadge.emoji}</span>
            <span className={cn("text-xs font-semibold", todayBadge.color)}>{todayBadge.label}</span>
            <div className="ml-auto flex-1 max-w-[120px]">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", todayScore >= 70 ? "bg-green-500" : todayScore >= 40 ? "bg-amber-500" : "bg-destructive")}
                  style={{ width: `${todayScore}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* This Month */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <CalendarDays className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">This Month</h3>
        </div>
        <div className={cn("grid gap-2.5", isMobile ? "grid-cols-2" : "grid-cols-4")}>
          {[
            { label: "Working Days", value: String(workingDays), icon: CalendarDays, color: "text-primary", bg: "bg-primary/10" },
            { label: "Active Hours", value: `${activeHours.toFixed(1)}h`, icon: Timer, color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10" },
            { label: "Avg Score", value: String(monthScore), icon: BarChart3, color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Est. Salary", value: `${config.currency}${estimatedSalary.toLocaleString()}`, icon: Wallet, color: "text-violet-500 dark:text-violet-400", bg: "bg-violet-500/10" },
          ].map(s => (
            <div key={s.label} className={cn("flex items-center gap-2.5 rounded-xl border border-border/40 px-3 py-2.5", s.bg)}>
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm", s.color)}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground leading-none">{s.label}</p>
                <p className="text-base font-bold text-foreground leading-tight tabular-nums">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Activity Feed</h3>
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md font-medium">Today</span>
        </div>
        {activityFeed.length > 0 ? (
          <div className="space-y-1">
            {activityFeed.map((log, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted/40 transition-colors group">
                <span className="text-sm shrink-0">{actionIcon(log.action)}</span>
                <span className="text-xs text-foreground flex-1 truncate">{actionLabel(log.action, log.meta)}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground font-medium shrink-0">{fmtTime(log.timestamp)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 mb-2">
              <Activity className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <p className="text-xs text-muted-foreground">No activity recorded today</p>
          </div>
        )}
      </div>
    </div>
  );
}
