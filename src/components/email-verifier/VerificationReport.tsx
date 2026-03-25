import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { loadMVSettings, getFileList, getFileStatusBadge } from "@/lib/emailVerifier";

export function VerificationReport() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchFiles = async () => {
    const settings = loadMVSettings();
    const key = settings.useDemo ? "API_KEY_FOR_TEST" : settings.apiKey;
    if (!key) { toast.error("Configure your API key in Settings first."); return; }
    setLoading(true);
    try {
      const data = await getFileList(key);
      setFiles(data.files || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Failed to load file list. This may be a CORS issue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiles(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Verification Report</h2>
          <p className="text-sm text-muted-foreground mt-1">Past bulk verification jobs from Million Verifier.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFiles} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No verification jobs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">File</th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">OK</th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Catch-all</th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Invalid</th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Disposable</th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Unknown</th>
                    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f: any) => {
                    const badge = getFileStatusBadge(f.status);
                    return (
                      <tr key={f.file_id} className="border-b border-border last:border-0 hover:bg-accent/30">
                        <td className="px-3 py-2 truncate max-w-[180px]">{f.file_name}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] border ${badge.color}`}>{badge.label}</Badge>
                        </td>
                        <td className="px-3 py-2 tabular-nums">{f.total_rows}</td>
                        <td className="px-3 py-2 tabular-nums text-green-600">{f.ok}</td>
                        <td className="px-3 py-2 tabular-nums text-amber-600">{f.catch_all}</td>
                        <td className="px-3 py-2 tabular-nums text-red-600">{f.invalid}</td>
                        <td className="px-3 py-2 tabular-nums text-red-600">{f.disposable}</td>
                        <td className="px-3 py-2 tabular-nums">{f.unknown}</td>
                        <td className="px-3 py-2 tabular-nums">{f.percent ?? 0}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {total > 0 && <p className="text-xs text-muted-foreground mt-3">Total jobs: {total}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
