import { useState, useEffect, useMemo } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import {
  getActivityLogs, getTimeSessions, getHourlyStats,
  ActivityLog, TimeSession, HourlyStat,
  getWorkforceSettings,
} from "@/hooks/useActivityTracker";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

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
  const { users } = useAuth();
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

    const nonAdminUsers = users.filter(u => u.active && u.role !== "Admin");

    return nonAdminUsers.map((user): EmployeeStatus => {
      const userLogs = logs.filter(l => l.userId === user.id && l.date === dateStr);
      const userSessions = sessions.filter(s => s.userId === user.id && s.date === dateStr);
      const userHourly = hourly.filter(h => h.userId === user.id && h.date === dateStr);

      // Determine status
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

      // Online minutes today
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
        userId: user.id,
        userName: user.name,
        role: user.role,
        status,
        idleSince: status === "idle" ? elapsed : undefined,
        onlineMinutes,
        todayActions,
        todayClicks,
        hourlyBreakdown,
        actionSummary,
      };
    }).sort((a, b) => {
      const order = { active: 0, idle: 1, offline: 2 };
      return order[a.status] - order[b.status];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, refreshKey]);

  const statusIcon = (s: string) => s === "active" ? "🟢" : s === "idle" ? "🟡" : "⚫";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Live Activity</h2>
          <p className="text-sm text-muted-foreground">Real-time employee activity monitoring</p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Online</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Today's Activity</th>
            </tr>
          </thead>
          <tbody>
            {employeeStatuses.map(emp => (
              <>
                <tr
                  key={emp.userId}
                  onClick={() => setExpandedUser(expandedUser === emp.userId ? null : emp.userId)}
                  className="border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-2">
                      {expandedUser === emp.userId ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {statusIcon(emp.status)} {emp.userName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.role}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.status === "active" ? "bg-green-100 text-green-700" :
                      emp.status === "idle" ? "bg-amber-100 text-amber-700" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {emp.status === "active" ? "Active" : emp.status === "idle" ? `Idle ${fmtMinutes((emp.idleSince || 0) / 60000)}` : "Offline"}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{fmtMinutes(emp.onlineMinutes)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {emp.todayActions} actions · {emp.todayClicks} clicks
                  </td>
                </tr>
                {expandedUser === emp.userId && (
                  <tr key={`${emp.userId}-detail`}>
                    <td colSpan={5} className="bg-muted/30 px-6 py-4">
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold">{emp.userName} — Today's Breakdown</h4>
                        {emp.hourlyBreakdown.length > 0 ? (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Timeline (hourly)</p>
                            {emp.hourlyBreakdown.map(h => {
                              const maxClicks = Math.max(...emp.hourlyBreakdown.map(x => x.clicks), 1);
                              const barWidth = Math.round((h.clicks / maxClicks) * 100);
                              return (
                                <div key={h.hour} className="flex items-center gap-3 text-xs">
                                  <span className="w-10 text-muted-foreground font-medium">{formatHour(h.hour)}</span>
                                  <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
                                    <div className="h-full rounded bg-primary/60" style={{ width: `${barWidth}%` }} />
                                  </div>
                                  <span className="w-40 text-muted-foreground">{h.clicks} clicks · {h.actions} actions</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No hourly data yet</p>
                        )}

                        {Object.keys(emp.actionSummary).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Actions today</p>
                            <ul className="space-y-0.5 text-xs text-muted-foreground">
                              {Object.entries(emp.actionSummary).map(([action, count]) => (
                                <li key={action}>• {actionLabel(action)}: {count}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {employeeStatuses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No employees found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
