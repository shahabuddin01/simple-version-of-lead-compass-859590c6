import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, X, RefreshCw, Wifi, WifiOff, Clock, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  loadCRMConfig, saveCRMConfig, testCRMConnection,
  fetchAllCRMLeadsPaginated, fetchCRMIndustries, fetchCRMCompanies,
  mapCRMLeadToLocalLead, CRMConnectionConfig, CRMLeadFilters, CRMLead,
} from "@/services/crmApi";
import { Lead } from "@/types/lead";

interface CRMConnectionSettingsProps {
  onImportLeads?: (leads: Omit<Lead, "id" | "dateAdded">[], updateExisting: boolean) => void;
}

export function CRMConnectionSettings({ onImportLeads }: CRMConnectionSettingsProps) {
  const [config, setConfig] = useState<CRMConnectionConfig>(loadCRMConfig);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; count: number; error?: string } | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ fetched: 0, total: 0 });

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFilters, setImportFilters] = useState<CRMLeadFilters>({
    activeOnly: true, verifiedOnly: true,
  });
  const [importPreview, setImportPreview] = useState<{ count: number; loading: boolean }>({ count: 0, loading: false });
  const [industries, setIndustries] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const updateConfig = (patch: Partial<CRMConnectionConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveCRMConfig(next);
  };

  const handleTestConnection = async () => {
    if (!config.apiUrl || !config.apiKey) {
      toast.error("Enter both API URL and API Key first.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testCRMConnection(config.apiUrl, config.apiKey);
      setTestResult(result);
      if (result.success) {
        updateConfig({ isConnected: true });
        toast.success(`Connected — ${result.count} leads available`);
      } else {
        updateConfig({ isConnected: false });
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (err: any) {
      setTestResult({ success: false, count: 0, error: err.message });
      toast.error("Connection test failed");
    }
    setTesting(false);
  };

  const handleSyncNow = async () => {
    if (!config.isConnected) {
      toast.error("Test connection first.");
      return;
    }
    setSyncing(true);
    setSyncProgress({ fetched: 0, total: 0 });
    try {
      const leads = await fetchAllCRMLeadsPaginated(
        config,
        { activeOnly: true },
        (fetched, total) => setSyncProgress({ fetched, total })
      );
      const mapped = leads.map(mapCRMLeadToLocalLead);
      if (onImportLeads) {
        onImportLeads(mapped as any, true);
      }
      updateConfig({ lastSyncAt: new Date().toISOString(), lastSyncCount: leads.length });
      toast.success(`Sync complete — ${leads.length} leads imported`);
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    }
    setSyncing(false);
  };

  // Load industries/companies when import modal opens
  useEffect(() => {
    if (!showImportModal || !config.isConnected) return;
    setLoadingMeta(true);
    Promise.all([
      fetchCRMIndustries(config).catch(() => []),
      fetchCRMCompanies(config).catch(() => []),
    ]).then(([ind, comp]) => {
      setIndustries(ind);
      setCompanies(comp);
      setLoadingMeta(false);
    });
  }, [showImportModal, config.isConnected]);

  // Preview count when filters change
  useEffect(() => {
    if (!showImportModal || !config.isConnected) return;
    setImportPreview({ count: 0, loading: true });
    const timeout = setTimeout(async () => {
      try {
        const { fetchCRMLeads } = await import("@/services/crmApi");
        const { total } = await fetchCRMLeads(config, { ...importFilters, limit: 1, offset: 0 });
        setImportPreview({ count: total, loading: false });
      } catch {
        setImportPreview({ count: 0, loading: false });
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [showImportModal, importFilters, config]);

  const handleFilteredImport = async () => {
    setSyncing(true);
    setSyncProgress({ fetched: 0, total: 0 });
    try {
      const leads = await fetchAllCRMLeadsPaginated(
        config,
        importFilters,
        (fetched, total) => setSyncProgress({ fetched, total })
      );
      const mapped = leads.map(mapCRMLeadToLocalLead);
      if (onImportLeads) {
        onImportLeads(mapped as any, true);
      }
      updateConfig({ lastSyncAt: new Date().toISOString(), lastSyncCount: leads.length });
      toast.success(`Import complete — ${leads.length} leads imported`);
      setShowImportModal(false);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    }
    setSyncing(false);
  };

  const maskedKey = config.apiKey
    ? config.apiKey.slice(0, 12) + "••••••••••••••••"
    : "";

  const SYNC_INTERVALS = [
    { value: "1hr", label: "Every hour" },
    { value: "6hr", label: "Every 6 hours" },
    { value: "24hr", label: "Every 24 hours" },
    { value: "weekly", label: "Weekly" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">CRM Connection</h2>
        <p className="text-sm text-muted-foreground">
          Connect to an external Lead CRM to fetch and sync leads via REST API
        </p>
      </div>

      {/* Connection Config */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">API Configuration</h3>
          {config.isConnected ? (
            <Badge className="bg-green-500/15 text-green-600 text-[10px]">
              <Wifi className="h-3 w-3 mr-1" /> Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-[10px]">
              <WifiOff className="h-3 w-3 mr-1" /> Not Connected
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">CRM API Base URL</label>
            <input
              value={config.apiUrl}
              onChange={(e) => updateConfig({ apiUrl: e.target.value, isConnected: false })}
              placeholder="https://[project-ref].supabase.co/rest/v1"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">CRM API Key (Read Only recommended)</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={config.apiKey}
                onChange={(e) => updateConfig({ apiKey: e.target.value, isConnected: false })}
                placeholder="nsp_live_..."
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="rounded-md p-2 hover:bg-accent transition-colors"
              >
                {showKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testing || !config.apiUrl || !config.apiKey}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            {testing ? "Testing..." : "Test Connection"}
          </button>

          {testResult && (
            <span className={`flex items-center gap-1 text-xs font-medium ${testResult.success ? "text-green-600" : "text-destructive"}`}>
              {testResult.success ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {testResult.success
                ? `Connected — ${testResult.count} leads available`
                : testResult.error}
            </span>
          )}
        </div>
      </div>

      {/* Sync */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Sync Leads</h3>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncNow}
            disabled={!config.isConnected || syncing}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {syncing ? "Syncing..." : "Sync Now"}
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            disabled={!config.isConnected}
            className="flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            Import from CRM with Filters
          </button>
        </div>

        {syncing && (
          <div className="space-y-2">
            <Progress value={syncProgress.total > 0 ? (syncProgress.fetched / syncProgress.total) * 100 : 0} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Syncing... {syncProgress.fetched}/{syncProgress.total} leads
            </p>
          </div>
        )}

        {config.lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Last sync: {new Date(config.lastSyncAt).toLocaleString()} — {config.lastSyncCount} leads
          </p>
        )}

        {/* Auto-sync */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateConfig({ autoSyncEnabled: !config.autoSyncEnabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${config.autoSyncEnabled ? "bg-green-500" : "bg-muted-foreground/30"}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${config.autoSyncEnabled ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className="text-xs text-foreground font-medium">Auto sync every:</span>
          </div>
          <select
            value={config.autoSyncInterval}
            onChange={(e) => updateConfig({ autoSyncInterval: e.target.value as any })}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SYNC_INTERVALS.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => !syncing && setShowImportModal(false)}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Import from CRM</h3>
              <button onClick={() => !syncing && setShowImportModal(false)} className="rounded p-1 hover:bg-accent">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Select filters to narrow down which leads to import from the CRM.
            </p>

            <div className="space-y-3">
              {/* Toggle filters */}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={importFilters.activeOnly ?? true}
                  onChange={(e) => setImportFilters({ ...importFilters, activeOnly: e.target.checked })}
                  className="rounded border-input"
                />
                Active leads only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={importFilters.verifiedOnly ?? true}
                  onChange={(e) => setImportFilters({ ...importFilters, verifiedOnly: e.target.checked })}
                  className="rounded border-input"
                />
                Verified emails only
              </label>

              {/* Industry */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Industry</label>
                <select
                  value={importFilters.industry || ""}
                  onChange={(e) => setImportFilters({ ...importFilters, industry: e.target.value || undefined })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All industries</option>
                  {industries.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* Company */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Company</label>
                <select
                  value={importFilters.company || ""}
                  onChange={(e) => setImportFilters({ ...importFilters, company: e.target.value || undefined })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All companies</option>
                  {companies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select
                  value={importFilters.status || ""}
                  onChange={(e) => setImportFilters({ ...importFilters, status: e.target.value || undefined })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All statuses</option>
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="CONVERTED">Converted</option>
                </select>
              </div>

              {/* ESP */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">ESP</label>
                <select
                  value={importFilters.esp || ""}
                  onChange={(e) => setImportFilters({ ...importFilters, esp: e.target.value || undefined })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All ESPs</option>
                  <option value="Google Workspace">Google Workspace</option>
                  <option value="Microsoft 365">Microsoft 365</option>
                  <option value="Google">Google</option>
                  <option value="Yahoo">Yahoo</option>
                </select>
              </div>

              {/* Since */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Added after</label>
                <input
                  type="date"
                  value={importFilters.since?.split("T")[0] || ""}
                  onChange={(e) => setImportFilters({ ...importFilters, since: e.target.value ? `${e.target.value}T00:00:00Z` : undefined })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-md bg-muted p-3">
              {importPreview.loading || loadingMeta ? (
                <p className="text-xs text-muted-foreground">Loading preview...</p>
              ) : (
                <p className="text-sm font-medium text-foreground">
                  This will import <span className="text-primary">{importPreview.count}</span> leads matching your filters.
                </p>
              )}
            </div>

            {syncing && (
              <div className="space-y-2">
                <Progress value={syncProgress.total > 0 ? (syncProgress.fetched / syncProgress.total) * 100 : 0} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Importing... {syncProgress.fetched}/{syncProgress.total} leads
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                disabled={syncing}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFilteredImport}
                disabled={syncing || importPreview.count === 0}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {syncing ? "Importing..." : `Import ${importPreview.count} Leads`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
