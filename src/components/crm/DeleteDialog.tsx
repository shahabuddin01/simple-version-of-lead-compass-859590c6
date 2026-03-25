import { Lead } from "@/types/lead";
import { motion } from "motion/react";
import { AlertTriangle, X } from "lucide-react";

interface DeleteDialogProps {
  lead: Lead;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteDialog({ lead, onConfirm, onClose }: DeleteDialogProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Delete {lead.name}?</h3>
            <p className="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
          </div>
          <button onClick={onClose} className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-[0.98] transition-all">
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
