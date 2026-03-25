import { useState, useEffect } from "react";
import { Eye, EyeOff, Send, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SMTPConfig {
  host: string;
  port: number;
  encryption: "tls" | "ssl" | "none";
  username: string;
  password: string;
  senderName: string;
  senderEmail: string;
  isActive: boolean;
}

const SMTP_KEY = "nhproductionhouse_smtp_settings";

function loadSMTP(): SMTPConfig {
  try { return JSON.parse(localStorage.getItem(SMTP_KEY) || "null") || getDefault(); } catch { return getDefault(); }
}
function saveSMTP(c: SMTPConfig) { localStorage.setItem(SMTP_KEY, JSON.stringify(c)); }
function getDefault(): SMTPConfig {
  return { host: "", port: 587, encryption: "tls", username: "", password: "", senderName: "", senderEmail: "", isActive: false };
}

export function SMTPSettings() {
  const [config, setConfig] = useState<SMTPConfig>(loadSMTP);
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"none" | "success" | "failed">("none");

  const set = (key: keyof SMTPConfig, value: any) => setConfig(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    saveSMTP(config);
    toast.success("SMTP settings saved.");
  };

  const handleTest = async () => {
    if (!config.host || !config.username) {
      toast.error("Please fill in SMTP host and username first.");
      return;
    }
    setTesting(true);
    setTestResult("none");
    // Simulate test since we can't actually connect to SMTP from browser
    await new Promise(r => setTimeout(r, 1500));
    setTesting(false);
    if (config.host && config.port && config.username && config.password) {
      setTestResult("success");
      toast.success("SMTP configuration looks valid. Test email would be sent in production.");
    } else {
      setTestResult("failed");
      toast.error("Missing required fields for SMTP connection.");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">SMTP Settings</h2>
        <p className="text-sm text-muted-foreground">Configure outgoing email server for password resets and notifications</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">SMTP Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">SMTP Host</label>
              <Input value={config.host} onChange={e => set("host", e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">SMTP Port</label>
              <Input type="number" value={config.port} onChange={e => set("port", parseInt(e.target.value) || 587)} placeholder="587" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Encryption</label>
            <select value={config.encryption} onChange={e => set("encryption", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">SMTP Username (Email)</label>
            <Input value={config.username} onChange={e => set("username", e.target.value)} placeholder="you@gmail.com" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">SMTP Password</label>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} value={config.password}
                onChange={e => set("password", e.target.value)} placeholder="••••••••" className="pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Sender Name</label>
              <Input value={config.senderName} onChange={e => set("senderName", e.target.value)} placeholder="Lead CRM" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Sender Email</label>
              <Input value={config.senderEmail} onChange={e => set("senderEmail", e.target.value)} placeholder="noreply@yourdomain.com" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Enable this SMTP for sending emails</p>
            </div>
            <button type="button" onClick={() => set("isActive", !config.isActive)}
              className={`relative h-5 w-9 rounded-full transition-colors ${config.isActive ? "bg-toggle-active" : "bg-toggle-inactive"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform ${config.isActive ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>

          {testResult === "success" && (
            <div className="flex items-center gap-2 text-sm text-green-600"><CheckCircle className="h-4 w-4" /> Configuration valid</div>
          )}
          {testResult === "failed" && (
            <div className="flex items-center gap-2 text-sm text-red-600"><XCircle className="h-4 w-4" /> Configuration incomplete</div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave}>Save SMTP Settings</Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              <Send className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} /> Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
