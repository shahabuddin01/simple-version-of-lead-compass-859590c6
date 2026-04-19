import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSupabaseLeads, SupabaseLead, PipelineStatus, FilterState } from "@/hooks/useSupabaseLeads";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { SupabaseUserMenu } from "@/components/auth/SupabaseUserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CRMSidebar } from "@/components/crm/CRMSidebar";
import { DashboardView } from "@/components/crm/DashboardView";
import { LeadTable } from "@/components/crm/LeadTable";
import { LeadModal } from "@/components/crm/LeadModal";
import { ImportModal } from "@/components/crm/ImportModal";
import { DeleteDialog } from "@/components/crm/DeleteDialog";
import { LeadFilters } from "@/components/crm/LeadFilters";
import { ExportDropdown } from "@/components/crm/ExportDropdown";
import { BulkActionBar } from "@/components/crm/BulkActionBar";
import { BulkDeleteModal } from "@/components/crm/BulkDeleteModal";
import { AddToClientCommModal } from "@/components/crm/AddToClientCommModal";
import { SupabaseUserManagement } from "@/pages/SupabaseUserManagement";
import { BackupSettings } from "@/components/settings/BackupSettings";
import { ClientCommunicationPage } from "@/components/client-communications/ClientCommunicationPage";
import { VerificationReport } from "@/components/email-verifier/VerificationReport";
import { APISettings } from "@/components/email-verifier/APISettings";
import { loadMVSettings, verifySingle, getESP } from "@/lib/emailVerifier";
import { EmailVerification } from "@/types/lead";
import { APIDashboard } from "@/components/api-dashboard/APIDashboard";
import { LiveActivity } from "@/components/workforce/LiveActivity";
import { TimeLogs } from "@/components/workforce/TimeLogs";
import { SalaryReport } from "@/components/workforce/SalaryReport";
import { WorkforceSettingsPage } from "@/components/workforce/WorkforceSettingsPage";
import { MyActivity } from "@/components/workforce/MyActivity";

import { Lead, ViewMode } from "@/types/lead";
import { getIndustryTree } from "@/lib/leadUtils";
import { AnimatePresence, motion } from "motion/react";
import { pageTransition } from "@/lib/animations";
import { Plus, Upload, Loader2, Trash2, MoreVertical } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import { toast } from "sonner";

