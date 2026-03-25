import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecurityScoreGauge } from "./SecurityScore";
import { useAuth } from "@/hooks/useAuth";
import {
  ShieldCheck, ShieldAlert, ShieldX, Lock, Bug, Globe, User, Key, BarChart3,
  Play, Trash2, Plus, RefreshCw, ChevronDown, ChevronUp, CheckCircle2, XCircle,
  AlertTriangle, Ban, Eye, Download, Search, Filter,
} from "lucide-react";
import {
  getSecuritySettings, saveSecuritySettings, SecuritySettings,
  getBlockedIPs, addBlockedIP, removeBlockedIP, BlockedIP,
  getLoginAttemptsLog, LoginAttemptLog,
  getIPWhitelist, addToWhitelist, removeFromWhitelist, WhitelistedIP,
  getActivityLog, ActivityLogEntry,
  getScanLogs, addScanLog, ScanLog, ScanFinding,
  getSecuritySessions, SecuritySession,
  calculateSecurityScore, scanLeadData, scanUserAccounts, fetchCurrentIP,
} from "@/lib/securityCenter";
import { loadSecure } from "@/lib/security";

// ── Module Card wrapper ──
function ModuleCard({ title, icon, description, children, badge, defaultOpen = false }: {
  title: string; icon: React.ReactNode; description: string; children: React.ReactNode;
  badge?: { label: string; variant: "default" | "secondary" | "destructive" | "outline" };
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {badge && <Badge variant={badge.variant} className="text-[10px] h-5">{badge.label}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <CardContent className="pt-0 border-t border-border">{children}</CardContent>}
    </Card>
  );
}

interface SecurityCenterProps {
  leads: any[];
}

