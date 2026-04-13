import { PipelineStatus } from "@/types/lead";
import { getStatusStyle } from "@/lib/leadUtils";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { Users, UserCheck, UserX, GitBranch } from "lucide-react";

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
    { label: "Total Leads", value: stats.total, icon: Users, accent: "bg-primary/10 text-primary" },
    { label: "Active Leads", value: stats.active, icon: UserCheck, accent: "bg-emerald-500/10 text-emerald-500" },
    { label: "Inactive Leads", value: stats.inactive, icon: UserX, accent: "bg-muted text-muted-foreground" },
  ];

  const statuses: PipelineStatus[] = ["New", "Contacted", "In Progress", "Closed", "Not Interested"];
  const total = Math.max(stats.total, 1);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="space-y-6"
    >
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((m) => {
          const Icon = m.icon;
          return (
            <motion.div key={m.label} variants={staggerItem} className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${m.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">{m.value}</p>
              </div>
            </motion.div>
          );
        })}

        {/* Pipeline Status Card */}
        <motion.div variants={staggerItem} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <GitBranch className="h-4 w-4" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Pipeline Status</p>
          </div>
          <div className="space-y-2">
            {statuses.map((s) => {
              const count = stats.byStatus[s];
              const pct = (count / total) * 100;
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className={`inline-flex w-[100px] shrink-0 items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(s)}`}>
                    {s}
                  </span>
                  <div className="relative h-2 flex-1 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-y-0 left-0 rounded-full bg-primary/60"
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums text-xs font-semibold text-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Industry Breakdown */}
      <motion.div variants={staggerItem} className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight">Industry Breakdown</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Industry Type</th>
              <th className="w-[120px] px-5 py-3 text-right text-xs font-medium text-muted-foreground">Companies</th>
              <th className="w-[120px] px-5 py-3 text-right text-xs font-medium text-muted-foreground">Contacts</th>
            </tr>
          </thead>
          <tbody>
            {industryBreakdown.map((row) => (
              <tr
                key={row.industry}
                onClick={() => onIndustryClick(row.industry)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
              >
                <td className="px-5 py-3 text-sm font-medium">{row.industry}</td>
                <td className="px-5 py-3 text-right tabular-nums text-sm">{row.companies}</td>
                <td className="px-5 py-3 text-right tabular-nums text-sm">{row.contacts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </motion.div>
  );
}