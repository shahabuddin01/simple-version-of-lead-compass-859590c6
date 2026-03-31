import { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { PipelineStatus } from "@/types/lead";
import { ChevronDown, CheckSquare, X, MailCheck, Trash2, MessageSquare, FolderPlus, Folder } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "motion/react";

const statuses: { label: PipelineStatus; dotColor: string; textColor: string }[] = [
  { label: "New", dotColor: "bg-blue-500", textColor: "text-blue-600" },
  { label: "Contacted", dotColor: "bg-amber-500", textColor: "text-amber-600" },
  { label: "In Progress", dotColor: "bg-purple-500", textColor: "text-purple-600" },
  { label: "Closed", dotColor: "bg-green-500", textColor: "text-green-600" },
  { label: "Not Interested", dotColor: "bg-red-500", textColor: "text-red-600" },
];

interface BulkActionBarProps {
  count: number;
  onUpdateStatus: (status: PipelineStatus) => void;
  onMarkActive: () => void;
  onMarkInactive: () => void;
  onVerifyEmails: (types: ("work" | "personal1" | "personal2")[]) => void;
  verifying?: boolean;
  onClear: () => void;
  isAdmin?: boolean;
  onDeleteSelected?: () => void;
  onDeletePage?: () => void;
  onDeleteByPages?: () => void;
  onDeleteAll?: () => void;
  onAddToClientComm?: () => void;
  pageLeadCount?: number;
  totalLeads?: number;
  folders?: string[];
  onMoveToFolder?: (folder: string) => void;
}

export function BulkActionBar({ count, onUpdateStatus, onMarkActive, onMarkInactive, onVerifyEmails, verifying, onClear, isAdmin, onDeleteSelected, onDeletePage, onDeleteByPages, onDeleteAll, onAddToClientComm, pageLeadCount, totalLeads, folders = [], onMoveToFolder }: BulkActionBarProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [verifyTypes, setVerifyTypes] = useState<Set<"work" | "personal1" | "personal2">>(new Set(["work"]));
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const verifyBtnRef = useRef<HTMLButtonElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);
  const statusDropRef = useRef<HTMLDivElement>(null);
  const verifyDropRef = useRef<HTMLDivElement>(null);
  const deleteDropRef = useRef<HTMLDivElement>(null);
  const [statusPos, setStatusPos] = useState({ top: 0, left: 0 });
  const [verifyPos, setVerifyPos] = useState({ top: 0, left: 0 });
  const [deletePos, setDeletePos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback((ref: React.RefObject<HTMLButtonElement | null>, setter: (p: { top: number; left: number }) => void) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < 200 ? rect.top - 200 - 4 : rect.bottom + 4;
    setter({ top, left: rect.left });
  }, []);

  useEffect(() => {
    if (!statusOpen && !verifyOpen && !deleteOpen) return;
    const onScroll = () => {
      if (statusOpen) updatePos(statusBtnRef, setStatusPos);
      if (verifyOpen) updatePos(verifyBtnRef, setVerifyPos);
      if (deleteOpen) updatePos(deleteBtnRef, setDeletePos);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", onScroll); };
  }, [statusOpen, verifyOpen, deleteOpen, updatePos]);

  useEffect(() => {
    if (!statusOpen && !verifyOpen && !deleteOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (statusOpen && !statusBtnRef.current?.contains(t) && !statusDropRef.current?.contains(t)) setStatusOpen(false);
      if (verifyOpen && !verifyBtnRef.current?.contains(t) && !verifyDropRef.current?.contains(t)) setVerifyOpen(false);
      if (deleteOpen && !deleteBtnRef.current?.contains(t) && !deleteDropRef.current?.contains(t)) setDeleteOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusOpen, verifyOpen, deleteOpen]);

  const toggleVerifyType = (type: "work" | "personal1" | "personal2") => {
    setVerifyTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const handleVerifySelected = () => {
    if (verifyTypes.size === 0) return;
    onVerifyEmails([...verifyTypes]);
    setVerifyOpen(false);
  };

  const statusDropdown = statusOpen
    ? ReactDOM.createPortal(
        <div ref={statusDropRef} style={{ position: "fixed", top: statusPos.top, left: statusPos.left, zIndex: 99999, minWidth: 180 }}
          className="rounded-lg border border-border bg-popover py-1 shadow-lg">
          {statuses.map((s) => (
            <button key={s.label} onClick={() => { onUpdateStatus(s.label); setStatusOpen(false); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors cursor-pointer">
              <span className={`h-2 w-2 rounded-full ${s.dotColor}`} />
              <span className={s.textColor}>{s.label}</span>
            </button>
          ))}
        </div>, document.body)
    : null;

  const verifyDropdown = verifyOpen
    ? ReactDOM.createPortal(
        <div ref={verifyDropRef} style={{ position: "fixed", top: verifyPos.top, left: verifyPos.left, zIndex: 99999, minWidth: 220 }}
          className="rounded-lg border border-border bg-popover py-1 shadow-lg">
          <div className="px-3 py-2 space-y-2">
            {([["work", "Work Email"], ["personal1", "Personal Email 1"], ["personal2", "Personal Email 2"]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground">
                <Checkbox checked={verifyTypes.has(key)} onCheckedChange={() => toggleVerifyType(key)} />
                {label}
              </label>
            ))}
          </div>
          <div className="border-t border-border mt-1 pt-1 px-3 pb-2">
            <button onClick={handleVerifySelected} disabled={verifyTypes.size === 0}
              className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              Verify Selected
            </button>
          </div>
        </div>, document.body)
    : null;

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-visible">
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-blue-300">
          <CheckSquare className="h-4 w-4" />
          {count} lead{count !== 1 ? "s" : ""} selected
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button ref={statusBtnRef} onMouseDown={(e) => { e.stopPropagation(); updatePos(statusBtnRef, setStatusPos); setStatusOpen(v => !v); setVerifyOpen(false); }}
            className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">
            Update Status <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {statusDropdown}

          <button onClick={onMarkActive} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">Mark Active</button>
          <button onClick={onMarkInactive} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">Mark Inactive</button>

          <button ref={verifyBtnRef} disabled={verifying}
            onMouseDown={(e) => { e.stopPropagation(); updatePos(verifyBtnRef, setVerifyPos); setVerifyOpen(v => !v); setStatusOpen(false); }}
            className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50">
            <MailCheck className={`h-3.5 w-3.5 text-blue-500 ${verifying ? "animate-spin" : ""}`} />
            Verify Emails <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {verifyDropdown}

          {onMoveToFolder && (
            <div className="relative">
              <button
                onClick={() => { setFolderOpen(v => !v); setStatusOpen(false); setVerifyOpen(false); setDeleteOpen(false); }}
                className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                Move to Folder <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {folderOpen && (
                <div className="absolute bottom-full mb-1 left-0 z-50 w-56 rounded-md border border-border bg-popover py-1 shadow-lg">
                  {folders.map((f) => (
                    <button key={f} onClick={() => { onMoveToFolder(f); setFolderOpen(false); }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent">
                      <Folder className="h-3 w-3" /> {f}
                    </button>
                  ))}
                  <div className="my-1 h-px bg-border" />
                  <div className="px-3 py-1.5 space-y-1.5">
                    <input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && newFolderName.trim()) { onMoveToFolder(newFolderName.trim()); setNewFolderName(""); setFolderOpen(false); } }}
                      placeholder="New folder name..."
                      className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => { if (newFolderName.trim()) { onMoveToFolder(newFolderName.trim()); setNewFolderName(""); setFolderOpen(false); } }}
                      disabled={!newFolderName.trim()}
                      className="w-full rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                      Create & Move
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

            <button onClick={onAddToClientComm}
              className="flex items-center gap-1.5 rounded-md border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-950/30 dark:text-purple-300 dark:hover:bg-purple-900/40">
              <MessageSquare className="h-3.5 w-3.5" />
              + Client Comm
            </button>
          )}

          {isAdmin && onDeleteSelected && (
            <>
              <button ref={deleteBtnRef}
                onMouseDown={(e) => { e.stopPropagation(); updatePos(deleteBtnRef, setDeletePos); setDeleteOpen(v => !v); setStatusOpen(false); setVerifyOpen(false); }}
                className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20">
                <Trash2 className="h-3.5 w-3.5" />
                Delete <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {deleteOpen && ReactDOM.createPortal(
                <div ref={deleteDropRef} style={{ position: "fixed", top: deletePos.top, left: deletePos.left, zIndex: 99999, minWidth: 220 }}
                  className="rounded-lg border border-border bg-popover py-1 shadow-lg">
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">🗑 Delete Options</div>
                  <button onClick={() => { setDeleteOpen(false); onDeleteSelected(); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent transition-colors cursor-pointer">
                    Delete Selected ({count} lead{count !== 1 ? "s" : ""})
                  </button>
                  {onDeletePage && (
                    <button onClick={() => { setDeleteOpen(false); onDeletePage(); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent transition-colors cursor-pointer">
                      Delete This Page ({pageLeadCount} leads)
                    </button>
                  )}
                  {onDeleteByPages && (
                    <button onClick={() => { setDeleteOpen(false); onDeleteByPages(); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent transition-colors cursor-pointer">
                      Delete By Page...
                    </button>
                  )}
                  {onDeleteAll && (
                    <>
                      <div className="mx-3 my-1 h-px bg-border" />
                      <button onClick={() => { setDeleteOpen(false); onDeleteAll(); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer">
                        ⚠️ Delete ALL Leads ({totalLeads?.toLocaleString()})
                      </button>
                    </>
                  )}
                </div>, document.body)}
            </>
          )}

          <button onClick={onClear} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>
    </motion.div>
  );
}
