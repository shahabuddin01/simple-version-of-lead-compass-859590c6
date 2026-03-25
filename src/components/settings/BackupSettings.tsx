import { useState } from "react";
import { Download, Upload, Trash2, Database, RefreshCw, Mail, HardDrive, CheckCircle, AlertTriangle, Send, Unplug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Lead } from "@/types/lead";

interface BackupEntry {
  id: string;
  createdAt: string;
  fileSizeKb: number;
  recordCount: number;
  status: "success" | "failed";
  data: Lead[];
}

const BACKUP_KEY = "nhproductionhouse_backups";
const BACKUP_SETTINGS_KEY = "nhproductionhouse_backup_settings";
const GDRIVE_KEY = "nhproductionhouse_gdrive_connection";
const MAX_BACKUPS = 4;

function loadBackups(): BackupEntry[] {
  try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]"); } catch { return []; }
}
function saveBackups(b: BackupEntry[]) { localStorage.setItem(BACKUP_KEY, JSON.stringify(b)); }
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_SETTINGS_KEY) || '{"autoEnabled":true,"emailEnabled":false}');
  } catch { return { autoEnabled: true, emailEnabled: false }; }
}
function saveSettings(s: Record<string, unknown>) { localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(s)); }
function loadGDrive(): { email: string; connected: boolean } | null {
  try { return JSON.parse(localStorage.getItem(GDRIVE_KEY) || "null"); } catch { return null; }
}
function saveGDrive(g: { email: string; connected: boolean } | null) {
  if (g) localStorage.setItem(GDRIVE_KEY, JSON.stringify(g));
  else localStorage.removeItem(GDRIVE_KEY);
}

// Read SMTP config to detect if configured
function isSMTPConfigured(): boolean {
  try {
    const smtp = JSON.parse(localStorage.getItem("nhproductionhouse_smtp_settings") || "null");
    return !!(smtp && smtp.host && smtp.username && smtp.password && smtp.isActive);
  } catch { return false; }
}
function getSMTPEmail(): string {
  try {
    const smtp = JSON.parse(localStorage.getItem("nhproductionhouse_smtp_settings") || "null");
    return smtp?.senderEmail || smtp?.username || "";
  } catch { return ""; }
}

// Backend API URL for server-side backup features
const API_URL = import.meta.env.VITE_API_URL || "";

interface BackupSettingsProps {
  leads: Lead[];
}

