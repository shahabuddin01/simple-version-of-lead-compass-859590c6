import { useState, useEffect, useMemo } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import {
  getActivityLogs, getTimeSessions, getHourlyStats,
  ActivityLog, TimeSession, HourlyStat,
  getWorkforceSettings,
} from "@/hooks/useActivityTracker";
import { ChevronDown, ChevronRight, RefreshCw, Radio, Users, Clock, MousePointerClick, Zap } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface EmployeeStatus {
  userId: string;
  userName: string;
  role: string;
  status: "active" | "idle" | "offline";
  idleSince?: number;
  onlineMinutes: number;
  todayActions: number;
  todayClicks: number;
  hourlyBreakdown: { hour: number; clicks: number; actions: number; actionBreakdown: Record<string, number> }[];
  actionSummary: Record<string, number>;
}

export function LiveActivity() {
  const { appUser } = useSupabaseAuth();
  const isMobile = useIsMobile();
  const users: { id: string; name: string; role: string }[] = appUser ? [{ id: appUser.id, name: appUser.fullName, role: appUser.role }] : [];
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const dateStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const iv = setInterval(() => setRefreshKey(k => k + 1), 15000);
    return () => clearInterval(iv);
  }, []);

  const employeeStatuses = useMemo(() => {
    const logs = getActivityLogs();
    const sessions = getTimeSessions();
    const hourly = getHourlyStats();
    const settings = getWorkforceSettings();
    const now = Date.now();
    const idleMs = settings.idleThresholdMinutes * 60 * 1000;
    const autoEndMs = settings.autoSessionEndMinutes * 60 * 1000;

    const nonAdminUsers = users.filter(u => u.role !== "admin");

    return nonAdminUsers.map((user): EmployeeStatus => {
      const userLogs = logs.filter(l => l.userId === user.id && l.date === dateStr);
      const userSessions = sessions.filter(s => s.userId === user.id && s.date === dateStr);
      const userHourly = hourly.filter(h => h.userId === user.id && h.date === dateStr);

      const lastLog = userLogs.filter(l => l.action !== "session_end").sort((a, b) => b.timestamp - a.timestamp)[0];
      const hasActiveSession = userSessions.some(s => !s.endTime);
      const lastActivity = lastLog?.timestamp || 0;
      const elapsed = now - lastActivity;

      let status: "active" | "idle" | "offline" = "offline";
      if (hasActiveSession) {
        if (elapsed < idleMs) status = "active";
        else if (elapsed < autoEndMs) status = "idle";
        else status = "offline";
      }

      let onlineMinutes = 0;
      userSessions.forEach(s => {
        const end = s.endTime || now;
        onlineMinutes += (end - s.startTime) / 60000;
      });

      const todayActions = userLogs.filter(l => l.action !== "session_start" && l.action !== "session_end").length;
      const todayClicks = userHourly.reduce((sum, h) => sum + h.clicks, 0);

      const actionSummary: Record<string, number> = {};
      userLogs.forEach(l => {
        if (l.action !== "session_start" && l.action !== "session_end") {
          actionSummary[l.action] = (actionSummary[l.action] || 0) + 1;
        }
      });

      const hourlyBreakdown = userHourly
        .sort((a, b) => a.hour - b.hour)
        .map(h => ({
          hour: h.hour,
          clicks: h.clicks,
          actions: h.actions,
          actionBreakdown: h.actionBreakdown,
        }));

      return {
        userId: user.id, userName: user.name, role: user.role, status,
        idleSince: status === "idle" ? elapsed : undefined,
        onlineMinutes, todayActions, todayClicks, hourlyBreakdown, actionSummary,
      };
    }).sort((a, b) => {
      const order = { active: 0, idle: 1, offline: 2 };
      return order[a.status] - order[b.status];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, refreshKey]);

  const fmtMinutes = (m: number) => {
    if (m < 1) return "—";
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  const actionLabel = (a: string) => {
    const labels: Record<string, string> = {
      lead_added: "Added leads", lead_edited: "Edited leads", lead_deleted: "Deleted leads",
      lead_viewed: "Viewed leads", status_updated: "Status updates", bulk_action: "Bulk actions",
      csv_imported: "CSV imports", csv_exported: "CSV exports",
      search_performed: "Searches", filter_applied: "Filters", page_navigated: "Navigation",
    };
    return labels[a] || a;
  };

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hr = h % 12 || 12;
    return `${hr}${ampm}`;
  };

  const statusConfig = {
    active: { label: "Active", icon: Radio, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
    idle: { label: "Idle", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
    offline: { label: "Offline", icon: Users, color: "text-muted-foreground", bg: "bg-muted border-border" },
  };

  const activeCount = employeeStatuses.filter(e => e.status === "active").length;
  const idleCount = employeeStatuses.filter(e => e.status === "idle").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">Live Activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time employee monitoring</p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent active:scale-[0.98]"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className={cn("grid gap-2.5", isMobile ? "grid-cols-2" : "grid-cols-4")}>
        {[
          { label: "Total Employees", value: employeeStatuses.length, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active Now", value: activeCount, icon: Radio, color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Idle", value: idleCount, icon: Clock, color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10" },
          { label: "Offline", value: employeeStatuses.length - activeCount - idleCount, icon: Users, color: "text-muted-foreground", bg: "bg-muted/60" },
        ].map(s => (
          <div key={s.label} className={cn("flex items-center gap-2.5 rounded-xl border border-border/50 px-3 py-2.5", s.bg)}>
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm", s.color)}>
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground leading-none">{s.label}</p>
              <p className="text-lg font-bold text-foreground leading-tight tabular-nums">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Employee List */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Employee</th>
              {!isMobile && <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Role</th>}
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
              {!isMobile && <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Online</th>}
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Activity</th>
            </tr>
          </thead>
          <tbody>
            {employeeStatuses.map(emp => {
              const sc = statusConfig[emp.status];
              return (
                <>
                  <tr
                    key={emp.userId}
                    onClick={() => setExpandedUser(expandedUser === emp.userId ? null : emp.userId)}
                    className="border-b border-border/40 hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      <span className="flex items-center gap-2">
                        {expandedUser === emp.userId ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        {emp.userName}
                      </span>
                    </td>
                    {!isMobile && <td className="px-4 py-2.5 text-xs text-muted-foreground">{emp.role}</td>}
                    <td className="px-4 py-2.5">
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", sc.bg, sc.color)}>
                        <sc.icon className="h-3 w-3" />
                        {emp.status === "idle" ? `Idle ${fmtMinutes((emp.idleSince || 0) / 60000)}` : sc.label}
                      </span>
                    </td>
                    {!isMobile && <td className="px-4 py-2.5 tabular-nums text-xs">{fmtMinutes(emp.onlineMinutes)}</td>}
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {emp.todayActions} actions · {emp.todayClicks} clicks
                    </td>
                  </tr>
                  {expandedUser === emp.userId && (
                    <tr key={`${emp.userId}-detail`}>
                      <td colSpan={isMobile ? 3 : 5} className="bg-muted/20 px-4 py-4 border-b border-border/40">
                        <div className="space-y-3">
                          <p className="text-xs font-semibold text-foreground">{emp.userName} — Today's Breakdown</p>
                          {emp.hourlyBreakdown.length > 0 ? (
                            <div className="space-y-1">
                              {emp.hourlyBreakdown.map(h => {
                                const maxClicks = Math.max(...emp.hourlyBreakdown.map(x => x.clicks), 1);
                                const barWidth = Math.round((h.clicks / maxClicks) * 100);
                                return (
                                  <div key={h.hour} className="flex items-center gap-2 text-xs">
                                    <span className="w-8 text-muted-foreground font-medium tabular-nums">{formatHour(h.hour)}</span>
                                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                                      <div className="h-full rounded-full bg-primary/50" style={{ width: `${barWidth}%` }} />
                                    </div>
                                    <span className="text-muted-foreground tabular-nums">{h.clicks}c · {h.actions}a</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No hourly data yet</p>
                          )}

                          {Object.keys(emp.actionSummary).length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(emp.actionSummary).map(([action, count]) => (
                                <span key={action} className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                                  {actionLabel(action)}: {count}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {employeeStatuses.length === 0 && (
              <tr>
                <td colSpan={isMobile ? 3 : 5} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">No employees found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
