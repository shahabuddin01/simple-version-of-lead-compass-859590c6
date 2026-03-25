import { useState, useCallback } from "react";
import { RefreshCw, Server, Database, MailCheck, Mail, HardDrive, MessageSquare, Globe, Code2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface APIStatus {
  name: string;
  icon: React.ReactNode;
  status: "online" | "error" | "not_configured";
  lastChecked: string | null;
  statusMessage: string;
  group: "internal" | "external" | "tools";
  scrollTarget?: string;
}

const SMTP_KEY = "nhproductionhouse_smtp_settings";
const MV_KEY = "nhproductionhouse_ev_settings";
const GDRIVE_KEY = "nhproductionhouse_gdrive_connection";
const TG_KEY = "nhproductionhouse_telegram_settings";

function getInitialStatuses(): APIStatus[] {
  const apiUrl = import.meta.env.VITE_API_URL;
  const mvKey = (() => { try { const s = JSON.parse(localStorage.getItem(MV_KEY) || "{}"); return s.apiKey; } catch { return null; } })();
  const smtp = (() => { try { const s = JSON.parse(localStorage.getItem(SMTP_KEY) || "null"); return s?.host && s?.isActive; } catch { return false; } })();
  const gdrive = (() => { try { const g = JSON.parse(localStorage.getItem(GDRIVE_KEY) || "null"); return g?.connected; } catch { return false; } })();
  const tg = (() => { try { const t = JSON.parse(localStorage.getItem(TG_KEY) || "{}"); return t?.botToken && t?.chatId; } catch { return false; } })();
  const apiActive = (() => { try { const c = JSON.parse(atob(localStorage.getItem("nhproductionhouse_api_credentials") || "")); return c?.isActive; } catch { return false; } })();

  return [
    { name: "CRM API", icon: <Server className="h-3.5 w-3.5" />, status: apiActive ? "online" : "not_configured", lastChecked: null, statusMessage: apiActive ? "API key active" : "No API key configured", group: "internal", scrollTarget: "card-crm-api" },
    { name: "PHP Backend", icon: <Database className="h-3.5 w-3.5" />, status: apiUrl ? "online" : "not_configured", lastChecked: null, statusMessage: apiUrl ? "Backend URL configured" : "VITE_API_URL not set", group: "internal", scrollTarget: "card-crm-api" },
    { name: "MillionVerifier", icon: <MailCheck className="h-3.5 w-3.5" />, status: mvKey ? "online" : "not_configured", lastChecked: null, statusMessage: mvKey ? "API key configured" : "Needs API key", group: "external", scrollTarget: "card-millionverifier" },
    { name: "SMTP", icon: <Mail className="h-3.5 w-3.5" />, status: smtp ? "online" : "not_configured", lastChecked: null, statusMessage: smtp ? "Mail server active" : "Not configured", group: "external", scrollTarget: "card-smtp" },
    { name: "Google Drive", icon: <HardDrive className="h-3.5 w-3.5" />, status: gdrive ? "online" : "not_configured", lastChecked: null, statusMessage: gdrive ? "Connected" : "Not connected", group: "external", scrollTarget: "card-google-drive" },
    { name: "Telegram", icon: <MessageSquare className="h-3.5 w-3.5" />, status: tg ? "online" : "not_configured", lastChecked: null, statusMessage: tg ? "Bot configured" : "Needs bot token", group: "external", scrollTarget: "card-telegram" },
    { name: "Email Tools", icon: <Mail className="h-3.5 w-3.5" />, status: apiUrl ? "online" : "not_configured", lastChecked: null, statusMessage: apiUrl ? "Available via API" : "Needs backend", group: "tools", scrollTarget: "card-email-tools" },
    { name: "IP Geo", icon: <Globe className="h-3.5 w-3.5" />, status: "online", lastChecked: null, statusMessage: "Free tier — no key needed", group: "tools", scrollTarget: "card-ip-geo" },
    { name: "IDE Tools", icon: <Code2 className="h-3.5 w-3.5" />, status: apiUrl ? "online" : "not_configured", lastChecked: null, statusMessage: apiUrl ? "REST API available" : "Needs backend URL", group: "tools", scrollTarget: "card-ide-tools" },
  ];
}

const statusConfig = {
  online: { dot: "bg-green-500", label: "Online" },
  error: { dot: "bg-destructive", label: "Error" },
  not_configured: { dot: "bg-yellow-500", label: "Not Set" },
};

const groupLabels: Record<string, string> = {
  internal: "Internal",
  external: "External",
  tools: "Tools",
};

function formatTimeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function scrollToCard(id?: string) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary/50");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 2000);
  }
}

export function APIHealthBar() {
  const [statuses, setStatuses] = useState<APIStatus[]>(getInitialStatuses);
  const [checking, setChecking] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<string | null>(null);

  const checkAll = useCallback(async () => {
    setChecking(true);
    const now = new Date().toISOString();
    const fresh = getInitialStatuses().map(s => ({ ...s, lastChecked: now }));

    const apiUrl = import.meta.env.VITE_API_URL;
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/backend/api/health`, { signal: AbortSignal.timeout(5000) });
        const idx = fresh.findIndex(s => s.name === "PHP Backend");
        if (idx >= 0) {
          fresh[idx].status = res.ok ? "online" : "error";
          fresh[idx].statusMessage = res.ok ? "Backend responding" : "Backend returned error";
        }
      } catch {
        const idx = fresh.findIndex(s => s.name === "PHP Backend");
        if (idx >= 0) { fresh[idx].status = "error"; fresh[idx].statusMessage = "Backend unreachable"; }
      }
    }

    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
      const idx = fresh.findIndex(s => s.name === "IP Geo");
      if (idx >= 0) {
        fresh[idx].status = res.ok ? "online" : "error";
        fresh[idx].statusMessage = res.ok ? "Service responding" : "Service error";
      }
    } catch {
      const idx = fresh.findIndex(s => s.name === "IP Geo");
      if (idx >= 0) { fresh[idx].status = "error"; fresh[idx].statusMessage = "Service unreachable"; }
    }

    setStatuses(fresh);
    setLastFullCheck(now);
    setChecking(false);
    toast.success("All API statuses refreshed");
  }, []);

  const groups = ["internal", "external", "tools"] as const;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">API Health Overview</h3>
          <div className="flex items-center gap-3">
            {lastFullCheck && (
              <span className="text-[11px] text-muted-foreground">
                Checked {formatTimeAgo(lastFullCheck)}
              </span>
            )}
            <button
              onClick={checkAll}
              disabled={checking}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking..." : "Check All"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {groups.map(group => {
            const items = statuses.filter(s => s.group === group);
            return (
              <div key={group} className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16 shrink-0">
                  {groupLabels[group]}
                </span>
                {items.map(api => {
                  const cfg = statusConfig[api.status];
                  return (
                    <Tooltip key={api.name}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => scrollToCard(api.scrollTarget)}
                          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs cursor-pointer transition-all hover:bg-accent/50 hover:shadow-sm active:scale-[0.97]"
                        >
                          <span className="text-muted-foreground">{api.icon}</span>
                          <span className="font-medium text-foreground">{api.name}</span>
                          <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        <p className="font-medium">{api.name} — {cfg.label}</p>
                        <p className="text-muted-foreground">{api.statusMessage}</p>
                        {api.lastChecked && (
                          <p className="text-muted-foreground">Checked: {formatTimeAgo(api.lastChecked)}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
