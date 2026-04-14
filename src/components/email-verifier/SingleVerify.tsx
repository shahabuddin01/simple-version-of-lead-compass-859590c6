import { useState } from "react";
import { Search, RefreshCw, Mail, CheckCircle, AlertTriangle, XCircle, Clock, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { loadMVSettings, verifySingle, getESP, getQualityDisplay, getErrorMessage } from "@/lib/emailVerifier";
import { EmailVerification } from "@/types/lead";
import { cn } from "@/lib/utils";

interface SingleVerifyProps {
  onSaveToLead?: (email: string, verification: EmailVerification) => void;
}

export function SingleVerify({ onSaveToLead }: SingleVerifyProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleVerify = async (emailToVerify?: string) => {
    const target = emailToVerify || email;
    if (!target.trim()) { toast.error("Enter an email address."); return; }
    const settings = loadMVSettings();
    const key = settings.useDemo ? "API_KEY_FOR_TEST" : settings.apiKey;
    if (!key) { toast.error("Configure your API key in Settings first."); return; }

    setLoading(true);
    try {
      const data = await verifySingle(key, target.trim());
      if (data.error && data.result === "error") {
        toast.error(getErrorMessage(data.error));
      }
      setResult({ ...data, _email: target.trim(), _esp: getESP(target.trim()), _verifiedAt: new Date().toISOString() });
    } catch {
      toast.error("Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!result || !onSaveToLead) return;
    const verification: EmailVerification = {
      quality: result.quality || "",
      result: result.result || "error",
      resultcode: result.resultcode || 0,
      subresult: result.subresult || "",
      free: !!result.free,
      role: !!result.role,
      didyoumean: result.didyoumean || "",
      esp: result._esp,
      verifiedAt: result._verifiedAt,
      creditsUsed: 1,
    };
    onSaveToLead(result._email, verification);
    toast.success("Verification saved to lead record.");
  };

  const display = result ? getQualityDisplay(result.quality, result.result) : null;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Single Email Verification</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Verify a single email address in real-time</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address..."
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            className="pl-8 h-9 text-sm rounded-lg"
          />
        </div>
        <Button onClick={() => handleVerify()} disabled={loading} size="sm" className="h-9 rounded-lg">
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Verify
        </Button>
      </div>

      {result?.didyoumean && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>Did you mean: <strong>{result.didyoumean}</strong>?</span>
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs rounded-lg" onClick={() => { setEmail(result.didyoumean); handleVerify(result.didyoumean); }}>
            Verify This
          </Button>
        </div>
      )}

      {result && display && (
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Badge className={cn("border text-xs font-semibold rounded-lg", display.color)}>
                {display.icon} {display.label}
              </Badge>
              <span className="text-xs font-medium">{result._email}</span>
            </div>
            {result._esp !== "Other" && (
              <Badge variant="outline" className="text-[10px] rounded-md">{result._esp}</Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Result", value: `${result.result} (${result.resultcode})` },
              { label: "Sub-result", value: result.subresult },
              { label: "Free email", value: result.free ? "Yes" : "No" },
              { label: "Role email", value: result.role ? "Yes" : "No" },
              { label: "Execution", value: `${result.executiontime}ms` },
              { label: "Credits left", value: result.credits?.toLocaleString() },
            ].map(item => (
              <div key={item.label} className="rounded-lg bg-muted/40 px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
                <p className="text-xs font-medium tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>

          {onSaveToLead && (
            <Button onClick={handleSave} variant="outline" size="sm" className="h-8 text-xs rounded-lg">
              Save to Lead Record
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
