import { useMemo, useState, useCallback, memo } from "react";
import { motion } from "motion/react";
import { Lead } from "@/types/lead";
import { getStatusStyle, getInitials, getAvatarColor, getIndustryColor } from "@/lib/leadUtils";
import { getQualityDisplay, getESP } from "@/lib/emailVerifier";
import { SocialLink } from "@/components/crm/SocialLink";
import { Edit2, Trash2, Clock, ChevronLeft, ChevronRight, Instagram } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LEADS_PER_PAGE = 50;

const ESP_STYLES: Record<string, string> = {
  Google: "bg-blue-50 text-blue-600 border-blue-200",
  Outlook: "bg-indigo-50 text-indigo-600 border-indigo-200",
  Microsoft: "bg-teal-50 text-teal-600 border-teal-200",
  Zoho: "bg-orange-50 text-orange-600 border-orange-200",
  Yahoo: "bg-purple-50 text-purple-600 border-purple-200",
  Other: "bg-muted text-muted-foreground border-border",
};

function ESPCell({ email, verification }: { email?: string; verification?: Lead["emailVerification"] }) {
  if (!verification || !email) return <span className="text-xs text-muted-foreground">—</span>;
  const esp = verification.esp || getESP(email);
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${ESP_STYLES[esp] || ESP_STYLES.Other}`}>
      {esp}
    </span>
  );
}

function VerifyBadge({ verification }: { verification?: Lead["emailVerification"] }) {
  if (!verification) return <span className="text-xs text-muted-foreground">—</span>;
  const d = getQualityDisplay(verification.quality, verification.result);
  const isCached = verification.fromCache;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center justify-center gap-0.5 h-5 min-w-5 rounded-full text-[10px] font-bold border px-1 ${isCached ? "bg-cyan-50 text-cyan-700 border-cyan-200" : d.color}`}>
          {isCached && <Clock className="h-2.5 w-2.5" />}
          {d.icon}
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-xs max-w-[220px]">
        <p><strong>{d.label}</strong> · {verification.result}{isCached ? " (cached)" : ""}</p>
        <p>ESP: {verification.esp} · {new Date(verification.verifiedAt).toLocaleDateString()}</p>
        {isCached && verification.cacheExpiresAt && <p>Cache expires: {new Date(verification.cacheExpiresAt).toLocaleDateString()}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

interface LeadTableProps {
  leads: Lead[];
  onToggleActive?: (id: string) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  canEditLead?: (lead: Lead) => boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

const LeadRow = memo(function LeadRow({ lead, editable, isSelected, showCheckbox, showActions, hasPersonalEmail2, hasPersonalPhone2, onToggleActive, onEdit, onDelete, onSelect }: {
  lead: Lead; editable: boolean; isSelected: boolean; showCheckbox: boolean; showActions: boolean;
  hasPersonalEmail2: boolean; hasPersonalPhone2: boolean;
  onToggleActive?: (id: string) => void; onEdit?: (lead: Lead) => void; onDelete?: (lead: Lead) => void;
  onSelect: (id: string) => void;
}) {
  const phoneCount = [lead.phone, lead.personalPhone1, lead.personalPhone2].filter(p => p?.trim()).length;
  return (
    <tr className={`border-b border-border last:border-0 transition-colors ${isSelected ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-accent/30"}`}>
      {showCheckbox && (
        <td className="px-3 py-3 text-center"><Checkbox checked={isSelected} onCheckedChange={() => onSelect(lead.id)} /></td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarColor(lead.name)}`}>
            {getInitials(lead.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{lead.name}</p>
            <p className="text-xs text-muted-foreground truncate">{lead.position}</p>
            {(lead.email || lead.phone) && (
              <p className="text-xs text-muted-foreground truncate">{lead.email || lead.personalEmail}{lead.phone ? ` · ${lead.phone}` : ""}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm truncate">{lead.company}</p>
        <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getIndustryColor(lead.type)}`}>{lead.type}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getStatusStyle(lead.status)}`}>{lead.status}</span>
      </td>
      <td className="px-4 py-3 text-center"><VerifyBadge verification={lead.emailVerification} /></td>
      <td className="px-4 py-3 text-center"><VerifyBadge verification={lead.personalEmailVerification} /></td>
      {hasPersonalEmail2 && <td className="px-4 py-3 text-center"><VerifyBadge verification={lead.personalEmail2Verification} /></td>}
      <td className="px-4 py-3 text-center"><ESPCell email={lead.email} verification={lead.emailVerification} /></td>
      <td className="px-4 py-3 text-center"><ESPCell email={lead.personalEmail} verification={lead.personalEmailVerification} /></td>
      {hasPersonalEmail2 && <td className="px-4 py-3 text-center"><ESPCell email={lead.personalEmail2} verification={lead.personalEmail2Verification} /></td>}
      <td className="px-4 py-3 text-center">
        {phoneCount > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold">{phoneCount} ph</span>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {lead.phone && <p>Work: {lead.phone}</p>}
              {lead.personalPhone1 && <p>Personal 1: {lead.personalPhone1}</p>}
              {lead.personalPhone2 && <p>Personal 2: {lead.personalPhone2}</p>}
            </TooltipContent>
          </Tooltip>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3 text-center">
        <SocialLink url={lead.linkedin} platform="LinkedIn">
          <div className="w-7 h-7 rounded flex items-center justify-center bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors">
            <span className="text-white text-xs font-bold">in</span>
          </div>
        </SocialLink>
      </td>
      <td className="px-4 py-3 text-center">
        <SocialLink url={lead.facebook} platform="Facebook">
          <div className="w-7 h-7 rounded flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity" style={{ backgroundColor: '#1877F2' }}>
            <span className="text-white text-xs font-bold">f</span>
          </div>
        </SocialLink>
      </td>
      <td className="px-4 py-3 text-center">
        <SocialLink url={lead.instagram} platform="Instagram">
          <div className="w-7 h-7 rounded flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity" style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' }}>
            <Instagram className="w-4 h-4 text-white" />
          </div>
        </SocialLink>
      </td>
      {onToggleActive && (
        <td className="px-4 py-3">
          <button onClick={() => onToggleActive(lead.id)}
            className={`relative h-5 w-9 rounded-full transition-colors ${lead.active ? "bg-toggle-active" : "bg-toggle-inactive"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform ${lead.active ? "left-[18px]" : "left-0.5"}`} />
          </button>
        </td>
      )}
      {showActions && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {onEdit && editable && (
              <button onClick={() => onEdit(lead)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(lead)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
});

export function LeadTable({ leads, onToggleActive, onEdit, onDelete, canEditLead, selectedIds, onSelectionChange }: LeadTableProps) {
  const [page, setPage] = useState(0);
  const hasPersonalEmail2 = useMemo(() => leads.some(l => l.personalEmail2?.trim()), [leads]);
  const hasPersonalPhone2 = useMemo(() => leads.some(l => l.personalPhone2?.trim()), [leads]);

  const totalPages = Math.max(1, Math.ceil(leads.length / LEADS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageLeads = useMemo(() => leads.slice(safePage * LEADS_PER_PAGE, (safePage + 1) * LEADS_PER_PAGE), [leads, safePage]);

  // Reset page when leads change significantly
  useMemo(() => { if (page >= totalPages) setPage(0); }, [leads.length]);

  const showActions = onEdit || onDelete;
  const showCheckbox = !!onSelectionChange;
  const allSelected = showCheckbox && pageLeads.length > 0 && pageLeads.every(l => selectedIds?.has(l.id));
  const someSelected = showCheckbox && pageLeads.some(l => selectedIds?.has(l.id)) && !allSelected;

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? new Set() : new Set(pageLeads.map(l => l.id)));
  };

  const handleSelectOne = useCallback((id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  }, [onSelectionChange, selectedIds]);

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-sm">No leads found</p>
        <p className="text-xs mt-1">Try adjusting your filters or add a new lead</p>
      </div>
    );
  }


  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="space-y-3"
    >
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10 backdrop-blur-md bg-card/95">
              <tr className="border-b border-border text-left">
                {showCheckbox && (
                  <th className="w-[40px] px-3 py-3 text-center">
                    <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={handleSelectAll} />
                  </th>
                )}
                <th className="min-w-[200px] px-4 py-3 text-xs font-medium text-muted-foreground">Contact</th>
                <th className="w-[150px] px-4 py-3 text-xs font-medium text-muted-foreground">Company</th>
                <th className="w-[100px] px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="w-[50px] px-4 py-3 text-xs font-medium text-muted-foreground">Work ✓</th>
                <th className="w-[50px] px-4 py-3 text-xs font-medium text-muted-foreground">P1 ✓</th>
                {hasPersonalEmail2 && <th className="w-[50px] px-4 py-3 text-xs font-medium text-muted-foreground">P2 ✓</th>}
                <th className="w-[70px] px-4 py-3 text-xs font-medium text-muted-foreground">Work ESP</th>
                <th className="w-[70px] px-4 py-3 text-xs font-medium text-muted-foreground">P1 ESP</th>
                {hasPersonalEmail2 && <th className="w-[70px] px-4 py-3 text-xs font-medium text-muted-foreground">P2 ESP</th>}
                <th className="w-[70px] px-4 py-3 text-xs font-medium text-muted-foreground">Phones</th>
                <th className="w-[70px] px-4 py-3 text-xs font-medium text-muted-foreground">LinkedIn</th>
                <th className="w-[70px] px-4 py-3 text-xs font-medium text-muted-foreground">Facebook</th>
                <th className="w-[70px] px-4 py-3 text-xs font-medium text-muted-foreground">Instagram</th>
                {onToggleActive && <th className="w-[80px] px-4 py-3 text-xs font-medium text-muted-foreground">Active</th>}
                {showActions && <th className="w-[100px] px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pageLeads.map(lead => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  editable={canEditLead ? canEditLead(lead) : true}
                  isSelected={selectedIds?.has(lead.id) ?? false}
                  showCheckbox={showCheckbox}
                  showActions={!!showActions}
                  hasPersonalEmail2={hasPersonalEmail2}
                  hasPersonalPhone2={hasPersonalPhone2}
                  onToggleActive={onToggleActive}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onSelect={handleSelectOne}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Showing {safePage * LEADS_PER_PAGE + 1}–{Math.min((safePage + 1) * LEADS_PER_PAGE, leads.length)} of {leads.length} leads
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${i === safePage ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
              >
                {i + 1}
              </button>
            )).slice(Math.max(0, safePage - 2), safePage + 3)}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
