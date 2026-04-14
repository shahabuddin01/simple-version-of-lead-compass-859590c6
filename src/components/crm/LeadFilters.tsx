import { FilterState, PipelineStatus } from "@/types/lead";
import { Search, ChevronDown, Copy, FolderPlus, Folder, SlidersHorizontal, X } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useIsMobile } from "@/hooks/use-mobile";

interface LeadFiltersProps {
  filter: FilterState;
  setFilter: (f: FilterState) => void;
  sortBy: string;
  setSortBy: (s: "name" | "company" | "dateAdded") => void;
  industries: string[];
  companies: string[];
  folders: string[];
  duplicateCount?: number;
  onCreateFolder?: (name: string) => void;
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

function FolderDropdown({ value, folders, onChange, onCreateFolder }: {
  value: string | null; folders: string[]; onChange: (v: string | null) => void; onCreateFolder?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCreating(false); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreateFolder?.(trimmed);
    onChange(trimmed);
    setNewName("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-accent"
      >
        <Folder className="h-3.5 w-3.5 text-muted-foreground" />
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || "Folder"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 rounded-md border border-border bg-popover py-1 shadow-lg">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="block w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
          >
            All Folders
          </button>
          {folders.map((f) => (
            <button key={f} onClick={() => { onChange(f); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent ${value === f ? "font-medium text-primary" : ""}`}>
              <Folder className="h-3 w-3" /> {f}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          {creating ? (
            <div className="px-3 py-1.5 space-y-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Folder name..."
                className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex gap-1">
                <button onClick={handleCreate} className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:bg-primary/90">Create</button>
                <button onClick={() => setCreating(false)} className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-primary hover:bg-accent"
            >
              <FolderPlus className="h-3.5 w-3.5" /> Create New Folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function LeadFilters({ filter, setFilter, industries, companies, folders, duplicateCount = 0, onCreateFolder }: LeadFiltersProps) {
  const isMobile = useIsMobile();
  const activeFilter = filter.activeFilter || "all";
  const activeLabel = activeFilter === "active" ? "Active Leads" : activeFilter === "inactive" ? "Inactive Leads" : null;
  const [searchInput, setSearchInput] = useState(filter.search);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Count active filters
  const activeFilterCount = [filter.industry, filter.company, filter.folder, filter.status, filter.workESP, filter.personalESP, filter.personal2ESP, activeLabel, filter.showDuplicatesOnly].filter(Boolean).length;

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilter({ ...filter, search: value });
    }, 300);
  }, [filter, setFilter]);

  useEffect(() => {
    if (filter.search !== searchInput) setSearchInput(filter.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.search]);

  const filterControls = (
    <>
      <Dropdown label="Industry" value={filter.industry} options={industries}
        onChange={(v) => setFilter({ ...filter, industry: v, company: v ? filter.company : null })} />
      <Dropdown label="Company" value={filter.company} options={companies}
        onChange={(v) => setFilter({ ...filter, company: v })} />
      <FolderDropdown
        value={filter.folder || null}
        folders={folders}
        onChange={(v) => setFilter({ ...filter, folder: v })}
        onCreateFolder={onCreateFolder}
      />
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
      <button
        onClick={() => setFilter({ ...filter, showDuplicatesOnly: !filter.showDuplicatesOnly })}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${
          filter.showDuplicatesOnly
            ? "border-destructive bg-destructive/10 text-destructive font-medium"
            : "border-input bg-background text-muted-foreground hover:bg-accent"
        }`}
      >
        <Copy className="h-3.5 w-3.5" />
        Duplicates{duplicateCount > 0 ? ` (${duplicateCount})` : ""}
      </button>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
      className="space-y-2"
    >
      {/* Search + Filter Toggle row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search leads..."
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        {isMobile && (
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
              filtersOpen || activeFilterCount > 0
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-input bg-background text-muted-foreground hover:bg-accent"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Filters - always visible on desktop, collapsible on mobile */}
      {isMobile ? (
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/30 p-2.5">
                {filterControls}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {filterControls}
        </div>
      )}
    </motion.div>
  );
}
