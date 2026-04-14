import { PipelineStatus } from "@/types/lead";
import { getStatusStyle } from "@/lib/leadUtils";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { Users, UserCheck, UserX, GitBranch, Building2, Factory } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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
  const isMobile = useIsMobile();

  const metricCards = [
    { label: "Total Leads", value: stats.total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Leads", value: stats.active, icon: UserCheck, color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Inactive Leads", value: stats.inactive, icon: UserX, color: "text-muted-foreground", bg: "bg-muted/60" },
  ];

  const statuses: PipelineStatus[] = ["New", "Contacted", "In Progress", "Closed", "Not Interested"];
  const total = Math.max(stats.total, 1);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="space-y-5"
    >
      {/* Metric Cards */}
      <div className={cn("grid gap-2.5", isMobile ? "grid-cols-2" : "grid-cols-4")}>
        {metricCards.map((m) => {
          const Icon = m.icon;
          return (
            <motion.div key={m.label} variants={staggerItem} className={cn("flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3.5 transition-colors", m.bg)}>
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm", m.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground leading-none">{m.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground leading-none">{m.value}</p>
              </div>
            </motion.div>
          );
        })}

        {/* Pipeline Status Card */}
        <motion.div variants={staggerItem} className={cn("rounded-xl border border-border/50 bg-card px-4 py-3.5", isMobile && "col-span-2")}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <GitBranch className="h-3.5 w-3.5" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">Pipeline Status</p>
          </div>
          <div className="space-y-2">
            {statuses.map((s) => {
              const count = stats.byStatus[s];
              const pct = (count / total) * 100;
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", isMobile ? "w-[80px]" : "w-[100px]", getStatusStyle(s))}>
                    {s}
                  </span>
                  <div className="relative h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-y-0 left-0 rounded-full bg-primary/60"
                    />
                  </div>
                  <span className="w-7 text-right tabular-nums text-xs font-semibold text-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Industry Breakdown */}
      <motion.div variants={staggerItem} className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Factory className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-semibold tracking-tight">Industry Breakdown</h2>
          <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">{industryBreakdown.length} industries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Industry Type</th>
                <th className="w-[100px] px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Companies</th>
                <th className="w-[100px] px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {industryBreakdown.map((row) => (
                <tr
                  key={row.industry}
                  onClick={() => onIndustryClick(row.industry)}
                  className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-accent/40 transition-colors group"
                >
                  <td className="px-4 py-2.5 text-sm font-medium group-hover:text-primary transition-colors">{row.industry}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-sm text-muted-foreground">{row.companies}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-sm text-muted-foreground">{row.contacts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
