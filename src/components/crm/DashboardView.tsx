import { PipelineStatus } from "@/types/lead";
import { getStatusStyle } from "@/lib/leadUtils";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/animations";
import {
  Users, UserCheck, UserX, GitBranch, Factory, TrendingUp,
  ArrowUpRight, ArrowDownRight, Building2, BarChart3
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

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

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-500",
  Contacted: "bg-amber-500",
  "In Progress": "bg-violet-500",
  Closed: "bg-emerald-500",
  "Not Interested": "bg-rose-500",
};

function AnimatedCounter({ value, duration = 1 }: { value: number; duration?: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="tabular-nums"
    >
      {value.toLocaleString()}
    </motion.span>
  );
}

function MiniDonut({ statuses, byStatus, total }: { statuses: PipelineStatus[]; byStatus: Record<PipelineStatus, number>; total: number }) {
  const size = 120;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulated = 0;
  const segments = statuses.map((s) => {
    const pct = total > 0 ? (byStatus[s] / total) : 0;
    const offset = accumulated;
    accumulated += pct;
    return { status: s, pct, offset };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-muted/40" />
      {segments.map((seg) => (
        seg.pct > 0 && (
          <motion.circle
            key={seg.status}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={STATUS_COLORS[seg.status]?.replace("bg-", "stroke-")}
            strokeDasharray={`${seg.pct * circumference} ${circumference}`}
            strokeDashoffset={-seg.offset * circumference}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${seg.pct * circumference} ${circumference}` }}
            transition={{ duration: 0.8, delay: 0.3 + seg.offset * 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
        )
      ))}
      <text x={center} y={center - 6} textAnchor="middle" className="fill-foreground text-xl font-bold" dominantBaseline="central">
        {total}
      </text>
      <text x={center} y={center + 12} textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium" dominantBaseline="central">
        Total
      </text>
    </svg>
  );
}

export function DashboardView({ stats, industryBreakdown, onIndustryClick }: DashboardViewProps) {
  const isMobile = useIsMobile();
  const [hoveredIndustry, setHoveredIndustry] = useState<string | null>(null);

  const activeRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;

  const metricCards = [
    {
      label: "Total Leads",
      value: stats.total,
      icon: Users,
      color: "text-primary",
      bg: "bg-gradient-to-br from-primary/10 to-primary/5",
      borderColor: "border-primary/20",
    },
    {
      label: "Active Leads",
      value: stats.active,
      icon: UserCheck,
      color: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5",
      borderColor: "border-emerald-500/20",
      badge: `${activeRate}%`,
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Inactive Leads",
      value: stats.inactive,
      icon: UserX,
      color: "text-muted-foreground",
      bg: "bg-gradient-to-br from-muted/60 to-muted/30",
      borderColor: "border-border/50",
    },
  ];

  const statuses: PipelineStatus[] = ["New", "Contacted", "In Progress", "Closed", "Not Interested"];
  const total = Math.max(stats.total, 1);

  const topIndustries = useMemo(() => {
    return [...industryBreakdown].sort((a, b) => b.contacts - a.contacts);
  }, [industryBreakdown]);

  const maxContacts = useMemo(() => Math.max(...topIndustries.map(r => r.contacts), 1), [topIndustries]);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="space-y-4"
    >
      {/* Metric Cards Row */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-3")}>
        {metricCards.map((m) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.label}
              variants={staggerItem}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "relative flex items-center gap-4 rounded-2xl border px-5 py-4 cursor-default overflow-hidden",
                m.bg, m.borderColor
              )}
            >
              <div className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm ring-1 ring-border/30",
                m.color
              )}>
                <Icon className="h-5.5 w-5.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground leading-none uppercase tracking-wider">{m.label}</p>
                <p className="mt-1.5 text-3xl font-bold leading-none text-foreground">
                  <AnimatedCounter value={m.value} />
                </p>
              </div>
              {m.badge && (
                <span className={cn("absolute top-3 right-3 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold", m.badgeColor)}>
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  {m.badge}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Pipeline + Donut Row */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        {/* Pipeline Status */}
        <motion.div
          variants={staggerItem}
          className="rounded-2xl border border-border/50 bg-card p-5"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <GitBranch className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Pipeline Status</h3>
              <p className="text-[10px] text-muted-foreground">Lead distribution by stage</p>
            </div>
          </div>
          <div className="space-y-3">
            {statuses.map((s) => {
              const count = stats.byStatus[s];
              const pct = (count / total) * 100;
              return (
                <div key={s} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      getStatusStyle(s)
                    )}>
                      {s}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold tabular-nums text-foreground">{count}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">({Math.round(pct)}%)</span>
                    </div>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className={cn("absolute inset-y-0 left-0 rounded-full", STATUS_COLORS[s])}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Donut Chart Card */}
        <motion.div
          variants={staggerItem}
          className="rounded-2xl border border-border/50 bg-card p-5"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Overview</h3>
              <p className="text-[10px] text-muted-foreground">Visual pipeline breakdown</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6">
            <MiniDonut statuses={statuses} byStatus={stats.byStatus} total={stats.total} />
            <div className="space-y-2">
              {statuses.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", STATUS_COLORS[s])} />
                  <span className="text-[11px] text-muted-foreground">{s}</span>
                  <span className="ml-auto text-[11px] font-semibold tabular-nums pl-3">{stats.byStatus[s]}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Industry Breakdown — Bar Chart Style */}
      <motion.div variants={staggerItem} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <Factory className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Industry Breakdown</h3>
            <p className="text-[10px] text-muted-foreground">Click an industry to filter leads</p>
          </div>
          <span className="ml-auto text-[10px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
            {industryBreakdown.length}
          </span>
        </div>

        {topIndustries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Building2 className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No industry data yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {topIndustries.map((row, i) => {
              const barPct = (row.contacts / maxContacts) * 100;
              const isHovered = hoveredIndustry === row.industry;
              return (
                <motion.div
                  key={row.industry}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  onClick={() => onIndustryClick(row.industry)}
                  onMouseEnter={() => setHoveredIndustry(row.industry)}
                  onMouseLeave={() => setHoveredIndustry(null)}
                  className={cn(
                    "flex items-center gap-4 px-5 py-3 cursor-pointer transition-all duration-200",
                    isHovered ? "bg-accent/50" : "hover:bg-accent/30"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn(
                        "text-sm font-medium truncate transition-colors",
                        isHovered ? "text-primary" : "text-foreground"
                      )}>
                        {row.industry}
                      </span>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-[11px] text-muted-foreground">
                          <Building2 className="h-3 w-3 inline mr-0.5 -mt-0.5" />{row.companies}
                        </span>
                        <span className="text-[11px] font-semibold text-foreground tabular-nums">
                          <Users className="h-3 w-3 inline mr-0.5 -mt-0.5" />{row.contacts}
                        </span>
                      </div>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ duration: 0.6, delay: 0.2 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full transition-colors duration-200",
                          isHovered ? "bg-primary" : "bg-primary/50"
                        )}
                      />
                    </div>
                  </div>
                  <motion.div
                    animate={{ x: isHovered ? 0 : -4, opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ArrowUpRight className="h-4 w-4 text-primary" />
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
