import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getTimeSessions, getActivityLogs,
  getSalaryConfig, saveSalaryConfig, SalaryConfig,
  getWorkforceSettings, isWorkingDay,
  calcProductivityScore, getScoreBadge,
} from "@/hooks/useActivityTracker";
import { toast } from "sonner";
import { X, Download } from "lucide-react";

export function SalaryReport() {
  const { users } = useAuth();
  const [config, setConfig] = useState<SalaryConfig>(getSalaryConfig);
  const [showConfig, setShowConfig] = useState(false);
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [detailUser, setDetailUser] = useState<string | null>(null);

  const sessions = useMemo(() => getTimeSessions(), []);
  const logs = useMemo(() => getActivityLogs(), []);
  const wfSettings = useMemo(() => getWorkforceSettings(), []);

  const salaryData = useMemo(() => {
    const nonAdminUsers = users.filter(u => u.role !== "Admin" && u.active);
    const [year, month] = filterMonth.split("-").map(Number);
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const overtimeThreshold = wfSettings.overtimeAfterHours;

      // Count calendar days in month
      const daysInMonth = new Date(year, month, 0).getDate();
      let totalCalendarDays = daysInMonth;
      let weeklyOffCount = 0;
      let holidayCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d);
        if (wfSettings.weeklyOffDays.includes(date.getDay())) weeklyOffCount++;
        else {
          const dateStr = date.toISOString().split("T")[0];
          const isHoliday = wfSettings.publicHolidays.some(h => {
            if (h.repeatYearly) return h.date.slice(5) === dateStr.slice(5);
            return h.date === dateStr;
          });
          if (isHoliday) holidayCount++;
        }
      }
      const billableDays = totalCalendarDays - weeklyOffCount - holidayCount;

      return nonAdminUsers.map(user => {
      const userSessions = sessions.filter(s => s.userId === user.id && s.date.startsWith(prefix));
      const userLogs = logs.filter(l => l.userId === user.id && l.date.startsWith(prefix));

      const dailyMap = new Map<string, { activeMs: number; isHoliday: boolean }>();
      userSessions.forEach(s => {
        const end = s.endTime || Date.now();
        const dur = end - s.startTime;
        const idle = s.idlePeriods.reduce((sum, p) => sum + (p.end - p.start), 0);
        const active = dur - idle;
        const existing = dailyMap.get(s.date) || { activeMs: 0, isHoliday: false };
        existing.activeMs += active;
        // Check if this date is a holiday/off day
        const dateObj = new Date(s.date + "T00:00:00");
        if (!isWorkingDay(dateObj, wfSettings)) existing.isHoliday = true;
        dailyMap.set(s.date, existing);
      });

      const workingDays = dailyMap.size;
      let totalActiveMs = 0;
      let totalDurationMs = 0;
      let totalIdleMs = 0;
      userSessions.forEach(s => {
        const end = s.endTime || Date.now();
        const dur = end - s.startTime;
        const idle = s.idlePeriods.reduce((sum, p) => sum + (p.end - p.start), 0);
        totalDurationMs += dur;
        totalIdleMs += idle;
        totalActiveMs += dur - idle;
      });

      const roleRates = wfSettings.hourlyRates[user.role] || { regular: 0, overtime: 0, holiday: 0 };

      let totalBasePay = 0;
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;
      let totalHolidayHours = 0;
      dailyMap.forEach(({ activeMs, isHoliday: isHol }) => {
        const activeHrs = activeMs / 3600000;
        if (isHol) {
          // All hours on holiday use holiday rate
          totalHolidayHours += activeHrs;
          totalBasePay += activeHrs * roleRates.holiday;
        } else {
          const regular = Math.min(activeHrs, overtimeThreshold);
          const overtime = Math.max(0, activeHrs - overtimeThreshold);
          totalRegularHours += regular;
          totalOvertimeHours += overtime;
          totalBasePay += regular * roleRates.regular + overtime * roleRates.overtime;
        }
      });

      const totalActions = userLogs.filter(l => l.action !== "session_start" && l.action !== "session_end").length;
      const totalClicks = userSessions.reduce((sum, s) => sum + s.totalClicks, 0);
      const leadsAdded = userLogs.filter(l => l.action === "lead_added").length;
      const leadsEdited = userLogs.filter(l => l.action === "lead_edited").length;

      const score = calcProductivityScore(
        totalActiveMs / 60000, totalDurationMs / 60000,
        totalActions, totalClicks,
        leadsAdded + leadsEdited
      );

      // Performance bonus from salary config
      let bonusPercent = 0;
      for (const rule of config.bonusRules.sort((a, b) => b.minScore - a.minScore)) {
        if (score >= rule.minScore) { bonusPercent = rule.bonusPercent; break; }
      }
      const bonus = totalBasePay * bonusPercent / 100;

      return {
        userId: user.id, userName: user.name, role: user.role,
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
        score, badge: getScoreBadge(score),
        basePay: Math.round(totalBasePay), bonus: Math.round(bonus),
        totalSalary: Math.round(totalBasePay + bonus),
        leadsAdded, leadsEdited,
        billableDays, weeklyOffCount, holidayCount,
      };
      });
    }, [users, sessions, logs, filterMonth, config, wfSettings]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Salary Calculator</h2>
          <p className="text-sm text-muted-foreground">Monthly salary reports based on activity tracking</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            ⚙ Settings
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold">Salary Configuration</h3>
          <div className="space-y-3">
            {["Manager", "Employee", "Viewer"].map(role => (
              <div key={role} className="flex items-center gap-4 text-sm">
                <span className="w-20 font-medium">{role}</span>
                <label className="flex items-center gap-1.5">
                  Hourly:
                  <input
                    type="number"
                    value={config.rates[role]?.hourly || 0}
                    onChange={e => updateRate(role, "hourly", Number(e.target.value))}
                    className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  Monthly Base:
                  <input
                    type="number"
                    value={config.rates[role]?.monthlyBase || 0}
                    onChange={e => updateRate(role, "monthlyBase", Number(e.target.value))}
                    className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm"
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Calculation Method</p>
            {(["hourly_active", "hourly_total", "monthly_bonus", "hourly_bonus"] as const).map(m => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input
                  type="radio" name="calcMethod"
                  checked={config.calcMethod === m}
                  onChange={() => setConfig(prev => ({ ...prev, calcMethod: m }))}
                  className="accent-primary"
                />
                {m === "hourly_active" ? "Hourly (Active Time only)" :
                 m === "hourly_total" ? "Hourly (Total Session Time)" :
                 m === "monthly_bonus" ? "Monthly Base + Performance Bonus" :
                 "Hourly + Performance Bonus"}
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Performance Bonus Rules</p>
            {config.bonusRules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span>Score ≥ {rule.minScore} →</span>
                <input
                  type="number"
                  value={rule.bonusPercent}
                  onChange={e => {
                    const newRules = [...config.bonusRules];
                    newRules[i] = { ...rule, bonusPercent: Number(e.target.value) };
                    setConfig(prev => ({ ...prev, bonusRules: newRules }));
                  }}
                  className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm"
                />
                <span>% bonus</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveConfig}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save Settings
          </button>
        </div>
      )}

      {/* Month Filter */}
      <div>
        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Salary Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Days</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Active Hours</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Avg Score</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Base Pay</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bonus</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Total Salary</th>
            </tr>
          </thead>
          <tbody>
            {salaryData.map(d => (
              <tr
                key={d.userId}
                onClick={() => setDetailUser(d.userId)}
                className="border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-medium">{d.userName}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.role}</td>
                <td className="px-4 py-3 tabular-nums">{d.workingDays}</td>
                <td className="px-4 py-3 tabular-nums">{d.activeHours.toFixed(1)}h</td>
                <td className="px-4 py-3">
                  <span className={d.badge.color}>{d.score} {d.badge.emoji}</span>
                </td>
                <td className="px-4 py-3 tabular-nums">{fmtCurrency(d.basePay)}</td>
                <td className="px-4 py-3 tabular-nums text-green-600">{fmtCurrency(d.bonus)}</td>
                <td className="px-4 py-3 tabular-nums font-semibold">{fmtCurrency(d.totalSalary)}</td>
              </tr>
            ))}
            {salaryData.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">No salary data for this period</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDetailUser(null)}>
          <div className="w-full max-w-lg rounded-lg bg-background border border-border p-6 shadow-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{detail.userName} — {filterMonth} Salary</h3>
              <button onClick={() => setDetailUser(null)} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2 text-sm">
              <p>Working Days: <strong>{detail.workingDays}</strong></p>
              <p>Billable Days (month): <strong>{detail.billableDays}</strong></p>
              <p className="text-xs text-muted-foreground">Weekly off excluded: {detail.weeklyOffCount} · Public holidays excluded: {detail.holidayCount}</p>
              <p>Total Session Time: <strong>{detail.totalHours.toFixed(1)}h</strong></p>
              <p>Active Time: <strong className="text-green-600">{detail.activeHours.toFixed(1)}h</strong></p>
              <p>Idle Time: <strong className="text-amber-600">{detail.idleHours.toFixed(1)}h</strong></p>
              <div className="my-3 h-px bg-border" />
              <p>Regular Rate: <strong>{fmtCurrency(detail.regularRate)}/hr</strong></p>
              <p>Overtime Rate: <strong>{fmtCurrency(detail.overtimeRate)}/hr</strong></p>
              <p>Holiday Rate: <strong>{fmtCurrency(detail.holidayRate)}/hr</strong></p>
              <div className="my-3 h-px bg-border" />
              <p>Regular Hours: <strong>{detail.regularHours.toFixed(1)}h</strong> × {fmtCurrency(detail.regularRate)} = <strong>{fmtCurrency(Math.round(detail.regularHours * detail.regularRate))}</strong></p>
              <p>Overtime Hours: <strong>{detail.overtimeHours.toFixed(1)}h</strong> × {fmtCurrency(detail.overtimeRate)} = <strong>{fmtCurrency(Math.round(detail.overtimeHours * detail.overtimeRate))}</strong></p>
              {detail.holidayHours > 0 && (
                <p>Holiday Hours: <strong>{detail.holidayHours.toFixed(1)}h</strong> × {fmtCurrency(detail.holidayRate)} = <strong>{fmtCurrency(Math.round(detail.holidayHours * detail.holidayRate))}</strong></p>
              )}
              <p>Base Pay: <strong>{fmtCurrency(detail.basePay)}</strong></p>
              <div className="my-3 h-px bg-border" />
              <p>Performance Score: <strong className={detail.badge.color}>{detail.score} {detail.badge.emoji} {detail.badge.label}</strong></p>
              <p>Bonus: <strong className="text-green-600">{fmtCurrency(detail.bonus)}</strong></p>
              <div className="my-3 h-px bg-border" />
              <p className="text-sm text-muted-foreground">Productivity Highlights:</p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                <li>• Leads Added: {detail.leadsAdded}</li>
                <li>• Leads Edited: {detail.leadsEdited}</li>
                <li>• SMS Sent: {detail.smsSent}</li>
              </ul>
              <div className="my-3 h-px bg-border" />
              <p className="text-lg font-bold">Total Salary: {fmtCurrency(detail.totalSalary)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
