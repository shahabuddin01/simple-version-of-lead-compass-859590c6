import { useState, useRef, useEffect } from "react";
import { Lead } from "@/types/lead";
import { exportToCSV } from "@/lib/leadUtils";
import { Download, ChevronDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface ExportDropdownProps {
  leads: Lead[];
  currentPageLeads?: Lead[];
  onExportDone?: () => void;
}

const exportPhoneCSV = (data: Lead[], type: "work" | "personal1" | "personal2") => {
  let filtered: Lead[];
  let headers: string;
  let filename: string;

  if (type === "work") {
    filtered = data.filter(l => l.phone?.trim());
    headers = "Name,Position,Company,Industry Type,Work Phone,Work Email,Status,Active";
    filename = "leads-work-phones.csv";
  } else if (type === "personal1") {
    filtered = data.filter(l => l.personalPhone1?.trim());
    headers = "Name,Position,Company,Industry Type,Personal Phone 1,Personal Email 1,Status,Active";
    filename = "leads-personal-phones-1.csv";
  } else {
    filtered = data.filter(l => l.personalPhone2?.trim());
    headers = "Name,Position,Company,Industry Type,Personal Phone 2,Personal Email 2,Status,Active";
    filename = "leads-personal-phones-2.csv";
  }

  const rows = filtered.map((l) => {
    const phone = type === "work" ? l.phone : type === "personal1" ? l.personalPhone1 : l.personalPhone2;
    const email = type === "work" ? l.email : type === "personal1" ? l.personalEmail : l.personalEmail2;
    const fields = [l.name, l.position, l.company, l.type, phone || "", email || "", l.status, String(l.active)];
    return fields.map(v => {
      const s = String(v || "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",");
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export function ExportDropdown({ leads, currentPageLeads = [], onExportDone }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleExport = (type: "all" | "active" | "inactive" | "current") => {
    let filtered: Lead[];
    let filename: string;
    if (type === "current") {
      filtered = currentPageLeads;
      filename = "current-view-leads.csv";
    } else if (type === "all") {
      filtered = leads;
      filename = "all-leads.csv";
    } else {
      filtered = leads.filter((l) => (type === "active" ? l.active : !l.active));
      filename = `${type}-leads.csv`;
    }
    exportToCSV(filtered, filename);
    setOpen(false);
    onExportDone?.();
  };

  const handleExportVerified = (quality: "good" | "risky" | "bad" | "unverified") => {
    let filtered: Lead[];
    let filename: string;
    if (quality === "unverified") {
      filtered = leads.filter(l => !l.emailVerification);
      filename = "unverified-emails.csv";
    } else if (quality === "good") {
      filtered = leads.filter(l => l.emailVerification?.result === "ok");
      filename = "good-emails.csv";
    } else if (quality === "risky") {
      filtered = leads.filter(l => l.emailVerification?.result === "catch_all" || l.emailVerification?.result === "unknown");
      filename = "risky-emails.csv";
    } else {
      filtered = leads.filter(l => l.emailVerification?.result === "invalid" || l.emailVerification?.result === "disposable");
      filename = "bad-emails.csv";
    }
    exportToCSV(filtered, filename);
    setOpen(false);
    onExportDone?.();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        <Download className="h-4 w-4" />
        Export
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-border bg-popover py-1 shadow-lg">
          <button onClick={() => handleExport("all")} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export All Leads</button>
          <button onClick={() => handleExport("active")} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export All Active Leads Only</button>
          <button onClick={() => handleExport("inactive")} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export All Inactive Leads Only</button>
          <button onClick={() => handleExport("current")} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export Current Page</button>
          <Separator className="my-1" />
          <button onClick={() => { exportPhoneCSV(leads, "work"); setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export Work Phone Numbers</button>
          <button onClick={() => { exportPhoneCSV(leads, "personal1"); setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export Personal Phone 1 Numbers</button>
          <button onClick={() => { exportPhoneCSV(leads, "personal2"); setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export Personal Phone 2 Numbers</button>
          <Separator className="my-1" />
          <button onClick={() => { handleExportVerified("good"); setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export Good Emails Only</button>
          <button onClick={() => { handleExportVerified("risky"); setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export Risky Emails Only</button>
          <button onClick={() => { handleExportVerified("bad"); setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export Bad Emails Only</button>
          <button onClick={() => { handleExportVerified("unverified"); setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-accent">Export Unverified Emails Only</button>
        </div>
      )}
    </div>
  );
}
