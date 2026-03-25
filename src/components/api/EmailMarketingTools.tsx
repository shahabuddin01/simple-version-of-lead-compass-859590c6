import { useState, useMemo } from "react";
import { ChevronDown, Copy, Check, Mail, Zap, Code2, TestTube, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-accent transition-colors">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
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

function CollapsibleIntegration({ title, icon, badge, description, children }: {
  title: string; icon: React.ReactNode; badge?: string; description: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">{icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">{title}</CardTitle>
                {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

export function EmailMarketingTools() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "[YOUR_SUPABASE_URL]";

  // Live API Tester state
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
    if (activeOnly) params.push("is_active=eq.true");
    if (verifiedOnly) params.push("work_email_verified=eq.true");
    if (industry) params.push(`industry=eq.${industry}`);
    if (esp) params.push(`work_esp=eq.${esp}`);
    if (status) params.push(`status=eq.${status}`);
    params.push(`limit=${limit}`);
    params.push("offset=0");
    params.push("order=created_at.desc");
    params.push("select=id,name,work_email,company,industry,status");
    return `${supabaseUrl}/rest/v1/leads?${params.join("&")}`;
  }, [supabaseUrl, activeOnly, verifiedOnly, industry, esp, status, limit]);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
      if (!anonKey || !import.meta.env.VITE_SUPABASE_URL) {
        toast.error("Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
        return;
      }
      const res = await fetch(generatedUrl, {
        headers: {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          Prefer: "count=exact",
        },
      });
      const data = await res.json();
      const total = parseInt(res.headers.get("content-range")?.split("/")?.[1] || `${data.length}`);
      setTestResult({ count: total, preview: data.slice(0, 3) });
      toast.success(`Query returned ${total} leads`);
    } catch (err) {
      toast.error("API test failed. Check your Supabase configuration.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Overview */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold">Connect Any Email Marketing Platform</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Access your CRM leads directly from any email marketing tool. Supports Instantly AI, Smartleads AI,
            Manyreach, Lemlist, Apollo, and any custom platform that can make HTTP requests.
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Badge variant="outline">Instantly AI</Badge>
            <Badge variant="outline">Smartleads AI</Badge>
            <Badge variant="outline">Manyreach</Badge>
            <Badge variant="outline">Lemlist</Badge>
            <Badge variant="outline">Apollo</Badge>
            <Badge variant="outline">Custom</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Instantly AI */}
      <CollapsibleIntegration title="Instantly AI" icon={<Zap className="h-4 w-4" />} badge="Popular"
        description="Import leads from your CRM into Instantly AI campaigns via REST API.">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Step 1: In Instantly AI → Leads → Import → API Import</p>
          <p className="text-xs text-muted-foreground font-medium">Step 2: Configure the API source</p>
          <CodeBlock code={`URL: ${supabaseUrl}/rest/v1/leads
Method: GET
Headers:
  Authorization: Bearer YOUR_API_KEY
  apikey: YOUR_API_KEY`} />
          <p className="text-xs text-muted-foreground font-medium">Step 3: Field mapping</p>
          <CodeBlock code={`First Name → name (split on space)
Email → work_email
Company → company
Custom fields → any additional lead fields`} />
          <p className="text-xs text-muted-foreground font-medium">Step 4: Filter to only import verified leads</p>
          <CodeBlock code={`Add to URL: ?work_email_verified=eq.true&is_active=eq.true`} />
          <p className="text-xs text-muted-foreground font-medium">Step 5: Pagination</p>
          <CodeBlock code={`Page 1: ?limit=100&offset=0
Page 2: ?limit=100&offset=100
Use Prefer: count=exact header to know total count`} />
        </div>
      </CollapsibleIntegration>

      {/* Smartleads AI */}
      <CollapsibleIntegration title="Smartleads AI" icon={<Mail className="h-4 w-4" />}
        description="Connect Smartleads to your CRM for multi-email campaigns.">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Step 1: In Smartleads → Campaigns → Upload Leads → API Source</p>
          <p className="text-xs text-muted-foreground font-medium">Step 2: API endpoint</p>
          <CodeBlock code={`GET ${supabaseUrl}/rest/v1/leads
  ?select=name,work_email,personal_email_1,company,work_phone,personal_phone_1,industry,status
  &work_email_verified=eq.true
  &is_active=eq.true
Headers:
  Authorization: Bearer YOUR_API_KEY
  apikey: YOUR_API_KEY`} />
          <p className="text-xs text-muted-foreground font-medium">Step 3: Multi-email campaigns</p>
          <CodeBlock code={`?select=name,work_email,personal_email_1,personal_email_2,company
This returns all 3 email addresses per lead —
Smartleads can attempt each in sequence.`} />
          <p className="text-xs text-muted-foreground font-medium">Step 4: Filter by industry</p>
          <CodeBlock code={`Single: &industry=eq.EdTech
Multiple: &industry=in.(EdTech,Food & Beverage)`} />
        </div>
      </CollapsibleIntegration>

      {/* Manyreach */}
      <CollapsibleIntegration title="Manyreach" icon={<ExternalLink className="h-4 w-4" />}
        description="Import active, verified leads into Manyreach with incremental sync.">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Step 1: Manyreach → Contacts → Import via API</p>
          <p className="text-xs text-muted-foreground font-medium">Step 2: Endpoint for active verified leads</p>
          <CodeBlock code={`GET ${supabaseUrl}/rest/v1/leads
  ?is_active=eq.true
  &work_email_verified=eq.true
  &select=id,name,work_email,personal_email_1,company,industry,status,work_phone
  &order=created_at.desc
Headers:
  Authorization: Bearer YOUR_API_KEY
  apikey: YOUR_API_KEY
  Prefer: count=exact`} />
          <p className="text-xs text-muted-foreground font-medium">Step 3: Incremental sync (only new leads since last import)</p>
          <CodeBlock code={`&created_at=gte.2024-01-15T00:00:00Z
Change the date to your last import date.`} />
        </div>
      </CollapsibleIntegration>

      {/* Custom */}
      <CollapsibleIntegration title="Custom / Build Your Own" icon={<Code2 className="h-4 w-4" />}
        description="Full flexible API access — use any combination of filters for your custom platform.">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Base URL</p>
          <CodeBlock code={`${supabaseUrl}/rest/v1/leads`} />

          <p className="text-xs text-muted-foreground font-medium">Available fields to select</p>
          <CodeBlock code={`id, name, position, company, industry, work_email,
work_email_verified, work_email_verification_status, work_esp,
personal_email_1, personal_email_1_verified, personal_email_1_esp,
personal_email_2, personal_email_2_verified, personal_email_2_esp,
work_phone, personal_phone_1, personal_phone_2,
status, is_active, created_at, updated_at`} />

          <p className="text-xs text-muted-foreground font-medium">PostgREST filter operators</p>
          <div className="rounded-md border border-border bg-muted/50 p-3 text-xs space-y-1">
            <p><code className="font-mono text-primary">eq</code> → equals</p>
            <p><code className="font-mono text-primary">neq</code> → not equals</p>
            <p><code className="font-mono text-primary">ilike</code> → case-insensitive contains</p>
            <p><code className="font-mono text-primary">in</code> → match any in list: <code className="font-mono">in.(val1,val2)</code></p>
            <p><code className="font-mono text-primary">gte</code> → greater than or equal</p>
            <p><code className="font-mono text-primary">lte</code> → less than or equal</p>
          </div>

          <p className="text-xs text-muted-foreground font-medium">JavaScript example with dynamic filters</p>
          <CodeBlock code={`const buildLeadsQuery = (filters) => {
  const params = new URLSearchParams()
  if (filters.industry) params.set('industry', \`eq.\${filters.industry}\`)
  if (filters.verifiedOnly) params.set('work_email_verified', 'eq.true')
  if (filters.activeOnly) params.set('is_active', 'eq.true')
  if (filters.esp) params.set('work_esp', \`eq.\${filters.esp}\`)
  params.set('limit', filters.limit || 100)
  params.set('offset', filters.offset || 0)
  params.set('order', 'created_at.desc')
  return \`\${BASE_URL}/leads?\${params.toString()}\`
}`} />
        </div>
      </CollapsibleIntegration>

      {/* Live API Tester */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TestTube className="h-4 w-4" /> Live API Tester
          </CardTitle>
          <p className="text-xs text-muted-foreground">Build and test your exact query before integrating.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="rounded border-input" />
              Active leads only
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} className="rounded border-input" />
              Verified work email only
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Industry</label>
              <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. EdTech" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ESP</label>
              <Input value={esp} onChange={e => setEsp(e.target.value)} placeholder="e.g. Google Workspace" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Input value={status} onChange={e => setStatus(e.target.value)} placeholder="e.g. NEW" className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Limit</label>
            <Input type="number" value={limit} onChange={e => setLimit(Number(e.target.value) || 10)} className="mt-1 w-24" />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Generated URL:</p>
            <div className="relative">
              <pre className="rounded-md border border-border bg-muted/50 p-3 text-xs overflow-x-auto font-mono break-all">{generatedUrl}</pre>
              <div className="absolute top-2 right-2"><CopyBtn text={generatedUrl} /></div>
            </div>
          </div>

          <Button onClick={runTest} disabled={testing} size="sm">
            {testing ? "Testing..." : "Build & Test Query"}
          </Button>

          {testResult && (
            <div className="rounded-md border border-border bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium">Results: <span className="text-primary">{testResult.count} leads</span> returned</p>
              {testResult.preview.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Preview (first 3):</p>
                  {testResult.preview.map((lead: any, i: number) => (
                    <div key={i} className="text-xs font-mono rounded bg-background px-2 py-1">
                      {lead.name} · {lead.work_email || lead.email} · {lead.company}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
