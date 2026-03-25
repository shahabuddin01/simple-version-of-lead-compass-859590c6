import { useState } from "react";
import { MailCheck, Eye, EyeOff, Send, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function ExternalAPIsTab() {
  const MV_KEY = "nhproductionhouse_ev_settings";
  const CACHE_KEY = "nhproductionhouse_ev_cache";

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

  const toggleCache = () => {
    const updated = { ...settings, cacheEnabled: !settings.cacheEnabled };
    setSettings(updated);
    localStorage.setItem(MV_KEY, JSON.stringify(updated));
    toast.success(updated.cacheEnabled ? "Cache enabled" : "Cache disabled");
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

  // Cache stats
  const getCacheStats = () => {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      const entries = cache.entries || {};
      const totalVerified = Object.keys(entries).length;
      const hits = cache.hits || 0;
      const misses = cache.misses || 0;
      const hitRate = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
      return { totalVerified, creditsSaved: hits, hitRate };
    } catch {
      return { totalVerified: 0, creditsSaved: 0, hitRate: 0 };
    }
  };

  const cacheStats = getCacheStats();

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
                <MailCheck className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-sm">MillionVerifier</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Email verification service</p>
              </div>
            </div>
            <Badge variant="secondary" className={isConfigured ? "bg-green-500/15 text-green-700 text-[10px]" : "text-[10px]"}>
              {isConfigured ? "Connected" : "Not Configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">API Key</label>
            <div className="flex items-center gap-2 mt-1">
              <Input type={showKey ? "text" : "password"} value={settings.apiKey || ""} onChange={e => handleSaveKey(e.target.value)} placeholder="Enter MillionVerifier API key" />
              <button onClick={() => setShowKey(!showKey)} className="rounded-md p-2 hover:bg-accent">
                {showKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Test Connection
            </Button>
            {testResult === "success" && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3.5 w-3.5" /> Connected</span>}
            {testResult === "error" && <span className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" /> Failed</span>}
          </div>

          {/* Cache Settings */}
          <div className="border-t border-border pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-foreground">Cache Settings</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Enable Cache</p>
                <p className="text-[11px] text-muted-foreground">Cache verification results to save credits</p>
              </div>
              <button onClick={toggleCache}
                className={`relative h-5 w-9 rounded-full transition-colors ${settings.cacheEnabled !== false ? "bg-green-500" : "bg-muted-foreground/30"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${settings.cacheEnabled !== false ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </div>
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p>Cache duration: <strong className="text-foreground">14 days</strong></p>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="border-t border-border pt-4 space-y-2">
            <h4 className="text-xs font-semibold text-foreground">Usage Stats</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-border p-3 text-center">
                <p className="text-lg font-bold text-foreground">{cacheStats.totalVerified}</p>
                <p className="text-[10px] text-muted-foreground">Total Verified</p>
              </div>
              <div className="rounded-md border border-border p-3 text-center">
                <p className="text-lg font-bold text-foreground">{cacheStats.creditsSaved}</p>
                <p className="text-[10px] text-muted-foreground">Credits Saved</p>
              </div>
              <div className="rounded-md border border-border p-3 text-center">
                <p className="text-lg font-bold text-foreground">{cacheStats.hitRate}%</p>
                <p className="text-[10px] text-muted-foreground">Cache Hit Rate</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
