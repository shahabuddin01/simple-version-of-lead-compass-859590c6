import { useState } from "react";
import { Key, Eye, EyeOff, Copy, Check, RefreshCw, Globe, Plus, X, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { APIRequestLogs } from "@/components/api/APIRequestLogs";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1500); };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-xs hover:bg-accent transition-colors">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

const CRED_KEY = "nhproductionhouse_api_credentials";
const ORIGINS_KEY = "nhproductionhouse_api_origins";

function loadCredentials() {
  try { return JSON.parse(atob(localStorage.getItem(CRED_KEY) || "")); } catch { return { apiKey: "", scope: "full", isActive: false }; }
}

function saveCredentials(creds: any) {
  localStorage.setItem(CRED_KEY, btoa(JSON.stringify(creds)));
}

interface AllowedOrigin {
  id: string;
  label: string;
  domain: string;
  addedAt: string;
}

function loadOrigins(): AllowedOrigin[] {
  try { return JSON.parse(localStorage.getItem(ORIGINS_KEY) || "[]"); } catch { return []; }
}

// ---- CRM API Card ----
function CRMAPICard() {
  const [creds, setCreds] = useState(loadCredentials);
  const [showKey, setShowKey] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || "(not configured)";
  const apiBase = `${apiUrl}/backend/api`;

  const toggleActive = () => {
    const updated = { ...creds, isActive: !creds.isActive };
    setCreds(updated);
    saveCredentials(updated);
    toast.success(updated.isActive ? "API activated" : "API deactivated");
  };

  const setScope = (scope: string) => {
    const updated = { ...creds, scope };
    setCreds(updated);
    saveCredentials(updated);
    toast.success(`Scope set to ${scope}`);
  };

  const regenerateKey = () => {
    const newKey = `nsp_live_${crypto.randomUUID().replace(/-/g, "").slice(0, 32)}`;
    const updated = { ...creds, apiKey: newKey, isActive: true, createdAt: new Date().toISOString() };
    setCreds(updated);
    saveCredentials(updated);
    toast.success("New API key generated");
  };

  const maskedKey = creds.apiKey
    ? creds.apiKey.slice(0, 12) + "•".repeat(Math.max(0, creds.apiKey.length - 12))
    : "(no key)";

  const scopeOptions = [
    { value: "full", label: "Full Access", color: "bg-green-500/15 text-green-700" },
    { value: "read_only", label: "Read Only", color: "bg-blue-500/15 text-blue-700" },
    { value: "read_update_status", label: "Read + Update", color: "bg-amber-500/15 text-amber-700" },
  ];

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Key className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm">NH Production House — CRM API</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Expose your CRM data to external systems</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-xs font-medium ${creds.isActive ? "text-green-600" : "text-muted-foreground"}`}>
                <span className={`h-2 w-2 rounded-full ${creds.isActive ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                {creds.isActive ? "Active" : "Inactive"}
              </span>
              <button onClick={toggleActive}
                className={`relative h-5 w-9 rounded-full transition-colors ${creds.isActive ? "bg-green-500" : "bg-muted-foreground/30"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${creds.isActive ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">API Key</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 text-xs font-mono">
                {showKey ? creds.apiKey || "(no key)" : maskedKey}
              </code>
              <button onClick={() => setShowKey(!showKey)} className="rounded-md p-2 hover:bg-accent">
                {showKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
              {creds.apiKey && <CopyBtn text={creds.apiKey} />}
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Scope</label>
            <div className="flex gap-2 mt-1">
              {scopeOptions.map(opt => (
                <button key={opt.value} onClick={() => setScope(opt.value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                    creds.scope === opt.value
                      ? `${opt.color} border-current`
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Base URL */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Base URL</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 text-xs font-mono truncate">
                {apiBase}
              </code>
              <CopyBtn text={apiBase} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="outline" onClick={regenerateKey}>
              <RefreshCw className="h-3.5 w-3.5" /> Regenerate Key
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowLogs(!showLogs)}>
              <FileText className="h-3.5 w-3.5" /> {showLogs ? "Hide Logs" : "View Request Logs"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showLogs && <APIRequestLogs />}
    </>
  );
}

// ---- Allowed Origins Card ----
function AllowedOriginsCard() {
  const [origins, setOrigins] = useState<AllowedOrigin[]>(loadOrigins);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDomain, setNewDomain] = useState("");

  const save = (list: AllowedOrigin[]) => {
    setOrigins(list);
    localStorage.setItem(ORIGINS_KEY, JSON.stringify(list));
  };

  const addOrigin = () => {
    if (!newDomain.trim()) { toast.error("Domain is required"); return; }
    const entry: AllowedOrigin = {
      id: crypto.randomUUID(),
      label: newLabel.trim() || newDomain.trim(),
      domain: newDomain.trim(),
      addedAt: new Date().toISOString(),
    };
    save([...origins, entry]);
    setNewLabel(""); setNewDomain(""); setShowAdd(false);
    toast.success("Origin added");
  };

  const removeOrigin = (id: string) => {
    save(origins.filter(o => o.id !== id));
    toast.success("Origin removed");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
            <Globe className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-sm">Allowed Domains & CORS</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Control which domains can call your CRM API</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {origins.length === 0 && !showAdd && (
          <div className="rounded-md border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">No domains added yet</p>
            <p className="text-[11px] text-muted-foreground mt-1">Add email marketing tool or external software domains here</p>
          </div>
        )}

        {origins.map(origin => (
          <div key={origin.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-xs font-medium text-foreground">{origin.label}</p>
              <p className="text-[11px] font-mono text-muted-foreground">{origin.domain}</p>
            </div>
            <button onClick={() => removeOrigin(origin.id)} className="rounded p-1 hover:bg-accent">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ))}

        {showAdd ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (e.g. Smartleads Production)" />
            <Input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="https://app.smartleads.io" />
            <div className="flex gap-2">
              <Button size="sm" onClick={addOrigin}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Domain
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function InternalAPIsTab() {
  return (
    <div className="space-y-4 mt-4">
      <CRMAPICard />
      <AllowedOriginsCard />
    </div>
  );
}
