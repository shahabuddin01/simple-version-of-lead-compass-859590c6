import { Component, type ErrorInfo, type ReactNode, useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Lead, PipelineStatus } from "@/types/lead";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Phone, X, Download, Copy, Check, Settings, CheckCircle2, XCircle, AlertTriangle,
  Bug, ChevronDown, ChevronUp, Smartphone, Wifi, WifiOff, RefreshCw,
  Clock, Send, RotateCcw, Trash2, BarChart3, Inbox, Signal,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiGetSMSQueue, apiAddToSMSQueue, apiUpdateSMSJob,
  apiGetSMSDevices, apiDeactivateSMSDevice, apiGetSMSStats,
  isBackendConfigured,
} from "@/services/api";
import { normalizePhoneBD, isValidBDPhone } from "@/lib/smsGateway";

// ── types ──
interface SMSTemplate {
  id: string;
  name: string;
  body: string;
}

interface SMSJob {
  id: number;
  lead_id: number;
  lead_name: string;
  phone_number: string;
  message: string;
  sim_preference: string;
  status: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  device_id: string;
  picked_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

interface SMSDevice {
  id: number;
  device_id: string;
  device_name: string;
  sim1_number: string;
  sim2_number: string;
  sim1_carrier: string;
  sim2_carrier: string;
  is_active: number;
  last_ping_at: string | null;
  app_version: string;
  registered_at: string;
}

interface SMSStats {
  sent_today: number;
  sent_this_week: number;
  sent_this_month: number;
  success_rate: number;
  failed_count: number;
  pending_count: number;
  active_devices: number;
  status_breakdown: { status: string; count: number }[];
  sim_usage: { sim_used: string; count: number }[];
}

type PhoneTarget = "work" | "personal" | "both" | "work-fallback";
type ActiveFilter = "all" | "active" | "inactive";
type TabType = "compose" | "queue" | "devices" | "analytics";

const PIPELINE_STATUSES: PipelineStatus[] = ["New", "Contacted", "In Progress", "Closed", "Not Interested"];

const DEFAULT_TEMPLATES: SMSTemplate[] = [
  { id: "intro", name: "Introduction", body: "Hi {name}, this is {sender}. I'd love to connect with you about opportunities at {company}." },
  { id: "followup", name: "Follow Up", body: "Hi {name}, just following up on our previous conversation. Would love to hear your thoughts." },
  { id: "meeting", name: "Meeting Request", body: "Hi {name}, I'd like to schedule a quick call at your convenience. Let me know a good time." },
];

const TEMPLATES_KEY = "nhproductionhouse_sms_templates";

function loadCustomTemplates(): SMSTemplate[] {
  try { const d = localStorage.getItem(TEMPLATES_KEY); const parsed = d ? JSON.parse(d) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function saveCustomTemplates(t: SMSTemplate[]) { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(t)); }

function personalize(template: string, lead: Lead, senderName: string): string {
  return template
    .replace(/\{name\}/gi, lead?.name ?? "")
    .replace(/\{company\}/gi, lead?.company ?? "")
    .replace(/\{position\}/gi, lead?.position ?? "")
    .replace(/\{industry\}/gi, lead?.type ?? "")
    .replace(/\{sender\}/gi, senderName ?? "")
    // Legacy [Name] format support
    .replace(/\[Name\]/g, lead?.name ?? "")
    .replace(/\[Company\]/g, lead?.company ?? "")
    .replace(/\[Position\]/g, lead?.position ?? "")
    .replace(/\[Industry\]/g, lead?.type ?? "")
    .replace(/\[Sender Name\]/g, senderName ?? "");
}

function smsPartCount(len: number) { return len <= 160 ? 1 : Math.ceil(len / 153); }

interface Props { leads: Lead[]; industries: string[]; companies: string[]; }

interface SMSErrorBoundaryProps { children: ReactNode; onReset: () => void; }
interface SMSErrorBoundaryState { error: string | null; }

class SMSErrorBoundary extends Component<SMSErrorBoundaryProps, SMSErrorBoundaryState> {
  state: SMSErrorBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): SMSErrorBoundaryState {
    return { error: error?.message || "SMS section encountered an error." };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("[SMSCenter]", error, errorInfo); }
  handleReset = () => { this.setState({ error: null }); this.props.onReset(); };
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-foreground">SMS section encountered an error</h2>
          <p className="mt-2 text-sm text-muted-foreground">{this.state.error}</p>
          <Button className="mt-4" onClick={this.handleReset}>Reload Section</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function getLeadPhones(lead: Lead): string[] {
  return [lead?.phone, lead?.personalPhone1, lead?.personalPhone2]
    .filter((p): p is string => !!p && typeof p === "string" && p.trim().length >= 5);
}

function getLeadInitials(name?: string): string {
  if (!name || !name.trim()) return "?";
  return name.split(" ").map(n => n?.[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
}

export function SMSCenter(props: Props) {
  const [resetKey, setResetKey] = useState(0);
  return (
    <SMSErrorBoundary onReset={() => setResetKey(v => v + 1)}>
      <SMSCenterContent key={resetKey} {...props} />
    </SMSErrorBoundary>
  );
}

function SMSCenterContent({ leads, industries, companies }: Props) {
  const [tab, setTab] = useState<TabType>("compose");

  // ── Filters ──
  const [fIndustry, setFIndustry] = useState("__all__");
  const [fCompany, setFCompany] = useState("__all__");
  const [fStatuses, setFStatuses] = useState<Set<PipelineStatus>>(new Set());
  const [fActive, setFActive] = useState<ActiveFilter>("all");
  const [fHasAny, setFHasAny] = useState(false);

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [phoneTarget, setPhoneTarget] = useState<PhoneTarget>("work-fallback");
  const [simPreference, setSimPreference] = useState<string>("ANY");

  // ── Message ──
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Templates ──
  const [customTemplates, setCustomTemplates] = useState<SMSTemplate[]>(loadCustomTemplates);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  // ── Queue ──
  const [queueJobs, setQueueJobs] = useState<SMSJob[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueFilter, setQueueFilter] = useState("ALL");

  // ── Devices ──
  const [devices, setDevices] = useState<SMSDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  // ── Stats ──
  const [stats, setStats] = useState<SMSStats | null>(null);

  // ── Sending ──
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Debug ──
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const safeLeads = useMemo(() => (Array.isArray(leads) ? leads.filter((l): l is Lead => !!l) : []), [leads]);

  const safeIndustries = useMemo(() => {
    const values = Array.isArray(industries) ? industries : [];
    return [...new Set(values.map(v => v?.trim?.() ?? "").filter(Boolean))];
  }, [industries]);

  const safeCompanies = useMemo(() => {
    const values = Array.isArray(companies) ? companies : [];
    return [...new Set(values.map(v => v?.trim?.() ?? "").filter(Boolean))];
  }, [companies]);

  const allTemplates = useMemo(() => {
    const seen = new Set<string>();
    return [...DEFAULT_TEMPLATES, ...customTemplates].filter(t => {
      const id = t?.id?.trim?.() ?? "";
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [customTemplates]);

  const filteredCompanies = useMemo(() => {
    if (fIndustry === "__all__") return safeCompanies;
    return [...new Set(safeLeads.filter(l => l?.type === fIndustry).map(l => l?.company?.trim?.() ?? "").filter(Boolean))];
  }, [fIndustry, safeLeads, safeCompanies]);

  useEffect(() => { setFCompany("__all__"); }, [fIndustry]);

  const filteredLeads = useMemo(() => {
    let result = safeLeads;
    if (fIndustry !== "__all__") result = result.filter(l => l?.type === fIndustry);
    if (fCompany !== "__all__") result = result.filter(l => l?.company === fCompany);
    if (fStatuses.size > 0) result = result.filter(l => fStatuses.has(l?.status));
    if (fActive === "active") result = result.filter(l => l?.active);
    if (fActive === "inactive") result = result.filter(l => !l?.active);
    if (fHasAny) result = result.filter(l => getLeadPhones(l).length > 0);
    return result;
  }, [safeLeads, fIndustry, fCompany, fStatuses, fActive, fHasAny]);

  const hasPhone = (lead: Lead) => !!lead?.phone?.trim();
  const hasPersonalPhone = (lead: Lead) => !!(lead?.personalPhone1?.trim() || lead?.personalPhone2?.trim());
  const hasAnyPhone = (lead: Lead) => getLeadPhones(lead).length > 0;

  const selectedLeads = useMemo(() => safeLeads.filter(l => selectedIds.has(l.id)), [safeLeads, selectedIds]);

  const recipientStats = useMemo(() => {
    let work = 0, personal = 0;
    selectedLeads.forEach(l => { if (hasPhone(l)) work++; if (hasPersonalPhone(l)) personal++; });
    return { total: selectedLeads.length, work, personal };
  }, [selectedLeads]);

  const debugStats = useMemo(() => {
    const totalLeads = safeLeads.length;
    const withAnyPhone = safeLeads.filter(l => getLeadPhones(l).length > 0).length;
    const validBDWork = safeLeads.filter(l => l?.phone?.trim() && isValidBDPhone(l.phone)).length;
    return { totalLeads, withAnyPhone, noPhones: totalLeads - withAnyPhone, validBDWork };
  }, [safeLeads]);

  // ── Load queue data ──
  const loadQueue = useCallback(async () => {
    if (!isBackendConfigured()) return;
    setQueueLoading(true);
    try {
      const statusParam = queueFilter === "ALL" ? "PENDING,PICKED,SENT,FAILED,CANCELLED" : queueFilter;
      const { data } = await apiGetSMSQueue(statusParam, 100);
      const result = data as any;
      const jobs = Array.isArray(result?.jobs) ? result.jobs : Array.isArray(result) ? result : [];
      setQueueJobs(jobs);
    } catch { setQueueJobs([]); }
    finally { setQueueLoading(false); }
  }, [queueFilter]);

  const loadDevices = useCallback(async () => {
    if (!isBackendConfigured()) return;
    setDevicesLoading(true);
    try {
      const { data } = await apiGetSMSDevices();
      setDevices(Array.isArray(data) ? data : []);
    } catch { setDevices([]); }
    finally { setDevicesLoading(false); }
  }, []);

  const loadStats = useCallback(async () => {
    if (!isBackendConfigured()) return;
    try {
      const { data } = await apiGetSMSStats();
      setStats(data);
    } catch { /* silent */ }
  }, []);

  // Auto-refresh queue every 30s when on queue tab
  useEffect(() => {
    if (tab === "queue") { loadQueue(); const interval = setInterval(loadQueue, 30000); return () => clearInterval(interval); }
  }, [tab, loadQueue]);

  useEffect(() => { if (tab === "devices") loadDevices(); }, [tab, loadDevices]);
  useEffect(() => { if (tab === "analytics") loadStats(); }, [tab, loadStats]);

  // ── Actions ──
  const toggleStatus = (s: PipelineStatus) => {
    setFStatuses(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  };

  const clearFilters = () => { setFIndustry("__all__"); setFCompany("__all__"); setFStatuses(new Set()); setFActive("all"); setFHasAny(false); };
  const selectAll = () => { const ids = new Set<string>(); filteredLeads.forEach(l => { if (hasAnyPhone(l)) ids.add(l.id); }); setSelectedIds(ids); };
  const deselectAll = () => setSelectedIds(new Set());
  const toggleSelect = (id: string) => { setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  const insertVariable = (variable: string) => {
    const ta = textareaRef.current;
    if (!ta) { setMessage(m => m + variable); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setMessage(message.slice(0, start) + variable + message.slice(end));
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + variable.length; });
  };

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    const tmpl = allTemplates.find(t => t.id === id);
    if (tmpl) setMessage(tmpl.body);
  };

  const saveTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) return;
    const tmpl: SMSTemplate = { id: crypto.randomUUID(), name, body: message };
    const updated = [...customTemplates, tmpl];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setShowSaveTemplate(false);
    setNewTemplateName("");
    toast.success(`Template "${name}" saved.`);
  };

  const buildRecipientList = useCallback(() => {
    const list: { phone: string; message: string; leadId: string; leadName: string }[] = [];
    selectedLeads.forEach(lead => {
      if (!lead) return;
      const msg = personalize(message, lead, senderName);
      const phones: string[] = [];
      if (phoneTarget === "work" && hasPhone(lead)) phones.push(lead.phone);
      else if (phoneTarget === "personal") {
        if (lead?.personalPhone1?.trim()) phones.push(lead.personalPhone1);
        if (lead?.personalPhone2?.trim()) phones.push(lead.personalPhone2);
      } else if (phoneTarget === "both") {
        if (hasPhone(lead)) phones.push(lead.phone);
        if (lead?.personalPhone1?.trim()) phones.push(lead.personalPhone1);
        if (lead?.personalPhone2?.trim()) phones.push(lead.personalPhone2);
      } else if (phoneTarget === "work-fallback") {
        if (hasPhone(lead)) phones.push(lead.phone);
        else if (lead?.personalPhone1?.trim()) phones.push(lead.personalPhone1);
        else if (lead?.personalPhone2?.trim()) phones.push(lead.personalPhone2);
      }
      phones.filter(Boolean).forEach(p => list.push({ phone: p, message: msg, leadId: lead.id, leadName: lead?.name ?? "Unknown" }));
    });
    return list;
  }, [selectedLeads, message, senderName, phoneTarget]);

  const previewLead = selectedLeads[0];
  const previewMessage = previewLead ? personalize(message, previewLead, senderName) : message;
  const charCount = message.length;
  const parts = smsPartCount(charCount);
  const charColor = charCount >= 160 ? "text-destructive" : charCount >= 140 ? "text-amber-500" : "text-muted-foreground";
  const canSend = selectedIds.size > 0 && message.trim().length > 0 && senderName.trim().length > 0;

  const handleAddToQueue = async () => {
    const recipients = buildRecipientList();
    if (recipients.length === 0) return;
    setShowConfirm(false);
    setSending(true);

    try {
      if (isBackendConfigured()) {
        // Group by lead for batch submission
        const grouped = new Map<string, { phones: string[]; message: string; leadId: string; leadName: string }>();
        recipients.forEach(r => {
          const existing = grouped.get(r.leadId);
          if (existing) { existing.phones.push(r.phone); }
          else { grouped.set(r.leadId, { phones: [r.phone], message: r.message, leadId: r.leadId, leadName: r.leadName }); }
        });

        let totalQueued = 0;
        for (const [, batch] of grouped) {
          const { data } = await apiAddToSMSQueue({
            phones: batch.phones,
            message: batch.message,
            lead_id: parseInt(batch.leadId) || 0,
            lead_name: batch.leadName,
            sim_preference: simPreference,
          });
          totalQueued += data?.queued || 0;
        }
        toast.success(`${totalQueued} SMS added to queue. Your Android device will pick them up and send.`);
        setTab("queue");
        loadQueue();
      } else {
        // Fallback — open SMS app
        const first = recipients[0];
        if (first) {
          const smsUri = `sms:${first.phone}?body=${encodeURIComponent(first.message)}`;
          window.open(smsUri, "_blank");
          toast.success(`SMS session created for ${recipients.length} recipients.`);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add SMS to queue.");
    } finally {
      setSending(false);
    }
  };

  const handleCancelJob = async (jobId: number) => {
    try {
      await apiUpdateSMSJob(jobId, "cancel");
      toast.success("SMS cancelled");
      loadQueue();
    } catch { toast.error("Failed to cancel"); }
  };

  const handleRetryJob = async (jobId: number) => {
    try {
      await apiUpdateSMSJob(jobId, "retry");
      toast.success("SMS re-queued for retry");
      loadQueue();
    } catch { toast.error("Failed to retry"); }
  };

  const handleDeactivateDevice = async (deviceId: string) => {
    try {
      await apiDeactivateSMSDevice(deviceId);
      toast.success("Device deactivated");
      loadDevices();
    } catch { toast.error("Failed to deactivate device"); }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDING": return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 text-[10px]">🟡 Pending</Badge>;
      case "PICKED": return <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 text-[10px]">🔵 Picked</Badge>;
      case "SENT": return <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 text-[10px]">🟢 Sent</Badge>;
      case "FAILED": return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 text-[10px]">🔴 Failed</Badge>;
      case "CANCELLED": return <Badge variant="secondary" className="text-[10px]">Cancelled</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  const devicePingStatus = (lastPing: string | null) => {
    if (!lastPing) return { color: "text-muted-foreground", label: "Never" };
    const diff = (Date.now() - new Date(lastPing).getTime()) / 60000;
    if (diff < 1) return { color: "text-green-600", label: "Online" };
    if (diff < 5) return { color: "text-amber-500", label: `${Math.round(diff)}m ago` };
    return { color: "text-destructive", label: `${Math.round(diff)}m ago` };
  };

  // ── RENDER ──
  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          ["compose", "Compose", <Send key="c" className="h-3.5 w-3.5" />],
          ["queue", "Queue", <Inbox key="q" className="h-3.5 w-3.5" />],
          ["devices", "Devices", <Smartphone key="d" className="h-3.5 w-3.5" />],
          ["analytics", "Analytics", <BarChart3 key="a" className="h-3.5 w-3.5" />],
        ] as [TabType, string, React.ReactNode][]).map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Debug Panel */}
      <div className="rounded-lg border border-border bg-muted/30">
        <button onClick={() => setShowDebugPanel(v => !v)} className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <span className="flex items-center gap-1.5"><Bug className="h-3.5 w-3.5" /> Debug — {debugStats.totalLeads} leads, {debugStats.withAnyPhone} with phones</span>
          {showDebugPanel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showDebugPanel && (
          <div className="grid grid-cols-4 gap-3 border-t border-border px-4 py-3">
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Leads</p><p className="text-lg font-semibold text-foreground">{debugStats.totalLeads}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">With Any Phone</p><p className="text-lg font-semibold text-green-600">{debugStats.withAnyPhone}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">No Phones</p><p className="text-lg font-semibold text-destructive">{debugStats.noPhones}</p></div>
            <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valid BD Work</p><p className="text-lg font-semibold text-foreground">{debugStats.validBDWork}</p></div>
          </div>
        )}
      </div>

      {/* ─── COMPOSE TAB ─── */}
      {tab === "compose" && (
        <div className="space-y-4">
          {/* Backend status bar */}
          {isBackendConfigured() ? (
            <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-4 py-2 dark:border-green-900 dark:bg-green-950/30">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-green-700 dark:text-green-400 font-medium">SMS Queue active — messages will be sent by your Android device</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-900 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-700 dark:text-amber-400">Backend not configured — SMS will open your device's SMS app</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── LEFT: Recipients ── */}
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-semibold text-foreground">Select Recipients</h2>

              <div className="grid grid-cols-2 gap-2">
                <Select value={fIndustry} onValueChange={setFIndustry}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Industry" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Industries</SelectItem>
                    {safeIndustries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fCompany} onValueChange={setFCompany}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Company" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Companies</SelectItem>
                    {filteredCompanies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PIPELINE_STATUSES.map(s => (
                  <button key={s} onClick={() => toggleStatus(s)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${fStatuses.has(s) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex gap-1.5">
                {(["all", "active", "inactive"] as ActiveFilter[]).map(v => (
                  <button key={v} onClick={() => setFActive(v)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${fActive === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
                    {v === "all" ? "All" : v === "active" ? "Active Only" : "Inactive Only"}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={fHasAny} onCheckedChange={(c) => setFHasAny(!!c)} /> Has Any Phone
              </label>

              <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear all filters</button>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs font-medium text-primary hover:underline">Select All</button>
                  <button onClick={deselectAll} className="text-xs font-medium text-muted-foreground hover:underline">Deselect All</button>
                </div>
                <span className="text-xs text-muted-foreground">{filteredLeads.length} leads</span>
              </div>

              <div className="max-h-[340px] overflow-y-auto space-y-1 rounded-md border border-border p-1">
                {filteredLeads.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No leads match filters</p>}
                {filteredLeads.map(lead => {
                  const canSelect = hasAnyPhone(lead);
                  const selected = selectedIds.has(lead.id);
                  return (
                    <button key={lead.id} onClick={() => canSelect && toggleSelect(lead.id)} disabled={!canSelect}
                      className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors ${!canSelect ? "opacity-50 cursor-not-allowed" : selected ? "bg-primary/10" : "hover:bg-accent"}`}>
                      {canSelect ? <Checkbox checked={selected} className="mt-1" tabIndex={-1} /> : <div className="mt-1 h-4 w-4" />}
                      <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="text-[10px] font-medium bg-muted text-muted-foreground">{getLeadInitials(lead?.name)}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{lead?.name || "Unknown"}</span>
                          {!canSelect && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">No phone</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{lead?.company || ""}{lead?.type ? ` · ${lead.type}` : ""}</p>
                        <div className="flex gap-3 mt-0.5">
                          {lead?.phone?.trim() && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Phone className="h-3 w-3" /> {lead.phone}</span>}
                          {lead?.personalPhone1?.trim() && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Phone className="h-3 w-3" /> {lead.personalPhone1}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{recipientStats.total}</span> recipients ({recipientStats.work} work, {recipientStats.personal} personal)
              </p>

              {/* Phone target + SIM preference */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Send to:</p>
                <div className="space-y-1.5">
                  {([
                    ["work-fallback", "Work Phone → fallback to Personal"],
                    ["work", "Work Phone only"],
                    ["personal", "Personal Phone only"],
                    ["both", "Both numbers (multiple SMS per contact)"],
                  ] as [PhoneTarget, string][]).map(([val, label]) => (
                    <label key={val} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input type="radio" name="phoneTarget" value={val} checked={phoneTarget === val} onChange={() => setPhoneTarget(val)} className="accent-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">SIM Preference:</p>
                <div className="flex gap-2">
                  {["ANY", "SIM1", "SIM2"].map(sim => (
                    <button key={sim} onClick={() => setSimPreference(sim)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${simPreference === sim ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
                      {sim === "ANY" ? "Any SIM" : sim}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT: Composer ── */}
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-semibold text-foreground">Compose Message</h2>

              <div className="flex gap-2">
                <Select value={templateId} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="h-9 text-xs flex-1"><SelectValue placeholder="Select a template..." /></SelectTrigger>
                  <SelectContent>
                    {allTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setShowSaveTemplate(true)} className="text-xs shrink-0">+ Save Template</Button>
              </div>

              {showSaveTemplate && (
                <div className="rounded-md border border-border bg-background p-3 space-y-2">
                  <Input placeholder="Template Name *" value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveTemplate(); if (e.key === "Escape") setShowSaveTemplate(false); }} autoFocus className="h-8 text-sm" />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
                    <Button size="sm" onClick={saveTemplate} disabled={!newTemplateName.trim()}>Save</Button>
                  </div>
                </div>
              )}

              <Textarea ref={textareaRef} value={message} onChange={e => setMessage(e.target.value)} placeholder="Hi {name}, ..." className="min-h-[140px] text-sm" />

              <div className="flex justify-between">
                <span className={`text-xs ${charColor}`}>{charCount} / 160 characters ({parts} SMS part{parts > 1 ? "s" : ""})</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Insert:</span>
                {["{name}", "{company}", "{position}", "{industry}", "{sender}"].map(v => (
                  <button key={v} onClick={() => insertVariable(v)} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/80 transition-colors">
                    {v}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Sender Name *</label>
                <Input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder='e.g. "Nasir from NH Production House"' className="mt-1 h-9 text-sm" />
              </div>

              {previewLead && (
                <div className="rounded-md border border-border bg-muted/50 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Preview ({previewLead.name})</p>
                  <div className="h-px bg-border" />
                  <p className="text-sm text-foreground whitespace-pre-wrap">{previewMessage || "..."}</p>
                </div>
              )}

              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {buildRecipientList().length} SMS will be queued for {recipientStats.total} recipient{recipientStats.total !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">SIM: {simPreference} · {parts} part{parts > 1 ? "s" : ""} per SMS</p>
                <Button onClick={() => setShowConfirm(true)} disabled={!canSend || sending} className="w-full">
                  {sending ? "Adding to Queue..." : "Add to SMS Queue →"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">SMS will be picked up and sent by your connected Android device</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── QUEUE TAB ─── */}
      {tab === "queue" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {["ALL", "PENDING", "PICKED", "SENT", "FAILED", "CANCELLED"].map(s => (
                <button key={s} onClick={() => setQueueFilter(s)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${queueFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"}`}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={loadQueue} disabled={queueLoading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${queueLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {!isBackendConfigured() ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground">Backend Not Configured</h3>
              <p className="text-xs text-muted-foreground mt-1">Set VITE_API_URL in your .env file to enable SMS queue.</p>
            </div>
          ) : queueJobs.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground">Queue Empty</h3>
              <p className="text-xs text-muted-foreground mt-1">No SMS jobs matching this filter.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Lead</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Phone</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Message</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">SIM</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Created</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queueJobs.map(job => (
                    <tr key={job.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground text-xs">{job.lead_name || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">{job.phone_number}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs max-w-[180px] truncate">{job.message}</td>
                      <td className="px-3 py-2 text-xs">{job.sim_preference}</td>
                      <td className="px-3 py-2">{statusBadge(job.status)}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">{new Date(job.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {job.status === "PENDING" && (
                            <button onClick={() => handleCancelJob(job.id)} className="rounded p-1 hover:bg-accent" title="Cancel">
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          )}
                          {job.status === "FAILED" && (
                            <button onClick={() => handleRetryJob(job.id)} className="rounded p-1 hover:bg-accent" title="Retry">
                              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center">Auto-refreshes every 30 seconds</p>
        </div>
      )}

      {/* ─── DEVICES TAB ─── */}
      {tab === "devices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Connected Android Devices</h2>
            <Button variant="outline" size="sm" onClick={loadDevices} disabled={devicesLoading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${devicesLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {!isBackendConfigured() ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <Smartphone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Backend not configured</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <WifiOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground">No Devices Connected</h3>
              <p className="text-xs text-muted-foreground mt-1">Install the NH Production House SMS app on your Android device to start sending.</p>
              <div className="mt-4 rounded-md border border-border bg-muted/50 p-3 text-left space-y-1">
                <p className="text-xs font-medium text-foreground">Setup Instructions:</p>
                <p className="text-xs text-muted-foreground">1. Install the Android SMS Gateway app</p>
                <p className="text-xs text-muted-foreground">2. Enter your CRM URL: <code className="bg-muted px-1 rounded">{import.meta.env.VITE_API_URL || "[YOUR_DOMAIN]"}/backend/api</code></p>
                <p className="text-xs text-muted-foreground">3. The app will auto-register and start polling for SMS jobs</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {devices.map(device => {
                const ping = devicePingStatus(device.last_ping_at);
                return (
                  <div key={device.device_id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-muted p-2"><Smartphone className="h-5 w-5 text-foreground" /></div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{device.device_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{device.device_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 text-xs font-medium ${ping.color}`}>
                          {ping.label === "Online" ? <Wifi className="h-3.5 w-3.5" /> : <Signal className="h-3.5 w-3.5" />}
                          {ping.label}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => handleDeactivateDevice(device.device_id)} className="text-xs text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-md border border-border bg-muted/30 p-2">
                        <p className="text-muted-foreground">SIM 1</p>
                        <p className="font-medium text-foreground">{device.sim1_number || "—"}</p>
                        <p className="text-muted-foreground">{device.sim1_carrier || "Unknown carrier"}</p>
                      </div>
                      <div className="rounded-md border border-border bg-muted/30 p-2">
                        <p className="text-muted-foreground">SIM 2</p>
                        <p className="font-medium text-foreground">{device.sim2_number || "—"}</p>
                        <p className="text-muted-foreground">{device.sim2_carrier || "Unknown carrier"}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">App v{device.app_version} · Registered {new Date(device.registered_at).toLocaleDateString()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── ANALYTICS TAB ─── */}
      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">SMS Analytics</h2>
            <Button variant="outline" size="sm" onClick={loadStats}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</Button>
          </div>

          {!stats ? (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{isBackendConfigured() ? "Loading analytics..." : "Backend not configured"}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Sent Today", value: stats.sent_today, color: "text-green-600" },
                  { label: "This Week", value: stats.sent_this_week, color: "text-blue-600" },
                  { label: "This Month", value: stats.sent_this_month, color: "text-foreground" },
                  { label: "Success Rate", value: `${stats.success_rate}%`, color: stats.success_rate >= 90 ? "text-green-600" : stats.success_rate >= 70 ? "text-amber-500" : "text-destructive" },
                ].map(s => (
                  <div key={s.label} className="rounded-lg border border-border bg-card p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-medium text-foreground mb-2">Queue Status</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Pending</span><span className="font-medium text-amber-500">{stats.pending_count}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Failed</span><span className="font-medium text-destructive">{stats.failed_count}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Active Devices</span><span className="font-medium text-green-600">{stats.active_devices}</span></div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-medium text-foreground mb-2">SIM Usage</p>
                  {stats.sim_usage.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {stats.sim_usage.map(s => (
                        <div key={s.sim_used} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{s.sim_used}</span>
                          <span className="font-medium text-foreground">{s.count} sent</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-medium text-foreground mb-2">Status Breakdown</p>
                  {stats.status_breakdown.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {stats.status_breakdown.map(s => (
                        <div key={s.status} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{s.status}</span>
                          <span className="font-medium text-foreground">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60" onClick={() => setShowConfirm(false)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground">Add to SMS Queue</h3>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{buildRecipientList().length}</span> SMS will be queued for sending.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Recipients: {recipientStats.total} leads</p>
              <p>SMS parts per message: {parts}</p>
              <p>SIM preference: {simPreference}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Messages will be picked up by your connected Android device and sent using physical SIM cards. No third-party SMS API needed.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button onClick={handleAddToQueue}>Confirm & Queue</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
