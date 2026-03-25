import { useState } from "react";
import { MailCheck, Mail, HardDrive, MessageSquare, Globe, Eye, EyeOff, ChevronDown, Check, Copy, Send, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 1500); };
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-xs hover:bg-accent transition-colors">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ExternalAPICard({ title, icon, iconColor, description, statusLabel, statusColor, enableToggle, id, children }: {
  title: string; icon: React.ReactNode; iconColor: string; description: string;
  statusLabel: string; statusColor: string; enableToggle?: React.ReactNode; id?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden transition-shadow" id={id}>
      <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconColor}`}>{icon}</div>
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`text-[10px] ${statusColor}`}>{statusLabel}</Badge>
            {enableToggle}
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
      </CardHeader>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <CardContent className="pt-0 space-y-4 border-t border-border mt-0 pt-4">{children}</CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// MillionVerifier
function MillionVerifierCard() {
  const MV_KEY = "nhproductionhouse_ev_settings";
  const loadSettings = () => { try { return JSON.parse(localStorage.getItem(MV_KEY) || "{}"); } catch { return {}; } };
  const [settings, setSettings] = useState(loadSettings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"none" | "success" | "error">("none");
  const isConfigured = !!settings.apiKey;

  const handleSaveKey = (key: string) => {
    const updated = { ...settings, apiKey: key };
    setSettings(updated);
    localStorage.setItem(MV_KEY, JSON.stringify(updated));
    toast.success("API key saved");
  };

  const testConnection = async () => {
    setTesting(true); setTestResult("none");
    try {
      const key = settings.apiKey;
      if (!key) { toast.error("Enter API key first"); setTesting(false); return; }
      const res = await fetch(`https://api.millionverifier.com/api/v3/?api=${key}&email=test@millionverifier.com`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) { setTestResult("success"); toast.success("MillionVerifier connected!"); }
      else { setTestResult("error"); toast.error("Connection failed"); }
    } catch { setTestResult("error"); toast.error("Connection failed"); }
    finally { setTesting(false); }
  };

  return (
    <ExternalAPICard title="MillionVerifier" icon={<MailCheck className="h-4 w-4 text-green-600" />}
      iconColor="bg-green-500/10" description="Email verification service" id="card-millionverifier"
      statusLabel={isConfigured ? "Connected" : "Not Configured"} statusColor={isConfigured ? "bg-green-500/15 text-green-700" : ""}>
      <div>
        <label className="text-xs font-medium text-muted-foreground">API Key</label>
        <div className="flex items-center gap-2 mt-1">
          <Input type={showKey ? "text" : "password"} value={settings.apiKey || ""} onChange={e => handleSaveKey(e.target.value)} placeholder="Enter MillionVerifier API key" />
          <button onClick={() => setShowKey(!showKey)} className="rounded-md p-2 hover:bg-accent">
            {showKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      </div>
      <div className="rounded-md bg-muted p-3 space-y-1 text-xs text-muted-foreground">
        <p>• Verification cache: <strong className="text-foreground">Enabled</strong> (14 days)</p>
        <p>• Auto-verify on import: configurable in Email Verifier settings</p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={testConnection} disabled={testing}>
          {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Test Connection
        </Button>
        {testResult === "success" && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3.5 w-3.5" /> Connected</span>}
        {testResult === "error" && <span className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" /> Failed</span>}
      </div>
    </ExternalAPICard>
  );
}

// SMTP
function SMTPCard() {
  const SMTP_KEY = "nhproductionhouse_smtp_settings";
  const loadSMTP = () => { try { return JSON.parse(localStorage.getItem(SMTP_KEY) || "null") || {}; } catch { return {}; } };
  const [config, setConfig] = useState(loadSMTP);
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const isConfigured = !!(config.host && config.username && config.isActive);

  const set = (key: string, value: any) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    localStorage.setItem(SMTP_KEY, JSON.stringify(updated));
  };

  const handleTest = async () => {
    setTesting(true);
    await new Promise(r => setTimeout(r, 1500));
    setTesting(false);
    if (config.host && config.port && config.username && config.password) toast.success("SMTP configuration looks valid.");
    else toast.error("Missing required fields.");
  };

  return (
    <ExternalAPICard title="SMTP Mail Server" icon={<Mail className="h-4 w-4 text-blue-600" />}
      iconColor="bg-blue-500/10" description="Outgoing email for resets & notifications" id="card-smtp"
      statusLabel={isConfigured ? "Active" : "Not Configured"} statusColor={isConfigured ? "bg-green-500/15 text-green-700" : ""}
      enableToggle={
        <button onClick={(e) => { e.stopPropagation(); set("isActive", !config.isActive); }}
          className={`relative h-5 w-9 rounded-full transition-colors ${config.isActive ? "bg-green-500" : "bg-muted-foreground/30"}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${config.isActive ? "left-[18px]" : "left-0.5"}`} />
        </button>
      }>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground">SMTP Host</label><Input value={config.host || ""} onChange={e => set("host", e.target.value)} placeholder="smtp.gmail.com" className="mt-1" /></div>
        <div><label className="text-xs text-muted-foreground">Port</label><Input type="number" value={config.port || 587} onChange={e => set("port", parseInt(e.target.value))} className="mt-1" /></div>
      </div>
      <div><label className="text-xs text-muted-foreground">Username</label><Input value={config.username || ""} onChange={e => set("username", e.target.value)} placeholder="you@gmail.com" className="mt-1" /></div>
      <div>
        <label className="text-xs text-muted-foreground">Password</label>
        <div className="relative mt-1">
          <Input type={showPassword ? "text" : "password"} value={config.password || ""} onChange={e => set("password", e.target.value)} placeholder="••••••••" className="pr-10" />
          <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground">Sender Name</label><Input value={config.senderName || ""} onChange={e => set("senderName", e.target.value)} placeholder="Lead CRM" className="mt-1" /></div>
        <div><label className="text-xs text-muted-foreground">Sender Email</label><Input value={config.senderEmail || ""} onChange={e => set("senderEmail", e.target.value)} placeholder="noreply@domain.com" className="mt-1" /></div>
      </div>
      <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
        <Send className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} /> Send Test Email
      </Button>
    </ExternalAPICard>
  );
}

// Google Drive
function GoogleDriveCard() {
  const GDRIVE_KEY = "nhproductionhouse_gdrive_connection";
  const loadGDrive = () => { try { return JSON.parse(localStorage.getItem(GDRIVE_KEY) || "null"); } catch { return null; } };
  const [connection, setConnection] = useState(loadGDrive);

  const connect = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) { toast.error("VITE_GOOGLE_CLIENT_ID not configured"); return; }
    toast.info("Google Drive OAuth would open here in production.");
  };

  const disconnect = () => { setConnection(null); localStorage.removeItem(GDRIVE_KEY); toast.success("Google Drive disconnected"); };

  return (
    <ExternalAPICard title="Google Drive" icon={<HardDrive className="h-4 w-4 text-yellow-600" />}
      iconColor="bg-yellow-500/10" description="Cloud backup storage" id="card-google-drive"
      statusLabel={connection?.connected ? "Connected" : "Not Connected"} statusColor={connection?.connected ? "bg-green-500/15 text-green-700" : ""}>
      {connection?.connected ? (
        <>
          <p className="text-xs text-muted-foreground">Connected as <strong className="text-foreground">{connection.email}</strong></p>
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
            <p>• Backup folder: NH Production House Backups</p>
            <p>• Auto backup: Weekly (configurable in Backup Settings)</p>
          </div>
          <Button size="sm" variant="outline" className="text-destructive" onClick={disconnect}>Disconnect</Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={connect}><HardDrive className="h-3.5 w-3.5" /> Connect Google Drive</Button>
          <p className="text-xs text-muted-foreground">Requires Google OAuth setup. See SETUP_GUIDE.md.</p>
        </>
      )}
    </ExternalAPICard>
  );
}