// Mobile-friendly header with 3-dot menu
function HeaderBar({ viewTitle, isLeadView, onImport, onAddLead, leads, filteredLeads, isAdmin }: {
  viewTitle: string; isLeadView: boolean; onImport: () => void; onAddLead: () => void; leads: Lead[]; filteredLeads: Lead[]; isAdmin: boolean;
}) {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3 sm:px-6 gap-2">
      <h1 className="text-sm font-semibold tracking-tight truncate">{viewTitle}</h1>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {isLeadView && (
          isMobile ? (
            <>
              <button onClick={onAddLead} className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all">
                <Plus className="h-3.5 w-3.5" />
              </button>
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={`flex items-center justify-center rounded-lg border p-1.5 transition-all ${
                    menuOpen ? "border-primary/30 bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: -4 }}
                      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                      className="fixed right-3 top-14 z-[9999] min-w-[180px] rounded-xl border border-border bg-popover/95 backdrop-blur-md p-1.5 shadow-2xl ring-1 ring-black/5"
                    >
                      <button
                        onClick={() => { onImport(); setMenuOpen(false); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                      >
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        Import CSV
                      </button>
                      {isAdmin && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <ExportDropdown leads={leads} currentPageLeads={filteredLeads} onExportDone={() => setMenuOpen(false)} />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <>
              <button onClick={onImport} className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent">
                <Upload className="h-4 w-4" /> Import CSV
              </button>
              {isAdmin && <ExportDropdown leads={leads} currentPageLeads={filteredLeads} />}
              <button onClick={onAddLead} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all">
                <Plus className="h-4 w-4" /> Add Lead
              </button>
            </>
          )
        )}
        <ThemeToggle />
        <SupabaseUserMenu />
      </div>
    </header>
  );
}

// Adapter to convert Supabase leads to legacy Lead type for existing components
function toFrontendLead(sl: SupabaseLead): Lead {
  return {
    id: sl.id,
    type: sl.industry || "",
    company: sl.company || "",
    companyEmail: sl.company_email || "",
    name: sl.name,
    position: sl.position || "",
    phone: sl.work_phone || "",
    personalPhone1: sl.personal_phone1 || "",
    personalPhone2: sl.personal_phone2 || "",
    email: sl.work_email || "",
    personalEmail: sl.personal_email || "",
    personalEmail2: sl.personal_email2 || "",
    linkedin: sl.linkedin || "",
    facebook: sl.facebook || "",
    instagram: sl.instagram || "",
    status: sl.status as any || "New",
    active: sl.active,
    dateAdded: sl.created_at,
    notes: sl.notes || "",
    listSource: sl.list_source || "",
    folder: sl.folder || "",
    tags: sl.tags || [],
    createdBy: sl.created_by || undefined,
    emailVerification: sl.email_verification || undefined,
    personalEmailVerification: sl.personal_email_verification || undefined,
    personalEmail2Verification: sl.personal_email2_verification || undefined,
  };
}

function toSupabaseFields(data: Omit<Lead, "id" | "dateAdded">): Partial<SupabaseLead> {
  return {
    name: data.name,
    company: data.company,
    company_email: data.companyEmail,
    position: data.position,
    industry: data.type,
    work_email: data.email,
    personal_email: data.personalEmail,
    personal_email2: data.personalEmail2,
    work_phone: data.phone,
    personal_phone1: data.personalPhone1,
    personal_phone2: data.personalPhone2,
    linkedin: data.linkedin,
    facebook: data.facebook,
    instagram: data.instagram,
    status: data.status,
    active: data.active,
    notes: data.notes,
    folder: data.folder || "",
    tags: data.tags || [],
    list_source: data.listSource || "",
  };
}

const CRMApp = () => {
  const { appUser, isAdmin, logout } = useSupabaseAuth();
  useActivityTracker(appUser ? { id: appUser.id, fullName: appUser.fullName, role: appUser.role } : null);
  const {
    leads: supabaseLeads, filteredLeads: supabaseFilteredLeads, loading,
    filter, setFilter, sortBy, setSortBy, stats, industries, companies, folders,
    addLead, updateLead, deleteLead, toggleActive, importLeads,
    bulkUpdateStatus, bulkSetActive, bulkDeleteLeads, bulkMoveToFolder, deleteAllLeads,
    duplicateCount, removeDuplicates, fetchLeads,
  } = useSupabaseLeads();

  const [view, setView] = useState<ViewMode>("dashboard");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"selected" | "page" | "pages" | "all" | null>(null);
  const [clientCommModalOpen, setClientCommModalOpen] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<any>(null);
  const [modal, setModal] = useState<{ type: "add" | "edit"; lead?: Lead } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>([]);

  // Merge DB-derived folders with locally created ones
  const allFolders = useMemo(() => {
    const set = new Set([...folders, ...customFolders]);
    return [...set].sort();
  }, [folders, customFolders]);

  // Convert to frontend format
  const leads = useMemo(() => supabaseLeads.map(toFrontendLead), [supabaseLeads]);
  const filteredLeads = useMemo(() => supabaseFilteredLeads.map(toFrontendLead), [supabaseFilteredLeads]);

  useEffect(() => { setSelectedIds(new Set()); }, [filter, view]);

  // RBAC check
  useEffect(() => {
    if (!appUser) return;
    const adminOnlyViews = ["users", "workforce-live", "workforce-timelogs", "workforce-salary", "workforce-settings", "ev-report", "ev-settings", "api-integrations", "backups"];
    if (adminOnlyViews.includes(view) && !isAdmin) {
      toast.error("You don't have permission to access this section.");
      setView("all");
    }
  }, [view, appUser, isAdmin]);

  const industryBreakdown = useMemo(() => {
    const tree = getIndustryTree(leads);
    return Object.entries(tree).map(([industry, data]) => ({
      industry, companies: Object.keys(data.companies).length, contacts: data.total,
    }));
  }, [leads]);

  const handleSave = async (data: Omit<Lead, "id" | "dateAdded">) => {
    const fields = toSupabaseFields(data);
    if (modal?.type === "edit" && modal.lead) {
      await updateLead(modal.lead.id, fields);
      toast.success(`Lead "${data.name}" updated`);
    } else {
      await addLead({ ...fields, name: data.name, created_by: appUser?.id || null });
      toast.success(`Lead "${data.name}" added`);
    }
    setModal(null);
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteLead(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleImport = async (newLeads: Omit<Lead, "id" | "dateAdded">[], updateExisting: boolean) => {
    const mapped = newLeads.map(l => ({ ...toSupabaseFields(l), name: l.name }));
    await importLeads(mapped, updateExisting);
    setView("all");
    setFilter({ industry: null, company: null, status: null, search: "" });
  };

  const handleBulkDelete = async (mode: "selected" | "page" | "pages" | "all", pages?: number[]) => {
    if (mode === "selected") {
      await bulkDeleteLeads(selectedIds);
      setSelectedIds(new Set());
      setBulkDeleteMode(null);
    } else if (mode === "page") {
      const pageIds = new Set(pageLeads.map(l => l.id));
      setDeleteProgress({ running: true, current: 0, total: pageIds.size, step: "Deleting current page leads...", done: false, deletedCount: 0 });
      await bulkDeleteLeads(pageIds);
      setSelectedIds(new Set());
      setDeleteProgress({ running: false, current: pageIds.size, total: pageIds.size, step: "Done", done: true, deletedCount: pageIds.size });
    } else if (mode === "pages" && pages && pages.length > 0) {
      // Collect lead IDs from selected pages
      const idsToDelete: string[] = [];
      for (const page of pages) {
        const start = (page - 1) * LEADS_PER_PAGE;
        const end = start + LEADS_PER_PAGE;
        const pageSlice = filteredLeads.slice(start, end);
        pageSlice.forEach(l => idsToDelete.push(l.id));
      }
      const totalToDelete = idsToDelete.length;
      setDeleteProgress({ running: true, current: 0, total: totalToDelete, step: `Deleting leads from ${pages.length} page(s)...`, done: false, deletedCount: 0 });

      // Delete in batches of 100
      const batchSize = 100;
      let deleted = 0;
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        const batchSet = new Set(batch);
        const { error } = await supabase.from("leads").delete().in("id", batch);
        if (error) {
          toast.error("Failed to delete batch: " + error.message);
          setDeleteProgress(null);
          setBulkDeleteMode(null);
          return;
        }
        deleted += batch.length;
        setDeleteProgress({ running: true, current: deleted, total: totalToDelete, step: `Deleted ${deleted} of ${totalToDelete} leads...`, done: false, deletedCount: deleted });
      }

      setSelectedIds(new Set());
      await fetchLeads();
      setDeleteProgress({ running: false, current: totalToDelete, total: totalToDelete, step: "Done", done: true, deletedCount: totalToDelete });
      toast.success(`${totalToDelete} leads deleted from ${pages.length} page(s)`);
    } else if (mode === "all") {
      setDeleteProgress({ running: true, current: 0, total: leads.length, step: "Deleting all leads...", done: false, deletedCount: 0 });
      await deleteAllLeads();
      setDeleteProgress({ running: false, current: leads.length, total: leads.length, step: "Done", done: true, deletedCount: leads.length });
    }
  };

  const LEADS_PER_PAGE = 50;
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));
  const pageLeads = filteredLeads.slice(0, LEADS_PER_PAGE);

  const viewTitles: Record<string, string> = {
    dashboard: "Dashboard", users: "User Management",
    all: "All Leads", active: "Active Leads", inactive: "Inactive Leads",
    "client-communications": "Client Communication",
    "workforce-live": "Live Activity", "workforce-timelogs": "Time Logs",
    "workforce-salary": "Salary Calculator", "workforce-settings": "Workforce Settings",
    "my-activity": "My Activity",
    "ev-report": "Verification Report", "ev-settings": "API Settings",
    "api-integrations": "API Dashboard",
    "backups": "Backups",
  };
  const viewTitle = viewTitles[view] || "All Leads";

  const isWorkforceView = view.startsWith("workforce-");
  const isEVView = view.startsWith("ev-");
  const isLeadView = !isWorkforceView && !isEVView && view !== "dashboard" && view !== "users" && view !== "my-activity" && view !== "api-integrations" && view !== "backups" && view !== "client-communications";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <CRMSidebar
        leads={leads} view={view} setView={setView} filter={filter as any} setFilter={setFilter as any} stats={stats as any}
        industries={industries}
        onAddIndustry={isAdmin ? () => {} : undefined}
        onAddCompany={isAdmin ? () => {} : undefined}
        onDeleteIndustry={isAdmin ? () => {} : undefined}
        onDeleteCompany={isAdmin ? () => {} : undefined}
        onRenameIndustry={isAdmin ? () => {} : undefined}
        onRenameCompany={isAdmin ? () => {} : undefined}
        onMergeCompany={isAdmin ? () => 0 : undefined}
        showUserManagement={isAdmin}
        showWorkforce={isAdmin}
        showMyActivity={isAdmin}
        showEmailVerifier={isAdmin}
        showAPIIntegrations={isAdmin}
        showBackups={isAdmin}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <HeaderBar
          viewTitle={viewTitle}
          isLeadView={isLeadView}
          onImport={() => setImportOpen(true)}
          onAddLead={() => setModal({ type: "add" })}
          leads={leads}
          filteredLeads={filteredLeads}
          isAdmin={isAdmin}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <AnimatePresence mode="wait">
          <motion.div key={view} {...pageTransition} className="h-full">
          {view === "users" && isAdmin ? (
            <SupabaseUserManagement />
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
          ) : view === "client-communications" ? (
            <ClientCommunicationPage leads={leads} />
          ) : isEVView && isAdmin ? (
            view === "ev-report" ? <VerificationReport /> : <APISettings />
          ) : view === "dashboard" ? (
            <DashboardView
              stats={stats as any}
              industryBreakdown={industryBreakdown}
              onIndustryClick={(industry) => { setView("all"); setFilter({ industry, company: null, status: null, search: "" }); }}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <LeadFilters filter={filter as any} setFilter={setFilter as any} sortBy={sortBy} setSortBy={setSortBy} industries={industries} companies={companies} folders={allFolders} duplicateCount={duplicateCount} isAdmin={isAdmin} onCreateFolder={(name) => {
                  setCustomFolders(prev => prev.includes(name) ? prev : [...prev, name]);
                  toast.success(`Folder "${name}" created`);
                }} />
                {isAdmin && duplicateCount > 0 && (filter as any).showDuplicatesOnly && (
                  <button
                    onClick={async () => {
                      if (confirm(`Remove ${duplicateCount} duplicate leads? The oldest entry for each group will be kept.`)) {
                        await removeDuplicates();
                      }
                    }}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" /> Remove Duplicates
                  </button>
                )}
              </div>
              <AnimatePresence>
                {selectedIds.size > 0 && (
                  <BulkActionBar
                    count={selectedIds.size}
                    onUpdateStatus={(status: PipelineStatus) => {
                      bulkUpdateStatus(selectedIds, status);
                      setSelectedIds(new Set());
                    }}
                    onMarkActive={() => { bulkSetActive(selectedIds, true); setSelectedIds(new Set()); }}
                    onMarkInactive={() => { bulkSetActive(selectedIds, false); setSelectedIds(new Set()); }}
                    onVerifyEmails={async (types) => {
                      const settings = loadMVSettings();
                      const key = settings.useDemo ? "API_KEY_FOR_TEST" : settings.apiKey;
                      if (!key) { toast.error("Configure your MillionVerifier API key in Email Verifier → API Settings."); return; }
                      const targets = leads.filter(l => selectedIds.has(l.id));
                      const fieldMap = { work: { email: "email", db: "email_verification", front: "emailVerification" }, personal1: { email: "personalEmail", db: "personal_email_verification", front: "personalEmailVerification" }, personal2: { email: "personalEmail2", db: "personal_email2_verification", front: "personalEmail2Verification" } } as const;
                      const tasks: { id: string; email: string; dbField: string }[] = [];
                      for (const l of targets) {
                        for (const t of types) {
                          const m = fieldMap[t];
                          const email = (l as any)[m.email]?.trim();
                          if (email) tasks.push({ id: l.id, email, dbField: m.db });
                        }
                      }
                      if (tasks.length === 0) { toast.error("No emails to verify in selected leads."); return; }
                      setBulkVerifying(true);
                      const tId = toast.loading(`Verifying ${tasks.length} email${tasks.length !== 1 ? "s" : ""}...`);
                      let ok = 0, fail = 0;
                      for (const task of tasks) {
                        try {
                          const data = await verifySingle(key, task.email);
                          if (data.error && data.result === "error") { fail++; continue; }
                          const verification: EmailVerification = {
                            quality: data.quality || "",
                            result: data.result || "error",
                            resultcode: data.resultcode || 0,
                            subresult: data.subresult || "",
                            free: !!data.free,
                            role: !!data.role,
                            didyoumean: data.didyoumean || "",
                            esp: data._esp || getESP(task.email),
                            verifiedAt: data._verifiedAt || new Date().toISOString(),
                            creditsUsed: 1,
                            fromCache: !!data.fromCache,
                          };
                          await updateLead(task.id, { [task.dbField]: verification } as any);
                          ok++;
                        } catch { fail++; }
                      }
                      toast.dismiss(tId);
                      if (fail === 0) toast.success(`Verified ${ok} email${ok !== 1 ? "s" : ""} successfully`);
                      else toast.warning(`Verified ${ok}, failed ${fail}`);
                      setBulkVerifying(false);
                      fetchLeads();
                    }}
                    verifying={bulkVerifying}
                    onClear={() => setSelectedIds(new Set())}
                    isAdmin={isAdmin}
                    onDeleteSelected={isAdmin ? () => setBulkDeleteMode("selected") : undefined}
                    onDeletePage={isAdmin ? () => setBulkDeleteMode("page") : undefined}
                    onDeleteByPages={isAdmin ? () => setBulkDeleteMode("pages") : undefined}
                    onDeleteAll={isAdmin ? () => setBulkDeleteMode("all") : undefined}
                    onAddToClientComm={() => setClientCommModalOpen(true)}
                    pageLeadCount={pageLeads.length}
                    totalLeads={leads.length}
                    folders={isAdmin ? allFolders : []}
                    onMoveToFolder={isAdmin ? async (folder: string) => {
                      await bulkMoveToFolder(selectedIds, folder);
                      setSelectedIds(new Set());
                    } : undefined}
                  />
                )}
              </AnimatePresence>
              <LeadTable
                leads={filteredLeads}
                onToggleActive={(id) => toggleActive(id)}
                onEdit={(lead) => setModal({ type: "edit", lead })}
                onDelete={(lead) => setDeleteTarget(lead)}
                canEditLead={() => true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
              />
            </div>
          )}
          </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {modal && (
          <LeadModal key="lead-modal" lead={modal.type === "edit" ? modal.lead : null}
            existingTypes={industries} existingCompanies={companies} onSave={handleSave} onClose={() => setModal(null)} onAddCompany={() => {}} />
        )}
        {importOpen && (
          <ImportModal key="import-modal" existingLeads={leads} onImport={handleImport} onClose={() => setImportOpen(false)}
            existingTags={[]} existingFolders={[]} existingListSources={[]} />
        )}
        {deleteTarget && (
          <DeleteDialog key="delete-dialog" lead={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
        )}
      </AnimatePresence>

      <BulkDeleteModal
        open={!!bulkDeleteMode}
        onClose={() => { setBulkDeleteMode(null); setDeleteProgress(null); }}
        mode={bulkDeleteMode || "selected"}
        selectedCount={selectedIds.size}
        pageLeadCount={pageLeads.length}
        currentPage={1}
        totalLeads={leads.length}
        totalPages={totalPages}
        leadsPerPage={LEADS_PER_PAGE}
        onConfirmDelete={handleBulkDelete}
        progress={deleteProgress}
        onGoToLeads={() => { setView("all"); setBulkDeleteMode(null); setDeleteProgress(null); }}
      />

      <AddToClientCommModal
        open={clientCommModalOpen}
        onClose={() => setClientCommModalOpen(false)}
        selectedLeads={leads.filter(l => selectedIds.has(l.id)) as unknown as Lead[]}
        onDone={() => setSelectedIds(new Set())}
      />
    </div>
  );
};

export default CRMApp;
