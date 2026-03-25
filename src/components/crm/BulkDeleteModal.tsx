import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Trash2, CheckCircle } from "lucide-react";

type DeleteMode = "selected" | "page" | "pages" | "all";

interface BulkDeleteModalProps {
  open: boolean;
  onClose: () => void;
  mode: DeleteMode;
  selectedCount: number;
  pageLeadCount: number;
  currentPage: number;
  totalLeads: number;
  totalPages: number;
  leadsPerPage: number;
  onConfirmDelete: (mode: DeleteMode, pages?: number[]) => void;
  progress: { running: boolean; current: number; total: number; step: string; done: boolean; deletedCount: number } | null;
  onGoToLeads?: () => void;
}

export function BulkDeleteModal({
  open, onClose, mode, selectedCount, pageLeadCount, currentPage,
  totalLeads, totalPages, leadsPerPage, onConfirmDelete, progress, onGoToLeads,
}: BulkDeleteModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);

  const requiredText = mode === "all" ? "DELETE ALL" : "DELETE";

  const isConfirmed = mode === "pages"
    ? confirmText === "DELETE" && selectedPages.size > 0
    : confirmText === requiredText;

  const pagesLeadCount = useMemo(() => {
    if (mode !== "pages") return 0;
    let count = 0;
    selectedPages.forEach((p) => {
      if (p === totalPages) {
        count += totalLeads - (p - 1) * leadsPerPage;
      } else {
        count += leadsPerPage;
      }
    });
    return count;
  }, [selectedPages, totalPages, totalLeads, leadsPerPage, mode]);

  const handleSelectAllPages = (checked: boolean) => {
    setSelectAllPages(checked);
    if (checked) {
      setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
    } else {
      setSelectedPages(new Set());
    }
  };

  const togglePage = (page: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page); else next.add(page);
      return next;
    });
    setSelectAllPages(false);
  };

  const handleConfirm = () => {
    if (mode === "pages") {
      onConfirmDelete("pages", [...selectedPages].sort((a, b) => a - b));
    } else {
      onConfirmDelete(mode);
    }
  };

  const handleClose = () => {
    if (progress?.running) return;
    setConfirmText("");
    setSelectedPages(new Set());
    setSelectAllPages(false);
    onClose();
  };

  // Progress / completion view
  if (progress?.running || progress?.done) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => { if (progress.running) e.preventDefault(); }}>
          {progress.done ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h3 className="text-lg font-semibold">Delete Complete</h3>
              <p className="text-sm text-muted-foreground">
                {progress.deletedCount.toLocaleString()} leads deleted successfully
              </p>
              {mode === "all" && (
                <p className="text-xs text-muted-foreground">Safety backup saved in Backups section</p>
              )}
              <button
                onClick={() => { handleClose(); onGoToLeads?.(); }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Go to Leads
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive animate-pulse" />
                <h3 className="text-lg font-semibold">Deleting leads...</h3>
              </div>
              <p className="text-sm text-muted-foreground">{progress.step}</p>
              <Progress value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">
                {progress.current.toLocaleString()} / {progress.total.toLocaleString()} leads
              </p>
              <p className="text-xs text-muted-foreground text-center">Please do not close this window</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // Page selector view
  if (mode === "pages") {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Select Pages to Delete
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Total leads: {totalLeads.toLocaleString()} across {totalPages} pages ({leadsPerPage} leads per page)
          </p>
          <div className="flex-1 overflow-y-auto space-y-2 border rounded-md p-3 max-h-[300px]">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer pb-2 border-b border-border">
              <Checkbox checked={selectAllPages} onCheckedChange={(c) => handleSelectAllPages(!!c)} />
              Select All Pages
            </label>
            {Array.from({ length: totalPages }, (_, i) => {
              const page = i + 1;
              const start = i * leadsPerPage + 1;
              const end = Math.min((i + 1) * leadsPerPage, totalLeads);
              return (
                <label key={page} className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground">
                  <Checkbox checked={selectedPages.has(page)} onCheckedChange={() => togglePage(page)} />
                  Page {page} (leads {start}–{end})
                </label>
              );
            })}
          </div>
          {selectedPages.size > 0 && (
            <p className="text-sm font-medium">
              Selected: {pagesLeadCount.toLocaleString()} leads from {selectedPages.size} page{selectedPages.size !== 1 ? "s" : ""}
            </p>
          )}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Type <strong>DELETE</strong> to confirm:</p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={handleClose} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
            <button onClick={handleConfirm} disabled={!isConfirmed}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors">
              🗑 Delete Selected Pages
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Standard confirmation view
  const isAll = mode === "all";
  const count = mode === "selected" ? selectedCount : mode === "page" ? pageLeadCount : totalLeads;
  const title = isAll ? `Delete ALL ${totalLeads.toLocaleString()} Leads?` : mode === "page" ? `Delete Page ${currentPage} (${pageLeadCount} Leads)?` : `Delete ${selectedCount} Leads?`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAll ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <Trash2 className="h-5 w-5 text-destructive" />
            )}
            {isAll ? "🚨" : "⚠️"} {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isAll ? (
            <>
              <p className="text-sm text-muted-foreground">
                <strong>WARNING:</strong> This will permanently delete every single lead in the CRM. This action <strong>CANNOT</strong> be undone.
              </p>
              <p className="text-sm text-muted-foreground">A backup will be created automatically before deletion.</p>
            </>
          ) : mode === "page" ? (
            <p className="text-sm text-muted-foreground">
              This will delete all {pageLeadCount} leads on the current page. This cannot be undone.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              You are about to permanently delete {selectedCount} selected leads. This cannot be undone.
            </p>
          )}
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              Type <strong>{requiredText}</strong> to confirm:
            </p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={`Type ${requiredText}`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={handleClose} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
          <button onClick={handleConfirm} disabled={!isConfirmed}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors">
            🗑 {isAll ? "Delete ALL Leads" : `Delete ${count} Leads`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
