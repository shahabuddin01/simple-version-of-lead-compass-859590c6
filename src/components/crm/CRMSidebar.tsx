import { useMemo, useState, useEffect, useCallback } from "react";
import logoSrc from "@/assets/logo.png";
import { ChevronRight, LayoutDashboard, Users, UserCheck, UserX, Plus, AlertTriangle, ArrowDown, Settings, Activity, Clock, DollarSign, Wrench, BarChart3, Mail, BarChart2, ShieldCheck, MessageSquare } from "lucide-react";
import { Lead, ViewMode } from "@/types/lead";
import { getIndustryTree } from "@/lib/leadUtils";
import { motion, AnimatePresence } from "motion/react";

// Workforce collapsible dropdown - extracted as separate component for proper hooks usage
function WorkforceDropdown({ view, navItem }: { view: ViewMode; navItem: (label: string, icon: React.ReactNode, targetView: ViewMode, count: number) => React.ReactNode }) {
  const workforceViews: ViewMode[] = ["workforce-live", "workforce-timelogs", "workforce-salary", "workforce-settings"];
  const isWorkforceActive = workforceViews.includes(view);
  const [wfOpen, setWfOpen] = useState(() => {
    try { return sessionStorage.getItem("ns_wf_open") === "1" || isWorkforceActive; } catch { return isWorkforceActive; }
  });
  const toggleWf = () => {
    const next = !wfOpen;
    setWfOpen(next);
    try { sessionStorage.setItem("ns_wf_open", next ? "1" : "0"); } catch {}
  };
  return (
    <>
      <div className="my-3 h-px bg-border" />
      <button
        onClick={toggleWf}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isWorkforceActive && !wfOpen
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        <Users className="h-4 w-4" />
        <span className="flex-1 text-left">Workforce</span>
        <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-150 ${wfOpen ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence>
        {wfOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="relative pl-3">{navItem("Live Activity", <Activity className="h-4 w-4" />, "workforce-live", 0)}</div>
            <div className="relative pl-3">{navItem("Time Logs", <Clock className="h-4 w-4" />, "workforce-timelogs", 0)}</div>
            <div className="relative pl-3">{navItem("Salary Report", <DollarSign className="h-4 w-4" />, "workforce-salary", 0)}</div>
            <div className="relative pl-3">{navItem("Settings", <Wrench className="h-4 w-4" />, "workforce-settings", 0)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Email Verifier collapsible dropdown
function EmailVerifierDropdown({ view, navItem }: { view: ViewMode; navItem: (label: string, icon: React.ReactNode, targetView: ViewMode, count: number) => React.ReactNode }) {
  const evViews: ViewMode[] = ["ev-report", "ev-settings"];
  const isEVActive = evViews.includes(view);
  const [evOpen, setEvOpen] = useState(() => {
    try { return sessionStorage.getItem("ns_ev_open") === "1" || isEVActive; } catch { return isEVActive; }
  });
  const toggleEv = () => {
    const next = !evOpen;
    setEvOpen(next);
    try { sessionStorage.setItem("ns_ev_open", next ? "1" : "0"); } catch {}
  };
  return (
    <>
      <div className="my-3 h-px bg-border" />
      <button
        onClick={toggleEv}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isEVActive && !evOpen
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        <Mail className="h-4 w-4" />
        <span className="flex-1 text-left">Email Verifier</span>
        <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-150 ${evOpen ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence>
        {evOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="relative pl-3">{navItem("Verification Report", <BarChart2 className="h-4 w-4" />, "ev-report", 0)}</div>
            <div className="relative pl-3">{navItem("API Settings", <Settings className="h-4 w-4" />, "ev-settings", 0)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Interfaces
interface IndustryNode {
  companies: Record<string, number>;
  total: number;
}

interface IndustryTree {
  [industry: string]: IndustryNode;
}

// Props for the CRMSidebar component
interface CRMSidebarProps {
  leads: Lead[];
  view: ViewMode;
  setView: (v: ViewMode) => void;
  filter: { industry: string | null; company: string | null; status: any; search: string };
  setFilter: (f: any) => void;
  stats: { total: number; active: number; inactive: number };
  industries: string[];
  onAddIndustry?: (name: string) => void;
  onAddCompany?: (name: string, industry: string, email?: string) => void;
  onDeleteIndustry?: (name: string) => void;
  onDeleteCompany?: (name: string) => void;
  onRenameIndustry?: (oldName: string, newName: string) => void;
  onRenameCompany?: (oldName: string, newName: string) => void;
  onMergeCompany?: (sourceName: string, targetName: string) => number;
  showUserManagement?: boolean;
  showWorkforce?: boolean;
  showMyActivity?: boolean;
  showEmailVerifier?: boolean;
  showAPIIntegrations?: boolean;
  showBackups?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: "industry" | "company";
  name: string;
  industry?: string;
}

export function CRMSidebar({
  leads, view, setView, filter, setFilter, stats, industries,
  onAddIndustry, onAddCompany, onDeleteIndustry, onDeleteCompany,
  onRenameIndustry, onRenameCompany, onMergeCompany, showUserManagement,
  showWorkforce, showMyActivity, showEmailVerifier, showAPIIntegrations, showBackups,
}: CRMSidebarProps) {
  const tree = useMemo(() => getIndustryTree(leads), [leads]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAddIndustry, setShowAddIndustry] = useState(false);
  const [newIndustryName, setNewIndustryName] = useState("");
  const [industryError, setIndustryError] = useState("");

  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyIndustry, setNewCompanyIndustry] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [companyError, setCompanyError] = useState("");

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "industry" | "company"; name: string; industry?: string } | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ type: "industry" | "company"; name: string; industry?: string } | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState("");
  const [showMerge, setShowMerge] = useState(false);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeError, setMergeError] = useState("");

  const allIndustries = useMemo(() => {
    const treeKeys = new Set(Object.keys(tree).map((k) => k.toLowerCase()));
    const extras: Record<string, { companies: Record<string, number>; total: number }> = {};
    industries.forEach((ind) => {
      if (!treeKeys.has(ind.toLowerCase())) {
        extras[ind] = { companies: {}, total: 0 };
      }
    });
    return { ...tree, ...extras };
  }, [tree, industries]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    document.addEventListener("click", closeContextMenu);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", closeContextMenu);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu, closeContextMenu]);

  const hasContextActions = onRenameIndustry || onRenameCompany || onDeleteIndustry || onDeleteCompany || onMergeCompany;

  const handleContextMenu = (e: React.MouseEvent, type: "industry" | "company", name: string, industry?: string) => {
    if (!hasContextActions) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, name, industry });
  };

  const handleAddIndustry = () => {
    const trimmed = newIndustryName.trim();
    if (!trimmed) return;
    const exists = industries.some((i) => i.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setIndustryError("This industry already exists.");
      return;
    }
    onAddIndustry?.(trimmed);
    setNewIndustryName("");
    setShowAddIndustry(false);
    setIndustryError("");
  };

  const handleAddCompany = () => {
    const trimmed = newCompanyName.trim();
    if (!trimmed || !newCompanyIndustry) return;
    const industryData = allIndustries[newCompanyIndustry];
    if (industryData) {
      const exists = Object.keys(industryData.companies).some(
        (c) => c.toLowerCase() === trimmed.toLowerCase()
      );
      if (exists) {
        setCompanyError(`This company already exists under ${newCompanyIndustry}.`);
        return;
      }
    }
    onAddCompany?.(trimmed, newCompanyIndustry, newCompanyEmail.trim() || undefined);
    setShowAddCompany(false);
    setNewCompanyName("");
    setNewCompanyEmail("");
    setNewCompanyIndustry("");
    setCompanyError("");
    setExpanded((p) => ({ ...p, [newCompanyIndustry]: true }));
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm || deleteInput !== "DELETE") return;
    if (deleteConfirm.type === "industry") {
      onDeleteIndustry?.(deleteConfirm.name);
      if (filter?.industry?.toLowerCase() === deleteConfirm.name.toLowerCase()) {
        setFilter({ industry: null, company: null, status: null, search: "" });
      }
    } else {
      onDeleteCompany?.(deleteConfirm.name);
      if (filter?.company?.toLowerCase() === deleteConfirm.name.toLowerCase()) {
        setFilter({ ...filter, company: null });
      }
    }
    setDeleteConfirm(null);
    setDeleteInput("");
  };

  const openDeleteFromContext = () => {
    if (!contextMenu) return;
    setDeleteConfirm({ type: contextMenu.type, name: contextMenu.name, industry: contextMenu.industry });
    setDeleteInput("");
    setContextMenu(null);
  };

  const openRenameFromContext = () => {
    if (!contextMenu) return;
    setRenameTarget({ type: contextMenu.type, name: contextMenu.name, industry: contextMenu.industry });
    setRenameInput(contextMenu.name);
    setRenameError("");
    setContextMenu(null);
  };

  const openMergeFromContext = () => {
    if (!contextMenu || contextMenu.type !== "company") return;
    setMergeSource(contextMenu.name);
    setMergeTarget("");
    setMergeError("");
    setShowMerge(true);
    setContextMenu(null);
  };

  const allCompaniesWithIndustry = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((l) => {
      if (!map.has(l.company)) map.set(l.company, l.type);
    });
    return [...map.entries()].map(([name, industry]) => ({ name, industry })).sort((a, b) => a.name.localeCompare(b.name));
  }, [leads]);

  const mergePreviewLeads = useMemo(() => {
    if (!mergeSource) return [];
    return leads.filter((l) => l.company.toLowerCase() === mergeSource.toLowerCase());
  }, [leads, mergeSource]);

  const handleMerge = () => {
    if (!mergeSource || !mergeTarget) return;
    if (mergeSource.toLowerCase() === mergeTarget.toLowerCase()) {
      setMergeError("Source and target must be different companies.");
      return;
    }
    onMergeCompany?.(mergeSource, mergeTarget);
    setShowMerge(false);
    setMergeSource("");
    setMergeTarget("");
    setMergeError("");
  };

  const handleConfirmRename = () => {
    if (!renameTarget) return;
    const trimmed = renameInput.trim();
    if (!trimmed || trimmed === renameTarget.name) return;

    if (renameTarget.type === "industry") {
      const exists = industries.some((i) => i.toLowerCase() === trimmed.toLowerCase() && i.toLowerCase() !== renameTarget.name.toLowerCase());
      if (exists) {
        setRenameError("An industry with this name already exists.");
        return;
      }
      onRenameIndustry?.(renameTarget.name, trimmed);
      if (filter?.industry?.toLowerCase() === renameTarget.name.toLowerCase()) {
        setFilter({ ...filter, industry: trimmed, company: filter.company });
      }
    } else {
      const industryData = allIndustries[renameTarget.industry || ""];
      if (industryData) {
        const exists = Object.keys(industryData.companies).some(
          (c) => c.toLowerCase() === trimmed.toLowerCase() && c.toLowerCase() !== renameTarget.name.toLowerCase()
        );
        if (exists) {
          setRenameError(`A company with this name already exists under ${renameTarget.industry}.`);
          return;
        }
      }
      onRenameCompany?.(renameTarget.name, trimmed);
      if (filter?.company?.toLowerCase() === renameTarget.name.toLowerCase()) {
        setFilter({ ...filter, company: trimmed });
      }
    }
    setRenameTarget(null);
    setRenameInput("");
    setRenameError("");
  };

  const navItem = (label: string, icon: React.ReactNode, targetView: ViewMode, count: number) => {
    const isActive = view === targetView;
    return (
      <button
        key={label}
        onClick={() => {
          setView(targetView);
          setFilter({ industry: null, company: null, status: null, search: "" });
        }}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        {isActive && <div className="absolute left-0 h-5 w-0.5 rounded-full bg-primary" />}
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {count > 0 && <span className="tabular-nums text-xs text-muted-foreground">{count}</span>}
      </button>
    );
  };

  const isDeleteValid = deleteInput === "DELETE";

  return (
    <>
      <aside className="flex h-screen w-72 flex-col border-r border-border bg-sidebar">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <img src={logoSrc} alt="NH Production House" className="h-10 w-auto object-contain" />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <div className="relative">
            {navItem("Dashboard", <LayoutDashboard className="h-4 w-4" />, "dashboard", stats.total)}
          </div>
          <div className="relative">
            {navItem("All Leads", <Users className="h-4 w-4" />, "all", stats.total)}
          </div>
          <div className="relative">
            {navItem("Active Leads", <UserCheck className="h-4 w-4" />, "active", stats.active)}
          </div>
          <div className="relative">
            {navItem("Inactive Leads", <UserX className="h-4 w-4" />, "inactive", stats.inactive)}
          </div>
          <div className="relative">
            {navItem("Client Communication", <MessageSquare className="h-4 w-4" />, "client-communications", 0)}
          </div>

          {showMyActivity && (
            <div className="relative">
              {navItem("My Activity", <BarChart3 className="h-4 w-4" />, "my-activity", 0)}
            </div>
          )}

          {showUserManagement && (
            <>
              <div className="my-3 h-px bg-border" />
              <div className="relative">
                {navItem("User Management", <Settings className="h-4 w-4" />, "users", 0)}
              </div>
            </>
          )}

          {showWorkforce && (
            <WorkforceDropdown view={view} navItem={navItem} />
          )}

          {showEmailVerifier && (
            <EmailVerifierDropdown view={view} navItem={navItem} />
          )}

          {showAPIIntegrations && (
            <>
              <div className="my-3 h-px bg-border" />
              <div className="relative">
                {navItem("API Dashboard", <LayoutDashboard className="h-4 w-4" />, "api-integrations", 0)}
              </div>
            </>
          )}


          {showBackups && (
            <div className="relative">
              {navItem("Backups", <ArrowDown className="h-4 w-4" />, "backups", 0)}
            </div>
          )}


          {showSecurityCenter && (
            <>
              <div className="my-3 h-px bg-border" />
              <div className="relative">
                {navItem("Security Center", <ShieldCheck className="h-4 w-4" />, "security-center", 0)}
              </div>
            </>
          )}

          <div className="my-3 h-px bg-border" />
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Industries
          </p>

          {Object.entries(allIndustries).map(([industry, data]) => (
            <div key={industry}>
              <button
                onClick={() => {
                  setExpanded((p) => ({ ...p, [industry]: !p[industry] }));
                  setView("all");
                  setFilter({ industry, company: null, status: null, search: "" });
                }}
                onContextMenu={(e) => handleContextMenu(e, "industry", industry)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter?.industry === industry && !filter?.company
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded[industry] ? "rotate-90" : ""}`}
                />
                <span className="flex-1 text-left truncate">{industry}</span>
                <span className="tabular-nums text-xs">{data.total}</span>
              </button>
              <AnimatePresence>
                {expanded[industry] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    {Object.entries(data.companies).map(([company, count], i) => (
                      <motion.button
                        key={company}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => {
                          setView("all");
                          setFilter({ industry, company, status: null, search: "" });
                        }}
                        onContextMenu={(e) => handleContextMenu(e, "company", company, industry)}
                        className="flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <span className="flex-1 text-left truncate">{company}</span>
                        <span className="tabular-nums text-xs">{count}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          {/* Add Industry */}
          {onAddIndustry && (
            showAddIndustry ? (
              <div className="px-3 py-1.5 space-y-1.5">
                <input
                  autoFocus
                  value={newIndustryName}
                  onChange={(e) => { setNewIndustryName(e.target.value); setIndustryError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddIndustry(); if (e.key === "Escape") { setShowAddIndustry(false); setIndustryError(""); } }}
                  placeholder="Industry name"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                {industryError && <p className="text-xs text-destructive">{industryError}</p>}
                <div className="flex gap-1.5">
                  <button onClick={handleAddIndustry} className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Add</button>
                  <button onClick={() => { setShowAddIndustry(false); setNewIndustryName(""); setIndustryError(""); }} className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddIndustry(true)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-primary hover:bg-primary/5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Industry
              </button>
            )
          )}

          {/* Add Company */}
          {onAddCompany && (
            showAddCompany ? (
              <div className="px-3 py-1.5 space-y-1.5">
                <input
                  autoFocus
                  value={newCompanyName}
                  onChange={(e) => { setNewCompanyName(e.target.value); setCompanyError(""); }}
                  placeholder="Company name"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <select
                  value={newCompanyIndustry}
                  onChange={(e) => setNewCompanyIndustry(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                >
                  <option value="">Select industry</option>
                  {industries.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <input
                  value={newCompanyEmail}
                  onChange={(e) => setNewCompanyEmail(e.target.value)}
                  placeholder="Company email (optional)"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                {companyError && <p className="text-xs text-destructive">{companyError}</p>}
                <div className="flex gap-1.5">
                  <button onClick={handleAddCompany} className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">Add</button>
                  <button onClick={() => { setShowAddCompany(false); setNewCompanyName(""); setNewCompanyEmail(""); setNewCompanyIndustry(""); setCompanyError(""); }} className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCompany(true)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-primary hover:bg-primary/5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Company
              </button>
            )
          )}
        </nav>
      </aside>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[9999] min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.type === "industry" && onRenameIndustry && (
            <button onClick={openRenameFromContext} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent">Rename Industry</button>
          )}
          {contextMenu.type === "company" && onRenameCompany && (
            <button onClick={openRenameFromContext} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent">Rename Company</button>
          )}
          {contextMenu.type === "company" && onMergeCompany && (
            <button onClick={openMergeFromContext} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent">Merge Into...</button>
          )}
          {((contextMenu.type === "industry" && onDeleteIndustry) || (contextMenu.type === "company" && onDeleteCompany)) && (
            <>
              <div className="my-0.5 h-px bg-border" />
              <button onClick={openDeleteFromContext} className="block w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10">
                Delete {contextMenu.type === "industry" ? "Industry" : "Company"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Delete "{deleteConfirm.name}"?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This will permanently delete {deleteConfirm.type === "industry" ? "the industry and all its companies and leads" : "the company and all its leads"}.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Type <strong>DELETE</strong> to confirm:</p>
              <input
                autoFocus
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && isDeleteValid) handleConfirmDelete(); }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={handleConfirmDelete} disabled={!isDeleteValid} className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 disabled:opacity-50 transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setRenameTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold">Rename {renameTarget.type === "industry" ? "Industry" : "Company"}</h3>
            <input
              autoFocus
              value={renameInput}
              onChange={(e) => { setRenameInput(e.target.value); setRenameError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleConfirmRename(); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
            {renameError && <p className="text-xs text-destructive">{renameError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenameTarget(null)} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={handleConfirmRename} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-all">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMerge && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setShowMerge(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold">Merge Company</h3>
            <p className="text-sm text-muted-foreground">
              Merge "<strong>{mergeSource}</strong>" ({mergePreviewLeads.length} leads) into:
            </p>
            <select
              value={mergeTarget}
              onChange={(e) => { setMergeTarget(e.target.value); setMergeError(""); }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select target company</option>
              {allCompaniesWithIndustry.filter(c => c.name.toLowerCase() !== mergeSource.toLowerCase()).map(c => (
                <option key={c.name} value={c.name}>{c.name} ({c.industry})</option>
              ))}
            </select>
            {mergeError && <p className="text-xs text-destructive">{mergeError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowMerge(false)} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={handleMerge} disabled={!mergeTarget} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 transition-all">Merge</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
