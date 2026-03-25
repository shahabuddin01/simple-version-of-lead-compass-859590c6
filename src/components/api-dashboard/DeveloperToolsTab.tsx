import { useState, useMemo } from "react";
import { Copy, Check, Eye, EyeOff, Plus, X, Trash2, TestTube, Webhook, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { APIDocumentation } from "@/components/api/APIDocumentation";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1500); };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-accent transition-colors">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ---- Live API Tester ----
function LiveAPITester() {
  const apiUrl = import.meta.env.VITE_API_URL || "[YOUR_DOMAIN]";
  const apiBase = `${apiUrl}/backend/api`;
  const [activeOnly, setActiveOnly] = useState(true);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [industry, setIndustry] = useState("");
  const [esp, setEsp] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(10);
  const [testResult, setTestResult] = useState<{ count: number; preview: any[] } | null>(null);
  const [testing, setTesting] = useState(false);

  const generatedUrl = useMemo(() => {
    const params: string[] = [];
    if (activeOnly) params.push("is_active=true");
    if (verifiedOnly) params.push("work_email_verified=true");
    if (industry) params.push(`industry=${industry}`);
    if (esp) params.push(`work_esp=${esp}`);
    if (status) params.push(`status=${status}`);
    params.push(`limit=${limit}`, "offset=0", "order=created_at", "dir=desc");
    return `${apiBase}/leads?${params.join("&")}`;
  }, [apiBase, activeOnly, verifiedOnly, industry, esp, status, limit]);

  const runTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const token = localStorage.getItem("nhproductionhouse_api_token") || "";
      if (!import.meta.env.VITE_API_URL) { toast.error("VITE_API_URL not configured"); setTesting(false); return; }
      const res = await fetch(generatedUrl, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      const data = await res.json();
      const total = parseInt(res.headers.get("X-Total-Count") || `${data.length}`);
      setTestResult({ count: total, preview: data.slice(0, 3) });
      toast.success(`Query returned ${total} leads`);
    } catch { toast.error("API test failed"); }
    finally { setTesting(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><TestTube className="h-4 w-4" /> Live API Tester</CardTitle>
        <p className="text-xs text-muted-foreground">Build and test queries before integrating.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="rounded border-input" /> Active leads only
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} className="rounded border-input" /> Verified work email only
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-muted-foreground">Industry</label><Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. EdTech" className="mt-1" /></div>
          <div><label className="text-xs text-muted-foreground">ESP</label><Input value={esp} onChange={e => setEsp(e.target.value)} placeholder="e.g. Google Workspace" className="mt-1" /></div>
          <div><label className="text-xs text-muted-foreground">Status</label><Input value={status} onChange={e => setStatus(e.target.value)} placeholder="e.g. NEW" className="mt-1" /></div>
        </div>
        <div><label className="text-xs text-muted-foreground">Limit</label><Input type="number" value={limit} onChange={e => setLimit(Number(e.target.value) || 10)} className="mt-1 w-24" /></div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Generated URL:</p>
          <div className="relative">
            <pre className="rounded-md border border-border bg-muted/50 p-3 text-xs overflow-x-auto font-mono break-all">{generatedUrl}</pre>
            <div className="absolute top-2 right-2"><CopyBtn text={generatedUrl} /></div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={runTest} disabled={testing} size="sm">{testing ? "Testing..." : "Build & Test Query"}</Button>
          <CopyBtn text={generatedUrl} />
        </div>
        {testResult && (
          <div className="rounded-md border border-border bg-muted/50 p-3 space-y-2">
            <p className="text-xs font-medium">Results: <span className="text-primary">{testResult.count} leads</span></p>
            {testResult.preview.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Preview (first 3):</p>
                {testResult.preview.map((lead: any, i: number) => (
                  <div key={i} className="text-xs font-mono rounded bg-background px-2 py-1">{lead.name} · {lead.work_email || lead.email} · {lead.company}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Webhook Manager ----
const WEBHOOKS_KEY = "nhproductionhouse_webhooks";
const WEBHOOK_LOGS_KEY = "nhproductionhouse_webhook_logs";

interface WebhookConfig { id: string; url: string; events: string[]; secretKey: string; isActive: boolean; createdAt: string; }
interface WebhookLog { id: string; webhookId: string; event: string; status: number; sentAt: string; }
const WEBHOOK_EVENTS = ["lead.created", "lead.updated", "lead.deleted", "lead.email_verified", "backup.completed", "user.login"];

function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(() => { try { return JSON.parse(localStorage.getItem(WEBHOOKS_KEY) || "[]"); } catch { return []; } });
  const [logs] = useState<WebhookLog[]>(() => { try { return JSON.parse(localStorage.getItem(WEBHOOK_LOGS_KEY) || "[]"); } catch { return []; } });
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState("");

  const saveWebhooks = (wh: WebhookConfig[]) => { setWebhooks(wh); localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(wh)); };
  const addWebhook = () => {
    if (!newUrl) { toast.error("URL is required"); return; }
    if (newEvents.length === 0) { toast.error("Select at least one event"); return; }
    saveWebhooks([...webhooks, { id: crypto.randomUUID(), url: newUrl, events: newEvents, secretKey: newSecret, isActive: true, createdAt: new Date().toISOString() }]);
    setNewUrl(""); setNewEvents([]); setNewSecret(""); setShowAdd(false);
    toast.success("Webhook added");
  };
  const removeWebhook = (id: string) => { saveWebhooks(webhooks.filter(w => w.id !== id)); toast.success("Webhook removed"); };
  const toggleEvent = (event: string) => { setNewEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]); };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><Webhook className="h-4 w-4" /> Outgoing Webhooks</CardTitle>
        <p className="text-xs text-muted-foreground">Send real-time events to external URLs.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {webhooks.length === 0 && !showAdd && (
          <div className="rounded-md border border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">No webhooks configured yet</p>
            <p className="text-[11px] text-muted-foreground mt-1">Add a webhook to receive real-time CRM events</p>
          </div>
        )}
        {webhooks.map(wh => (
          <div key={wh.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-xs font-mono truncate">{wh.url}</p>
              <div className="flex gap-1 mt-1 flex-wrap">{wh.events.map(e => <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>)}</div>
            </div>
            <button onClick={() => removeWebhook(wh.id)} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        ))}
        {!showAdd ? (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5" /> Add Webhook</Button>
        ) : (
          <div className="space-y-3 rounded-md border border-border p-3">
            <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://yourtool.com/webhook" />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Events:</p>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map(event => (
                  <button key={event} onClick={() => toggleEvent(event)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${newEvents.includes(event) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <Input value={newSecret} onChange={e => setNewSecret(e.target.value)} placeholder="Secret key for signature (optional)" />
            <div className="flex gap-2">
              <Button size="sm" onClick={addWebhook}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {logs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Logs</p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-muted/50"><th className="px-3 py-1.5 text-left">Time</th><th className="px-3 py-1.5 text-left">Event</th><th className="px-3 py-1.5 text-left">Status</th></tr></thead>
                <tbody>
                  {logs.slice(0, 10).map(log => (
                    <tr key={log.id} className="border-t border-border">
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{new Date(log.sentAt).toLocaleString()}</td>
                      <td className="px-3 py-1.5">{log.event}</td>
                      <td className="px-3 py-1.5"><Badge variant={log.status === 200 ? "default" : "destructive"} className="text-[10px]">{log.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- Connection Strings ----
function ConnectionStrings() {
  const apiUrl = import.meta.env.VITE_API_URL || "(not configured)";
  const appUrl = import.meta.env.VITE_APP_URL || "(not configured)";
  const apiBase = `${apiUrl}/backend/api`;
  const apiKey = (() => { try { return JSON.parse(atob(localStorage.getItem("nhproductionhouse_api_credentials") || "")).apiKey || "(not set)"; } catch { return "(not set)"; } })();
  const [showApiKey, setShowApiKey] = useState(false);

  const rows = [
    { label: "API Base URL", value: apiBase, masked: false },
    { label: "CRM API Key", value: apiKey, masked: true, show: showApiKey, toggle: () => setShowApiKey(!showApiKey) },
    { label: "App URL", value: appUrl, masked: false },
    { label: "Backend URL", value: apiUrl, masked: false },
    { label: "Database", value: "MySQL via cPanel phpMyAdmin", masked: false },
  ];

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Quick Credentials</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.map(row => (
          <div key={row.label} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
              <p className="text-xs font-mono truncate">{row.masked && !row.show ? "•••••••••••••••" : row.value}</p>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {row.masked && row.toggle && (
                <button onClick={row.toggle} className="rounded p-1 hover:bg-accent">
                  {row.show ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              )}
              <CopyBtn text={row.value} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function DeveloperToolsTab() {
  const [section, setSection] = useState<"docs" | "tester" | "webhooks" | "strings">("docs");

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-1 flex-wrap">
        {([
          ["docs", "API Docs", <BookOpen className="h-3.5 w-3.5" key="d" />],
          ["tester", "Live Tester", <TestTube className="h-3.5 w-3.5" key="t" />],
          ["webhooks", "Webhooks", <Webhook className="h-3.5 w-3.5" key="w" />],
          ["strings", "Credentials", <Copy className="h-3.5 w-3.5" key="c" />],
        ] as [string, string, React.ReactNode][]).map(([key, label, icon]) => (
          <button key={key} onClick={() => setSection(key as any)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${section === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {section === "docs" && <APIDocumentation />}
      {section === "tester" && <LiveAPITester />}
      {section === "webhooks" && <WebhookManager />}
      {section === "strings" && <ConnectionStrings />}
    </div>
  );
}
