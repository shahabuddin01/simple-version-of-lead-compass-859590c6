import { useState, useEffect } from "react";
import { RefreshCw, FileCheck, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { loadMVSettings, getFileList, getFileStatusBadge } from "@/lib/emailVerifier";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export function VerificationReport() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const isMobile = useIsMobile();

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
      toast.error("Failed to load file list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiles(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Verification Report</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Past bulk verification jobs</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFiles} disabled={loading} className="h-8 text-xs rounded-lg">
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <FileCheck className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">No verification jobs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">File</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">Total</th>
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground text-emerald-600 dark:text-emerald-400">OK</th>
                  {!isMobile && <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground text-amber-600">Catch</th>}
                  <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground text-destructive">Invalid</th>
                  {!isMobile && <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">Progress</th>}
                </tr>
              </thead>
              <tbody>
                {files.map((f: any) => {
                  const badge = getFileStatusBadge(f.status);
                  return (
                    <tr key={f.file_id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 truncate max-w-[140px] text-xs font-medium">{f.file_name}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className={cn("text-[10px] border rounded-md", badge.color)}>{badge.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-xs">{f.total_rows}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-xs text-emerald-600 dark:text-emerald-400">{f.ok}</td>
                      {!isMobile && <td className="px-3 py-2.5 text-center tabular-nums text-xs text-amber-600">{f.catch_all}</td>}
                      <td className="px-3 py-2.5 text-center tabular-nums text-xs text-destructive">{f.invalid}</td>
                      {!isMobile && <td className="px-3 py-2.5 text-center tabular-nums text-xs">{f.percent ?? 0}%</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && <div className="px-3 py-2 border-t border-border/40"><p className="text-[10px] text-muted-foreground">Total jobs: {total}</p></div>}
      </div>
    </div>
  );
}
