import { useState, useEffect, useMemo, useCallback } from "react";
import { Lead, ViewMode, FilterState, PipelineStatus } from "@/types/lead";
import { sampleLeads } from "@/data/sampleLeads";
import { normalizeIndustryName } from "@/lib/leadUtils";
import { cleanPhoneNumber } from "@/lib/phoneUtils";

const STORAGE_KEY = "nhproductionhouse_crm_leads";
const STORAGE_VERSION = "v5";
const STORAGE_VERSION_KEY = "nhproductionhouse_crm_version";

const loadLeads = (): Lead[] => {
  try {
    const version = localStorage.getItem(STORAGE_VERSION_KEY);
    if (version === STORAGE_VERSION) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } else {
      localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
  return sampleLeads;
};

export const useLeads = () => {
  const [leads, setLeads] = useState<Lead[]>(loadLeads);
  const [view, setView] = useState<ViewMode>("dashboard");
  const [filter, setFilter] = useState<FilterState>({ industry: null, company: null, status: null, search: "" });
  const [sortBy, setSortBy] = useState<"name" | "company" | "dateAdded">("name");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  const addLead = useCallback((lead: Omit<Lead, "id" | "dateAdded">) => {
    setLeads((prev) => [...prev, {
      ...lead,
      type: normalizeIndustryName(lead.type),
      phone: cleanPhoneNumber(lead.phone),
      personalPhone1: cleanPhoneNumber(lead.personalPhone1),
      personalPhone2: cleanPhoneNumber(lead.personalPhone2),
      id: crypto.randomUUID(),
      dateAdded: new Date().toISOString(),
    }]);
  }, []);

  const updateLead = useCallback((id: string, updates: Partial<Lead>) => {
    const normalized = updates.type !== undefined ? { ...updates, type: normalizeIndustryName(updates.type) } : updates;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...normalized } : l)));
  }, []);

  const deleteLead = useCallback((id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const deleteByIndustry = useCallback((industry: string) => {
    setLeads((prev) => prev.filter((l) => l.type.toLowerCase() !== industry.toLowerCase()));
    setCustomIndustries((prev) => prev.filter((i) => i.toLowerCase() !== industry.toLowerCase()));
    setCustomCompanies((prev) => prev.filter((c) => c.industry.toLowerCase() !== industry.toLowerCase()));
  }, []);

  const deleteByCompany = useCallback((companyName: string) => {
    setLeads((prev) => prev.filter((l) => l.company.toLowerCase() !== companyName.toLowerCase()));
    setCustomCompanies((prev) => prev.filter((c) => c.name.toLowerCase() !== companyName.toLowerCase()));
  }, []);

  const renameIndustry = useCallback((oldName: string, newName: string) => {
    const normalized = normalizeIndustryName(newName);
    setLeads((prev) => prev.map((l) =>
      l.type.toLowerCase() === oldName.toLowerCase() ? { ...l, type: normalized } : l
    ));
    setCustomIndustries((prev) => prev.map((i) =>
      i.toLowerCase() === oldName.toLowerCase() ? normalized : i
    ));
    setCustomCompanies((prev) => prev.map((c) =>
      c.industry.toLowerCase() === oldName.toLowerCase() ? { ...c, industry: normalized } : c
    ));
  }, []);

  const renameCompany = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    setLeads((prev) => prev.map((l) =>
      l.company.toLowerCase() === oldName.toLowerCase() ? { ...l, company: trimmed } : l
    ));
    setCustomCompanies((prev) => prev.map((c) =>
      c.name.toLowerCase() === oldName.toLowerCase() ? { ...c, name: trimmed } : c
    ));
  }, []);

  const mergeCompany = useCallback((sourceName: string, targetName: string) => {
    const targetLead = leads.find((l) => l.company.toLowerCase() === targetName.toLowerCase());
    const targetIndustry = targetLead?.type || "";
    const movedCount = leads.filter((l) => l.company.toLowerCase() === sourceName.toLowerCase()).length;

    setLeads((prev) => prev.map((l) => {
      if (l.company.toLowerCase() === sourceName.toLowerCase()) {
        return { ...l, company: targetName, type: targetIndustry || l.type };
      }
      return l;
    }));
    setCustomCompanies((prev) => prev.filter((c) => c.name.toLowerCase() !== sourceName.toLowerCase()));
    return movedCount;
  }, [leads]);

  const toggleActive = useCallback((id: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, active: !l.active } : l)));
  }, []);

  const bulkUpdateStatus = useCallback((ids: Set<string>, status: PipelineStatus) => {
    setLeads((prev) => prev.map((l) => ids.has(l.id) ? { ...l, status } : l));
  }, []);

  const bulkSetActive = useCallback((ids: Set<string>, active: boolean) => {
    setLeads((prev) => prev.map((l) => ids.has(l.id) ? { ...l, active } : l));
  }, []);

  const importLeads = useCallback((newLeads: Omit<Lead, "id" | "dateAdded">[], updateExisting = false) => {
    setLeads((prev) => {
      const emailIndex = new Map<string, number>();
      prev.forEach((l, i) => {
        if (l.email) emailIndex.set(l.email.toLowerCase(), i);
      });

      const result = [...prev];
      const added: Lead[] = [];
      let updatedCount = 0;

      for (const l of newLeads) {
        const emailKey = l.email?.toLowerCase();
        const existingIdx = emailKey ? emailIndex.get(emailKey) : undefined;

        if (existingIdx !== undefined) {
          if (updateExisting) {
            result[existingIdx] = { ...result[existingIdx], ...l, id: result[existingIdx].id, dateAdded: result[existingIdx].dateAdded };
            updatedCount++;
          }
        } else {
          added.push({ ...l, id: crypto.randomUUID(), dateAdded: new Date().toISOString() } as Lead);
        }
      }

      return [...result, ...added];
    });
  }, []);

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (view === "active") result = result.filter((l) => l.active);
    else if (view === "inactive") result = result.filter((l) => !l.active);

    if (filter.activeFilter === "active") result = result.filter((l) => l.active);
    else if (filter.activeFilter === "inactive") result = result.filter((l) => !l.active);

    if (filter.industry) result = result.filter((l) => l.type === filter.industry);
    if (filter.company) result = result.filter((l) => l.company === filter.company);
    if (filter.status) result = result.filter((l) => l.status === filter.status);
    if (filter.workESP) {
      if (filter.workESP === "Not Verified") {
        result = result.filter((l) => !l.emailVerification);
      } else {
        result = result.filter((l) => l.emailVerification?.esp === filter.workESP);
      }
    }
    if (filter.personalESP) {
      if (filter.personalESP === "Not Verified") {
        result = result.filter((l) => !l.personalEmailVerification);
      } else {
        result = result.filter((l) => l.personalEmailVerification?.esp === filter.personalESP);
      }
    }
    if (filter.personal2ESP) {
      if (filter.personal2ESP === "Not Verified") {
        result = result.filter((l) => !l.personalEmail2Verification);
      } else {
        result = result.filter((l) => l.personalEmail2Verification?.esp === filter.personal2ESP);
      }
    }
    if (filter.search) {
      const s = filter.search.toLowerCase();
      result = result.filter((l) =>
        [l.name, l.position, l.email, l.company, l.type, l.phone].some((f) => f?.toLowerCase().includes(s))
      );
    }

    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "company") return a.company.localeCompare(b.company);
      return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    });

    return result;
  }, [leads, view, filter, sortBy]);

  const stats = useMemo(() => {
    const total = leads.length;
    const active = leads.filter((l) => l.active).length;
    const inactive = total - active;
    const byStatus: Record<PipelineStatus, number> = {
      New: 0, Contacted: 0, "In Progress": 0, Closed: 0, "Not Interested": 0,
    };
    leads.forEach((l) => byStatus[l.status]++);
    return { total, active, inactive, byStatus };
  }, [leads]);

  const [customIndustries, setCustomIndustries] = useState<string[]>([]);
  const [customCompanies, setCustomCompanies] = useState<{ name: string; industry: string; email?: string }[]>([]);

  const industries = useMemo(() => {
    const fromLeads = leads.map((l) => l.type);
    const all = [...fromLeads, ...customIndustries];
    const seen = new Map<string, string>();
    all.forEach((t) => {
      const key = t.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, t.trim());
    });
    return [...seen.values()];
  }, [leads, customIndustries]);

  const companies = useMemo(() => {
    const fromLeads = leads.map((l) => l.company);
    const fromCustom = customCompanies.map((c) => c.name);
    return [...new Set([...fromLeads, ...fromCustom])];
  }, [leads, customCompanies]);

  const addIndustry = useCallback((name: string) => {
    const normalized = normalizeIndustryName(name);
    setCustomIndustries((prev) => [...prev, normalized]);
  }, []);

  const addCompany = useCallback((name: string, industry: string, email?: string) => {
    setCustomCompanies((prev) => [...prev, { name: name.trim(), industry: normalizeIndustryName(industry), email }]);
  }, []);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    leads.forEach((l) => l.tags?.forEach((t) => tags.add(t)));
    return [...tags];
  }, [leads]);

  const allFolders = useMemo(() => {
    const folders = new Set<string>();
    leads.forEach((l) => { if (l.folder) folders.add(l.folder); });
    return [...folders];
  }, [leads]);

  const allListSources = useMemo(() => {
    const sources = new Set<string>();
    leads.forEach((l) => { if (l.listSource) sources.add(l.listSource); });
    return [...sources];
  }, [leads]);
  const cleanAllPhoneData = useCallback(() => {
    let dirtyCount = 0;
    setLeads((prev) => prev.map((l) => {
      const cPhone = cleanPhoneNumber(l.phone);
      const cP1 = cleanPhoneNumber(l.personalPhone1);
      const cP2 = cleanPhoneNumber(l.personalPhone2);
      if (cPhone !== (l.phone || '') || cP1 !== (l.personalPhone1 || '') || cP2 !== (l.personalPhone2 || '')) {
        dirtyCount++;
        return { ...l, phone: cPhone, personalPhone1: cP1, personalPhone2: cP2 };
      }
      return l;
    }));
    return dirtyCount;
  }, []);

  const bulkDeleteLeads = useCallback((ids: Set<string>) => {
    setLeads((prev) => prev.filter((l) => !ids.has(l.id)));
  }, []);

  const deleteAllLeads = useCallback(() => {
    setLeads([]);
  }, []);

  const deletePageLeads = useCallback((pageLeadIds: string[]) => {
    const idSet = new Set(pageLeadIds);
    setLeads((prev) => prev.filter((l) => !idSet.has(l.id)));
  }, []);

  return {
    leads, filteredLeads, view, setView, filter, setFilter,
    sortBy, setSortBy, stats, industries, companies,
    addLead, updateLead, deleteLead, toggleActive, importLeads,
    bulkUpdateStatus, bulkSetActive, bulkDeleteLeads, deleteAllLeads, deletePageLeads,
    allTags, allFolders, allListSources,
    addIndustry, addCompany, deleteByIndustry, deleteByCompany,
    renameIndustry, renameCompany, mergeCompany, cleanAllPhoneData,
  };
};
