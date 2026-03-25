import { PipelineStatus } from "@/types/lead";
import { getStatusStyle } from "@/lib/leadUtils";

interface DashboardViewProps {
  stats: {
    total: number;
    active: number;
    inactive: number;
    byStatus: Record<PipelineStatus, number>;
  };
  industryBreakdown: { industry: string; companies: number; contacts: number }[];
  onIndustryClick: (industry: string) => void;
}

export function DashboardView({ stats, industryBreakdown, onIndustryClick }: DashboardViewProps) {
  const metricCards = [
    { label: "Total Leads", value: stats.total, color: "text-foreground" },
    { label: "Active Leads", value: stats.active, color: "text-toggle-active" },
    { label: "Inactive Leads", value: stats.inactive, color: "text-muted-foreground" },
  ];

  const statuses: PipelineStatus[] = ["New", "Contacted", "In Progress", "Closed", "Not Interested"];

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        {metricCards.map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${m.color}`}>{m.value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Pipeline Status</p>
          <div className="mt-2 space-y-1">
            {statuses.map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getStatusStyle(s)}`}>
                  {s}
                </span>
                <span className="tabular-nums text-sm font-medium">{stats.byStatus[s]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Industry Breakdown */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">Industry Breakdown</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Industry Type</th>
              <th className="w-[120px] px-4 py-3 text-right text-xs font-medium text-muted-foreground">Companies</th>
              <th className="w-[120px] px-4 py-3 text-right text-xs font-medium text-muted-foreground">Contacts</th>
            </tr>
          </thead>
          <tbody>
            {industryBreakdown.map((row) => (
              <tr
                key={row.industry}
                onClick={() => onIndustryClick(row.industry)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
              >
                <td className="px-4 py-3 text-sm font-medium">{row.industry}</td>
                <td className="px-4 py-3 text-right tabular-nums text-sm">{row.companies}</td>
                <td className="px-4 py-3 text-right tabular-nums text-sm">{row.contacts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
