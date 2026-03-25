import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-md bg-[hsl(220,20%,10%)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <span className="text-xs font-mono text-white/50">{language}</span>
        <button onClick={copy} className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 transition-colors">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono text-green-300 leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}

function EndpointBlock({ method, path, description, params, sample }: {
  method: string; path: string; description: string;
  params?: { name: string; type: string; desc: string }[];
  sample: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center rounded-md bg-green-500/15 px-2.5 py-1 text-xs font-bold text-green-600 font-mono">{method}</span>
        <code className="text-sm font-mono text-foreground">{path}</code>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {params && params.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">Query Parameters:</p>
          <div className="rounded-md bg-muted p-3 space-y-1">
            {params.map(p => (
              <div key={p.name} className="flex gap-2 text-xs">
                <code className="font-mono text-primary">{p.name}</code>
                <span className="text-muted-foreground">({p.type})</span>
                <span className="text-muted-foreground">— {p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2">Sample Response:</p>
        <CodeBlock code={sample} language="json" />
      </div>
    </div>
  );
}

export function APIDocumentation() {
  const [codeTab, setCodeTab] = useState<"javascript" | "python" | "curl">("javascript");

  const baseUrl = import.meta.env.VITE_APP_URL ? `${import.meta.env.VITE_APP_URL}/api/v1` : `${window.location.origin}/api/v1`;

  const sampleLead = JSON.stringify([{
    id: "uuid-example-1234",
    name: "Abdul Aziz",
    position: "Brand Manager",
    company: "AKIJ Food & Beverage (MOJO)",
    industry: "Food & Beverage",
    work_email: "abdul@akijfood.com",
    personal_email: "",
    phone: "+880XXXXXXXXXX",
    linkedin: "https://linkedin.com/in/...",
    facebook: "",
    instagram: "",
    status: "New",
    is_active: true,
    work_email_verified: false,
    personal_email_verified: false,
    created_at: "2024-01-01T00:00:00Z"
  }], null, 2);

  const singleSample = JSON.stringify({
    id: "uuid-example-1234",
    name: "Abdul Aziz",
    position: "Brand Manager",
    company: "AKIJ Food & Beverage (MOJO)",
    industry: "Food & Beverage",
    work_email: "abdul@akijfood.com",
    status: "New",
    is_active: true,
  }, null, 2);

  const jsCode = `const response = await fetch(
  '${baseUrl}/leads',
  {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    }
  }
);
const leads = await response.json();`;

  const pyCode = `import requests

headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}

response = requests.get(
    "${baseUrl}/leads",
    headers=headers
)
leads = response.json()`;

  const curlCode = `curl -X GET \\
  '${baseUrl}/leads' \\
  -H 'Authorization: Bearer YOUR_API_KEY' \\
  -H 'Content-Type: application/json'`;

  return (
    <div className="space-y-6 mt-4">
      {/* Overview */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Overview</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Technology</p>
            <p className="text-foreground">React + Vite + TypeScript (Lovable)</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Authentication</p>
            <p className="text-foreground">Bearer Token via API Key</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Base URL</p>
            <code className="text-xs font-mono text-primary">{baseUrl}</code>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Content-Type</p>
            <code className="text-xs font-mono text-foreground">application/json</code>
          </div>
        </div>
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs font-semibold text-foreground mb-1">Required Headers:</p>
          <code className="text-xs font-mono text-muted-foreground block">Authorization: Bearer YOUR_API_KEY</code>
          <code className="text-xs font-mono text-muted-foreground block">Content-Type: application/json</code>
        </div>
      </div>

      {/* Endpoints */}
      <h3 className="text-sm font-semibold text-foreground">Endpoints</h3>

      <EndpointBlock
        method="GET" path="/leads"
        description="Returns all leads with their full details. Supports filtering and pagination."
        params={[
          { name: "active", type: "boolean", desc: "Filter by active/inactive status" },
          { name: "industry", type: "string", desc: "Filter by industry name" },
          { name: "company", type: "string", desc: "Filter by company name" },
          { name: "status", type: "string", desc: "Filter by pipeline status (New, Contacted, In Progress, Closed, Not Interested)" },
          { name: "limit", type: "integer", desc: "Max results to return" },
          { name: "offset", type: "integer", desc: "Pagination offset" },
        ]}
        sample={sampleLead}
      />

      <EndpointBlock
        method="GET" path="/leads/:id"
        description="Returns a single lead record by its unique ID."
        sample={singleSample}
      />

      <EndpointBlock
        method="GET" path="/leads?company={company_name}"
        description="Returns all leads belonging to a specific company."
        sample={sampleLead}
      />

      <EndpointBlock
        method="GET" path="/leads?industry={industry_name}"
        description="Returns all leads in a specific industry (e.g. 'EdTech', 'Food & Beverage')."
        sample={sampleLead}
      />

      <EndpointBlock
        method="GET" path="/leads?active=true"
        description="Returns only active leads."
        sample={sampleLead}
      />

      {/* SMS Gateway API */}
      <h3 className="text-sm font-semibold text-foreground pt-2">SMS Gateway API (for Android App)</h3>
      <EndpointBlock method="POST" path="/sms/device" description="Register an Android device as an SMS gateway."
        params={[{ name: "device_id", type: "string", desc: "Unique device identifier" }, { name: "device_name", type: "string", desc: "Friendly name" }, { name: "sim1_number", type: "string", desc: "SIM 1 number" }, { name: "sim2_number", type: "string", desc: "SIM 2 number" }]}
        sample={'{ "success": true, "device_id": "android-abc123" }'} />
      <EndpointBlock method="GET" path="/sms/queue?limit=10&sim=ANY" description="Poll for pending SMS jobs. Add X-Device-ID header. Jobs marked PICKED on fetch."
        params={[{ name: "limit", type: "integer", desc: "Max jobs (max 50)" }, { name: "sim", type: "string", desc: "SIM1, SIM2, or ANY" }]}
        sample={'{ "jobs": [{ "id": 1, "phone_number": "+880...", "message": "Hi" }], "count": 1 }'} />
      <EndpointBlock method="POST" path="/sms/report" description="Report delivery status after sending SMS from mobile device."
        params={[{ name: "job_id", type: "integer", desc: "Queue job ID" }, { name: "status", type: "string", desc: "SENT or FAILED" }, { name: "sim_used", type: "string", desc: "SIM1 or SIM2" }]}
        sample={'{ "success": true }'} />
      <EndpointBlock method="POST" path="/sms/queue" description="Add SMS to queue from CRM. Android app picks up and sends via physical SIM."
        params={[{ name: "phones", type: "string[]", desc: "Phone numbers array" }, { name: "message", type: "string", desc: "SMS text" }, { name: "sim_preference", type: "string", desc: "SIM1, SIM2, or ANY" }]}
        sample={'{ "success": true, "queued": 3, "job_ids": [1, 2, 3] }'} />

      {/* Code Examples */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Code Examples</h3>
        <div className="flex gap-1">
          {(["javascript", "python", "curl"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setCodeTab(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${codeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {tab === "javascript" ? "JavaScript" : tab === "python" ? "Python" : "cURL"}
            </button>
          ))}
        </div>
        <CodeBlock
          code={codeTab === "javascript" ? jsCode : codeTab === "python" ? pyCode : curlCode}
          language={codeTab}
        />
      </div>

      {/* Integration Notes */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Integration Notes</h3>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
          <li>This CRM exposes <strong className="text-foreground">read-only</strong> access — no write/delete operations are available via the API</li>
          <li>All timestamps are in <strong className="text-foreground">UTC ISO 8601</strong> format</li>
          <li><strong className="text-foreground">UUID</strong> format is used for all <code className="font-mono text-primary">id</code> fields</li>
          <li>For filtering multiple values use: <code className="font-mono text-primary">?status=New,Contacted</code></li>
          <li>For pagination use: <code className="font-mono text-primary">?limit=50&offset=0</code></li>
          <li>The API returns JSON arrays for list endpoints and single objects for detail endpoints</li>
          <li>Rate limiting: 100 requests per minute per API key</li>
          <li>When building the billing CRM, use the lead <code className="font-mono text-primary">id</code> as the foreign key to link invoices and quotations back to specific contacts</li>
        </ul>
      </div>
    </div>
  );
}
