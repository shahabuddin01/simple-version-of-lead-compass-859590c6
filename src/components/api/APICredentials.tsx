import { useState } from "react";
import { Eye, EyeOff, Copy, RefreshCw, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const STORAGE_KEY = "nhproductionhouse_api_credentials";
const ORIGINS_KEY = "nhproductionhouse_api_origins";
const API_CONFIG_KEY = "nhproductionhouse_api_config";

type APIScope = "full" | "read_only" | "read_update_status";

interface APIConfig {
  apiKey: string;
  isActive: boolean;
  allowedOrigins: string[];
  createdAt: string;
  lastUsedAt: string | null;
  scope: APIScope;
}

interface AllowedOrigin {
  id: string;
  origin_url: string;
  label: string;
  added_at: string;
  is_active: boolean;
}

interface CustomAPIConfig {
  customBaseUrl: string;
  customKeyHeader: string;
}

function generateAPIKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "nsp_live_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function loadConfig(): APIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(atob(raw));
      return { ...parsed, scope: parsed.scope || "full" };
    }
  } catch {}
  const config: APIConfig = {
    apiKey: generateAPIKey(),
    isActive: true,
    allowedOrigins: [],
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    scope: "full",
  };
  localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify(config)));
  return config;
}

function saveConfig(config: APIConfig) {
  localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify(config)));
}

function loadOrigins(): AllowedOrigin[] {
  try { return JSON.parse(localStorage.getItem(ORIGINS_KEY) || "[]"); } catch { return []; }
}
function saveOrigins(o: AllowedOrigin[]) { localStorage.setItem(ORIGINS_KEY, JSON.stringify(o)); }

function loadAPIConfig(): CustomAPIConfig {
  try { return JSON.parse(localStorage.getItem(API_CONFIG_KEY) || '{"customBaseUrl":"","customKeyHeader":"apikey"}'); } catch { return { customBaseUrl: "", customKeyHeader: "apikey" }; }
}
function saveAPIConfig(c: CustomAPIConfig) { localStorage.setItem(API_CONFIG_KEY, JSON.stringify(c)); }

const SCOPE_LABELS: Record<APIScope, { label: string; color: string; desc: string }> = {
  full: { label: "Full Access", color: "bg-green-500/15 text-green-600", desc: "All endpoints — for internal use" },
  read_only: { label: "Read Only", color: "bg-blue-500/15 text-blue-600", desc: "Can only GET /leads — for email marketing tools" },
  read_update_status: { label: "Read + Update Status", color: "bg-amber-500/15 text-amber-600", desc: "Read leads and update status field only" },
};