export function SecurityCenter({ leads }: SecurityCenterProps) {
  const { users, currentUser } = useAuth();
  const [settings, setSettings] = useState<SecuritySettings>(getSecuritySettings);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>(getBlockedIPs);
  const [loginLogs, setLoginLogs] = useState<LoginAttemptLog[]>(getLoginAttemptsLog);
  const [whitelist, setWhitelist] = useState<WhitelistedIP[]>(getIPWhitelist);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(getActivityLog);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>(getScanLogs);
  const [sessions] = useState<SecuritySession[]>(getSecuritySessions);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStage, setScanStage] = useState("");
  const [selectedScanReport, setSelectedScanReport] = useState<ScanLog | null>(null);

  // Add IP state
  const [newBlockIP, setNewBlockIP] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [newWhitelistIP, setNewWhitelistIP] = useState("");
  const [newWhitelistLabel, setNewWhitelistLabel] = useState("");

  // Filter state
  const [loginFilter, setLoginFilter] = useState<"all" | "failed" | "blocked" | "success">("all");
  const [activityFilter, setActivityFilter] = useState("");

  // ── Settings updater ──
  const updateSetting = useCallback(<K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveSecuritySettings(next);
      return next;
    });
  }, []);

  // ── Security Score ──
  const { score, checks } = useMemo(
    () => calculateSecurityScore(settings, scanLogs, loginLogs, blockedIPs),
    [settings, scanLogs, loginLogs, blockedIPs]
  );

  const scoreColor = score < 40 ? "text-destructive" : score < 70 ? "text-amber-500" : "text-green-500";

  // ── Quick Stats ──
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;
  const failedToday = loginLogs.filter(l => !l.was_successful && new Date(l.attempted_at).getTime() > last24h).length;
  const blockedToday = blockedIPs.filter(b => new Date(b.blocked_at).getTime() > last24h).length;
  const lastScan = scanLogs[0];

  // ── Malware Scan ──
  const runScan = useCallback(async () => {
    setScanning(true);
    setScanProgress(0);
    const findings: ScanFinding[] = [];
    const startTime = Date.now();

    setScanStage("Scanning lead data...");
    setScanProgress(20);
    await new Promise(r => setTimeout(r, 600));
    findings.push(...scanLeadData(leads));
    setScanProgress(40);

    setScanStage("Checking user accounts...");
    await new Promise(r => setTimeout(r, 400));
    findings.push(...scanUserAccounts(users));
    setScanProgress(60);

    setScanStage("Auditing security settings...");
    await new Promise(r => setTimeout(r, 400));
    // Check password policy
    if (settings.min_password_length < 8) {
      findings.push({ severity: "warning", description: "Password minimum length below 8 characters", action: "Increase minimum password length" });
    }
    if (!settings.auto_block_enabled) {
      findings.push({ severity: "warning", description: "Auto IP blocking is disabled", action: "Enable auto IP blocking in Login Protection" });
    }
    setScanProgress(80);

    setScanStage("Verifying data integrity...");
    await new Promise(r => setTimeout(r, 400));
    // Check for localStorage tampering indicators
    const keysToCheck = ["nhproductionhouse_crm_leads", "nhproductionhouse_users"];
    keysToCheck.forEach(key => {
      const raw = localStorage.getItem(key);
      if (raw && (/<script/i.test(raw) || /javascript:/i.test(raw))) {
        findings.push({ severity: "critical", description: `Suspicious content detected in stored data: ${key}`, action: "Investigate and clean stored data" });
      }
    });
    setScanProgress(100);

    const duration = Math.round((Date.now() - startTime) / 1000);
    const threats = findings.filter(f => f.severity === "critical").length;
    const warnings = findings.filter(f => f.severity === "warning").length;
    const status = threats > 0 ? "critical" : warnings > 0 ? "warning" : "clean";

    const log = addScanLog({
      scanned_at: new Date().toISOString(),
      threats_found: threats,
      warnings_found: warnings,
      status,
      scan_report: findings,
      duration_seconds: duration,
    });
    setScanLogs(getScanLogs());

    setScanStage(threats === 0 && warnings === 0 ? "✅ Scan complete — no threats found" : `⚠️ Found ${threats} threats, ${warnings} warnings`);
    setScanning(false);
  }, [leads, users, settings]);

  // ── Blocked IP actions ──
  const handleBlockIP = () => {
    if (!newBlockIP.trim()) return;
    addBlockedIP({
      ip_address: newBlockIP.trim(),
      reason: newBlockReason.trim() || "Manually blocked",
      blocked_at: new Date().toISOString(),
      expires_at: null,
      is_permanent: true,
      created_by: currentUser?.email || "admin",
    });
    setBlockedIPs(getBlockedIPs());
    setNewBlockIP("");
    setNewBlockReason("");
  };

  const handleUnblockIP = (id: string) => {
    removeBlockedIP(id);
    setBlockedIPs(getBlockedIPs());
  };

  // ── Whitelist actions ──
  const handleAddWhitelist = () => {
    if (!newWhitelistIP.trim()) return;
    addToWhitelist({
      ip_address: newWhitelistIP.trim(),
      label: newWhitelistLabel.trim() || "Manual entry",
      added_at: new Date().toISOString(),
      added_by: currentUser?.email || "admin",
    });
    setWhitelist(getIPWhitelist());
    setNewWhitelistIP("");
    setNewWhitelistLabel("");
  };

  const handleAddCurrentIP = async () => {
    const ip = await fetchCurrentIP();
    if (ip !== "Unknown") {
      addToWhitelist({
        ip_address: ip,
        label: "My current IP",
        added_at: new Date().toISOString(),
        added_by: currentUser?.email || "admin",
      });
      setWhitelist(getIPWhitelist());
    }
  };

  const handleRemoveWhitelist = (id: string) => {
    removeFromWhitelist(id);
    setWhitelist(getIPWhitelist());
  };

  // ── Filtered login logs ──
  const filteredLoginLogs = useMemo(() => {
    let logs = loginLogs.slice(0, 50);
    if (loginFilter === "failed") logs = logs.filter(l => !l.was_successful && !l.blocked);
    else if (loginFilter === "blocked") logs = logs.filter(l => l.blocked);
    else if (loginFilter === "success") logs = logs.filter(l => l.was_successful);
    return logs;
  }, [loginLogs, loginFilter]);

  // ── Filtered activity ──
  const filteredActivity = useMemo(() => {
    let logs = activityLog.slice(0, 100);
    if (activityFilter) {
      const q = activityFilter.toLowerCase();
      logs = logs.filter(l => l.action.toLowerCase().includes(q) || l.user_email.toLowerCase().includes(q) || l.details.toLowerCase().includes(q));
    }
    return logs;
  }, [activityLog, activityFilter]);

  const blockDurationMap: Record<string, string> = {
    "1hr": "1 Hour", "6hr": "6 Hours", "24hr": "24 Hours", "7days": "7 Days", "permanent": "Permanent"
  };

  return (
    <div className="space-y-6">
      {/* ── TOP SUMMARY BAR ── */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="md:col-span-2 flex items-center justify-center p-6">
          <SecurityScoreGauge score={score} />
        </Card>
        <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 flex flex-col items-center justify-center gap-1">
            <Ban className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold tabular-nums">{blockedToday}</span>
            <span className="text-[11px] text-muted-foreground text-center">IPs Blocked Today</span>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center gap-1">
            <Lock className="h-5 w-5 text-amber-500" />
            <span className="text-2xl font-bold tabular-nums">{failedToday}</span>
            <span className="text-[11px] text-muted-foreground text-center">Failed Logins Today</span>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center gap-1">
            <Bug className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold tabular-nums">{lastScan ? lastScan.threats_found : "—"}</span>
            <span className="text-[11px] text-muted-foreground text-center">Last Scan Threats</span>
          </Card>
          <Card className="p-4 flex flex-col items-center justify-center gap-1">
            <User className="h-5 w-5 text-green-500" />
            <span className="text-2xl font-bold tabular-nums">{sessions.filter(s => s.is_active).length || 1}</span>
            <span className="text-[11px] text-muted-foreground text-center">Active Sessions</span>
          </Card>
        </div>
      </div>

      {/* ── Critical alerts banner ── */}
      {score < 40 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <ShieldX className="h-5 w-5 text-destructive shrink-0" />
          <span className="text-sm text-destructive font-medium">Critical: Your security score is {score}/100. Review the modules below and fix failing checks.</span>
        </div>
      )}

      {/* ── MODULE 1: Login Protection ── */}
      <ModuleCard
        title="Login Protection"
        icon={<Lock className="h-5 w-5" />}
        description="Track failed logins, auto-block suspicious IPs"
        badge={settings.auto_block_enabled ? { label: "Active", variant: "default" } : { label: "Inactive", variant: "secondary" }}
        defaultOpen
      >
        <div className="space-y-5 pt-4">
          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Max failed attempts</Label>
              <Input type="number" min={1} max={20} value={settings.max_failed_attempts}
                onChange={e => updateSetting("max_failed_attempts", parseInt(e.target.value) || 5)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Time window (minutes)</Label>
              <Input type="number" min={1} max={60} value={settings.block_window_minutes}
                onChange={e => updateSetting("block_window_minutes", parseInt(e.target.value) || 15)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Block duration</Label>
              <Select value={settings.block_duration} onValueChange={v => updateSetting("block_duration", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(blockDurationMap).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch checked={settings.auto_block_enabled} onCheckedChange={v => updateSetting("auto_block_enabled", v)} />
                <Label className="text-xs">Auto IP blocking</Label>
              </div>
            </div>
          </div>

          <Tabs defaultValue="attempts" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="attempts">Login Attempts</TabsTrigger>
              <TabsTrigger value="blocked">Blocked IPs ({blockedIPs.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="attempts" className="space-y-3">
              <div className="flex gap-2">
                {(["all", "failed", "blocked", "success"] as const).map(f => (
                  <button key={f} onClick={() => setLoginFilter(f)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${loginFilter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div className="max-h-64 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">IP</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoginLogs.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">No login attempts recorded</TableCell></TableRow>
                    ) : filteredLoginLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs tabular-nums">{new Date(log.attempted_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-mono">{log.email_attempted}</TableCell>
                        <TableCell className="text-xs font-mono">{log.ip_address}</TableCell>
                        <TableCell>
                          {log.blocked ? <Badge variant="destructive" className="text-[10px]"><Ban className="h-3 w-3 mr-1" />Blocked</Badge> :
                           log.was_successful ? <Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge> :
                           <Badge variant="outline" className="text-destructive text-[10px]"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="blocked" className="space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1"><Label className="text-xs">IP Address</Label><Input placeholder="192.168.1.1" value={newBlockIP} onChange={e => setNewBlockIP(e.target.value)} /></div>
                <div className="flex-1 space-y-1"><Label className="text-xs">Reason</Label><Input placeholder="Suspicious activity" value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)} /></div>
                <button onClick={handleBlockIP} className="flex items-center gap-1 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"><Plus className="h-4 w-4" />Block</button>
              </div>
              <div className="max-h-48 overflow-auto rounded-md border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">IP Address</TableHead>
                    <TableHead className="text-xs">Reason</TableHead>
                    <TableHead className="text-xs">Blocked At</TableHead>
                    <TableHead className="text-xs">Expires</TableHead>
                    <TableHead className="text-xs w-20">Action</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {blockedIPs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">No blocked IPs</TableCell></TableRow>
                    ) : blockedIPs.map(ip => (
                      <TableRow key={ip.id}>
                        <TableCell className="text-xs font-mono">{ip.ip_address}</TableCell>
                        <TableCell className="text-xs">{ip.reason}</TableCell>
                        <TableCell className="text-xs tabular-nums">{new Date(ip.blocked_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">{ip.is_permanent ? "Permanent" : ip.expires_at ? new Date(ip.expires_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell><button onClick={() => handleUnblockIP(ip.id)} className="text-xs text-primary hover:underline">Unblock</button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ModuleCard>

      {/* ── MODULE 2: Malware Scanner ── */}
      <ModuleCard
        title="Malware Scanner"
        icon={<Bug className="h-5 w-5" />}
        description="Scan database content for suspicious patterns & injection attempts"
        badge={lastScan ? (lastScan.status === "clean" ? { label: "Clean", variant: "default" } : { label: `${lastScan.threats_found} Threats`, variant: "destructive" }) : undefined}
      >
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={runScan} disabled={scanning}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all">
                {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {scanning ? "Scanning..." : "Run Security Scan"}
              </button>
              <div className="flex items-center gap-2">
                <Switch checked={settings.auto_scan_enabled} onCheckedChange={v => updateSetting("auto_scan_enabled", v)} />
                <Label className="text-xs">Weekly auto-scan</Label>
              </div>
            </div>
            {lastScan && <span className="text-xs text-muted-foreground">Last scan: {new Date(lastScan.scanned_at).toLocaleDateString()}</span>}
          </div>

          {(scanning || scanStage) && (
            <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3">
              <Progress value={scanProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">{scanStage}</p>
            </div>
          )}

          {/* Scan History */}
          {scanLogs.length > 0 && (
            <div className="max-h-48 overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Duration</TableHead>
                  <TableHead className="text-xs">Threats</TableHead>
                  <TableHead className="text-xs">Warnings</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-24">Report</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {scanLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs tabular-nums">{new Date(log.scanned_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs">{log.duration_seconds}s</TableCell>
                      <TableCell className="text-xs"><Badge variant={log.threats_found > 0 ? "destructive" : "secondary"} className="text-[10px]">{log.threats_found}</Badge></TableCell>
                      <TableCell className="text-xs"><Badge variant={log.warnings_found > 0 ? "outline" : "secondary"} className="text-[10px]">{log.warnings_found}</Badge></TableCell>
                      <TableCell>
                        {log.status === "clean" ? <Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px]">Clean</Badge> :
                         log.status === "warning" ? <Badge variant="outline" className="text-amber-500 text-[10px]">Warning</Badge> :
                         <Badge variant="destructive" className="text-[10px]">Critical</Badge>}
                      </TableCell>
                      <TableCell><button onClick={() => setSelectedScanReport(log)} className="text-xs text-primary hover:underline">View</button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Scan Report Modal */}
          {selectedScanReport && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedScanReport(null)}>
              <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl space-y-4 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Scan Report — {new Date(selectedScanReport.scanned_at).toLocaleDateString()}</h3>
                  <button onClick={() => setSelectedScanReport(null)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
                </div>
                {selectedScanReport.scan_report.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm"><CheckCircle2 className="h-4 w-4" />No threats or warnings found.</div>
                ) : selectedScanReport.scan_report.map((finding, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={finding.severity === "critical" ? "destructive" : finding.severity === "warning" ? "outline" : "secondary"} className="text-[10px]">
                        {finding.severity}
                      </Badge>
                      {finding.table && <span className="text-xs text-muted-foreground">{finding.table}{finding.field ? `.${finding.field}` : ""}</span>}
                    </div>
                    <p className="text-xs text-foreground">{finding.description}</p>
                    {finding.record && <p className="text-xs text-muted-foreground">Record: {finding.record}</p>}
                    {finding.action && <p className="text-xs text-primary">→ {finding.action}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ModuleCard>

      {/* ── MODULE 3: IP & Access Control ── */}
      <ModuleCard
        title="IP & Access Control"
        icon={<Globe className="h-5 w-5" />}
        description="IP whitelist, country blocking, and access restrictions"
        badge={settings.ip_whitelist_enabled ? { label: "Whitelist ON", variant: "default" } : undefined}
      >
        <div className="space-y-4 pt-4">
          {/* IP Whitelist */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={settings.ip_whitelist_enabled} onCheckedChange={v => updateSetting("ip_whitelist_enabled", v)} />
              <div>
                <Label className="text-sm font-medium">Enable IP Whitelist</Label>
                <p className="text-[11px] text-muted-foreground">Restrict admin access to specific IPs only</p>
              </div>
            </div>
            {settings.ip_whitelist_enabled && (
              <div className="rounded-md border border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/10 p-2">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Enabling this will lock out all IPs not on the list. Add your IP first.</p>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1"><Label className="text-xs">IP Address</Label><Input placeholder="203.0.113.50" value={newWhitelistIP} onChange={e => setNewWhitelistIP(e.target.value)} /></div>
              <div className="flex-1 space-y-1"><Label className="text-xs">Label</Label><Input placeholder="Office network" value={newWhitelistLabel} onChange={e => setNewWhitelistLabel(e.target.value)} /></div>
              <button onClick={handleAddWhitelist} className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />Add</button>
              <button onClick={handleAddCurrentIP} className="flex items-center gap-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"><Globe className="h-4 w-4" />Add My IP</button>
            </div>
            <div className="max-h-36 overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">IP Address</TableHead>
                  <TableHead className="text-xs">Label</TableHead>
                  <TableHead className="text-xs">Added</TableHead>
                  <TableHead className="text-xs w-16">Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {whitelist.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">No whitelisted IPs</TableCell></TableRow>
                  ) : whitelist.map(w => (
                    <TableRow key={w.id}>
                      <TableCell className="text-xs font-mono">{w.ip_address}</TableCell>
                      <TableCell className="text-xs">{w.label}</TableCell>
                      <TableCell className="text-xs tabular-nums">{new Date(w.added_at).toLocaleDateString()}</TableCell>
                      <TableCell><button onClick={() => handleRemoveWhitelist(w.id)} className="text-xs text-destructive hover:underline">Remove</button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </ModuleCard>

      {/* ── MODULE 4: User Activity Monitor ── */}
      <ModuleCard
        title="User Activity Monitor"
        icon={<User className="h-5 w-5" />}
        description="Track all user actions and detect suspicious behavior"
      >
        <div className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Filter by user, action..." className="pl-8 h-9 text-xs" value={activityFilter} onChange={e => setActivityFilter(e.target.value)} />
            </div>
          </div>
          <div className="max-h-72 overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">User</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Details</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredActivity.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">No activity recorded yet</TableCell></TableRow>
                ) : filteredActivity.map(log => (
                  <TableRow key={log.id} className={log.flagged ? "bg-destructive/5" : ""}>
                    <TableCell className="text-xs tabular-nums">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{log.user_email}{log.flagged && <span className="ml-1">🚨</span>}</TableCell>
                    <TableCell className="text-xs"><Badge variant="secondary" className="text-[10px]">{log.action}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{log.details || log.resource}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </ModuleCard>

      {/* ── MODULE 5: Session & Auth Security ── */}
      <ModuleCard
        title="Session & Auth Security"
        icon={<Key className="h-5 w-5" />}
        description="Manage sessions, password policies, and authentication settings"
      >
        <div className="space-y-5 pt-4">
          {/* Password Policy */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password Policy</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Min length</Label>
                <Input type="number" min={6} max={32} value={settings.min_password_length}
                  onChange={e => updateSetting("min_password_length", parseInt(e.target.value) || 8)} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={settings.require_uppercase} onCheckedChange={v => updateSetting("require_uppercase", v)} />
                <Label className="text-xs">Uppercase</Label>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={settings.require_number} onCheckedChange={v => updateSetting("require_number", v)} />
                <Label className="text-xs">Number</Label>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={settings.require_special_char} onCheckedChange={v => updateSetting("require_special_char", v)} />
                <Label className="text-xs">Special char</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Password expiry</Label>
                <Select value={String(settings.password_expiry_days)} onValueChange={v => updateSetting("password_expiry_days", parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Never</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Session timeout</Label>
                <Select value={String(settings.session_timeout_minutes)} onValueChange={v => updateSetting("session_timeout_minutes", parseInt(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                    <SelectItem value="1440">24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 2FA & Session Settings */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Authentication</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Require 2FA for admin accounts</Label>
                  <p className="text-[11px] text-muted-foreground">Uses TOTP (Google Authenticator compatible)</p>
                </div>
                <Switch checked={settings.require_2fa_admin} onCheckedChange={v => updateSetting("require_2fa_admin", v)} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm">Send weekly security report</Label>
                  <p className="text-[11px] text-muted-foreground">Email summary of score, threats, and activity</p>
                </div>
                <Switch checked={settings.weekly_report_enabled} onCheckedChange={v => updateSetting("weekly_report_enabled", v)} />
              </div>
            </div>
          </div>
        </div>
      </ModuleCard>

      {/* ── MODULE 6: Security Scoring Checklist ── */}
      <ModuleCard
        title="Security Checklist"
        icon={<BarChart3 className="h-5 w-5" />}
        description="Score breakdown — see what's passing and what needs attention"
        badge={{ label: `${score}/100`, variant: score < 40 ? "destructive" : score < 70 ? "outline" : "default" }}
        defaultOpen
      >
        <div className="space-y-2 pt-4">
          {checks.map((check, i) => (
            <div key={i} className={`flex items-center justify-between rounded-md border px-3 py-2 ${check.pass ? "border-green-200/50 bg-green-50/30 dark:bg-green-900/5" : "border-destructive/20 bg-destructive/5"}`}>
              <div className="flex items-center gap-2">
                {check.pass ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                <span className="text-xs text-foreground">{check.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">+{check.points}</span>
                {!check.pass && (
                  <Badge variant="outline" className="text-[10px] text-destructive cursor-default">Fix needed</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </ModuleCard>
    </div>
  );
}
