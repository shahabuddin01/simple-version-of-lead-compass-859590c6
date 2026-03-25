import { useState, useEffect } from "react";
import { Zap, Mail, ExternalLink, Code2, Terminal, GitBranch, Workflow, Plus, Copy, Check, ChevronDown, X, Link2, Wifi, WifiOff, Eye, EyeOff, RefreshCw, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  loadCRMConfig, saveCRMConfig, testCRMConnection,
  fetchAllCRMLeadsPaginated, fetchCRMIndustries, fetchCRMCompanies,
  mapCRMLeadToLocalLead, CRMConnectionConfig, CRMLeadFilters,
} from "@/services/crmApi";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1500); };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-accent transition-colors">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="rounded-md border border-border bg-muted/50 p-3 text-xs overflow-x-auto font-mono"><code>{code}</code></pre>
      <div className="absolute top-2 right-2"><CopyBtn text={code} /></div>
    </div>
  );
}

function IntegrationCard({ title, icon, iconColor, description, badge, children }: {
  title: string; icon: React.ReactNode; iconColor: string; description: string; badge?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden transition-shadow" id={`card-${title.toLowerCase().replace(/[\s/\.]+/g, "-")}`}>
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${iconColor}`}>{icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">{title}</CardTitle>
                {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Ready to connect</Badge>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
      </CardHeader>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <CardContent className="pt-0 space-y-3 border-t border-border pt-4">{children}</CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

const CUSTOM_INTEGRATIONS_KEY = "nhproductionhouse_custom_integrations";

interface CustomIntegration {
  id: string;
  name: string;
  type: string;
  url: string;
  notes: string;
}

function loadCustomIntegrations(): CustomIntegration[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_INTEGRATIONS_KEY) || "[]"); } catch { return []; }
}

// ---- CRM Connection Card (moved from sidebar) ----
function CRMConnectionCard() {
  const [config, setConfig] = useState<CRMConnectionConfig>(loadCRMConfig);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; count: number; error?: string } | null>(null);
  const [open, setOpen] = useState(false);

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

  const maskedKey = config.apiKey
    ? config.apiKey.slice(0, 12) + "••••••••••••••••"
    : "";

  return (
    <Card className="overflow-hidden transition-shadow" id="card-crm-connection">
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Wifi className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">External CRM Connection</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Sync leads from another CRM instance via REST API</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {config.isConnected ? (
              <Badge className="bg-green-500/15 text-green-700 text-[10px]"><Wifi className="h-3 w-3 mr-1" /> Connected</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[10px]"><WifiOff className="h-3 w-3 mr-1" /> Not Connected</Badge>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
      </CardHeader>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <CardContent className="pt-0 space-y-4 border-t border-border pt-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">CRM API Base URL</label>
                <Input
                  value={config.apiUrl}
                  onChange={(e) => updateConfig({ apiUrl: e.target.value, isConnected: false })}
                  placeholder="https://yourdomain.com/backend/api"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">API Key (Read Only recommended)</label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={config.apiKey}
                    onChange={(e) => updateConfig({ apiKey: e.target.value, isConnected: false })}
                    placeholder="nsp_live_..."
                    className="font-mono text-xs"
                  />
                  <button onClick={() => setShowKey(!showKey)} className="rounded-md p-2 hover:bg-accent transition-colors">
                    {showKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={handleTestConnection} disabled={testing || !config.apiUrl || !config.apiKey}>
                  {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                  {testing ? "Testing..." : "Test Connection"}
                </Button>
                {testResult && (
                  <span className={`flex items-center gap-1 text-xs font-medium ${testResult.success ? "text-green-600" : "text-destructive"}`}>
                    {testResult.success ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {testResult.success ? `${testResult.count} leads available` : testResult.error}
                  </span>
                )}
              </div>
              {config.lastSyncAt && (
                <p className="text-xs text-muted-foreground">
                  Last sync: {new Date(config.lastSyncAt).toLocaleString()} — {config.lastSyncCount} leads
                </p>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function IntegrationsTab() {
  const apiUrl = import.meta.env.VITE_API_URL || "[YOUR_DOMAIN]";
  const apiBase = `${apiUrl}/backend/api`;
  const headers = `Authorization: Bearer YOUR_API_KEY\nContent-Type: application/json`;

  const [customIntegrations, setCustomIntegrations] = useState<CustomIntegration[]>(loadCustomIntegrations);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInteg, setNewInteg] = useState({ name: "", type: "Email Marketing", url: "", notes: "" });

  const addCustom = () => {
    if (!newInteg.name) { toast.error("Name is required"); return; }
    const entry: CustomIntegration = { id: crypto.randomUUID(), ...newInteg };
    const updated = [...customIntegrations, entry];
    setCustomIntegrations(updated);
    localStorage.setItem(CUSTOM_INTEGRATIONS_KEY, JSON.stringify(updated));
    setNewInteg({ name: "", type: "Email Marketing", url: "", notes: "" });
    setShowAddModal(false);
    toast.success("Integration added");
  };

  const removeCustom = (id: string) => {
    const updated = customIntegrations.filter(i => i.id !== id);
    setCustomIntegrations(updated);
    localStorage.setItem(CUSTOM_INTEGRATIONS_KEY, JSON.stringify(updated));
    toast.success("Integration removed");
  };

  return (
    <div className="space-y-6 mt-4">
      {/* CRM Connection — moved from sidebar */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">CRM Sync</h3>
        <CRMConnectionCard />
      </section>

      {/* Email Marketing Tools */}
      <section id="card-email-tools">
        <h3 className="text-sm font-semibold text-foreground mb-3">Email Marketing Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <IntegrationCard title="Instantly AI" icon={<Zap className="h-4 w-4 text-orange-500" />} iconColor="bg-orange-500/10" badge="Popular"
            description="Import leads into Instantly campaigns">
            <p className="text-xs font-medium text-muted-foreground">Setup Guide:</p>
            <CodeBlock code={`Base URL: ${apiBase}\nEndpoint: /leads\n\nHeaders:\n  ${headers}\n\nFilter:\n  ?work_email_verified=true&is_active=true&limit=100`} />
          </IntegrationCard>

          <IntegrationCard title="Smartleads AI" icon={<Mail className="h-4 w-4 text-blue-500" />} iconColor="bg-blue-500/10"
            description="Multi-email campaign support">
            <p className="text-xs font-medium text-muted-foreground">Setup Guide:</p>
            <CodeBlock code={`GET ${apiBase}/leads\n  ?work_email_verified=true&is_active=true\n\nHeaders:\n  ${headers}`} />
          </IntegrationCard>

          <IntegrationCard title="Manyreach" icon={<ExternalLink className="h-4 w-4 text-green-500" />} iconColor="bg-green-500/10"
            description="Active verified leads with incremental sync">
            <p className="text-xs font-medium text-muted-foreground">Setup Guide:</p>
            <CodeBlock code={`GET ${apiBase}/leads\n  ?is_active=true&work_email_verified=true\n  &order=created_at&dir=desc\n\nHeaders:\n  ${headers}`} />
          </IntegrationCard>

          {!showAddModal ? (
            <Card className="border-dashed cursor-pointer hover:bg-accent/50 transition-colors flex items-center justify-center min-h-[80px]" onClick={() => setShowAddModal(true)}>
              <div className="flex items-center gap-2 text-muted-foreground py-6">
                <Plus className="h-4 w-4" /> <span className="text-sm">Add Custom Tool</span>
              </div>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Input value={newInteg.name} onChange={e => setNewInteg({ ...newInteg, name: e.target.value })} placeholder="Integration name" />
                <select value={newInteg.type} onChange={e => setNewInteg({ ...newInteg, type: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option>Email Marketing</option><option>IDE</option><option>Automation</option><option>Other</option>
                </select>
                <Input value={newInteg.url} onChange={e => setNewInteg({ ...newInteg, url: e.target.value })} placeholder="Connection URL (optional)" />
                <Input value={newInteg.notes} onChange={e => setNewInteg({ ...newInteg, notes: e.target.value })} placeholder="Notes (optional)" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={addCustom}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* IDE & AI Tools */}
      <section id="card-ide-tools">
        <h3 className="text-sm font-semibold text-foreground mb-3">IDE & AI Coding Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <IntegrationCard title="Claude Code" icon={<Terminal className="h-4 w-4 text-orange-500" />} iconColor="bg-orange-500/10" badge="Recommended"
            description="Connect via REST API to CRM backend">
            <CodeBlock code={`const API_URL = "${apiBase}";\nconst TOKEN = "your_session_token";\n\nconst res = await fetch(API_URL + "/leads?limit=100", {\n  headers: { "Authorization": "Bearer " + TOKEN }\n});\nconst leads = await res.json();`} />
          </IntegrationCard>

          <IntegrationCard title="Cursor IDE" icon={<Code2 className="h-4 w-4 text-purple-500" />} iconColor="bg-purple-500/10"
            description="Use CRM data via REST API">
            <CodeBlock code={`API Base URL: ${apiBase}\n\nconst res = await fetch("${apiBase}/leads", {\n  headers: { Authorization: "Bearer YOUR_TOKEN" }\n});\nconst leads = await res.json();`} />
          </IntegrationCard>

          <IntegrationCard title="n8n / Make.com" icon={<Workflow className="h-4 w-4 text-green-500" />} iconColor="bg-green-500/10"
            description="Automate workflows between CRM and tools">
            <CodeBlock code={`HTTP Request Node:\n  Method: GET\n  URL: ${apiBase}/leads\n  Headers:\n    Authorization: Bearer YOUR_TOKEN`} />
          </IntegrationCard>

          <IntegrationCard title="VS Code + REST Client" icon={<GitBranch className="h-4 w-4 text-blue-500" />} iconColor="bg-blue-500/10"
            description="Use .http files for API testing">
            <CodeBlock code={`### Get All Leads\nGET ${apiBase}/leads\nAuthorization: Bearer YOUR_TOKEN\n\n### Get Active Leads\nGET ${apiBase}/leads?is_active=true\nAuthorization: Bearer YOUR_TOKEN`} />
          </IntegrationCard>
        </div>
      </section>

      {/* Custom Integrations */}
      {customIntegrations.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Custom Integrations</h3>
          <div className="space-y-2">
            {customIntegrations.map(ci => (
              <Card key={ci.id}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{ci.name}</p>
                    <p className="text-xs text-muted-foreground">{ci.type}{ci.url ? ` · ${ci.url}` : ""}</p>
                  </div>
                  <button onClick={() => removeCustom(ci.id)} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4 text-muted-foreground" /></button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Billing CRM Placeholder */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">Billing CRM</h3>
        <Card className="border-dashed">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Billing & Invoice CRM</p>
                <p className="text-xs text-muted-foreground mt-0.5">Connect your future billing CRM to access leads via API</p>
                <Badge variant="outline" className="text-[10px] mt-2">Coming Soon</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
