import { useState, useMemo } from "react";
import { MessageSquare, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lead } from "@/types/lead";
import { toast } from "sonner";

const STORAGE_KEY = "nhproductionhouse_client_communications";

interface Props {
  open: boolean;
  onClose: () => void;
  selectedLeads: Lead[];
  onDone: () => void;
}

export function AddToClientCommModal({ open, onClose, selectedLeads, onDone }: Props) {
  const [skip, setSkip] = useState(true);
  const [adding, setAdding] = useState(false);

  const existingKeys = useMemo(() => {
    try {
      const clients = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return new Set(clients.map((c: any) => `${(c.name || "").toLowerCase()}|${(c.company || "").toLowerCase()}`));
    } catch { return new Set<string>(); }
  }, [open]);

  const { toAdd, toSkip } = useMemo(() => {
    if (!skip) return { toAdd: selectedLeads.length, toSkip: 0 };
    let add = 0, sk = 0;
    for (const lead of selectedLeads) {
      const key = `${lead.name.toLowerCase()}|${lead.company.toLowerCase()}`;
      if (existingKeys.has(key)) sk++; else add++;
    }
    return { toAdd: add, toSkip: sk };
  }, [selectedLeads, skip, existingKeys]);

  const handleConfirm = () => {
    setAdding(true);
    try {
      const clients = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      const currentKeys = new Set(clients.map((c: any) => `${(c.name || "").toLowerCase()}|${(c.company || "").toLowerCase()}`));
      let added = 0, skipped = 0;

      for (const lead of selectedLeads) {
        const key = `${lead.name.toLowerCase()}|${lead.company.toLowerCase()}`;
        if (skip && currentKeys.has(key)) { skipped++; continue; }

        clients.unshift({
          id: crypto.randomUUID(),
          name: lead.name,
          designation: lead.position || "",
          company: lead.company || "",
          linkedin: lead.linkedin || "",
          facebook: lead.facebook || "",
          instagram: lead.instagram || "",
          lead_status: "",
          lead_collected_date: "",
          mail_status: "not_send",
          mail_sent_date: "",
          comments: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        currentKeys.add(key);
        added++;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));

      if (added > 0 && skipped > 0) {
        toast.success(`✅ ${added} leads added to Client Communication. ${skipped} skipped (already exist).`);
      } else if (added > 0) {
        toast.success(`✅ ${added} leads added to Client Communication`);
      } else {
        toast.info(`ℹ️ All ${skipped} leads already exist in Client Communication`);
      }

      onDone();
      onClose();
    } finally {
      setAdding(false);
    }
  };

  const fields = [
    { label: "Name", icon: "✅" },
    { label: "Designation / Position", icon: "✅" },
    { label: "Company", icon: "✅" },
    { label: "LinkedIn", icon: "✅" },
    { label: "Facebook", icon: "✅" },
    { label: "Instagram", icon: "✅" },
  ];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-600" />
            Add to Client Communication
          </DialogTitle>
          <DialogDescription>
            Adding {selectedLeads.length} selected lead{selectedLeads.length !== 1 ? "s" : ""} as clients
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={skip} onChange={e => setSkip(e.target.checked)} className="rounded border-input" />
            Skip leads already in Client Communication list
            <span className="text-xs text-muted-foreground">(matched by name + company)</span>
          </label>

          {skip && toSkip > 0 && (
            <p className="text-xs text-muted-foreground">
              {toSkip} lead{toSkip !== 1 ? "s" : ""} will be skipped (already exist)
            </p>
          )}

          <div>
            <p className="text-sm font-medium text-foreground mb-1.5">These fields will be copied:</p>
            <div className="space-y-1">
              {fields.map(f => (
                <div key={f.label} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-3.5 w-3.5 text-green-500" /> {f.label}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-1.5">Communication fields will start empty:</p>
            <ul className="text-sm text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>Lead Status: (empty)</li>
              <li>Mail Status: Not Sent</li>
              <li>Comments: (empty)</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={adding || toAdd === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white">
            {adding ? "Adding..." : `Add ${toAdd} to Client Comm`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
