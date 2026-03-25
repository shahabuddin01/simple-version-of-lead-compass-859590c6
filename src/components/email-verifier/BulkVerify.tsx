import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, StopCircle, Download, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Lead, EmailVerification } from "@/types/lead";
import { loadMVSettings, bulkUpload, pollFileStatus, stopVerification, downloadResults, deleteFile, getESP, getQualityDisplay } from "@/lib/emailVerifier";

interface BulkVerifyProps {
  leads: Lead[];
  onUpdateLeadVerification?: (email: string, verification: EmailVerification) => void;
}

type Mode = "select" | "uploading" | "progress" | "results";

export function BulkVerify({ leads, onUpdateLeadVerification }: BulkVerifyProps) {
  const [mode, setMode] = useState<Mode>("select");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [useCSV, setUseCSV] = useState(false);
  const [fileId, setFileId] = useState("");
  const [progress, setProgress] = useState<any>(null);
  const [resultData, setResultData] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => cleanup, [cleanup]);

  const leadsWithEmail = leads.filter(l => l.email?.trim());
  const allSelected = leadsWithEmail.length > 0 && leadsWithEmail.every(l => selectedIds.has(l.id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(leadsWithEmail.map(l => l.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const startVerification = async () => {
    const settings = loadMVSettings();
    const key = settings.useDemo ? "API_KEY_FOR_TEST" : settings.apiKey;
    if (!key) { toast.error("Configure your API key in Settings first."); return; }

    let emails: string[];
    if (useCSV && csvFile) {
      const text = await csvFile.text();
      emails = text.split(/[\r\n]+/).map(e => e.trim()).filter(Boolean);
    } else {
      emails = leadsWithEmail.filter(l => selectedIds.has(l.id)).map(l => l.email);
    }

    if (emails.length === 0) { toast.error("No emails to verify."); return; }

    setMode("uploading");
    try {
      const data = await bulkUpload(key, emails);
      setFileId(data.file_id);
      setMode("progress");
      toast.success(`Uploaded ${emails.length} emails. Verification started.`);

      pollRef.current = setInterval(async () => {
        try {
          const info = await pollFileStatus(key, data.file_id);
          setProgress(info);
          if (info.status === "finished") {
            cleanup();
            setResultData(info);
            setMode("results");
            toast.success("Bulk verification complete!");
          } else if (info.status === "error" || info.status === "canceled") {
            cleanup();
            setMode("results");
            toast.error(`Verification ${info.status}.`);
          }
        } catch {
          // continue polling
        }
      }, 3000);
    } catch (err: any) {
      toast.error(err.message || "Upload failed. This may be a CORS issue.");
      setMode("select");
    }
  };

  const handleStop = async () => {
    const settings = loadMVSettings();
    const key = settings.useDemo ? "API_KEY_FOR_TEST" : settings.apiKey;
    try {
      await stopVerification(key, fileId);
      cleanup();
      toast.success("Verification stopped.");
      setMode("results");
    } catch {
      toast.error("Failed to stop verification.");
    }
  };

  const handleDownload = async (filter: string) => {
    const settings = loadMVSettings();
    const key = settings.useDemo ? "API_KEY_FOR_TEST" : settings.apiKey;
    try {
      const csv = await downloadResults(key, fileId, filter);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ns-production-verification-${filter}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed.");
    }
  };

  const handleDeleteFromServer = async () => {
    const settings = loadMVSettings();
    const key = settings.useDemo ? "API_KEY_FOR_TEST" : settings.apiKey;
    try {
      await deleteFile(key, fileId);
      toast.success("File deleted from server.");
    } catch {}
  };

  if (mode === "uploading") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Uploading emails...</p>
      </div>
    );
  }

  if (mode === "progress" && progress) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle className="text-sm">Bulk Verification In Progress</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progress.percent ?? 0}%</span>
                <span className="text-muted-foreground">({progress.verified ?? 0} / {progress.total_rows ?? 0})</span>
              </div>
              <Progress value={progress.percent ?? 0} className="h-3" />
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-green-600">✓ OK: {progress.ok ?? 0}</span>
              <span className="text-amber-600">📥 Catch-all: {progress.catch_all ?? 0}</span>
              <span className="text-red-600">✗ Invalid: {progress.invalid ?? 0}</span>
              <span className="text-red-600">🗑 Disposable: {progress.disposable ?? 0}</span>
              <span className="text-muted-foreground">? Unknown: {progress.unknown ?? 0}</span>
            </div>
            {progress.estimated_time_sec > 0 && (
              <p className="text-xs text-muted-foreground">Estimated: ~{progress.estimated_time_sec}s remaining</p>
            )}
            <p className="text-xs text-muted-foreground">Status: {progress.status}</p>
            <Button variant="destructive" size="sm" onClick={handleStop}>
              <StopCircle className="h-3.5 w-3.5" /> Stop Verification
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "results" && resultData) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle className="text-sm">Verification Results</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-green-600">✓ OK: {resultData.ok ?? 0}</span>
              <span className="text-amber-600">📥 Catch-all: {resultData.catch_all ?? 0}</span>
              <span className="text-red-600">✗ Invalid: {resultData.invalid ?? 0}</span>
              <span className="text-red-600">🗑 Disposable: {resultData.disposable ?? 0}</span>
              <span className="text-muted-foreground">? Unknown: {resultData.unknown ?? 0}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Total: {resultData.total_rows ?? 0} | Unique: {resultData.verified ?? 0}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => handleDownload("all")}>
                <Download className="h-3.5 w-3.5" /> All
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDownload("ok")}>
                <Download className="h-3.5 w-3.5" /> OK only
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDownload("ok_and_catch_all")}>
                <Download className="h-3.5 w-3.5" /> OK + Catch-all
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDownload("invalid")}>
                <Download className="h-3.5 w-3.5" /> Invalid
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDeleteFromServer()}>
                Delete from Server
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setMode("select"); setProgress(null); setResultData(null); setFileId(""); }}>
              New Verification
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Select mode
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Bulk Email Verification</h2>
        <p className="text-sm text-muted-foreground mt-1">Verify multiple emails at once using Million Verifier's bulk API.</p>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={!useCSV} onChange={() => setUseCSV(false)} className="accent-primary" />
          Select from CRM leads
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={useCSV} onChange={() => setUseCSV(true)} className="accent-primary" />
          Upload CSV file
        </label>
      </div>

      {useCSV ? (
        <Card>
          <CardContent className="pt-6">
            <label className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-border p-8 cursor-pointer hover:bg-accent/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{csvFile ? csvFile.name : "Click to upload a text/CSV file with one email per line"}</p>
              <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
            </label>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{selectedIds.size} of {leadsWithEmail.length} leads selected</p>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto border border-border rounded-md">
              {leadsWithEmail.map(l => (
                <label key={l.id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer border-b border-border last:border-0">
                  <Checkbox checked={selectedIds.has(l.id)} onCheckedChange={() => toggleOne(l.id)} />
                  <span className="text-sm flex-1 truncate">{l.name}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{l.email}</span>
                  {l.emailVerification && (
                    <Badge variant="outline" className="text-[10px]">
                      {getQualityDisplay(l.emailVerification.quality, l.emailVerification.result).icon}
                    </Badge>
                  )}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={startVerification} disabled={!useCSV && selectedIds.size === 0}>
        Start Verification {!useCSV && selectedIds.size > 0 && `(${selectedIds.size})`}
      </Button>
    </div>
  );
}
