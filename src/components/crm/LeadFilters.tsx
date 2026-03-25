import { FilterState, PipelineStatus } from "@/types/lead";
import { Search, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

interface LeadFiltersProps {
  filter: FilterState;
  setFilter: (f: FilterState) => void;
  sortBy: string;
  setSortBy: (s: "name" | "company" | "dateAdded") => void;
  industries: string[];
  companies: string[];
}

const statuses: PipelineStatus[] = ["New", "Contacted", "In Progress", "Closed", "Not Interested"];
const espOptions = ["Google", "Outlook", "Zoho", "Yahoo", "Other", "Not Verified"];

function Dropdown({ label, value, options, onChange }: {
  label: string; value: string | null; options: string[]; onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-48 rounded-md border border-border bg-popover py-1 shadow-lg">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="block w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
          >
            All
          </button>
          {options.map((o) => (
            <button key={o} onClick={() => { onChange(o); setOpen(false); }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-accent ${value === o ? "font-medium text-primary" : ""}`}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LeadFilters({ filter, setFilter, sortBy, setSortBy, industries, companies }: LeadFiltersProps) {
  const activeFilter = filter.activeFilter || "all";
  const activeLabel = activeFilter === "active" ? "Active Leads" : activeFilter === "inactive" ? "Inactive Leads" : null;
  const [searchInput, setSearchInput] = useState(filter.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilter({ ...filter, search: value });
    }, 300);
  }, [filter, setFilter]);

  useEffect(() => {
    if (filter.search !== searchInput) setSearchInput(filter.search);
  }, [filter.search]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search leads..."
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>

      <Dropdown label="Industry" value={filter.industry} options={industries}
        onChange={(v) => setFilter({ ...filter, industry: v, company: v ? filter.company : null })} />
      <Dropdown label="Company" value={filter.company} options={companies}
        onChange={(v) => setFilter({ ...filter, company: v })} />
      <Dropdown label="Status" value={filter.status} options={statuses}
        onChange={(v) => setFilter({ ...filter, status: v as PipelineStatus | null })} />
      <Dropdown label="Work ESP" value={filter.workESP || null} options={espOptions}
        onChange={(v) => setFilter({ ...filter, workESP: v })} />
      <Dropdown label="P1 ESP" value={filter.personalESP || null} options={espOptions}
        onChange={(v) => setFilter({ ...filter, personalESP: v })} />
      <Dropdown label="P2 ESP" value={filter.personal2ESP || null} options={espOptions}
        onChange={(v) => setFilter({ ...filter, personal2ESP: v })} />
      <Dropdown label="Active Status" value={activeLabel} options={["Active Leads", "Inactive Leads"]}
        onChange={(v) => setFilter({ ...filter, activeFilter: v === "Active Leads" ? "active" : v === "Inactive Leads" ? "inactive" : "all" })} />
    </div>
  );
}
