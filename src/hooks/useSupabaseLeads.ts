import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PipelineStatus = "New" | "Contacted" | "In Progress" | "Closed" | "Not Interested";

export interface SupabaseLead {
  id: string;
  name: string;
  company: string;
  company_email: string;
  position: string;
  industry: string;
  work_email: string;
  personal_email: string;
  personal_email2: string;
  work_phone: string;
  personal_phone1: string;
  personal_phone2: string;
  linkedin: string;
  facebook: string;
  instagram: string;
  website: string;
  status: string;
  active: boolean;
  notes: string;
  source: string;
  esp: string;
  tags: string[];
  folder: string;
  list_source: string;
  email_verification: any;
  personal_email_verification: any;
  personal_email2_verification: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FilterState {
  industry: string | null;
  company: string | null;
  status: PipelineStatus | null;
  search: string;
  activeFilter?: "all" | "active" | "inactive";
  showDuplicatesOnly?: boolean;
}

export const useSupabaseLeads = () => {
  const [leads, setLeads] = useState<SupabaseLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterState>({ industry: null, company: null, status: null, search: "" });
  const [sortBy, setSortBy] = useState<"name" | "company" | "dateAdded">("name");

  const fetchLeads = useCallback(async () => {
    const PAGE_SIZE = 1000;
    let allLeads: SupabaseLead[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("Error fetching leads:", error);
        toast.error("Failed to load leads");
        return;
      }

      allLeads = allLeads.concat((data as SupabaseLead[]) || []);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    setLeads(allLeads);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("leads-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  const addLead = useCallback(async (lead: Partial<SupabaseLead> & { name: string }) => {
    const { error } = await supabase.from("leads").insert([lead as any]);
    if (error) { toast.error("Failed to add lead: " + error.message); return false; }
    toast.success(`Lead "${lead.name}" added`);
    return true;
  }, []);

  const updateLead = useCallback(async (id: string, updates: Partial<SupabaseLead>) => {
    const { error } = await supabase.from("leads").update(updates).eq("id", id);
    if (error) { toast.error("Failed to update lead: " + error.message); return false; }
    return true;
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) { toast.error("Failed to delete lead: " + error.message); return false; }
    toast.success("Lead deleted");
    return true;
  }, []);

  const toggleActive = useCallback(async (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    await updateLead(id, { active: !lead.active });
  }, [leads, updateLead]);

  const bulkUpdateStatus = useCallback(async (ids: Set<string>, status: PipelineStatus) => {
    const idArray = Array.from(ids);
    const { error } = await supabase.from("leads").update({ status }).in("id", idArray);
    if (error) { toast.error("Bulk update failed"); return; }
    toast.success(`${idArray.length} leads updated to "${status}"`);
    fetchLeads();
  }, [fetchLeads]);

  const bulkSetActive = useCallback(async (ids: Set<string>, active: boolean) => {
    const idArray = Array.from(ids);
    const { error } = await supabase.from("leads").update({ active }).in("id", idArray);
    if (error) { toast.error("Bulk update failed"); return; }
    toast.success(`${idArray.length} leads marked ${active ? "active" : "inactive"}`);
    fetchLeads();
  }, [fetchLeads]);

  const bulkDeleteLeads = useCallback(async (ids: Set<string>) => {
    const idArray = Array.from(ids);
    const { error } = await supabase.from("leads").delete().in("id", idArray);
    if (error) { toast.error("Bulk delete failed: " + error.message); return; }
    toast.success(`${idArray.length} leads deleted`);
    fetchLeads();
  }, [fetchLeads]);

  const deleteAllLeads = useCallback(async () => {
    const { error } = await supabase.from("leads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) { toast.error("Delete all failed: " + error.message); return; }
    toast.success("All leads deleted");
    fetchLeads();
  }, [fetchLeads]);

  const importLeads = useCallback(async (newLeads: Array<Partial<SupabaseLead> & { name: string }>, updateExisting = false) => {
    if (updateExisting) {
      // Upsert by work_email
      for (const lead of newLeads) {
        if (lead.work_email) {
          const { data: existing } = await supabase
            .from("leads")
            .select("id")
            .eq("work_email", lead.work_email)
            .single();
          if (existing) {
            await supabase.from("leads").update(lead).eq("id", existing.id);
            continue;
          }
        }
        await supabase.from("leads").insert([lead as any]);
      }
    } else {
      const { error } = await supabase.from("leads").insert(newLeads as any);
      if (error) { toast.error("Import failed: " + error.message); return; }
    }
    toast.success(`${newLeads.length} leads imported`);
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (filter.activeFilter === "active") result = result.filter(l => l.active);
    else if (filter.activeFilter === "inactive") result = result.filter(l => !l.active);

    if (filter.industry) result = result.filter(l => l.industry === filter.industry);
    if (filter.company) result = result.filter(l => l.company === filter.company);
    if (filter.status) result = result.filter(l => l.status === filter.status);
    if (filter.search) {
      const s = filter.search.toLowerCase();
      result = result.filter(l =>
        [l.name, l.position, l.work_email, l.company, l.industry, l.work_phone].some(f => f?.toLowerCase().includes(s))
      );
    }

    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "company") return a.company.localeCompare(b.company);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [leads, filter, sortBy]);

  const stats = useMemo(() => {
    const total = leads.length;
    const active = leads.filter(l => l.active).length;
    const inactive = total - active;
    const byStatus: Record<string, number> = { New: 0, Contacted: 0, "In Progress": 0, Closed: 0, "Not Interested": 0 };
    leads.forEach(l => { if (byStatus[l.status] !== undefined) byStatus[l.status]++; });
    return { total, active, inactive, byStatus };
  }, [leads]);

  const industries = useMemo(() => [...new Set(leads.map(l => l.industry).filter(Boolean))], [leads]);
  const companies = useMemo(() => [...new Set(leads.map(l => l.company).filter(Boolean))], [leads]);

  return {
    leads, filteredLeads, loading, filter, setFilter, sortBy, setSortBy, stats, industries, companies,
    addLead, updateLead, deleteLead, toggleActive, importLeads,
    bulkUpdateStatus, bulkSetActive, bulkDeleteLeads, deleteAllLeads,
    fetchLeads,
  };
};
