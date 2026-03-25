import { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { PipelineStatus } from "@/types/lead";
import { ChevronDown, CheckSquare, X, MailCheck } from "lucide-react";
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
}

export function BulkActionBar({ count, onUpdateStatus, onMarkActive, onMarkInactive, onVerifyEmails, verifying, onClear }: BulkActionBarProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyTypes, setVerifyTypes] = useState<Set<"work" | "personal1" | "personal2">>(new Set(["work"]));
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const verifyBtnRef = useRef<HTMLButtonElement>(null);
  const statusDropRef = useRef<HTMLDivElement>(null);
  const verifyDropRef = useRef<HTMLDivElement>(null);
  const [statusPos, setStatusPos] = useState({ top: 0, left: 0 });
  const [verifyPos, setVerifyPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback((ref: React.RefObject<HTMLButtonElement | null>, setter: (p: { top: number; left: number }) => void) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < 200 ? rect.top - 200 - 4 : rect.bottom + 4;
    setter({ top, left: rect.left });
  }, []);

  useEffect(() => {
    if (!statusOpen && !verifyOpen) return;
    const onScroll = () => {
      if (statusOpen) updatePos(statusBtnRef, setStatusPos);
      if (verifyOpen) updatePos(verifyBtnRef, setVerifyPos);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll, true); window.removeEventListener("resize", onScroll); };
  }, [statusOpen, verifyOpen, updatePos]);

  useEffect(() => {
    if (!statusOpen && !verifyOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (statusOpen && !statusBtnRef.current?.contains(t) && !statusDropRef.current?.contains(t)) setStatusOpen(false);
      if (verifyOpen && !verifyBtnRef.current?.contains(t) && !verifyDropRef.current?.contains(t)) setVerifyOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusOpen, verifyOpen]);

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

          <button onClick={onClear} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>
    </motion.div>
  );
}
