import { useState, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "nhproductionhouse_api_logs";

interface APILog {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress: string;
  requestedAt: string;
}

function loadLogs(): APILog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(atob(raw));
  } catch {}
  // Generate sample logs for demonstration
  const sampleLogs: APILog[] = [
    { id: "1", endpoint: "/api/v1/leads", method: "GET", statusCode: 200, ipAddress: "192.168.1.45", requestedAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "2", endpoint: "/api/v1/leads?industry=EdTech", method: "GET", statusCode: 200, ipAddress: "192.168.1.45", requestedAt: new Date(Date.now() - 7200000).toISOString() },
    { id: "3", endpoint: "/api/v1/leads/abc-123", method: "GET", statusCode: 404, ipAddress: "10.0.0.12", requestedAt: new Date(Date.now() - 10800000).toISOString() },
    { id: "4", endpoint: "/api/v1/leads", method: "GET", statusCode: 403, ipAddress: "203.0.113.50", requestedAt: new Date(Date.now() - 14400000).toISOString() },
    { id: "5", endpoint: "/api/v1/leads?active=true", method: "GET", statusCode: 200, ipAddress: "192.168.1.45", requestedAt: new Date(Date.now() - 18000000).toISOString() },
  ];
  localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify(sampleLogs)));
  return sampleLogs;
}

export function APIRequestLogs() {
  const [logs, setLogs] = useState<APILog[]>(loadLogs);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return logs;
    return logs.filter(l => l.statusCode.toString() === statusFilter);
  }, [logs, statusFilter]);

  const clearLogs = () => {
    setLogs([]);
    localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify([])));
    toast.success("Logs cleared");
  };

  const statusColor = (code: number) => {
    if (code >= 200 && code < 300) return "text-green-600 bg-green-500/15";
    if (code === 403) return "text-yellow-600 bg-yellow-500/15";
    if (code === 404) return "text-orange-600 bg-orange-500/15";
    return "text-destructive bg-destructive/15";
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Filter by status:</span>
          {["all", "200", "403", "404", "500"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
        <button onClick={clearLogs} className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-3 w-3" /> Clear Logs
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Timestamp</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Method</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Endpoint</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No logs found</td></tr>
            ) : (
              filtered.map(log => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{new Date(log.requestedAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5"><span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold font-mono text-primary">{log.method}</span></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{log.endpoint}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(log.statusCode)}`}>{log.statusCode}</span></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{log.ipAddress}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Showing last {filtered.length} requests</p>
    </div>
  );
}
