import { useState, useEffect, useMemo } from "react";
import { useSupabaseUsers } from "@/hooks/useSupabaseUsers";
import {
  getTimeSessions,
  getActivityLogs,
  getHourlyStats,
  getSalaryConfig,
  saveSalaryConfig,
  SalaryConfig,
  getWorkforceSettings,
  isWorkingDay,
  calcProductivityScore,
  getScoreBadge,
  buildDailyActivitySummaries,
  TimeSession,
  ActivityLog,
  HourlyStat,
} from "@/hooks/useActivityTracker";
import { toast } from "sonner";
import { X, Download, Settings2, CalendarDays, Timer, TrendingUp, Wallet } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

export function SalaryReport() {
  const { users: supabaseUsers } = useSupabaseUsers();
  const users = supabaseUsers.map((u) => ({ id: u.userId, name: u.fullName, role: u.role, active: u.isActive }));
  const isMobile = useIsMobile();
  const [config, setConfig] = useState<SalaryConfig>(getSalaryConfig);
  const [showConfig, setShowConfig] = useState(false);
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [detailUser, setDetailUser] = useState<string | null>(null);

  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [hourly, setHourly] = useState<HourlyStat[]>([]);
  const wfSettings = useMemo(() => getWorkforceSettings(), []);

  const refresh = () => {
    Promise.all([getTimeSessions(), getActivityLogs(), getHourlyStats()]).then(([s, l, h]) => {
      setSessions(s);
      setLogs(l);
      setHourly(h);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  useRealtimeTable(["time_sessions", "activity_logs", "hourly_stats"], refresh, "salary-rt");

  const salaryData = useMemo(() => {
    const activeUsers = users.filter((u) => u.active);
    const [year, month] = filterMonth.split("-").map(Number);
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const overtimeThreshold = wfSettings.overtimeAfterHours;

    const daysInMonth = new Date(year, month, 0).getDate();
    let weeklyOffCount = 0;
    let holidayCount = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (wfSettings.weeklyOffDays.includes(date.getDay())) {
        weeklyOffCount++;
      } else {
        const dateStr = date.toISOString().split("T")[0];
        const isHoliday = wfSettings.publicHolidays.some((holiday) => {
          if (holiday.repeatYearly) return holiday.date.slice(5) === dateStr.slice(5);
          return holiday.date === dateStr;
        });
        if (isHoliday) holidayCount++;
      }
    }
    const billableDays = daysInMonth - weeklyOffCount - holidayCount;

    const monthlySummaries = buildDailyActivitySummaries(
      sessions.filter((session) => session.date.startsWith(prefix)),
      hourly.filter((stat) => stat.date.startsWith(prefix))
    );

    return activeUsers.map((user) => {
      const userDailySummaries = monthlySummaries.filter((summary) => summary.userId === user.id);
      const userLogs = logs.filter((log) => log.userId === user.id && log.date.startsWith(prefix));

      const workingDays = userDailySummaries.length;
      const totalActiveMs = userDailySummaries.reduce((sum, day) => sum + day.activeTime, 0);
      const totalDurationMs = userDailySummaries.reduce((sum, day) => sum + day.totalDuration, 0);
      const totalIdleMs = userDailySummaries.reduce((sum, day) => sum + day.idleTime, 0);
      const totalActions = userDailySummaries.reduce((sum, day) => sum + day.totalActions, 0);
      const totalClicks = userDailySummaries.reduce((sum, day) => sum + day.totalClicks, 0);

      const roleRates = wfSettings.hourlyRates[user.role] || { regular: 0, overtime: 0, holiday: 0 };

      let totalBasePay = 0;
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;
      let totalHolidayHours = 0;

      userDailySummaries.forEach((day) => {
        const activeHours = day.activeTime / 3600000;
        const isHoliday = !isWorkingDay(new Date(`${day.date}T00:00:00`), wfSettings);

        if (isHoliday) {
          totalHolidayHours += activeHours;
          totalBasePay += activeHours * roleRates.holiday;
          return;
        }

        const regularHours = Math.min(activeHours, overtimeThreshold);
        const overtimeHours = Math.max(0, activeHours - overtimeThreshold);
        totalRegularHours += regularHours;
        totalOvertimeHours += overtimeHours;
        totalBasePay += regularHours * roleRates.regular + overtimeHours * roleRates.overtime;
      });

      const leadsAdded = userLogs.filter((log) => log.action === "lead_added").length;
      const leadsEdited = userLogs.filter((log) => log.action === "lead_edited").length;
      const score = calcProductivityScore(
        totalActiveMs / 60000,
        totalDurationMs / 60000,
        totalActions,
        totalClicks,
        leadsAdded + leadsEdited
      );

      let bonusPercent = 0;
      for (const rule of [...config.bonusRules].sort((a, b) => b.minScore - a.minScore)) {
        if (score >= rule.minScore) {
          bonusPercent = rule.bonusPercent;
          break;
        }
      }
      const bonus = totalBasePay * bonusPercent / 100;

      return {
        userId: user.id,
        userName: user.name,
        role: user.role,
        workingDays,
        activeHours: totalActiveMs / 3600000,
        totalHours: totalDurationMs / 3600000,
        idleHours: totalIdleMs / 3600000,
        regularHours: totalRegularHours,
        overtimeHours: totalOvertimeHours,
        holidayHours: totalHolidayHours,
        regularRate: roleRates.regular,
        overtimeRate: roleRates.overtime,
        holidayRate: roleRates.holiday,
        score,
        badge: getScoreBadge(score),
        basePay: Math.round(totalBasePay),
        bonus: Math.round(bonus),
        totalSalary: Math.round(totalBasePay + bonus),
        leadsAdded,
        leadsEdited,
        billableDays,
        weeklyOffCount,
        holidayCount,
      };
    });
  }, [users, sessions, logs, hourly, filterMonth, config, wfSettings]);

  const handleSaveConfig = () => {
    saveSalaryConfig(config);
    toast.success("Salary settings saved");
    setShowConfig(false);
  };

  const updateRate = (role: string, field: "hourly" | "monthlyBase", value: number) => {
    setConfig(prev => ({
      ...prev,
      rates: { ...prev.rates, [role]: { ...prev.rates[role], [field]: value } },
    }));
  };

  const fmtCurrency = (n: number) => `${config.currency}${n.toLocaleString()}`;

  const exportCSV = () => {
    const headers = "Employee,Role,Working Days,Active Hours,Avg Score,Base Pay,Bonus,Total Salary";
    const rows = salaryData.map(d =>
      `"${d.userName}","${d.role}",${d.workingDays},${d.activeHours.toFixed(1)},${d.score},${d.basePay},${d.bonus},${d.totalSalary}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `salary-report-${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const detail = detailUser ? salaryData.find(d => d.userId === detailUser) : null;

  const totalPayout = salaryData.reduce((s, d) => s + d.totalSalary, 0);
  const avgScore = salaryData.length > 0 ? Math.round(salaryData.reduce((s, d) => s + d.score, 0) / salaryData.length) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">Salary Calculator</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly salary reports based on activity</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors active:scale-[0.98]">
            <Settings2 className="h-3 w-3" /> Settings
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent transition-colors active:scale-[0.98]">
            <Download className="h-3 w-3" /> Export
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className={cn("grid gap-2.5", isMobile ? "grid-cols-2" : "grid-cols-4")}>
        {[
          { label: "Employees", value: String(salaryData.length), icon: CalendarDays, color: "text-primary", bg: "bg-primary/10" },
          { label: "Avg Score", value: String(avgScore), icon: TrendingUp, color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Total Hours", value: `${salaryData.reduce((s, d) => s + d.activeHours, 0).toFixed(0)}h`, icon: Timer, color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10" },
          { label: "Total Payout", value: fmtCurrency(totalPayout), icon: Wallet, color: "text-violet-500 dark:text-violet-400", bg: "bg-violet-500/10" },
        ].map(s => (
          <div key={s.label} className={cn("flex items-center gap-2.5 rounded-xl border border-border/50 px-3 py-2.5", s.bg)}>
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm", s.color)}>
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-muted-foreground leading-none">{s.label}</p>
              <p className="text-base font-bold text-foreground leading-tight tabular-nums">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Salary Configuration</h3>
          <div className="space-y-3">
            {(["admin", "manager", "user", "viewer"] as const).map(role => {
              const label = role === "user" ? "Employee" : role.charAt(0).toUpperCase() + role.slice(1);
              return (
              <div key={role} className="flex items-center gap-3 text-xs">
                <span className="w-16 font-medium">{label}</span>
                <label className="flex items-center gap-1">
                  Hourly:
                  <input type="number" value={config.rates[role]?.hourly || 0}
                    onChange={e => updateRate(role, "hourly", Number(e.target.value))}
                    className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-xs" />
                </label>
                <label className="flex items-center gap-1">
                  Monthly:
                  <input type="number" value={config.rates[role]?.monthlyBase || 0}
                    onChange={e => updateRate(role, "monthlyBase", Number(e.target.value))}
                    className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-xs" />
                </label>
              </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Calculation Method</p>
            {(["hourly_active", "hourly_total", "monthly_bonus", "hourly_bonus"] as const).map(m => (
              <label key={m} className="flex items-center gap-2 text-xs">
                <input type="radio" name="calcMethod" checked={config.calcMethod === m}
                  onChange={() => setConfig(prev => ({ ...prev, calcMethod: m }))} className="accent-primary" />
                {m === "hourly_active" ? "Hourly (Active)" : m === "hourly_total" ? "Hourly (Total)" : m === "monthly_bonus" ? "Monthly + Bonus" : "Hourly + Bonus"}
              </label>
            ))}
          </div>

          <button onClick={handleSaveConfig}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Save Settings
          </button>
        </div>
      )}

      {/* Month Filter */}
      <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
        className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs h-8" />

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Employee</th>
                {!isMobile && <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Days</th>}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Hours</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Score</th>
                {!isMobile && <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Base</th>}
                <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {salaryData.map(d => (
                <tr key={d.userId} onClick={() => setDetailUser(d.userId)}
                  className="border-b border-border/40 hover:bg-muted/20 cursor-pointer transition-colors">
                  <td className="px-3 py-2.5">
                    <span className="font-medium text-foreground text-xs">{d.userName}</span>
                    {isMobile && <p className="text-[10px] text-muted-foreground">{d.role} · {d.workingDays}d</p>}
                  </td>
                  {!isMobile && <td className="px-3 py-2.5 tabular-nums text-xs">{d.workingDays}</td>}
                  <td className="px-3 py-2.5 tabular-nums text-xs">{d.activeHours.toFixed(1)}h</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("text-xs font-medium", d.badge.color)}>{d.score} {d.badge.emoji}</span>
                  </td>
                  {!isMobile && <td className="px-3 py-2.5 tabular-nums text-xs">{fmtCurrency(d.basePay)}</td>}
                  <td className="px-3 py-2.5 tabular-nums text-xs font-semibold text-right">{fmtCurrency(d.totalSalary)}</td>
                </tr>
              ))}
              {salaryData.length === 0 && (
                <tr><td colSpan={isMobile ? 4 : 6} className="px-4 py-12 text-center">
                  <Wallet className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No salary data for this period</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setDetailUser(null)}>
          <div className="w-full max-w-lg mx-4 rounded-xl bg-card border border-border p-5 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">{detail.userName} — {filterMonth}</h3>
              <button onClick={() => setDetailUser(null)} className="rounded-lg p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 p-2.5"><p className="text-muted-foreground">Working Days</p><p className="font-bold text-sm">{detail.workingDays}</p></div>
                <div className="rounded-lg bg-muted/40 p-2.5"><p className="text-muted-foreground">Active Time</p><p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{detail.activeHours.toFixed(1)}h</p></div>
                <div className="rounded-lg bg-muted/40 p-2.5"><p className="text-muted-foreground">Idle Time</p><p className="font-bold text-sm text-amber-600">{detail.idleHours.toFixed(1)}h</p></div>
                <div className="rounded-lg bg-muted/40 p-2.5"><p className="text-muted-foreground">Score</p><p className={cn("font-bold text-sm", detail.badge.color)}>{detail.score} {detail.badge.emoji}</p></div>
              </div>

              <div className="h-px bg-border my-3" />

              <div className="space-y-1.5">
                <p>Regular: <strong>{detail.regularHours.toFixed(1)}h</strong> × {fmtCurrency(detail.regularRate)} = <strong>{fmtCurrency(Math.round(detail.regularHours * detail.regularRate))}</strong></p>
                <p>Overtime: <strong>{detail.overtimeHours.toFixed(1)}h</strong> × {fmtCurrency(detail.overtimeRate)} = <strong>{fmtCurrency(Math.round(detail.overtimeHours * detail.overtimeRate))}</strong></p>
                {detail.holidayHours > 0 && <p>Holiday: <strong>{detail.holidayHours.toFixed(1)}h</strong> × {fmtCurrency(detail.holidayRate)} = <strong>{fmtCurrency(Math.round(detail.holidayHours * detail.holidayRate))}</strong></p>}
                <p>Bonus: <strong className="text-emerald-600">{fmtCurrency(detail.bonus)}</strong></p>
              </div>

              <div className="h-px bg-border my-3" />
              <p className="text-base font-bold">Total: {fmtCurrency(detail.totalSalary)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
