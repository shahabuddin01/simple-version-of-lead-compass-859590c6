import { useState } from "react";
import { getWorkforceSettings, saveWorkforceSettings, WorkforceSettings, PublicHoliday } from "@/hooks/useActivityTracker";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, X } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WorkforceSettingsPage() {
  const [settings, setSettings] = useState<WorkforceSettings>(getWorkforceSettings);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState<Date | undefined>();
  const [newHolidayRepeat, setNewHolidayRepeat] = useState(false);

  const handleSave = () => {
    saveWorkforceSettings(settings);
    toast.success("Workforce settings saved");
  };

  const toggleWeeklyOff = (day: number) => {
    setSettings(s => ({
      ...s,
      weeklyOffDays: s.weeklyOffDays.includes(day)
        ? s.weeklyOffDays.filter(d => d !== day)
        : [...s.weeklyOffDays, day],
    }));
  };

  const addHoliday = () => {
    if (!newHolidayName.trim() || !newHolidayDate) return;
    const holiday: PublicHoliday = {
      name: newHolidayName.trim(),
      date: newHolidayDate.toISOString().split("T")[0],
      repeatYearly: newHolidayRepeat,
    };
    setSettings(s => ({ ...s, publicHolidays: [...s.publicHolidays, holiday] }));
    setNewHolidayName("");
    setNewHolidayDate(undefined);
    setNewHolidayRepeat(false);
    setShowAddHoliday(false);
  };

  const removeHoliday = (index: number) => {
    setSettings(s => ({ ...s, publicHolidays: s.publicHolidays.filter((_, i) => i !== index) }));
  };

  const roles = ["Manager", "Employee", "Viewer"] as const;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Workforce Settings</h2>
        <p className="text-sm text-muted-foreground">Configure activity tracking and salary parameters</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Idle Threshold (minutes)</span>
            <input type="number" min={1} value={settings.idleThresholdMinutes}
              onChange={e => setSettings(s => ({ ...s, idleThresholdMinutes: Number(e.target.value) }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Auto Session End (minutes)</span>
            <input type="number" min={1} value={settings.autoSessionEndMinutes}
              onChange={e => setSettings(s => ({ ...s, autoSessionEndMinutes: Number(e.target.value) }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Overtime After (hours/day)</span>
            <input type="number" min={1} value={settings.overtimeAfterHours}
              onChange={e => setSettings(s => ({ ...s, overtimeAfterHours: Number(e.target.value) }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Currency Symbol</span>
            <input type="text" value={settings.currency}
              onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
        </div>

        {/* 24/7 Office Hours Notice */}
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-2">
            <span className="text-lg">🕐</span>
            <div>
              <p className="text-sm font-medium text-foreground">24/7 — No fixed working hours</p>
              <p className="text-xs text-muted-foreground">Employees can log in and work anytime. All hours are counted equally.</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Holiday & Leave Configuration */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Holiday & Leave Configuration</h3>
          </div>

          {/* Weekly Off Days */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Weekly Off Days</p>
            <p className="text-xs text-muted-foreground">Select which days of the week are non-working. These days will be excluded from salary calculation.</p>
            <div className="flex gap-3 flex-wrap">
              {DAY_NAMES.map((name, i) => (
                <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={settings.weeklyOffDays.includes(i)}
                    onCheckedChange={() => toggleWeeklyOff(i)}
                  />
                  <span className="text-sm">{name}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Public Holidays */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Public Holidays</p>
                <p className="text-xs text-muted-foreground">Add specific dates as public holidays excluded from salary calculation.</p>
              </div>
              <button
                onClick={() => setShowAddHoliday(true)}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Holiday
              </button>
            </div>

            {settings.publicHolidays.length > 0 ? (
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Holiday Name</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Repeat</th>
                      <th className="px-4 py-2 text-right font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.publicHolidays.map((h, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2 font-medium">{h.name}</td>
                        <td className="px-4 py-2 tabular-nums">{format(new Date(h.date + "T00:00:00"), "MMM d, yyyy")}</td>
                        <td className="px-4 py-2 text-muted-foreground">{h.repeatYearly ? "Yearly" : "One-time"}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => removeHoliday(i)} className="rounded-md p-1 text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No public holidays added yet.</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Hourly Rate Configuration */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Hourly Rate Configuration</h3>
            <p className="text-xs text-muted-foreground">Set the hourly pay rate for each role. Salary is calculated based on Active Time only.</p>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Regular Rate</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Overtime Rate</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Holiday Rate</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(role => (
                  <tr key={role} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-medium">{role}</td>
                    {(["regular", "overtime", "holiday"] as const).map(field => (
                      <td key={field} className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{settings.currency}</span>
                          <input
                            type="number" min={0}
                            value={settings.hourlyRates[role]?.[field] || 0}
                            onChange={e => setSettings(s => ({
                              ...s,
                              hourlyRates: {
                                ...s.hourlyRates,
                                [role]: { ...s.hourlyRates[role], [field]: Number(e.target.value) },
                              },
                            }))}
                            className="w-24 rounded-md border border-input bg-background px-2 py-1 text-sm"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Overtime rate applies after <strong>{settings.overtimeAfterHours}h</strong> of active time in a single day.
            Holiday rate applies on weekly off days and public holidays.
          </p>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Salary Pay Cycle</span>
          <select
            value={settings.payCycle}
            onChange={e => setSettings(s => ({ ...s, payCycle: e.target.value as any }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Save Settings
        </button>
      </div>

      {/* Add Holiday Modal */}
      {showAddHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddHoliday(false)}>
          <div className="w-full max-w-sm rounded-lg bg-background border border-border p-6 shadow-lg space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Add Public Holiday</h3>
              <button onClick={() => setShowAddHoliday(false)} className="rounded-md p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Holiday Name *</span>
              <input
                type="text" value={newHolidayName}
                onChange={e => setNewHolidayName(e.target.value)}
                placeholder="e.g. Eid ul-Adha"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Date *</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "w-full justify-start text-left rounded-md border border-input bg-background px-3 py-2 text-sm",
                    !newHolidayDate && "text-muted-foreground"
                  )}>
                    {newHolidayDate ? format(newHolidayDate, "PPP") : "Pick a date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newHolidayDate} onSelect={setNewHolidayDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Repeat Yearly</span>
              <Switch checked={newHolidayRepeat} onCheckedChange={setNewHolidayRepeat} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddHoliday(false)} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={addHoliday} disabled={!newHolidayName.trim() || !newHolidayDate}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                Add Holiday
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
