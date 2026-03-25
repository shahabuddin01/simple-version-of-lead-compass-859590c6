import { useState, useCallback, useRef } from "react";
import {
  Download, Upload, Trash2, Database, RefreshCw,
  Mail, HardDrive, CheckCircle, AlertTriangle,
  Send, Unplug, FileUp, X, Loader2, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Lead } from "@/types/lead";

// ─── Types ───────────────────────────────────────────────────

interface BackupEntry {
  id: string;
  createdAt: string;
  fileSizeKb: number;
  recordCount: number;
  status: "success" | "failed";
  data: Lead[];
}

interface BackupMetadata {
  crm_name?: string;
  backup_date?: string;
  crm_version?: string;
  total_leads?: number;
  total_users?: number;
}

interface ParsedBackup {
  metadata: BackupMetadata;
  leads: any[];
  email_verification_cache?: any[];
  users?: any[];
  industries?: string[];
  companies?: string[];
}

interface RestoreProgress {
  status: "idle" | "running" | "complete" | "error";
  step: string;
  current: number;
  total: number;
  restored?: number;
  skipped?: number;
  errorMessage?: string;
  backupDate?: string;
}

// ─── Storage helpers ─────────────────────────────────────────

const BACKUP_KEY = "nhproductionhouse_backups";
const BACKUP_SETTINGS_KEY = "nhproductionhouse_backup_settings";
const GDRIVE_KEY = "nhproductionhouse_gdrive_connection";
const MAX_BACKUPS = 4;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

const API_URL = import.meta.env.VITE_API_URL || "";

// ─── Validation ──────────────────────────────────────────────

