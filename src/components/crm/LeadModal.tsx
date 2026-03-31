import { useState, useEffect, useMemo } from "react";
import { Lead, PipelineStatus, EmailVerification } from "@/types/lead";
import { verifySingle, loadMVSettings, getESP, getQualityDisplay } from "@/lib/emailVerifier";
import { lookupCache, saveToCache, recordCacheHit } from "@/lib/emailVerificationCache";
import { motion } from "motion/react";
import { X, Plus, RefreshCw, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LeadModalProps {
  lead?: Lead | null;
  existingTypes: string[];
  existingCompanies: string[];
  onSave: (data: Omit<Lead, "id" | "dateAdded">) => void;
  onClose: () => void;
  onAddCompany?: (name: string, industry: string, email?: string) => void;
}

const pipelineStatuses: PipelineStatus[] = ["New", "Contacted", "In Progress", "Closed", "Not Interested"];

const ESP_STYLES: Record<string, string> = {
  Google: "bg-blue-50 text-blue-600 border-blue-200",
  Outlook: "bg-indigo-50 text-indigo-600 border-indigo-200",
  Zoho: "bg-orange-50 text-orange-600 border-orange-200",
  Yahoo: "bg-purple-50 text-purple-600 border-purple-200",
  Other: "bg-muted text-muted-foreground border-border",
};

function ESPBadge({ esp }: { esp: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${ESP_STYLES[esp] || ESP_STYLES.Other}`}>
      {esp}
    </span>
  );
}

function EmailVerificationBadge({ verification, email }: { verification?: EmailVerification; email: string }) {
  if (!email) return null;
  if (!verification) return <p className="mt-1 text-[11px] text-muted-foreground">○ Not verified</p>;
  const d = getQualityDisplay(verification.quality, verification.result);
  const esp = verification.esp || getESP(email);
  const isCached = verification.fromCache;
  return (
    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
      <ESPBadge esp={esp} />
      <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${isCached ? "bg-cyan-50 text-cyan-700 border-cyan-200" : d.color}`}>
        {isCached && <Clock className="h-2.5 w-2.5" />}
        {d.icon} {d.label}{isCached ? " (cached)" : ""}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {new Date(verification.verifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </span>
    </div>
  );
}

// Verify circle icon for each email field
function VerifyCircle({ email, verification, onVerified }: {
  email: string; verification?: EmailVerification; onVerified: (v: EmailVerification) => void;
}) {
  const [verifying, setVerifying] = useState(false);

  const getCircleStyle = () => {
    if (!email.trim()) return "border-muted bg-muted text-muted-foreground cursor-not-allowed";
    if (!verification) return "border-input bg-background text-muted-foreground hover:border-primary hover:text-primary cursor-pointer";
    if (verification.fromCache) return "border-cyan-300 bg-cyan-100 text-cyan-700";
    const r = verification.result;
    if (r === "ok") return "border-green-300 bg-green-100 text-green-700";
    if (r === "invalid" || r === "error" || r === "disposable") return "border-red-300 bg-red-100 text-red-700";
    return "border-amber-300 bg-amber-100 text-amber-700";
  };

  const getTooltipText = () => {
    if (!email.trim()) return "Enter an email first";
    if (!verification) return "Click to verify";
    const d = getQualityDisplay(verification.quality, verification.result);
    return `${d.label} — ${new Date(verification.verifiedAt).toLocaleDateString()}${verification.fromCache ? " (cached)" : ""}`;
  };

  const handleVerify = async () => {
    if (!email.trim() || verifying) return;
    const settings = loadMVSettings();
    if (!settings.apiKey && !settings.useDemo) { toast.error("Configure API key in Email Verifier → Settings"); return; }
    const apiKey = settings.useDemo ? "API_KEY_FOR_TEST" : settings.apiKey;
    setVerifying(true);
    try {
      const cached = lookupCache(email);
      if (cached) {
        const esp = cached.esp || getESP(email);
        onVerified({
          quality: cached.quality as any, result: cached.verificationStatus as any,
          resultcode: cached.resultcode, subresult: cached.subresult, free: cached.free,
          role: cached.role, didyoumean: cached.didyoumean, esp,
          verifiedAt: cached.verifiedAt, creditsUsed: 0, fromCache: true, cacheExpiresAt: cached.expiresAt,
        });
        recordCacheHit(email);
        toast.success(`Verified (cached) — ${esp}`);
        return;
      }
      const data = await verifySingle(apiKey, email);
      if (data.error) { toast.error(`Verification failed: ${data.error}`); return; }
      const esp = getESP(email);
      const v: EmailVerification = {
        quality: data.quality || "", result: data.result, resultcode: data.resultcode,
        subresult: data.subresult || "", free: !!data.free, role: !!data.role,
        didyoumean: data.didyoumean || "", esp, verifiedAt: new Date().toISOString(),
        creditsUsed: 1, fromCache: false,
      };
      saveToCache(email, {
        result: data.result, quality: data.quality || "", resultcode: data.resultcode,
        subresult: data.subresult || "", free: !!data.free, role: !!data.role,
        didyoumean: data.didyoumean || "", esp,
      });
      onVerified(v);
      toast.success(`Verified: ${data.result} — ${esp}`);
    } catch { toast.error("Verification failed"); } finally { setVerifying(false); }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={handleVerify} disabled={!email.trim() || verifying}
          className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors shrink-0 ${getCircleStyle()}`}>
          {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> :
            verification ? (
              verification.fromCache ? <Clock className="h-3 w-3" /> :
              verification.result === "ok" ? <span className="text-[10px]">✓</span> :
              (verification.result === "invalid" || verification.result === "error") ? <span className="text-[10px]">✗</span> :
              <span className="text-[10px]">?</span>
            ) : <span className="text-[10px]">○</span>
          }
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{getTooltipText()}</TooltipContent>
    </Tooltip>
  );
}

export function LeadModal({ lead, existingTypes, existingCompanies, onSave, onClose, onAddCompany }: LeadModalProps) {
  const [form, setForm] = useState({
    type: "", company: "", companyEmail: "", name: "", position: "",
    phone: "", personalPhone1: "", personalPhone2: "",
    email: "", personalEmail: "", personalEmail2: "",
    linkedin: "", facebook: "", instagram: "",
    status: "New" as PipelineStatus, active: true, notes: "", folder: "",
  });
  const [typeSuggestions, setTypeSuggestions] = useState(false);
  const [companySuggestions, setCompanySuggestions] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [newCompanyError, setNewCompanyError] = useState("");

  const [workVerification, setWorkVerification] = useState<EmailVerification | undefined>(lead?.emailVerification);
  const [personalVerification, setPersonalVerification] = useState<EmailVerification | undefined>(lead?.personalEmailVerification);
  const [personal2Verification, setPersonal2Verification] = useState<EmailVerification | undefined>(lead?.personalEmail2Verification);

  useEffect(() => {
    if (lead) {
      setForm({
        type: lead.type, company: lead.company, companyEmail: lead.companyEmail,
        name: lead.name, position: lead.position,
        phone: lead.phone, personalPhone1: lead.personalPhone1 || "", personalPhone2: lead.personalPhone2 || "",
        email: lead.email, personalEmail: lead.personalEmail, personalEmail2: lead.personalEmail2 || "",
        linkedin: lead.linkedin, facebook: lead.facebook, instagram: lead.instagram,
        status: lead.status, active: lead.active, notes: lead.notes,
      });
      setWorkVerification(lead.emailVerification);
      setPersonalVerification(lead.personalEmailVerification);
      setPersonal2Verification(lead.personalEmail2Verification);
    }
  }, [lead]);

  const filteredTypes = useMemo(() => existingTypes.filter(t => t.toLowerCase().includes(form.type.toLowerCase())), [form.type, existingTypes]);
  const filteredCompanies = useMemo(() => existingCompanies.filter(c => c.toLowerCase().includes(form.company.toLowerCase())), [form.company, existingCompanies]);
  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.position.trim()) errs.position = "Position is required";
    if (!form.type.trim()) errs.type = "Industry type is required";
    if (!form.company.trim()) errs.company = "Company is required";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSave({
      ...form,
      emailVerification: workVerification,
      personalEmailVerification: personalVerification,
      personalEmail2Verification: personal2Verification,
    } as any);
  };

  const handleAddNewCompany = () => {
    const trimmed = newCompanyName.trim();
    if (!trimmed) { setNewCompanyError("Company name is required."); return; }
    if (existingCompanies.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setNewCompanyError(`This company already exists.`); return;
    }
    onAddCompany?.(trimmed, form.type, newCompanyEmail.trim() || undefined);
    set("company", trimmed);
    if (newCompanyEmail.trim()) set("companyEmail", newCompanyEmail.trim());
    setShowNewCompany(false); setNewCompanyName(""); setNewCompanyEmail(""); setNewCompanyError("");
  };

  const inputClass = (field: string) =>
    `w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20 ${errors[field] ? "border-destructive" : "border-input"}`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold tracking-tight">{lead ? "Edit Lead" : "Add Lead"}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Industry Type */}
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Industry Type *</label>
            <input value={form.type} onChange={e => { set("type", e.target.value); setTypeSuggestions(true); }}
              onFocus={() => setTypeSuggestions(true)} onBlur={() => setTimeout(() => setTypeSuggestions(false), 150)}
              className={inputClass("type")} placeholder="e.g. EdTech" />
            {errors.type && <p className="mt-0.5 text-xs text-destructive">{errors.type}</p>}
            {typeSuggestions && filteredTypes.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-lg">
                {filteredTypes.map(t => (
                  <button key={t} onMouseDown={() => { set("type", t); setTypeSuggestions(false); }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent">{t}</button>
                ))}
              </div>
            )}
          </div>
          {/* Company */}
          <div className="relative">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Company *</label>
              {onAddCompany && lead && (
                <button type="button" onClick={() => setShowNewCompany(!showNewCompany)}
                  className="flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary/80">
                  <Plus className="h-3 w-3" /> New
                </button>
              )}
            </div>
            <input value={form.company} onChange={e => { set("company", e.target.value); setCompanySuggestions(true); }}
              onFocus={() => setCompanySuggestions(true)} onBlur={() => setTimeout(() => setCompanySuggestions(false), 150)}
              className={inputClass("company")} placeholder="e.g. Shikho" />
            {errors.company && <p className="mt-0.5 text-xs text-destructive">{errors.company}</p>}
            {companySuggestions && filteredCompanies.length > 0 && !showNewCompany && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-lg">
                {filteredCompanies.map(c => (
                  <button key={c} onMouseDown={() => { set("company", c); setCompanySuggestions(false); }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent">{c}</button>
                ))}
              </div>
            )}
          </div>

          {/* New Company inline */}
          {showNewCompany && (
            <div className="col-span-2 rounded-md border border-border bg-muted/30 p-3 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Company</p>
              <input autoFocus value={newCompanyName} onChange={e => { setNewCompanyName(e.target.value); setNewCompanyError(""); }}
                className={inputClass("")} placeholder="Company name" />
              <input value={newCompanyEmail} onChange={e => setNewCompanyEmail(e.target.value)} className={inputClass("")} placeholder="info@company.com" />
              {newCompanyError && <p className="text-xs text-destructive">{newCompanyError}</p>}
              <div className="flex gap-2">
                <button onClick={handleAddNewCompany} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Add Company</button>
                <button onClick={() => { setShowNewCompany(false); setNewCompanyError(""); }} className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent">Cancel</button>
              </div>
            </div>
          )}

          {/* Company Email */}
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Company Email</label>
            <input value={form.companyEmail} onChange={e => set("companyEmail", e.target.value)} className={inputClass("")} placeholder="info@company.com" />
          </div>
          {/* Name + Position */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Name *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} className={inputClass("name")} placeholder="Full name" />
            {errors.name && <p className="mt-0.5 text-xs text-destructive">{errors.name}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Position *</label>
            <input value={form.position} onChange={e => set("position", e.target.value)} className={inputClass("position")} placeholder="Job title" />
            {errors.position && <p className="mt-0.5 text-xs text-destructive">{errors.position}</p>}
          </div>

          {/* ── Email Section ── */}
          <div className="col-span-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Email Addresses</p>
          </div>
          <div className="col-span-2 space-y-3">
            {/* Work Email */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Work Email</label>
              <div className="flex items-center gap-2">
                <input value={form.email} onChange={e => set("email", e.target.value)} className={`${inputClass("")} flex-1`} placeholder="name@company.com" />
                <VerifyCircle email={form.email} verification={workVerification} onVerified={v => setWorkVerification(v)} />
              </div>
              <EmailVerificationBadge verification={workVerification} email={form.email} />
            </div>
            {/* Personal Email 1 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Personal Email 1</label>
              <div className="flex items-center gap-2">
                <input value={form.personalEmail} onChange={e => set("personalEmail", e.target.value)} className={`${inputClass("")} flex-1`} placeholder="personal@gmail.com" />
                <VerifyCircle email={form.personalEmail} verification={personalVerification} onVerified={v => setPersonalVerification(v)} />
              </div>
              <EmailVerificationBadge verification={personalVerification} email={form.personalEmail} />
            </div>
            {/* Personal Email 2 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Personal Email 2</label>
              <div className="flex items-center gap-2">
                <input value={form.personalEmail2} onChange={e => set("personalEmail2", e.target.value)} className={`${inputClass("")} flex-1`} placeholder="alternate@gmail.com" />
                <VerifyCircle email={form.personalEmail2} verification={personal2Verification} onVerified={v => setPersonal2Verification(v)} />
              </div>
              <EmailVerificationBadge verification={personal2Verification} email={form.personalEmail2} />
            </div>
          </div>

          {/* ── Phone Section ── */}
          <div className="col-span-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Phone Numbers</p>
          </div>
          <div className="col-span-2 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Work Phone</label>
              <input value={form.phone} onChange={e => set("phone", e.target.value)} className={inputClass("")} placeholder="+880..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Personal Phone 1</label>
                <input value={form.personalPhone1} onChange={e => set("personalPhone1", e.target.value)} className={inputClass("")} placeholder="+880..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Personal Phone 2</label>
                <input value={form.personalPhone2} onChange={e => set("personalPhone2", e.target.value)} className={inputClass("")} placeholder="+880..." />
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">LinkedIn URL</label>
            <input value={form.linkedin} onChange={e => set("linkedin", e.target.value)} className={inputClass("")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Facebook URL</label>
            <input value={form.facebook} onChange={e => set("facebook", e.target.value)} className={inputClass("")} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Instagram URL</label>
            <input value={form.instagram} onChange={e => set("instagram", e.target.value)} className={inputClass("")} />
          </div>
          {/* Status */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Pipeline Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} className={inputClass("")}>
              {pipelineStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Active Toggle */}
          <div className="flex items-end gap-3 pb-1">
            <label className="text-xs font-medium text-muted-foreground">Active</label>
            <button type="button" onClick={() => set("active", !form.active)}
              className={`relative h-5 w-9 rounded-full transition-colors ${form.active ? "bg-toggle-active" : "bg-toggle-inactive"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform ${form.active ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
          {/* Notes */}
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} className={`${inputClass("")} resize-none`} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
          <button onClick={handleSave} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all">
            {lead ? "Save Changes" : "Add Lead"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
