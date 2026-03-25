import { Lead, PipelineStatus } from "@/types/lead";

/** Normalize an industry/type string to consistent Title Case */
export const normalizeIndustryName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/(?:^|\s|[-&])\S/g, (match) => match.toUpperCase());
};

export const getStatusStyle = (status: PipelineStatus) => {
  const styles: Record<PipelineStatus, string> = {
    "New": "bg-status-new-bg text-status-new border-status-new-border",
    "Contacted": "bg-status-contacted-bg text-status-contacted border-status-contacted-border",
    "In Progress": "bg-status-progress-bg text-status-progress border-status-progress-border",
    "Closed": "bg-status-closed-bg text-status-closed border-status-closed-border",
    "Not Interested": "bg-status-not-interested-bg text-status-not-interested border-status-not-interested-border",
  };
  return styles[status];
};

export const getIndustryColor = (type: string) => {
  const colors = [
    "text-blue-600 bg-blue-50 border-blue-200",
    "text-teal-600 bg-teal-50 border-teal-200",
    "text-amber-600 bg-amber-50 border-amber-200",
    "text-purple-600 bg-purple-50 border-purple-200",
    "text-rose-600 bg-rose-50 border-rose-200",
  ];
  let hash = 0;
  for (let i = 0; i < type.length; i++) hash = type.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const getAvatarColor = (name: string) => {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-teal-100 text-teal-700",
    "bg-amber-100 text-amber-700",
    "bg-purple-100 text-purple-700",
    "bg-rose-100 text-rose-700",
    "bg-indigo-100 text-indigo-700",
    "bg-emerald-100 text-emerald-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export const getIndustryTree = (leads: Lead[]) => {
  const tree: Record<string, { companies: Record<string, number>; total: number }> = {};
  const keyToDisplay: Record<string, string> = {};

  leads.forEach((l) => {
    const key = l.type.trim().toLowerCase();
    if (!keyToDisplay[key]) keyToDisplay[key] = l.type.trim();
    const display = keyToDisplay[key];
    if (!tree[display]) tree[display] = { companies: {}, total: 0 };
    tree[display].companies[l.company] = (tree[display].companies[l.company] || 0) + 1;
    tree[display].total++;
  });
  return tree;
};

export const exportToCSV = (data: Lead[], filename: string) => {
  const headers = [
    "Type", "Company", "Company Email", "Name", "Position",
    "Work Phone", "Personal Phone 1", "Personal Phone 2",
    "Work Email", "Work ESP", "Work Email Quality",
    "Personal Email 1", "P1 ESP", "P1 Email Quality",
    "Personal Email 2", "P2 ESP", "P2 Email Quality",
    "LinkedIn", "Facebook", "Instagram",
    "Status", "Active", "Date Added", "Notes"
  ].join(",");

  const rows = data.map((l) => {
    const fields = [
      l.type, l.company, l.companyEmail || "", l.name, l.position,
      l.phone || "", l.personalPhone1 || "", l.personalPhone2 || "",
      l.email || "", l.emailVerification?.esp || "", l.emailVerification?.result || "",
      l.personalEmail || "", l.personalEmailVerification?.esp || "", l.personalEmailVerification?.result || "",
      l.personalEmail2 || "", l.personalEmail2Verification?.esp || "", l.personalEmail2Verification?.result || "",
      l.linkedin || "", l.facebook || "",
      l.instagram || "", l.status, String(l.active), l.dateAdded,
      (l.notes || "").replace(/"/g, '""'),
    ];
    return fields.map(v => {
      const s = String(v);
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