function validateBackupFile(data: any): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Support both formats: with metadata wrapper and legacy (plain leads array)
  if (Array.isArray(data)) {
    // Legacy format — just an array of leads
    return { valid: true, errors: [], warnings: ["Legacy backup format detected — no metadata available."] };
  }

  if (!data.leads && !data.metadata) {
    errors.push("This file is not a valid CRM backup.");
  }
  if (data.leads && !Array.isArray(data.leads)) {
    errors.push("Invalid leads data — expected an array.");
  }
  if (Array.isArray(data.leads) && data.leads.length === 0) {
    errors.push("Backup file is empty — no leads found.");
  }
  if (data.metadata?.backup_date) {
    const backupAge = Date.now() - new Date(data.metadata.backup_date).getTime();
    const daysSince = Math.floor(backupAge / (1000 * 60 * 60 * 24));
    if (daysSince > 30) {
      warnings.push(`This backup is from ${daysSince} days ago — are you sure you want to restore old data?`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function normalizeBackupData(data: any): ParsedBackup {
  // Legacy format: plain array of leads
  if (Array.isArray(data)) {
    return {
      metadata: {
        crm_name: "NH Production House",
        backup_date: "Unknown",
        crm_version: "Unknown",
        total_leads: data.length,
        total_users: 0,
      },
      leads: data,
    };
  }
  return {
    metadata: data.metadata || {
      crm_name: "NH Production House",
      backup_date: data.exported_at || "Unknown",
      crm_version: data.version || "Unknown",
      total_leads: data.leads?.length || 0,
      total_users: data.users?.length || 0,
    },
    leads: data.leads || [],
    email_verification_cache: data.email_verification_cache,
    users: data.users,
    industries: data.industries,
    companies: data.companies,
  };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─── Component ───────────────────────────────────────────────

interface BackupSettingsProps {
  leads: Lead[];
}

export function BackupSettings({ leads }: BackupSettingsProps) {
  const [backups, setBackups] = useState<BackupEntry[]>(loadBackups);
  const settings = loadSettings();
  const [autoEnabled, setAutoEnabled] = useState(settings.autoEnabled);
  const [emailEnabled, setEmailEnabled] = useState(settings.emailEnabled ?? false);
  const [creating, setCreating] = useState(false);

  // Stored backup restore
  const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null);
  const [restoreInput, setRestoreInput] = useState("");

  // Clear all
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearInput, setClearInput] = useState("");

  // Email/Drive
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testingDrive, setTestingDrive] = useState(false);
  const [gdriveConnection, setGdriveConnection] = useState(loadGDrive);

  // File upload restore
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<ParsedBackup | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [fileRestoreInput, setFileRestoreInput] = useState("");

  // Restore options
  const [restoreMode, setRestoreMode] = useState<"overwrite" | "merge">("overwrite");
  const [restoreLeadsEnabled, setRestoreLeadsEnabled] = useState(true);
  const [restoreCacheEnabled, setRestoreCacheEnabled] = useState(true);

  // Progress dialog
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress>({
    status: "idle", step: "", current: 0, total: 0,
  });

  const smtpConfigured = isSMTPConfigured();
  const adminEmail = getSMTPEmail();

  const callBackendAPI = async (endpoint: string, body: Record<string, unknown>) => {
    if (!API_URL) throw new Error("VITE_API_URL not configured");
    const token = localStorage.getItem("nhproductionhouse_api_token") || "";
    const res = await fetch(`${API_URL}/backend/api${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `API error: ${res.status}`);
    return data;
  };

  // ─── Backup Creation ────────────────────────────────────

  const createBackup = async () => {
    setCreating(true);
    try {
      const backupPayload: ParsedBackup = {
        metadata: {
          crm_name: "NH Production House",
          backup_date: new Date().toISOString(),
          crm_version: "1.0",
          total_leads: leads.length,
          total_users: 0,
        },
        leads,
        email_verification_cache: [],
        industries: [...new Set(leads.map(l => l.industry).filter(Boolean))],
        companies: [...new Set(leads.map(l => l.company).filter(Boolean))],
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
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

      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `nh-production-house-backup-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);

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
    const backupPayload: ParsedBackup = {
      metadata: {
        crm_name: "NH Production House",
        backup_date: entry.createdAt,
        crm_version: "1.0",
        total_leads: entry.recordCount,
        total_users: 0,
      },
      leads: entry.data,
    };
    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date(entry.createdAt).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `nh-production-house-backup-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── File Upload ────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setFileErrors([]);
    setFileWarnings([]);
    setParsedBackup(null);
    setFileRestoreInput("");
    setRestoreMode("overwrite");
    setRestoreLeadsEnabled(true);
    setRestoreCacheEnabled(true);

    if (!file.name.endsWith(".json")) {
      setFileErrors(["Only .json backup files are accepted."]);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileErrors([`File too large — maximum ${formatFileSize(MAX_FILE_SIZE)} allowed.`]);
      return;
    }

    setUploadedFile(file);

    try {
      const text = await file.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        setFileErrors(["File is corrupted — cannot read data (invalid JSON)."]);
        return;
      }

      const { valid, errors, warnings } = validateBackupFile(data);
      setFileWarnings(warnings);

      if (!valid) {
        setFileErrors(errors);
        return;
      }

      const normalized = normalizeBackupData(data);
      setParsedBackup(normalized);
    } catch {
      setFileErrors(["Failed to read the uploaded file."]);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback(() => setDragActive(false), []);

  const clearUpload = () => {
    setUploadedFile(null);
    setParsedBackup(null);
    setFileErrors([]);
    setFileWarnings([]);
    setFileRestoreInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Restore execution ─────────────────────────────────

  const executeRestore = async (backupData: ParsedBackup, mode: "overwrite" | "merge", rLeads: boolean, rCache: boolean) => {
    const totalLeads = backupData.leads.length;

    setRestoreProgress({
      status: "running",
      step: "Preparing restore...",
      current: 0,
      total: totalLeads,
      backupDate: backupData.metadata.backup_date,
    });

    try {
      // If backend is configured, use PHP endpoint
      if (API_URL) {
        setRestoreProgress(p => ({ ...p, step: mode === "overwrite" ? "Clearing existing data..." : "Preparing merge..." }));

        const result = await callBackendAPI("/backup/restore", {
          backup_data: backupData,
          mode,
          restore_leads: rLeads,
          restore_cache: rCache,
        });

        setRestoreProgress({
          status: "complete",
          step: "Complete",
          current: totalLeads,
          total: totalLeads,
          restored: result.restored,
          skipped: result.skipped,
          backupDate: backupData.metadata.backup_date,
        });
        return;
      }

      // LocalStorage fallback
      if (rLeads) {
        if (mode === "overwrite") {
          setRestoreProgress(p => ({ ...p, step: "Clearing existing data..." }));
          // Small delay for UI feedback
          await new Promise(r => setTimeout(r, 300));

          const batches = chunk(backupData.leads, 50);
          let restored = 0;

          for (const batch of batches) {
            // Simulate batch processing delay
            await new Promise(r => setTimeout(r, 50));
            restored += batch.length;
            setRestoreProgress(p => ({
              ...p,
              step: "Restoring leads...",
              current: restored,
              total: totalLeads,
            }));
          }

          localStorage.setItem("nhproductionhouse_crm_leads", JSON.stringify(backupData.leads));

          setRestoreProgress({
            status: "complete",
            step: "Complete",
            current: totalLeads,
            total: totalLeads,
            restored: totalLeads,
            skipped: 0,
            backupDate: backupData.metadata.backup_date,
          });
        } else {
          // Merge mode (localStorage)
          setRestoreProgress(p => ({ ...p, step: "Merging leads..." }));

          let existing: Lead[] = [];
          try {
            existing = JSON.parse(localStorage.getItem("nhproductionhouse_crm_leads") || "[]");
          } catch { existing = []; }

          const existingEmails = new Set(existing.map(l => l.work_email).filter(Boolean));
          let added = 0;
          let skipped = 0;

          const batches = chunk(backupData.leads, 50);
          let processed = 0;

          for (const batch of batches) {
            await new Promise(r => setTimeout(r, 50));
            for (const lead of batch) {
              if (lead.work_email && existingEmails.has(lead.work_email)) {
                skipped++;
              } else {
                existing.push(lead as Lead);
                if (lead.work_email) existingEmails.add(lead.work_email);
                added++;
              }
            }
            processed += batch.length;
            setRestoreProgress(p => ({
              ...p, step: "Merging leads...", current: processed, total: totalLeads,
            }));
          }

          localStorage.setItem("nhproductionhouse_crm_leads", JSON.stringify(existing));

          setRestoreProgress({
            status: "complete",
            step: "Complete",
            current: totalLeads,
            total: totalLeads,
            restored: added,
            skipped,
            backupDate: backupData.metadata.backup_date,
          });
        }
      }

      if (rCache && backupData.email_verification_cache?.length) {
        setRestoreProgress(p => ({ ...p, step: "Restoring verification cache..." }));
        await new Promise(r => setTimeout(r, 200));
        // Cache is stored in localStorage by emailVerificationCache module
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setRestoreProgress(p => ({
        ...p,
        status: "error",
        step: "Restore failed",
        errorMessage: msg,
      }));
    }
  };

  // Restore from uploaded file
  const handleFileRestore = () => {
    if (!parsedBackup || fileRestoreInput !== "RESTORE") return;
    executeRestore(parsedBackup, restoreMode, restoreLeadsEnabled, restoreCacheEnabled);
    clearUpload();
  };

  // Restore from stored backup
  const handleStoredRestore = () => {
    if (!restoreTarget || restoreInput !== "RESTORE") return;
    const normalized = normalizeBackupData({ leads: restoreTarget.data, metadata: { backup_date: restoreTarget.createdAt, total_leads: restoreTarget.recordCount, crm_version: "1.0" } });
    executeRestore(normalized, restoreMode, restoreLeadsEnabled, restoreCacheEnabled);
    setRestoreTarget(null);
    setRestoreInput("");
  };

  const closeProgressDialog = () => {
    setRestoreProgress({ status: "idle", step: "", current: 0, total: 0 });
  };

  // ─── Misc handlers ─────────────────────────────────────

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
      toast.info("Email backup requires SMTP configuration on the server.");
    } finally {
      setSendingTestEmail(false);
    }
  };

  const connectGoogleDrive = () => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      toast.error("VITE_GOOGLE_CLIENT_ID not configured. See SETUP_GUIDE.md.");
      return;
    }
    const redirectUri = `${window.location.origin}/auth/google-drive/callback`;
    const scope = "https://www.googleapis.com/auth/drive.file";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    window.open(authUrl, "google-drive-auth", "width=500,height=600");
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
      toast.info("Google Drive backup requires server-side OAuth configuration.");
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

  const progressPercent = restoreProgress.total > 0
    ? Math.round((restoreProgress.current / restoreProgress.total) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Backups</h2>
        <p className="text-sm text-muted-foreground">Create, download, and restore CRM data backups</p>
      </div>

      <Button onClick={createBackup} disabled={creating}>
        {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
        Create Backup Now
      </Button>

      {/* ─── Restore from File Card ─────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileUp className="h-4 w-4" /> Restore from Backup File
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a previously downloaded CRM backup JSON file to restore your data.
          </p>

          {/* Drop Zone */}
          {!parsedBackup && fileErrors.length === 0 && (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
                ${dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }
              `}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Drop backup file here or click to upload</p>
              <p className="text-xs text-muted-foreground">.json files only · Max 50MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          )}

          {/* File errors */}
          {fileErrors.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              {fileErrors.map((err, i) => (
                <p key={i} className="text-sm text-destructive flex items-start gap-2">
                  <X className="h-4 w-4 mt-0.5 shrink-0" /> {err}
                </p>
              ))}
              <Button variant="outline" size="sm" onClick={clearUpload}>Try Another File</Button>
            </div>
          )}

          {/* Preview Card */}
          {parsedBackup && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-semibold text-foreground">Valid backup file detected</span>
                <Button variant="ghost" size="sm" className="ml-auto h-7 w-7 p-0" onClick={clearUpload}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {uploadedFile && (
                <p className="text-xs text-muted-foreground">
                  File: {uploadedFile.name} · {formatFileSize(uploadedFile.size)}
                </p>
              )}

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div className="text-muted-foreground">Backup Date</div>
                <div className="font-medium">{parsedBackup.metadata.backup_date && parsedBackup.metadata.backup_date !== "Unknown"
                  ? new Date(parsedBackup.metadata.backup_date).toLocaleString()
                  : "Unknown"}</div>
                <div className="text-muted-foreground">Total Leads</div>
                <div className="font-medium">{parsedBackup.leads.length.toLocaleString()}</div>
                {(parsedBackup.metadata.total_users ?? 0) > 0 && (
                  <>
                    <div className="text-muted-foreground">Total Users</div>
                    <div className="font-medium">{parsedBackup.metadata.total_users}</div>
                  </>
                )}
                <div className="text-muted-foreground">CRM Version</div>
                <div className="font-medium">{parsedBackup.metadata.crm_version || "Unknown"}</div>
              </div>

              {/* Warnings */}
              {fileWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">{w}</p>
                </div>
              ))}

              {/* Restore Options */}
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-sm font-medium text-foreground">What would you like to restore?</p>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="restoreLeads"
                    checked={restoreLeadsEnabled}
                    onCheckedChange={(v) => setRestoreLeadsEnabled(!!v)}
                  />
                  <Label htmlFor="restoreLeads" className="text-sm">
                    Leads ({parsedBackup.leads.length.toLocaleString()} records)
                  </Label>
                </div>

                {parsedBackup.email_verification_cache && parsedBackup.email_verification_cache.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="restoreCache"
                      checked={restoreCacheEnabled}
                      onCheckedChange={(v) => setRestoreCacheEnabled(!!v)}
                    />
                    <Label htmlFor="restoreCache" className="text-sm">
                      Email Verification Cache ({parsedBackup.email_verification_cache.length.toLocaleString()} records)
                    </Label>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <p className="text-sm font-medium text-foreground">Restore mode:</p>
                  <RadioGroup value={restoreMode} onValueChange={(v) => setRestoreMode(v as "overwrite" | "merge")}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="overwrite" id="modeOverwrite" />
                      <Label htmlFor="modeOverwrite" className="text-sm">
                        Overwrite — Replace all current data with backup
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="merge" id="modeMerge" />
                      <Label htmlFor="modeMerge" className="text-sm">
                        Merge — Add backup leads without deleting existing (duplicates skipped by email)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Warning and Confirmation */}
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-3">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ {restoreMode === "overwrite"
                    ? "WARNING: This will overwrite ALL current leads data. This cannot be undone."
                    : "This will add backup leads to your existing data. Duplicates will be skipped."}
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Type RESTORE to confirm:</p>
                  <Input
                    value={fileRestoreInput}
                    onChange={e => setFileRestoreInput(e.target.value)}
                    placeholder="RESTORE"
                    className="max-w-[200px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={clearUpload}>Cancel</Button>
                  <Button
                    variant="destructive"
                    disabled={fileRestoreInput !== "RESTORE" || (!restoreLeadsEnabled && !restoreCacheEnabled)}
                    onClick={handleFileRestore}
                  >
                    <Upload className="h-4 w-4" /> Restore Now
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Backup Settings Card ──────────────────────── */}
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

      {/* ─── Email Backup Card ──────────────────────────── */}
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
          <Button variant="outline" size="sm" onClick={sendTestEmail} disabled={sendingTestEmail || !smtpConfigured}>
            {sendingTestEmail ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Test Backup Now
          </Button>
          {!API_URL && <p className="text-xs text-muted-foreground">Set VITE_API_URL to enable server-side email backup</p>}
        </CardContent>
      </Card>

      {/* ─── Google Drive Backup Card ──────────────────── */}
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
                Backups automatically upload to "NH Production House Backups" folder.
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
                Connect Google Drive to automatically upload weekly backups.
              </p>
              <Button variant="outline" size="sm" onClick={connectGoogleDrive}>
                <HardDrive className="h-3.5 w-3.5" /> Connect Google Drive
              </Button>
              <p className="text-xs text-muted-foreground">Requires Google OAuth setup. See SETUP_GUIDE.md.</p>
            </>
          )}
          {!API_URL && <p className="text-xs text-muted-foreground">Set VITE_API_URL to enable Google Drive backup</p>}
        </CardContent>
      </Card>

      {/* ─── Stored Backups List ────────────────────────── */}
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
                    <Button variant="outline" size="sm" onClick={() => { setRestoreTarget(b); setRestoreInput(""); setRestoreMode("overwrite"); }}>
                      <Upload className="h-3.5 w-3.5" /> Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Stored Backup Restore Modal ───────────────── */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setRestoreTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-foreground">⚠️ Restore Backup</h3>
            <p className="text-sm text-muted-foreground">
              Backup: {new Date(restoreTarget.createdAt).toLocaleString()} · {restoreTarget.recordCount} leads
            </p>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Restore mode:</p>
              <RadioGroup value={restoreMode} onValueChange={(v) => setRestoreMode(v as "overwrite" | "merge")}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="overwrite" id="storedOverwrite" />
                  <Label htmlFor="storedOverwrite" className="text-sm">Overwrite all current data</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="merge" id="storedMerge" />
                  <Label htmlFor="storedMerge" className="text-sm">Merge (skip duplicates by email)</Label>
                </div>
              </RadioGroup>
            </div>

            <p className="text-sm text-destructive font-medium">
              {restoreMode === "overwrite"
                ? "This will OVERWRITE all current leads. This cannot be undone."
                : "This will add backup leads to existing data."
              }
            </p>
            <p className="text-sm font-medium text-foreground">Type RESTORE to confirm</p>
            <Input value={restoreInput} onChange={e => setRestoreInput(e.target.value)} placeholder="RESTORE" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRestoreTarget(null)}>Cancel</Button>
              <Button variant="destructive" disabled={restoreInput !== "RESTORE"} onClick={handleStoredRestore}>
                Confirm Restore
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Restore Progress Dialog ───────────────────── */}
      <Dialog open={restoreProgress.status === "running" || restoreProgress.status === "complete" || restoreProgress.status === "error"} onOpenChange={() => {
        if (restoreProgress.status !== "running") closeProgressDialog();
      }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={e => { if (restoreProgress.status === "running") e.preventDefault(); }}>
          {restoreProgress.status === "running" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Restoring Backup...
                </DialogTitle>
                <DialogDescription>{restoreProgress.step}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <Progress value={progressPercent} className="h-3" />
                <p className="text-sm text-muted-foreground text-center">
                  {restoreProgress.current.toLocaleString()} / {restoreProgress.total.toLocaleString()} leads
                </p>
                <p className="text-xs text-muted-foreground text-center">Please do not close this window</p>
              </div>
            </>
          )}

          {restoreProgress.status === "complete" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Restore Complete!
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <p className="text-sm text-foreground">
                  <strong>{(restoreProgress.restored ?? 0).toLocaleString()}</strong> leads restored
                </p>
                {(restoreProgress.skipped ?? 0) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {restoreProgress.skipped?.toLocaleString()} leads skipped (already existed)
                  </p>
                )}
                {restoreProgress.backupDate && restoreProgress.backupDate !== "Unknown" && (
                  <p className="text-sm text-muted-foreground">
                    Restored from backup: {new Date(restoreProgress.backupDate).toLocaleString()}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeProgressDialog}>Close</Button>
                <Button onClick={() => { closeProgressDialog(); window.location.reload(); }}>
                  <ArrowRight className="h-4 w-4" /> Go to Leads
                </Button>
              </DialogFooter>
            </>
          )}

          {restoreProgress.status === "error" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <X className="h-5 w-5" />
                  Restore Failed
                </DialogTitle>
                <DialogDescription>{restoreProgress.errorMessage}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={closeProgressDialog}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
