import { useState, useCallback } from "react";
import { RefreshCw, Server, MailCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface APIStatus {
  name: string;
  icon: React.ReactNode;
  status: "online" | "error" | "not_configured";
  lastChecked: string | null;
  statusMessage: string;
}

const MV_KEY = "nhproductionhouse_ev_settings";
const CRED_KEY = "nhproductionhouse_api_credentials";

function checkCRMAPI(): APIStatus {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (!raw) return { name: "CRM API", icon: <Server className="h-3.5 w-3.5" />, status: "not_configured", lastChecked: null, statusMessage: "No API key generated" };
    const creds = JSON.parse(atob(raw));
    return {
      name: "CRM API", icon: <Server className="h-3.5 w-3.5" />,
      status: creds.isActive && creds.apiKey ? "online" : "not_configured",
      lastChecked: new Date().toLocaleTimeString(),
      statusMessage: creds.isActive ? "Active" : "Inactive",
    };
  } catch {
    return { name: "CRM API", icon: <Server className="h-3.5 w-3.5" />, status: "not_configured", lastChecked: null, statusMessage: "Not configured" };
  }
}

function checkMillionVerifier(): APIStatus {
  try {
    const settings = JSON.parse(localStorage.getItem(MV_KEY) || "{}");
    return {
      name: "MillionVerifier", icon: <MailCheck className="h-3.5 w-3.5" />,
      status: settings.apiKey ? "online" : "not_configured",
      lastChecked: new Date().toLocaleTimeString(),
      statusMessage: settings.apiKey ? "Connected" : "Not configured",
    };
  } catch {
    return { name: "MillionVerifier", icon: <MailCheck className="h-3.5 w-3.5" />, status: "not_configured", lastChecked: null, statusMessage: "Not configured" };
  }
}

export function APIHealthBar() {
  const [statuses, setStatuses] = useState<APIStatus[]>([checkCRMAPI(), checkMillionVerifier()]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setStatuses([checkCRMAPI(), checkMillionVerifier()]);
      setRefreshing(false);
      toast.success("Status refreshed");
    }, 500);
  }, []);

  const statusColors = { online: "bg-green-500", error: "bg-red-500", not_configured: "bg-muted-foreground/40" };
  const statusText = { online: "text-green-600", error: "text-red-600", not_configured: "text-muted-foreground" };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2.5">
      <span className="text-xs font-medium text-muted-foreground">API Status</span>
      <div className="flex items-center gap-3 flex-1">
        <TooltipProvider>
          {statuses.map((api) => (
            <Tooltip key={api.name}>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-1.5 text-xs font-medium ${statusText[api.status]}`}>
                  <span className={`h-2 w-2 rounded-full ${statusColors[api.status]}`} />
                  {api.icon}
                  <span>{api.name}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{api.statusMessage}</p>
                {api.lastChecked && <p className="text-[10px] text-muted-foreground">Last checked: {api.lastChecked}</p>}
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
      <button onClick={refresh} disabled={refreshing} className="rounded-md p-1.5 hover:bg-accent transition-colors">
        <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
