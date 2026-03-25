import { useState, useEffect } from "react";
import { Eye, EyeOff, RefreshCw, ExternalLink, CheckCircle, AlertTriangle, XCircle, Trash2, Clock, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { loadMVSettings, saveMVSettings, getCredits } from "@/lib/emailVerifier";
import {
  loadCacheSettings, saveCacheSettings, getCacheStats, clearCache, CacheStats,
} from "@/lib/emailVerificationCache";

export function APISettings() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [status, setStatus] = useState<"none" | "connected" | "invalid">("none");
  const [credits, setCredits] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Cache settings
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheStats, setCacheStats] = useState<CacheStats>({ total: 0, active: 0, expired: 0, creditsSavedThisWeek: 0 });
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const s = loadMVSettings();
    setApiKey(s.apiKey);
    setUseDemo(s.useDemo);
    const cs = loadCacheSettings();
    setCacheEnabled(cs.cacheEnabled);
    setCacheStats(getCacheStats());
  }, []);

  const effectiveKey = useDemo ? "API_KEY_FOR_TEST" : apiKey;

  const testConnection = async () => {
    if (!effectiveKey) { toast.error("Enter an API key first."); return; }
    setLoading(true);
    try {
      const data = await getCredits(effectiveKey);
      if (data.error) {
        setStatus("invalid");
        toast.error("Invalid API key.");
      } else {
        setCredits(data);
        setStatus("connected");
        toast.success("Connected successfully!");
      }
    } catch {
      setStatus("invalid");
      toast.error("Connection failed. This may be a CORS issue — try using a server-side proxy.");
    } finally {
      setLoading(false);
    }
  };

  const refreshBalance = async () => {
    if (!effectiveKey) return;
    setLoading(true);
    try {
      const data = await getCredits(effectiveKey);
      if (!data.error) { setCredits(data); toast.success("Balance refreshed."); }
    } catch {
      toast.error("Failed to refresh balance.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    saveMVSettings({ apiKey, useDemo });
    saveCacheSettings({ cacheEnabled, cacheDurationDays: 14 });
    toast.success("Settings saved.");
  };

  const handleToggleCache = (enabled: boolean) => {
    setCacheEnabled(enabled);
    saveCacheSettings({ cacheEnabled: enabled, cacheDurationDays: 14 });
  };

  const handleClearCache = () => {
    if (clearConfirmText !== "CLEAR") return;
    clearCache();
    setCacheStats(getCacheStats());
    setShowClearConfirm(false);
    setClearConfirmText("");
    toast.success("All cached verification data cleared.");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Million Verifier — API Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">Connect your Million Verifier account to verify email addresses.</p>
      </div>

      {/* API Key Card */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">API Key</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="your-api-key"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="demo" checked={useDemo} onCheckedChange={(v) => setUseDemo(v === true)} />
            <label htmlFor="demo" className="text-sm text-muted-foreground">
              Use demo key "API_KEY_FOR_TEST" (returns random results, costs no credits)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={testConnection} disabled={loading} size="sm">
              {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Test Connection
            </Button>
          </div>

          {status === "none" && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="h-4 w-4" /> Not configured
            </div>
          )}
          {status === "connected" && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" /> Connected — {credits?.credits?.toLocaleString() ?? "?"} credits remaining
            </div>
          )}
          {status === "invalid" && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <XCircle className="h-4 w-4" /> Invalid API key
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Balance Card */}
      {credits && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Credit Balance</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Credits</p>
                <p className="text-lg font-semibold tabular-nums">{credits.credits?.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Bulk Credits</p>
                <p className="text-lg font-semibold tabular-nums">{credits.bulk_credits?.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Renewing Credits</p>
                <p className="text-lg font-semibold tabular-nums">{credits.renewing_credits?.toLocaleString()}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="text-lg font-semibold tabular-nums">{credits.plan}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={refreshBalance} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Balance
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://app.millionverifier.com" target="_blank" rel="noopener noreferrer">
                  Buy Credits <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Cache Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" /> Verification Cache
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Cache Verification Results (Save Credits)</p>
              <p className="text-xs text-muted-foreground">
                When enabled, email verification results are cached for 2 weeks.
                The same email will not use a new MillionVerifier credit within that period.
              </p>
            </div>
            <Switch checked={cacheEnabled} onCheckedChange={handleToggleCache} />
          </div>

          {!cacheEnabled && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Cache is disabled. Every verification will use a MillionVerifier credit.
            </div>
          )}

          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Current cache duration: 14 days
          </div>

          {/* Cache Statistics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Total Cached</p>
              <p className="text-lg font-semibold tabular-nums">{cacheStats.total}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Active (Not Expired)</p>
              <p className="text-lg font-semibold tabular-nums text-green-600">{cacheStats.active}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Expired</p>
              <p className="text-lg font-semibold tabular-nums text-muted-foreground">{cacheStats.expired}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Credits Saved (7d)</p>
              <p className="text-lg font-semibold tabular-nums text-blue-600">{cacheStats.creditsSavedThisWeek}</p>
            </div>
          </div>

          {/* Clear Cache */}
          {!showClearConfirm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear All Cache
            </Button>
          ) : (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive">Type CLEAR to confirm</p>
              <div className="flex gap-2">
                <Input
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="Type CLEAR"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={clearConfirmText !== "CLEAR"}
                  onClick={handleClearCache}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowClearConfirm(false); setClearConfirmText(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave}>Save Settings</Button>
    </div>
  );
}
