import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Upload, Download, RefreshCw, Check, X, MessageSquare, Instagram, Linkedin, Trash2, Pencil, Search, SlidersHorizontal, MoreVertical, Users, Flame, Thermometer, Snowflake, MailCheck } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { SocialLink } from "@/components/crm/SocialLink";
import { toast } from "sonner";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Types
export interface ClientComm {
  id: string;
  name: string;
  designation: string;
  company: string;
  linkedin: string;
  facebook: string;
  instagram: string;
  lead_status: "HOT" | "WARM" | "COLD" | "";
  lead_collected_date: string;
  mail_status: "not_send" | "mail_sent" | "follow_up_sent" | "reply_received" | "no";
  mail_sent_date: string;
  comments: string;
  created_at?: string;
  updated_at?: string;
}

const STORAGE_KEY = "nhproductionhouse_client_communications";

function loadClients(): ClientComm[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function saveClients(clients: ClientComm[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

const leadStatusConfig: Record<string, { label: string; className: string }> = {
  HOT: { label: "HOT", className: "bg-destructive/15 text-destructive border-destructive/30" },
  WARM: { label: "WARM", className: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400" },
  COLD: { label: "COLD", className: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400" },
  "": { label: "—", className: "text-muted-foreground" },
};

const mailStatusConfig: Record<string, { label: string; className: string }> = {
  not_send: { label: "Not Sent", className: "bg-muted text-muted-foreground border-border" },
  mail_sent: { label: "Mail Sent", className: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400" },
  follow_up_sent: { label: "Follow Up", className: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400" },
  reply_received: { label: "Replied ✅", className: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400" },
  no: { label: "No", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

interface SyncModalProps {
  open: boolean;
  onClose: () => void;
  leads: any[];
  existingClients: ClientComm[];
  onSync: (clients: Omit<ClientComm, "id">[]) => void;
}

function SyncFromLeadsModal({ open, onClose, leads, existingClients, onSync }: SyncModalProps) {
  const [skip, setSkip] = useState(true);
  const [industryFilter, setIndustryFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const industries = useMemo(() => [...new Set(leads.map(l => l.type).filter(Boolean))].sort(), [leads]);
  const companies = useMemo(() => [...new Set(leads.map(l => l.company).filter(Boolean))].sort(), [leads]);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (industryFilter !== "all" && l.type !== industryFilter) return false;
      if (companyFilter !== "all" && l.company !== companyFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      return true;
    });
  }, [leads, industryFilter, companyFilter, statusFilter]);

  const syncable = useMemo(() => {
    if (!skip) return filtered;
    const existingKeys = new Set(existingClients.map(c => `${c.name.toLowerCase()}|${c.company.toLowerCase()}`));
    return filtered.filter(l => !existingKeys.has(`${l.name.toLowerCase()}|${l.company.toLowerCase()}`));
  }, [filtered, skip, existingClients]);

  const handleSync = () => {
    const newClients = syncable.map(l => ({
      name: l.name || "",
      designation: l.position || "",
      company: l.company || "",
      linkedin: l.linkedin || "",
      facebook: l.facebook || "",
      instagram: l.instagram || "",
      lead_status: "" as const,
      lead_collected_date: "",
      mail_status: "not_send" as const,
      mail_sent_date: "",
      comments: "",
    }));
    onSync(newClients);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync Contacts from Main CRM</DialogTitle>
          <DialogDescription>Import leads from the main CRM leads table as clients here.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Industry</Label>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {industries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Company</Label>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Contacted">Contacted</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">Matching leads found: <strong>{filtered.length}</strong></p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={skip} onChange={e => setSkip(e.target.checked)} className="rounded border-input" />
            Skip leads already in this list (match by name + company)
          </label>
          {skip && <p className="text-xs text-muted-foreground">Will sync: {syncable.length} new contacts</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSync} disabled={syncable.length === 0}>Sync {syncable.length} Contacts</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ClientModalProps {
  open: boolean;
  onClose: () => void;
  client: ClientComm | null;
  onSave: (data: Omit<ClientComm, "id">) => void;
}

function ClientModal({ open, onClose, client, onSave }: ClientModalProps) {
  const [form, setForm] = useState({
    name: "", designation: "", company: "", linkedin: "", facebook: "", instagram: "",
    lead_status: "" as ClientComm["lead_status"], lead_collected_date: "",
    mail_status: "not_send" as ClientComm["mail_status"], mail_sent_date: "", comments: "",
  });

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name, designation: client.designation, company: client.company,
        linkedin: client.linkedin, facebook: client.facebook, instagram: client.instagram,
        lead_status: client.lead_status, lead_collected_date: client.lead_collected_date,
        mail_status: client.mail_status, mail_sent_date: client.mail_sent_date, comments: client.comments,
      });
    } else {
      setForm({ name: "", designation: "", company: "", linkedin: "", facebook: "", instagram: "",
        lead_status: "", lead_collected_date: "", mail_status: "not_send", mail_sent_date: "", comments: "" });
    }
  }, [client, open]);

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    onSave(form);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? "Edit Client" : "Add Client"}</DialogTitle>
          <DialogDescription>{client ? "Update client communication details." : "Add a new client to track communications."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</legend>
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Designation</Label><Input value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} /></div>
            <div><Label>Company</Label><Input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} /></div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Social Media</legend>
            <div><Label>LinkedIn</Label><Input value={form.linkedin} onChange={e => setForm(p => ({ ...p, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/..." /></div>
            <div><Label>Facebook</Label><Input value={form.facebook} onChange={e => setForm(p => ({ ...p, facebook: e.target.value }))} placeholder="https://facebook.com/..." /></div>
            <div><Label>Instagram</Label><Input value={form.instagram} onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))} placeholder="https://instagram.com/..." /></div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Communication</legend>
            <div>
              <Label>Lead Status</Label>
              <Select value={form.lead_status || "none"} onValueChange={v => setForm(p => ({ ...p, lead_status: v === "none" ? "" : v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="HOT">HOT</SelectItem>
                  <SelectItem value="WARM">WARM</SelectItem>
                  <SelectItem value="COLD">COLD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lead Collected Date</Label>
              <Input type="date" value={form.lead_collected_date} onChange={e => setForm(p => ({ ...p, lead_collected_date: e.target.value }))} />
            </div>
            <div>
              <Label>Mail Status</Label>
              <Select value={form.mail_status} onValueChange={v => setForm(p => ({ ...p, mail_status: v as any, mail_sent_date: v === "mail_sent" && !p.mail_sent_date ? new Date().toISOString().slice(0, 10) : p.mail_sent_date }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_send">Not Sent</SelectItem>
                  <SelectItem value="mail_sent">Mail Sent</SelectItem>
                  <SelectItem value="follow_up_sent">Follow Up Sent</SelectItem>
                  <SelectItem value="reply_received">Reply Received</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mail Sent Date</Label>
              <Input type="date" value={form.mail_sent_date} onChange={e => setForm(p => ({ ...p, mail_sent_date: e.target.value }))} />
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</legend>
            <Textarea value={form.comments} onChange={e => setForm(p => ({ ...p, comments: e.target.value }))} rows={3} placeholder="Comments..." />
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline editable cell components
function InlineSelect({ value, options, onChange }: { value: string; options: { value: string; label: string; className?: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const current = options.find(o => o.value === value);

  const handleChange = (v: string) => {
    onChange(v);
    setOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
  };

  return (
    <div className="relative inline-flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className={cn("px-2 py-0.5 rounded text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity", current?.className)}>
            {current?.label || "—"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" align="start">
          {options.map(o => (
            <button key={o.value} onClick={() => handleChange(o.value)}
              className={cn("w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors", o.value === value && "bg-accent")}>
              <span className={cn("px-1.5 py-0.5 rounded border", o.className)}>{o.label}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {saved && <Check className="h-3 w-3 text-green-500 animate-in fade-in" />}
    </div>
  );
}

function InlineDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const date = value ? parseISO(value) : undefined;

  const handleSelect = (d: Date | undefined) => {
    if (d) {
      onChange(format(d, "yyyy-MM-dd"));
      setSaved(true);
      setTimeout(() => setSaved(false), 1000);
    }
    setOpen(false);
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="text-xs text-foreground hover:text-primary cursor-pointer transition-colors">
            {date ? format(date, "MMM d, yyyy") : <span className="text-muted-foreground">—</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={handleSelect} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {saved && <Check className="h-3 w-3 text-green-500 animate-in fade-in" />}
    </div>
  );
}

function InlineComment({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);

  const save = () => {
    onChange(draft);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1000);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input className="h-7 text-xs w-40" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          autoFocus />
        <button onClick={save} className="text-green-500 hover:text-green-600"><Check className="h-3 w-3" /></button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button onClick={() => { setDraft(value); setEditing(true); }}
        className="text-xs text-left text-foreground hover:text-primary cursor-pointer transition-colors max-w-[150px] truncate">
        {value ? (value.length > 50 ? value.slice(0, 50) + "..." : value) : <span className="text-muted-foreground">—</span>}
      </button>
      {saved && <Check className="h-3 w-3 text-green-500 animate-in fade-in" />}
    </div>
  );
}

// Main page component
interface Props {
  leads?: any[];
}

export function ClientCommunicationPage({ leads = [] }: Props) {
  const [clients, setClients] = useState<ClientComm[]>(() => loadClients());
  const [search, setSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState("all");
  const [mailStatusFilter, setMailStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientComm | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientComm | null>(null);

  useEffect(() => { saveClients(clients); }, [clients]);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.company.toLowerCase().includes(search.toLowerCase())) return false;
      if (leadStatusFilter !== "all" && c.lead_status !== leadStatusFilter) return false;
      if (mailStatusFilter !== "all" && c.mail_status !== mailStatusFilter) return false;
      return true;
    });
  }, [clients, search, leadStatusFilter, mailStatusFilter]);

  const stats = useMemo(() => ({
    total: clients.length,
    hot: clients.filter(c => c.lead_status === "HOT").length,
    warm: clients.filter(c => c.lead_status === "WARM").length,
    cold: clients.filter(c => c.lead_status === "COLD").length,
    replied: clients.filter(c => c.mail_status === "reply_received").length,
  }), [clients]);

  const updateClient = useCallback((id: string, updates: Partial<ClientComm>) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
  }, []);

  const handleSave = (data: Omit<ClientComm, "id">) => {
    if (editClient) {
      updateClient(editClient.id, data);
      toast.success(`"${data.name}" updated`);
    } else {
      const newClient: ClientComm = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      setClients(prev => [newClient, ...prev]);
      toast.success(`"${data.name}" added`);
    }
    setEditClient(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setClients(prev => prev.filter(c => c.id !== deleteTarget.id));
    toast.success(`"${deleteTarget.name}" deleted`);
    setDeleteTarget(null);
  };

  const handleSync = (newClients: Omit<ClientComm, "id">[]) => {
    const created = newClients.map(c => ({ ...c, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
    setClients(prev => [...created, ...prev]);
    toast.success(`✅ ${created.length} contacts synced from CRM`);
  };

  // CSV Import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const imported: ClientComm[] = [];
        for (const row of results.data as Record<string, string>[]) {
          const name = (row["Name"] || "").trim();
          if (!name) continue;

          // Map lead status with typo fixes
          let ls = (row["lead status"] || row["Lead Status"] || "").trim().toUpperCase();
          if (ls === "WRAM") ls = "WARM";
          const leadStatus = ["HOT", "WARM", "COLD"].includes(ls) ? ls as ClientComm["lead_status"] : "";

          // Map mail status with typo fixes
          let ms = (row["Mail status"] || row["mail status"] || "").trim().toLowerCase();
          let mailStatus: ClientComm["mail_status"] = "not_send";
          if (ms.includes("follow")) mailStatus = "follow_up_sent";
          else if (ms.includes("reply")) mailStatus = "reply_received";
          else if (ms.includes("send") || ms.includes("sent")) mailStatus = "mail_sent";
          else if (ms === "no") mailStatus = "no";

          // Parse dates
          const collectDate = (row["Lead collected date"] || row["lead collected date"] || "").trim();
          const sentDate = (row[" Mail snet date"] || row["Mail snet date"] || row["Mail sent date"] || row["mail sent date"] || "").trim();

          imported.push({
            id: crypto.randomUUID(),
            name,
            designation: (row["Designation"] || row["designation"] || "").trim(),
            company: (row["Company"] || row["company"] || "").trim(),
            linkedin: (row["Linkedin"] || row["LinkedIn"] || row["linkedin"] || "").trim(),
            facebook: (row["Facebook "] || row["Facebook"] || row["facebook"] || "").trim(),
            instagram: (row["Instragram"] || row["Instagram"] || row["instagram"] || "").trim(),
            lead_status: leadStatus,
            lead_collected_date: parseDateFlex(collectDate),
            mail_status: mailStatus,
            mail_sent_date: parseDateFlex(sentDate),
            comments: (row["comments"] || row["Comments"] || "").trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        setClients(prev => [...imported, ...prev]);
        toast.success(`✅ ${imported.length} clients imported successfully`);
      },
    });
    e.target.value = "";
  };

  // CSV Export
  const handleExport = () => {
    const rows = clients.map(c => ({
      Name: c.name, Designation: c.designation, Company: c.company,
      LinkedIn: c.linkedin, Facebook: c.facebook, Instagram: c.instagram,
      "Lead Status": c.lead_status, "Lead Collected Date": c.lead_collected_date,
      "Mail Status": c.mail_status === "not_send" ? "not send" : c.mail_status === "mail_sent" ? "Mail sent" : c.mail_status === "follow_up_sent" ? "Follow up mail sent" : c.mail_status === "reply_received" ? "reply mail" : c.mail_status,
      "Mail Sent Date": c.mail_sent_date, Comments: c.comments,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `client_communications_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const leadStatusOptions = [
    { value: "", label: "—", className: "text-muted-foreground" },
    { value: "HOT", ...leadStatusConfig.HOT },
    { value: "WARM", ...leadStatusConfig.WARM },
    { value: "COLD", ...leadStatusConfig.COLD },
  ];
  const mailStatusOptions = Object.entries(mailStatusConfig).map(([k, v]) => ({ value: k, ...v }));

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: null },
          { label: "HOT", value: stats.hot, icon: "🔴" },
          { label: "WARM", value: stats.warm, icon: "🟡" },
          { label: "COLD", value: stats.cold, icon: "🔵" },
          { label: "Replied", value: stats.replied, icon: "✅" },
        ].map(s => (
          <Card key={s.label} className="p-3">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-xl font-bold text-foreground flex items-center gap-1">{s.value} {s.icon && <span className="text-sm">{s.icon}</span>}</div>
          </Card>
        ))}
      </div>

      {/* Top bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="Search name/company..." value={search} onChange={e => setSearch(e.target.value)} className="w-56" />
        <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Lead Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="HOT">HOT</SelectItem>
            <SelectItem value="WARM">WARM</SelectItem>
            <SelectItem value="COLD">COLD</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mailStatusFilter} onValueChange={setMailStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Mail Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Mail</SelectItem>
            <SelectItem value="not_send">Not Sent</SelectItem>
            <SelectItem value="mail_sent">Mail Sent</SelectItem>
            <SelectItem value="follow_up_sent">Follow Up</SelectItem>
            <SelectItem value="reply_received">Replied</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => setSyncOpen(true)}><RefreshCw className="h-4 w-4 mr-1" /> Sync from Leads</Button>
        <label className="cursor-pointer">
          <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          <Button variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1" /> Import CSV</span></Button>
        </label>
        <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
        <Button size="sm" onClick={() => { setEditClient(null); setModalOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add Client</Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-auto bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground text-xs">#</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground text-xs">Name & Designation</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground text-xs">Company</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs">Social</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs">Lead Status</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs">Collected Date</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs">Mail Status</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs">Mail Sent</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground text-xs">Comments</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-12 text-center text-muted-foreground">No clients found</td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <div>
                      <div className="font-medium text-foreground text-xs">{c.name}</div>
                      {c.designation && <div className="text-[11px] text-muted-foreground">{c.designation}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-foreground">{c.company || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <SocialLink url={c.linkedin} platform="LinkedIn">
                      <div className="w-6 h-6 rounded flex items-center justify-center bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors">
                        <Linkedin className="w-3 h-3 text-white" />
                      </div>
                    </SocialLink>
                    <SocialLink url={c.facebook} platform="Facebook">
                      <div className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity" style={{ backgroundColor: '#1877F2' }}>
                        <span className="text-white text-[10px] font-bold">f</span>
                      </div>
                    </SocialLink>
                    <SocialLink url={c.instagram} platform="Instagram">
                      <div className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity" style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' }}>
                        <Instagram className="w-3 h-3 text-white" />
                      </div>
                    </SocialLink>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <InlineSelect value={c.lead_status} options={leadStatusOptions} onChange={v => updateClient(c.id, { lead_status: v as any })} />
                </td>
                <td className="px-3 py-2 text-center">
                  <InlineDate value={c.lead_collected_date} onChange={v => updateClient(c.id, { lead_collected_date: v })} />
                </td>
                <td className="px-3 py-2 text-center">
                  <InlineSelect value={c.mail_status} options={mailStatusOptions} onChange={v => {
                    const updates: Partial<ClientComm> = { mail_status: v as any };
                    if (v === "mail_sent" && !c.mail_sent_date) updates.mail_sent_date = new Date().toISOString().slice(0, 10);
                    updateClient(c.id, updates);
                  }} />
                </td>
                <td className="px-3 py-2 text-center">
                  <InlineDate value={c.mail_sent_date} onChange={v => updateClient(c.id, { mail_sent_date: v })} />
                </td>
                <td className="px-3 py-2">
                  <InlineComment value={c.comments} onChange={v => updateClient(c.id, { comments: v })} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => { setEditClient(c); setModalOpen(true); }} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setDeleteTarget(c)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <ClientModal open={modalOpen} onClose={() => { setModalOpen(false); setEditClient(null); }} client={editClient} onSave={handleSave} />
      <SyncFromLeadsModal open={syncOpen} onClose={() => setSyncOpen(false)} leads={leads} existingClients={clients} onSync={handleSync} />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseDateFlex(s: string): string {
  if (!s) return "";
  // Try common formats
  try {
    // Try ISO
    const d = new Date(s);
    if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
  } catch {}
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (c > 100) return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    if (a > 100) return `${a}-${String(b).padStart(2, '0')}-${String(c).padStart(2, '0')}`;
  }
  return s;
}
