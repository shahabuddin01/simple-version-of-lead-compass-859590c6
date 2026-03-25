import { useState, useMemo, useEffect, useCallback } from "react";
import { useLeads } from "@/hooks/useLeads";
import { useAuth } from "@/hooks/useAuth";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { LoginPage } from "@/components/auth/LoginPage";
import { UserMenu } from "@/components/auth/UserMenu";
import { CRMSidebar } from "@/components/crm/CRMSidebar";
import { DashboardView } from "@/components/crm/DashboardView";
import { LeadTable } from "@/components/crm/LeadTable";
import { LeadModal } from "@/components/crm/LeadModal";
import { ImportModal } from "@/components/crm/ImportModal";
import { DeleteDialog } from "@/components/crm/DeleteDialog";
import { LeadFilters } from "@/components/crm/LeadFilters";
import { ExportDropdown } from "@/components/crm/ExportDropdown";
import { BulkActionBar } from "@/components/crm/BulkActionBar";
import { SMSCenter } from "@/components/crm/SMSCenter";
import { UserManagement } from "@/pages/UserManagement";
import { LiveActivity } from "@/components/workforce/LiveActivity";
import { TimeLogs } from "@/components/workforce/TimeLogs";
import { SalaryReport } from "@/components/workforce/SalaryReport";
import { WorkforceSettingsPage } from "@/components/workforce/WorkforceSettingsPage";
import { MyActivity } from "@/components/workforce/MyActivity";
import { VerificationReport } from "@/components/email-verifier/VerificationReport";
import { APIDashboard } from "@/components/api-dashboard/APIDashboard";
import { APISettings } from "@/components/email-verifier/APISettings";
import { BackupSettings } from "@/components/settings/BackupSettings";
import { SMTPSettings } from "@/components/settings/SMTPSettings";
import { SecurityCenter } from "@/components/security/SecurityCenter";