export function BackupSettings({ leads }: BackupSettingsProps) {
  const [backups, setBackups] = useState<BackupEntry[]>(loadBackups);
  const settings = loadSettings();
  const [autoEnabled, setAutoEnabled] = useState(settings.autoEnabled);
  const [emailEnabled, setEmailEnabled] = useState(settings.emailEnabled ?? false);
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null);
  const [restoreInput, setRestoreInput] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearInput, setClearInput] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testingDrive, setTestingDrive] = useState(false);
  const [gdriveConnection, setGdriveConnection] = useState(loadGDrive);

  const smtpConfigured = isSMTPConfigured();
  const adminEmail = getSMTPEmail();

  const callBackendAPI = async (endpoint: string, body: Record<string, unknown>) => {
    if (!API_URL) throw new Error("VITE_API_URL not configured");
    const token = localStorage.getItem("nhproductionhouse_api_token") || "";
    const res = await fetch(`${API_URL}/backend/api${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `API error: ${res.status}`);
    return data;
  };

  const createBackup = async () => {
    setCreating(true);
    try {
      const jsonStr = JSON.stringify(leads, null, 2);
      const sizeKb = Math.round(new Blob([jsonStr]).size / 1024);
      const entry: BackupEntry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        fileSizeKb: sizeKb,
        recordCount: leads.length,
        status: "success",
        data: leads,
      };
      let updated = [entry, ...backups];
      if (updated.length > MAX_BACKUPS) updated = updated.slice(0, MAX_BACKUPS);
      setBackups(updated);
      saveBackups(updated);

      // Download locally
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `nh-production-house-backup-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Also try server-side backup if PHP backend configured
      if (API_URL) {
        try {
          await callBackendAPI("/backup", {});
          toast.success(`Backup created — ${leads.length} leads exported + server backup triggered.`);
        } catch {
          toast.success(`Backup created — ${leads.length} leads exported (server backup skipped).`);
        }
      } else {
        toast.success(`Backup created — ${leads.length} leads exported.`);
      }
    } catch {
      toast.error("Backup failed.");
    } finally {
      setCreating(false);
    }
  };

  const downloadBackup = (entry: BackupEntry) => {
    const jsonStr = JSON.stringify(entry.data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date(entry.createdAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `nh-production-house-backup-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = () => {
    if (!restoreTarget || restoreInput !== "RESTORE") return;
    localStorage.setItem("nhproductionhouse_crm_leads", JSON.stringify(restoreTarget.data));
    toast.success(`Restored ${restoreTarget.recordCount} leads. Reloading...`);
    setRestoreTarget(null);
    setRestoreInput("");
    setTimeout(() => window.location.reload(), 1000);
  };

  const clearAll = () => {
    if (clearInput !== "CLEAR") return;
    setBackups([]);
    saveBackups([]);
    setClearConfirm(false);
    setClearInput("");
    toast.success("All backups cleared.");
  };

  const toggleAuto = (v: boolean) => {
    setAutoEnabled(v);
    saveSettings({ ...loadSettings(), autoEnabled: v });
  };

  const toggleEmail = (v: boolean) => {
    setEmailEnabled(v);
    saveSettings({ ...loadSettings(), emailEnabled: v });
  };

  const sendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      // Note: Email backup via PHP backend requires SMTP to be configured on server
      toast.info("Email backup requires SMTP configuration on the server. Use cPanel cron jobs for automated email backups.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to send test email: ${msg}`);
    } finally {
      setSendingTestEmail(false);
    }
  };

  const connectGoogleDrive = () => {
    // In production: open Google OAuth popup. For now, show instructions.
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      toast.error("VITE_GOOGLE_CLIENT_ID not configured. See SETUP_GUIDE.md for instructions.");
      return;
    }
    const redirectUri = `${window.location.origin}/auth/google-drive/callback`;
    const scope = "https://www.googleapis.com/auth/drive.file";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    window.open(authUrl, "google-drive-auth", "width=500,height=600");
    // Listen for message from popup
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "google-drive-connected") {
        setGdriveConnection({ email: event.data.email, connected: true });
        saveGDrive({ email: event.data.email, connected: true });
        toast.success(`Google Drive connected as ${event.data.email}`);
        window.removeEventListener("message", handler);
      }
    };
    window.addEventListener("message", handler);
  };

  const disconnectGoogleDrive = () => {
    setGdriveConnection(null);
    saveGDrive(null);
    toast.success("Google Drive disconnected.");
  };

  const testDriveUpload = async () => {
    setTestingDrive(true);
    try {
      // Note: Google Drive backup requires OAuth setup on the server
      toast.info("Google Drive backup requires server-side OAuth configuration. This feature is available with a custom PHP script on your cPanel hosting.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Drive upload failed: ${msg}`);
    } finally {
      setTestingDrive(false);
    }
  };

  const nextSunday = () => {
    const d = new Date();
    d.setDate(d.getDate() + (7 - d.getDay()));
    d.setHours(0, 0, 0, 0);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Backups</h2>
        <p className="text-sm text-muted-foreground">Create and manage CRM data backups</p>
      </div>

      <Button onClick={createBackup} disabled={creating}>
        {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
        Create Backup Now
      </Button>

      {/* Backup Settings */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Backup Settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Weekly Automatic Backup</p>
              <p className="text-xs text-muted-foreground">Every Sunday at 00:00 UTC</p>
            </div>
            <Switch checked={autoEnabled} onCheckedChange={toggleAuto} />
          </div>
          {autoEnabled && (
            <p className="text-xs text-muted-foreground">Next scheduled: {nextSunday()} at 00:00 UTC</p>
          )}
          <p className="text-xs text-muted-foreground">Backups retained: {MAX_BACKUPS} maximum</p>
          {!clearConfirm ? (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setClearConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Clear All Backups
            </Button>
          ) : (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm text-destructive">Type CLEAR to confirm</p>
              <div className="flex gap-2">
                <Input value={clearInput} onChange={e => setClearInput(e.target.value)} placeholder="CLEAR" className="flex-1" />
                <Button size="sm" variant="destructive" disabled={clearInput !== "CLEAR"} onClick={clearAll}>Confirm</Button>
                <Button size="sm" variant="outline" onClick={() => { setClearConfirm(false); setClearInput(""); }}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Backup Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" /> Email Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Send backup to email weekly</p>
              <p className="text-xs text-muted-foreground">Backup JSON sent as attachment to admin email</p>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={toggleEmail} />
          </div>

          <div className="flex items-center gap-2 text-sm">
            {smtpConfigured ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">SMTP configured</span>
                <span className="text-xs text-muted-foreground">· {adminEmail}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-muted-foreground">SMTP not configured</span>
                <span className="text-xs text-muted-foreground">— configure in SMTP Settings</span>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={sendTestEmail}
            disabled={sendingTestEmail || !smtpConfigured}
          >
            {sendingTestEmail ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Test Backup Now
          </Button>
          {!API_URL && (
            <p className="text-xs text-muted-foreground">Set VITE_API_URL to enable server-side email backup</p>
          )}
        </CardContent>
      </Card>

      {/* Google Drive Backup Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Google Drive Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {gdriveConnection?.connected ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Connected as: <strong>{gdriveConnection.email}</strong></span>
              </div>
              <p className="text-xs text-muted-foreground">
                Backups automatically upload to "NH Production House Backups" folder in Google Drive.
                Files in Google Drive are never auto-deleted.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={testDriveUpload} disabled={testingDrive || !API_URL}>
                  {testingDrive ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Test Upload Now
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={disconnectGoogleDrive}>
                  <Unplug className="h-3.5 w-3.5" /> Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect Google Drive to automatically upload weekly backups to your Drive account.
              </p>
              <Button variant="outline" size="sm" onClick={connectGoogleDrive}>
                <HardDrive className="h-3.5 w-3.5" /> Connect Google Drive
              </Button>
              <p className="text-xs text-muted-foreground">
                Requires Google OAuth setup. See SETUP_GUIDE.md for configuration.
              </p>
            </>
          )}
          {!API_URL && (
            <p className="text-xs text-muted-foreground">Set VITE_API_URL to enable server-side Google Drive backup</p>
          )}
        </CardContent>
      </Card>

      {/* Backup List */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Stored Backups ({backups.length})</CardTitle></CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No backups yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {backups.map(b => (
                <div key={b.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{new Date(b.createdAt).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{b.recordCount} leads · {b.fileSizeKb} KB · {b.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => downloadBackup(b)}>
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setRestoreTarget(b); setRestoreInput(""); }}>
                      <Upload className="h-3.5 w-3.5" /> Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setRestoreTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-foreground">⚠️ Restore Backup</h3>
            <p className="text-sm text-muted-foreground">
              Restoring this backup will <strong>OVERWRITE</strong> all current leads data. This cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground">
              Backup: {new Date(restoreTarget.createdAt).toLocaleString()} · {restoreTarget.recordCount} leads
            </p>
            <p className="text-sm font-medium text-destructive">Type RESTORE to confirm</p>
            <Input value={restoreInput} onChange={e => setRestoreInput(e.target.value)} placeholder="RESTORE" />
            <div className="flex gap-2">
              <Button variant="destructive" disabled={restoreInput !== "RESTORE"} onClick={handleRestore}>Confirm Restore</Button>
              <Button variant="outline" onClick={() => setRestoreTarget(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
