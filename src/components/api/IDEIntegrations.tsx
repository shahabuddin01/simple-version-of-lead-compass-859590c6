import { useState } from "react";
import { ChevronDown, Copy, Check, Terminal, Code2, GitBranch, Workflow, Blocks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-accent transition-colors">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CollapsibleCard({ title, icon, badge, description, children }: {
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

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="rounded-md border border-border bg-muted/50 p-3 text-xs overflow-x-auto"><code>{code}</code></pre>
      <div className="absolute top-2 right-2"><CopyBtn text={code} /></div>
    </div>
  );
}

export function IDEIntegrations() {
  const appUrl = import.meta.env.VITE_APP_URL || "(not configured)";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "[YOUR_SUPABASE_URL]";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "[YOUR_ANON_KEY]";
  const dbUrl = `postgresql://postgres:[password]@${supabaseUrl.replace("https://", "").replace(".supabase.co", "")}:5432/postgres`;

  return (
    <div className="space-y-6">
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold">Connect Your IDE or AI Agent to NH Production House CRM</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Use your CRM data directly inside your development environment or AI coding assistant.
            Automate lead management, build workflows, and query your CRM without leaving your IDE.
          </p>
          <div className="mt-3 rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
            <p><strong>CORS:</strong> Ensure your app domain and any external origins are added in your Supabase Dashboard → Auth → URL Configuration and in the Allowed Origins section of API Credentials.</p>
          </div>
        </CardContent>
      </Card>

      {/* Claude Code */}
      <CollapsibleCard title="Claude Code (Anthropic)" icon={<Terminal className="h-4 w-4" />} badge="Recommended"
        description="Connect Claude Code to your CRM via MCP (Model Context Protocol).">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Step 1: Install Claude Code CLI</p>
          <CodeBlock code="npm install -g @anthropic-ai/claude-code" />
          <p className="text-xs text-muted-foreground font-medium">Step 2: Add MCP Server to ~/.claude/config.json</p>
          <CodeBlock code={`{
  "mcpServers": {
    "lead-crm": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${dbUrl}"
      }
    }
  }
}`} />
          <p className="text-xs text-muted-foreground font-medium">Step 3: Example prompts in Claude Code</p>
          <CodeBlock code={`"Show me all new leads from the EdTech industry added this week"
"Mark all leads from 10 Minute School as contacted"
"Export leads with verified emails to a CSV"`} />
        </div>
      </CollapsibleCard>

      {/* Cursor */}
      <CollapsibleCard title="Cursor IDE" icon={<Code2 className="h-4 w-4" />}
        description="Use Cursor's AI features with your CRM data via REST API or direct database connection.">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Step 1: In Cursor → Settings → Features → Docs</p>
          <p className="text-xs text-muted-foreground font-medium">Step 2: Add your API base URL</p>
          <CodeBlock code={`Base URL: ${supabaseUrl}/rest/v1
API Key: ${anonKey}`} />
          <p className="text-xs text-muted-foreground font-medium">Step 3: Use Cursor Chat</p>
          <CodeBlock code={`"Using the CRM API at ${supabaseUrl}/rest/v1 with key ${anonKey},
write a script to fetch all active leads"`} />
          <p className="text-xs text-muted-foreground font-medium">Step 4: Or connect via Supabase JS client</p>
          <CodeBlock code={`import { createClient } from '@supabase/supabase-js'
const supabase = createClient('${supabaseUrl}', '${anonKey}')
const { data } = await supabase.from('leads').select('*')`} />
        </div>
      </CollapsibleCard>

      {/* GitHub Copilot */}
      <CollapsibleCard title="GitHub Copilot / VS Code" icon={<GitBranch className="h-4 w-4" />}
        description="Use the CRM REST API inside VS Code with GitHub Copilot for AI-assisted automation.">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Step 1: Install REST Client extension</p>
          <p className="text-xs text-muted-foreground font-medium">Step 2: Create a .http file</p>
          <CodeBlock code={`### Get All Leads
GET ${supabaseUrl}/rest/v1/leads
Authorization: Bearer ${anonKey}
apikey: ${anonKey}

### Get Active Leads Only
GET ${supabaseUrl}/rest/v1/leads?is_active=eq.true
Authorization: Bearer ${anonKey}
apikey: ${anonKey}`} />
          <p className="text-xs text-muted-foreground font-medium">Step 3: Ask Copilot</p>
          <CodeBlock code={`"Write a Node.js script to sync leads from this API to my billing CRM"`} />
        </div>
      </CollapsibleCard>

      {/* n8n / Make */}
      <CollapsibleCard title="n8n / Make (Zapier alternative)" icon={<Workflow className="h-4 w-4" />}
        description="Automate workflows between your CRM and other tools — no code required.">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Step 1: In n8n, add an HTTP Request node</p>
          <p className="text-xs text-muted-foreground font-medium">Step 2: Configure</p>
          <CodeBlock code={`Method: GET
URL: ${supabaseUrl}/rest/v1/leads
Headers:
  Authorization: Bearer ${anonKey}
  apikey: ${anonKey}`} />
          <p className="text-xs text-muted-foreground font-medium">Example automations:</p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>New lead added → Send Slack notification</li>
            <li>Lead status changed → Update billing CRM</li>
            <li>Weekly → Export verified leads to Google Sheets</li>
            <li>New verified email → Add to email marketing list</li>
          </ul>
        </div>
      </CollapsibleCard>

      {/* Custom MCP */}
      <CollapsibleCard title="Custom MCP Server" icon={<Blocks className="h-4 w-4" />}
        description="Build a custom MCP server for any AI agent that supports MCP protocol.">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">Step 1: Install MCP SDK</p>
          <CodeBlock code="npm install @modelcontextprotocol/sdk" />
          <p className="text-xs text-muted-foreground font-medium">Step 2: Register MCP tools</p>
          <CodeBlock code={`get_leads: GET /leads with filter params
get_lead_by_id: GET /leads?id=eq.{id}
get_leads_by_company: GET /leads?company=eq.{name}
get_active_leads: GET /leads?is_active=eq.true`} />
        </div>
      </CollapsibleCard>

      {/* Quick Copy Credentials */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Your Credentials</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            ["API Base URL", `${supabaseUrl}/rest/v1`],
            ["Supabase URL", supabaseUrl],
            ["Supabase Anon Key", anonKey],
            ["Database Connection String", dbUrl],
            ["App URL", appUrl],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-xs font-mono truncate max-w-[400px]">{value}</p>
              </div>
              <CopyBtn text={value} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
