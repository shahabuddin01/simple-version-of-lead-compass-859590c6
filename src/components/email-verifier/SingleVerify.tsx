import { useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { loadMVSettings, verifySingle, getESP, getQualityDisplay, getErrorMessage } from "@/lib/emailVerifier";
import { EmailVerification } from "@/types/lead";

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
      toast.error("Verification failed. This may be a CORS issue.");
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Single Email Verification</h2>
        <p className="text-sm text-muted-foreground mt-1">Verify a single email address in real-time.</p>
      </div>

      <div className="flex gap-2">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email address..."
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          className="flex-1"
        />
        <Button onClick={() => handleVerify()} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Verify
        </Button>
      </div>

      {result?.didyoumean && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <span>💡 Did you mean: <strong>{result.didyoumean}</strong>?</span>
          <Button size="sm" variant="outline" onClick={() => { setEmail(result.didyoumean); handleVerify(result.didyoumean); }}>
            Verify This Instead
          </Button>
        </div>
      )}

      {result && display && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={`${display.color} border text-sm font-semibold`}>
                  {display.icon} {display.label}
                </Badge>
                <span className="text-sm font-medium">{result._email}</span>
              </div>
              {result._esp !== "Other" && (
                <Badge variant="outline" className="text-xs">{result._esp}</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Result:</span> <span className="font-medium">{result.result} (code: {result.resultcode})</span></div>
              <div><span className="text-muted-foreground">Sub-result:</span> <span className="font-medium">{result.subresult}</span></div>
              <div><span className="text-muted-foreground">Free email:</span> <span className="font-medium">{result.free ? "Yes" : "No"}</span></div>
              <div><span className="text-muted-foreground">Role email:</span> <span className="font-medium">{result.role ? "Yes" : "No"}</span></div>
              <div><span className="text-muted-foreground">Execution:</span> <span className="font-medium">{result.executiontime}ms</span></div>
              <div><span className="text-muted-foreground">Credits left:</span> <span className="font-medium tabular-nums">{result.credits?.toLocaleString()}</span></div>
              <div><span className="text-muted-foreground">Live mode:</span> <span className="font-medium">{result.livemode ? "Yes" : "No"}</span></div>
              <div><span className="text-muted-foreground">Verified:</span> <span className="font-medium">{new Date(result._verifiedAt).toLocaleString()}</span></div>
            </div>

            {onSaveToLead && (
              <Button onClick={handleSave} variant="outline" size="sm">
                Save to Lead Record
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