export function APICredentials() {
  const [config, setConfig] = useState<APIConfig>(loadConfig);
  const [showKey, setShowKey] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [newOrigin, setNewOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Allowed Origins (domain manager)
  const [origins, setOrigins] = useState<AllowedOrigin[]>(loadOrigins);
  const [newDomain, setNewDomain] = useState("");
  const [newDomainLabel, setNewDomainLabel] = useState("");

  // Custom API config
  const [apiConfig, setApiConfig] = useState<CustomAPIConfig>(loadAPIConfig);

  const update = (patch: Partial<APIConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveConfig(next);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(null), 2000);
  };

  const regenerate = () => {
    update({ apiKey: generateAPIKey(), createdAt: new Date().toISOString(), lastUsedAt: null });
    setConfirmRegen(false);
    toast.success("API key regenerated");
  };

  const addOrigin = () => {
    const trimmed = newOrigin.trim();
    if (!trimmed) return;
    if (config.allowedOrigins.includes(trimmed)) {
      toast.error("Origin already added");
      return;
    }
    update({ allowedOrigins: [...config.allowedOrigins, trimmed] });
    setNewOrigin("");
    toast.success("Origin added");
  };

  const removeOrigin = (origin: string) => {
    update({ allowedOrigins: config.allowedOrigins.filter(o => o !== origin) });
    toast.success("Origin removed");
  };

  // Domain manager
  const addDomain = () => {
    const url = newDomain.trim();
    if (!url) return;
    if (origins.some(o => o.origin_url === url)) { toast.error("Domain already added"); return; }
    const entry: AllowedOrigin = { id: crypto.randomUUID(), origin_url: url, label: newDomainLabel.trim() || url, added_at: new Date().toISOString(), is_active: true };
    const updated = [...origins, entry];
    setOrigins(updated);
    saveOrigins(updated);
    setNewDomain("");
    setNewDomainLabel("");
    toast.success("Domain added");
  };

  const toggleDomain = (id: string) => {
    const updated = origins.map(o => o.id === id ? { ...o, is_active: !o.is_active } : o);
    setOrigins(updated);
    saveOrigins(updated);
  };

  const removeDomain = (id: string) => {
    const updated = origins.filter(o => o.id !== id);
    setOrigins(updated);
    saveOrigins(updated);
    toast.success("Domain removed");
  };

  const saveCustomConfig = () => {
    saveAPIConfig(apiConfig);
    toast.success("Custom API configuration saved");
  };

  const baseUrl = window.location.origin;
  const maskedKey = config.apiKey.slice(0, 9) + "••••••••••••••••••••••••";

  return (
    <div className="space-y-6 mt-4">
      {/* API Key */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">API Key</h3>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono text-foreground">
            {showKey ? config.apiKey : maskedKey}
          </code>
          <button onClick={() => setShowKey(!showKey)} className="rounded-md p-2 hover:bg-accent transition-colors" title={showKey ? "Hide" : "Reveal"}>
            {showKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          </button>
          <button onClick={() => copyText(config.apiKey, "API Key")} className="rounded-md p-2 hover:bg-accent transition-colors">
            {copied === "API Key" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>

        {/* Scope */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">API Key Scope</p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(SCOPE_LABELS) as APIScope[]).map(scope => (
              <button
                key={scope}
                onClick={() => update({ scope })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${config.scope === scope ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}
              >
                {SCOPE_LABELS[scope].label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{SCOPE_LABELS[config.scope].desc}</p>
          <Badge className={`text-[10px] ${SCOPE_LABELS[config.scope].color}`}>
            {SCOPE_LABELS[config.scope].label}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {!confirmRegen ? (
            <button onClick={() => setConfirmRegen(true)} className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <RefreshCw className="h-3 w-3" /> Regenerate Key
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive">The old key will stop working. Continue?</span>
              <button onClick={regenerate} className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground">Yes, Regenerate</button>
              <button onClick={() => setConfirmRegen(false)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">Cancel</button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Created: {new Date(config.createdAt).toLocaleString()}</p>
      </div>

      {/* Base URL */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Base URL</h3>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono text-foreground">{baseUrl}/api/v1</code>
          <button onClick={() => copyText(`${baseUrl}/api/v1`, "Base URL")} className="rounded-md p-2 hover:bg-accent transition-colors">
            {copied === "Base URL" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* API Status */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">API Status</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => update({ isActive: !config.isActive })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${config.isActive ? "bg-green-500" : "bg-muted-foreground/30"}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${config.isActive ? "translate-x-5" : "translate-x-0"}`} />
          </button>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.isActive ? "bg-green-500/15 text-green-600" : "bg-destructive/15 text-destructive"}`}>
            {config.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        {!config.isActive && <p className="text-xs text-muted-foreground">All API requests will return 403 Forbidden while inactive.</p>}
      </div>

      {/* Allowed Origins (CORS) */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Allowed Origins (CORS)</h3>
        <div className="flex items-center gap-2">
          <input
            value={newOrigin}
            onChange={e => setNewOrigin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addOrigin()}
            placeholder="https://billing-crm.com"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button onClick={addOrigin} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {config.allowedOrigins.length === 0 ? (
          <p className="text-xs text-muted-foreground">No origins configured. All origins will be allowed.</p>
        ) : (
          <div className="space-y-1">
            {config.allowedOrigins.map(origin => (
              <div key={origin} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5">
                <code className="text-xs font-mono text-foreground">{origin}</code>
                <button onClick={() => removeOrigin(origin)} className="rounded p-0.5 hover:bg-accent transition-colors">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Allowed Domains & Origins (persistent manager) */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Allowed Domains & Origins</h3>
        <p className="text-xs text-muted-foreground">Add any domain that is allowed to access this CRM's API or connect via integration.</p>
        <div className="flex items-center gap-2">
          <input
            value={newDomainLabel}
            onChange={e => setNewDomainLabel(e.target.value)}
            placeholder="Label (e.g. Email Marketing Tool)"
            className="w-48 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addDomain()}
            placeholder="https://yoursoftware.com"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button onClick={addDomain} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {origins.length === 0 ? (
          <p className="text-xs text-muted-foreground">No domains configured yet.</p>
        ) : (
          <div className="space-y-1">
            {origins.map(o => (
              <div key={o.id} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5">
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">{o.label}</p>
                  <code className="text-[11px] font-mono text-muted-foreground">{o.origin_url}</code>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleDomain(o.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${o.is_active ? "bg-green-500" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${o.is_active ? "translate-x-4" : "translate-x-0"}`} />
                  </button>
                  <button onClick={() => removeDomain(o.id)} className="rounded p-0.5 hover:bg-accent transition-colors">
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom API Endpoints Override */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Custom API Endpoints (Optional)</h3>
        <p className="text-xs text-muted-foreground">Override the default Supabase URL if you use a custom API gateway.</p>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground">Custom API Base URL</label>
            <input
              value={apiConfig.customBaseUrl}
              onChange={e => setApiConfig({ ...apiConfig, customBaseUrl: e.target.value })}
              placeholder="https://api.yourdomain.com/v1"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Custom API Key Header Name</label>
            <input
              value={apiConfig.customKeyHeader}
              onChange={e => setApiConfig({ ...apiConfig, customKeyHeader: e.target.value })}
              placeholder="apikey"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button onClick={saveCustomConfig} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