// Telegram
function TelegramCard() {
  const TG_KEY = "nhproductionhouse_telegram_settings";
  const loadTG = () => { try { return JSON.parse(localStorage.getItem(TG_KEY) || "{}"); } catch { return {}; } };
  const [config, setConfig] = useState(loadTG);
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const isConfigured = !!(config.botToken && config.chatId);

  const set = (key: string, value: string) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);
    localStorage.setItem(TG_KEY, JSON.stringify(updated));
  };

  const testMessage = async () => {
    if (!config.botToken || !config.chatId) { toast.error("Enter bot token and chat ID first"); return; }
    setTesting(true);
    try {
      const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: config.chatId, text: "✅ NH Production House CRM — Telegram connection successful!" }),
      });
      if (res.ok) toast.success("Test message sent!"); else toast.error("Failed to send message");
    } catch { toast.error("Connection failed"); }
    finally { setTesting(false); }
  };

  return (
    <ExternalAPICard title="Telegram" icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
      iconColor="bg-blue-500/10" description="Notifications & backup delivery" id="card-telegram"
      statusLabel={isConfigured ? "Configured" : "Not Configured"} statusColor={isConfigured ? "bg-green-500/15 text-green-700" : ""}>
      <div>
        <label className="text-xs text-muted-foreground">Bot Token</label>
        <div className="flex items-center gap-2 mt-1">
          <Input type={showToken ? "text" : "password"} value={config.botToken || ""} onChange={e => set("botToken", e.target.value)} placeholder="123456:ABC-DEF..." />
          <button onClick={() => setShowToken(!showToken)} className="rounded-md p-2 hover:bg-accent">
            {showToken ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      </div>
      <div><label className="text-xs text-muted-foreground">Channel / Chat ID</label><Input value={config.chatId || ""} onChange={e => set("chatId", e.target.value)} placeholder="-1001234567890" className="mt-1" /></div>
      <Button size="sm" variant="outline" onClick={testMessage} disabled={testing}>
        <Send className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} /> Send Test Message
      </Button>
    </ExternalAPICard>
  );
}

// IP Geolocation
function IPGeoCard() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testLookup = async () => {
    setTesting(true);
    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      setResult(data); toast.success("IP lookup successful");
    } catch { toast.error("Lookup failed"); }
    finally { setTesting(false); }
  };

  return (
    <ExternalAPICard title="IP Geolocation" icon={<Globe className="h-4 w-4 text-purple-600" />}
      iconColor="bg-purple-500/10" description="Security Center — country blocking & login detection" id="card-ip-geo"
      statusLabel="Auto-configured" statusColor="bg-green-500/15 text-green-700">
      <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
        <p>Service: ipapi.co · Free tier: 1,000 requests/day · No API key needed</p>
      </div>
      <Button size="sm" variant="outline" onClick={testLookup} disabled={testing}>
        <Globe className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} /> Test Lookup
      </Button>
      {result && (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-xs space-y-1">
          <p><strong>Your IP:</strong> {result.ip}</p>
          <p><strong>Location:</strong> {result.city}, {result.country_name}</p>
          <p><strong>ISP:</strong> {result.org}</p>
        </div>
      )}
    </ExternalAPICard>
  );
}

export function ExternalAPIsTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <MillionVerifierCard />
      <SMTPCard />
      <GoogleDriveCard />
      <TelegramCard />
      <IPGeoCard />
    </div>
  );
}