import { Lead, PipelineStatus, EmailVerification } from "@/types/lead";
import { getIndustryTree } from "@/lib/leadUtils";
import { canPerformAction, logAudit } from "@/lib/security";
import { lookupCache, saveToCache, recordCacheHit, cleanupExpiredCache } from "@/lib/emailVerificationCache";
import { AnimatePresence } from "motion/react";
import { Plus, Upload } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const { currentUser, permissions, rolePermissions, sessionExpired, sessionWarning, concurrentSessionKicked, dismissSessionExpired, dismissConcurrentKick, extendSession, logout } = useAuth();
  const { trackAction } = useActivityTracker(currentUser);

  const {
    leads, filteredLeads, view, setView, filter, setFilter,
    sortBy, setSortBy, stats, industries, companies,
    addLead, updateLead, deleteLead, toggleActive, importLeads,
    bulkUpdateStatus, bulkSetActive,
    allTags, allFolders, allListSources,
    addIndustry, addCompany, deleteByIndustry, deleteByCompany,
    renameIndustry, renameCompany, mergeCompany,
  } = useLeads();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkVerifying, setBulkVerifying] = useState(false);

  useEffect(() => { setSelectedIds(new Set()); }, [filter, view]);
  useEffect(() => { cleanupExpiredCache(); }, []);

  useEffect(() => {
    if (!currentUser) return;
    const adminOnlyViews = ["users", "workforce-live", "workforce-timelogs", "workforce-salary", "workforce-settings", "ev-report", "ev-settings", "api-integrations", "backups", "smtp-settings", "security-center"];
    if (adminOnlyViews.includes(view) && currentUser.role !== "Admin") {
      toast.error("You don't have permission to access this section.");
      setView("all");
    }
  }, [view, currentUser, setView]);

  useEffect(() => {
    if (currentUser) trackAction("page_navigated", { page: view });
  }, [view, currentUser, trackAction]);

  const [modal, setModal] = useState<{ type: "add" | "edit"; lead?: Lead } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);

  const industryBreakdown = useMemo(() => {
    const tree = getIndustryTree(leads);
    return Object.entries(tree).map(([industry, data]) => ({
      industry, companies: Object.keys(data.companies).length, contacts: data.total,
    }));
  }, [leads]);

  if (!currentUser) return <LoginPage />;

  const isAdmin = currentUser.role === "Admin";

  const checkPermission = (action: keyof typeof permissions, actionName: string): boolean => {
    if (!permissions[action]) { toast.error(`You don't have permission to: ${actionName}`); return false; }
    return true;
  };

  const handleSave = (data: Omit<Lead, "id" | "dateAdded">) => {
    if (modal?.type === "edit" && modal.lead) {
      if (!checkPermission("canEditAnyLead", "Edit Lead") && !(permissions.canEditOwnLead && modal.lead.createdBy === currentUser.id)) return;
      updateLead(modal.lead.id, data);
      trackAction("lead_edited");
      logAudit(currentUser.email, currentUser.id, 'LEAD_EDITED', `Lead: ${data.name}`);
      toast.success(`Lead "${data.name}" updated`);
    } else {
      if (!checkPermission("canAddLead", "Add Lead")) return;
      addLead({ ...data, createdBy: currentUser.id });
      trackAction("lead_added");
      logAudit(currentUser.email, currentUser.id, 'LEAD_ADDED', `Lead: ${data.name}`);
      toast.success(`Lead "${data.name}" added`);
    }
    setModal(null);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      if (!checkPermission("canDeleteLead", "Delete Lead")) return;
      deleteLead(deleteTarget.id);
      trackAction("lead_deleted");
      logAudit(currentUser.email, currentUser.id, 'LEAD_DELETED', `Lead: ${deleteTarget.name}`);
      toast.success(`Lead "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    }
  };

  const handleImport = (newLeads: Omit<Lead, "id" | "dateAdded">[], updateExisting: boolean) => {
    if (!checkPermission("canImport", "Import CSV")) return;
    importLeads(newLeads, updateExisting);
    trackAction("csv_imported", { count: newLeads.length });
    logAudit(currentUser.email, currentUser.id, 'CSV_IMPORTED', `${newLeads.length} leads`);
    setView("all");
    setFilter({ industry: null, company: null, status: null, search: "" });
  };

  const handleDeleteIndustry = (name: string) => { deleteByIndustry(name); toast.success(`"${name}" deleted.`); };
  const handleDeleteCompany = (name: string) => { deleteByCompany(name); toast.success(`"${name}" deleted.`); };
  const handleRenameIndustry = (o: string, n: string) => { renameIndustry(o, n); toast.success(`Renamed to "${n}".`); };
  const handleRenameCompany = (o: string, n: string) => { renameCompany(o, n); toast.success(`Renamed to "${n}".`); };

  const canEditLead = (lead: Lead) => {
    if (permissions.canEditAnyLead) return true;
    if (permissions.canEditOwnLead && lead.createdBy === currentUser.id) return true;
    return false;
  };

  // Bulk verify handler for the smart dropdown
  const handleBulkVerifyEmails = async (types: ("work" | "personal1" | "personal2")[]) => {
    const { loadMVSettings, verifySingle, getESP } = await import("@/lib/emailVerifier");
    const settings = loadMVSettings();
    const key = settings.useDemo ? "API_KEY_FOR_TEST" : settings.apiKey;
    if (!key) { toast.error("Configure your API key in Email Verifier Settings first."); return; }

    setBulkVerifying(true);
    let verified = 0, invalid = 0, cacheHits = 0;
    const totalEmails = selectedIds.size * types.length;

    const verifyEmail = async (email: string, leadId: string, field: "emailVerification" | "personalEmailVerification" | "personalEmail2Verification") => {
      if (!email?.trim()) return;
      try {
        const cached = lookupCache(email.trim());
        if (cached) {
          const esp = cached.esp || getESP(email.trim());
          const verification = {
            quality: cached.quality || "", result: cached.verificationStatus || "error",
            resultcode: cached.resultcode || 0, subresult: cached.subresult || "",
            free: cached.free, role: cached.role, didyoumean: cached.didyoumean || "",
            esp, verifiedAt: cached.verifiedAt, creditsUsed: 0,
            fromCache: true, cacheExpiresAt: cached.expiresAt,
          } as EmailVerification;
          updateLead(leadId, { [field]: verification });
          recordCacheHit(email.trim(), leadId);
          cacheHits++;
          verified++;
          return;
        }
        const data = await verifySingle(key, email.trim());
        const esp = getESP(email.trim());
        const verification = {
          quality: data.quality || "", result: data.result || "error",
          resultcode: data.resultcode || 0, subresult: data.subresult || "",
          free: !!data.free, role: !!data.role, didyoumean: data.didyoumean || "",
          esp, verifiedAt: new Date().toISOString(), creditsUsed: 1, fromCache: false,
        } as EmailVerification;
        saveToCache(email.trim(), {
          result: data.result || "error", quality: data.quality || "",
          resultcode: data.resultcode || 0, subresult: data.subresult || "",
          free: !!data.free, role: !!data.role, didyoumean: data.didyoumean || "", esp,
        });
        updateLead(leadId, { [field]: verification });
        if (data.result === "invalid" || data.result === "error") invalid++;
        else verified++;
      } catch { /* skip failed */ }
    };

    for (const id of selectedIds) {
      const lead = leads.find(l => l.id === id);
      if (!lead) continue;
      for (const type of types) {
        if (type === "work") await verifyEmail(lead.email, lead.id, "emailVerification");
        else if (type === "personal1") await verifyEmail(lead.personalEmail, lead.id, "personalEmailVerification");
        else if (type === "personal2") await verifyEmail(lead.personalEmail2, lead.id, "personalEmail2Verification");
      }
    }

    setBulkVerifying(false);
    const parts = [`${verified + invalid} emails checked`, `${verified} verified`, `${invalid} invalid`];
    if (cacheHits > 0) parts.push(`${cacheHits} cached`);
    toast.success(parts.join(" · "));
    setSelectedIds(new Set());
  };

  const viewTitles: Record<string, string> = {
    dashboard: "Dashboard", users: "User Management", sms: "SMS Center",
    all: "All Leads", active: "Active Leads", inactive: "Inactive Leads",
    "workforce-live": "Live Activity", "workforce-timelogs": "Time Logs",
    "workforce-salary": "Salary Calculator", "workforce-settings": "Workforce Settings",
    "my-activity": "My Activity",
    "ev-report": "Verification Report", "ev-settings": "API Settings",
    "api-integrations": "API Dashboard",
    "backups": "Backups", "smtp-settings": "SMTP Settings",
    "security-center": "Security Center",
  };
  const viewTitle = viewTitles[view] || "All Leads";

  const isWorkforceView = view.startsWith("workforce-");
  const isEVView = view.startsWith("ev-");
  const isLeadView = !isWorkforceView && !isEVView && view !== "dashboard" && view !== "users" && view !== "sms" && view !== "my-activity" && view !== "api-integrations" && view !== "backups" && view !== "smtp-settings" && view !== "security-center";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Session expired modal */}
      {sessionExpired && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Session Expired</h3>
            <p className="text-sm text-muted-foreground">Your session has expired. Please log in again.</p>
            <button onClick={() => { dismissSessionExpired(); logout(); }} className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Log In Again</button>
          </div>
        </div>
      )}
      {concurrentSessionKicked && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Logged Out</h3>
            <p className="text-sm text-muted-foreground">A new session was started elsewhere.</p>
            <button onClick={() => { dismissConcurrentKick(); logout(); }} className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Log In Again</button>
          </div>
        </div>
      )}
      {sessionWarning && !sessionExpired && (
        <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border border-amber-300 bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Session Expiring</h3>
            <p className="text-sm text-muted-foreground">Your session will expire in less than 5 minutes.</p>
            <div className="flex gap-3">
              <button onClick={extendSession} className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Stay Logged In</button>
              <button onClick={logout} className="flex-1 rounded-md border border-input bg-background py-2 text-sm font-medium text-muted-foreground hover:bg-accent">Log Out</button>
            </div>
          </div>
        </div>
      )}

      <CRMSidebar
        leads={leads} view={view} setView={setView} filter={filter} setFilter={setFilter} stats={stats}
        industries={industries}
        onAddIndustry={permissions.canAddIndustry ? addIndustry : undefined}
        onAddCompany={permissions.canAddCompany ? (name: string, industry: string, email?: string) => {
          addCompany(name, industry, email);
          toast.success(`${name} added successfully.`);
        } : undefined}
        onDeleteIndustry={permissions.canDeleteIndustry ? handleDeleteIndustry : undefined}
        onDeleteCompany={permissions.canDeleteCompany ? handleDeleteCompany : undefined}
        onRenameIndustry={permissions.canRenameIndustry ? handleRenameIndustry : undefined}
        onRenameCompany={permissions.canRenameCompany ? handleRenameCompany : undefined}
        onMergeCompany={permissions.canMergeCompany ? (source: string, target: string) => {
          const count = mergeCompany(source, target);
          toast.success(`"${source}" merged into "${target}". ${count} leads moved.`);
          return count;
        } : undefined}
        showUserManagement={permissions.canManageUsers}
        showSMSCenter={permissions.canAccessSMS}
        showWorkforce={isAdmin}
        showMyActivity={!isAdmin}
        showEmailVerifier={isAdmin}
        showAPIIntegrations={isAdmin}
        
        showBackups={isAdmin}
        showSMTPSettings={isAdmin}
        showSecurityCenter={isAdmin}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <h1 className="text-sm font-semibold tracking-tight">{viewTitle}</h1>
          <div className="flex items-center gap-2">
            {isLeadView && (
              <>
                {permissions.canImport && (
                  <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
                    <Upload className="h-4 w-4" /> Import CSV
                  </button>
                )}
                {permissions.canExport && <ExportDropdown leads={leads} currentPageLeads={filteredLeads} />}
                {permissions.canAddLead && (
                  <button onClick={() => setModal({ type: "add" })} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all">
                    <Plus className="h-4 w-4" /> Add Lead
                  </button>
                )}
              </>
            )}
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {view === "users" && permissions.canManageUsers ? (
            <UserManagement />
          ) : view === "sms" && permissions.canAccessSMS ? (
            <SMSCenter leads={leads} industries={industries} companies={companies} />
          ) : view === "workforce-live" && isAdmin ? (
            <LiveActivity />
          ) : view === "workforce-timelogs" && isAdmin ? (
            <TimeLogs />
          ) : view === "workforce-salary" && isAdmin ? (
            <SalaryReport />
          ) : view === "workforce-settings" && isAdmin ? (
            <WorkforceSettingsPage />
          ) : view === "my-activity" ? (
            <MyActivity />
          ) : view === "api-integrations" && isAdmin ? (
            <APIDashboard />
          ) : view === "backups" && isAdmin ? (
            <BackupSettings leads={leads} />
          ) : view === "smtp-settings" && isAdmin ? (
            <SMTPSettings />
          ) : view === "security-center" && isAdmin ? (
            <SecurityCenter leads={leads} />
          ) : isEVView && isAdmin ? (
            view === "ev-report" ? <VerificationReport /> : <APISettings />
          ) : view === "dashboard" ? (
            <DashboardView
              stats={stats}
              industryBreakdown={industryBreakdown}
              onIndustryClick={(industry) => { setView("all"); setFilter({ industry, company: null, status: null, search: "" }); }}
            />
          ) : (
            <div className="space-y-4">
              <LeadFilters filter={filter} setFilter={setFilter} sortBy={sortBy} setSortBy={setSortBy} industries={industries} companies={companies} />
              <AnimatePresence>
                {selectedIds.size > 0 && (
                  <BulkActionBar
                    count={selectedIds.size}
                    onUpdateStatus={(status: PipelineStatus) => {
                      if (!checkPermission("canBulkStatusUpdate", "Bulk Status Update")) return;
                      bulkUpdateStatus(selectedIds, status);
                      trackAction("bulk_action", { count: selectedIds.size });
                      logAudit(currentUser.email, currentUser.id, 'BULK_ACTION', `Status → ${status} for ${selectedIds.size} leads`);
                      toast.success(`Pipeline status updated to "${status}" for ${selectedIds.size} leads.`);
                      setSelectedIds(new Set());
                    }}
                    onMarkActive={() => { bulkSetActive(selectedIds, true); toast.success(`${selectedIds.size} leads marked Active.`); setSelectedIds(new Set()); }}
                    onMarkInactive={() => { bulkSetActive(selectedIds, false); toast.success(`${selectedIds.size} leads marked Inactive.`); setSelectedIds(new Set()); }}
                    onVerifyEmails={handleBulkVerifyEmails}
                    verifying={bulkVerifying}
                    onClear={() => setSelectedIds(new Set())}
                  />
                )}
              </AnimatePresence>
              <LeadTable
                leads={filteredLeads}
                onToggleActive={permissions.canToggleActive ? (id) => {
                  toggleActive(id);
                  trackAction("status_updated");
                  const lead = leads.find(l => l.id === id);
                  if (lead) toast.success(`${lead.name} marked as ${lead.active ? "inactive" : "active"}`);
                } : undefined}
                onEdit={permissions.canEditAnyLead || permissions.canEditOwnLead ? (lead) => setModal({ type: "edit", lead }) : undefined}
                onDelete={permissions.canDeleteLead ? (lead) => setDeleteTarget(lead) : undefined}
                canEditLead={canEditLead}
                selectedIds={selectedIds}
                onSelectionChange={permissions.canEditAnyLead || permissions.canEditOwnLead ? setSelectedIds : undefined}
              />
            </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {modal && (
          <LeadModal key="lead-modal" lead={modal.type === "edit" ? modal.lead : null}
            existingTypes={industries} existingCompanies={companies} onSave={handleSave} onClose={() => setModal(null)} onAddCompany={addCompany} />
        )}
        {importOpen && (
          <ImportModal key="import-modal" existingLeads={leads} onImport={handleImport} onClose={() => setImportOpen(false)}
            existingTags={allTags} existingFolders={allFolders} existingListSources={allListSources} />
        )}
        {deleteTarget && (
          <DeleteDialog key="delete-dialog" lead={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
