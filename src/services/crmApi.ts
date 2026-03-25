// CRM API Service — connects to external Lead CRM via REST API (PostgREST)

const STORAGE_KEY = "nhproductionhouse_crm_connection";

export interface CRMConnectionConfig {
  apiUrl: string;
  apiKey: string;
  autoSyncEnabled: boolean;
  autoSyncInterval: "1hr" | "6hr" | "24hr" | "weekly";
  lastSyncAt: string | null;
  lastSyncCount: number;
  isConnected: boolean;
}

export interface CRMLeadFilters {
  activeOnly?: boolean;
  verifiedOnly?: boolean;
  industry?: string;
  company?: string;
  status?: string;
  esp?: string;
  since?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface CRMLead {
  id: string;
  name: string;
  position: string;
  company: string;
  industry: string;
  status: string;
  is_active: boolean;
  work_email: string;
  work_email_verified: boolean;
  work_email_verification_status: string | null;
  work_esp: string | null;
  work_email_verified_at: string | null;
  personal_email_1: string | null;
  personal_email_1_verified: boolean;
  personal_email_1_verification_status: string | null;
  personal_email_1_esp: string | null;
  personal_email_2: string | null;
  personal_email_2_verified: boolean;
  personal_email_2_verification_status: string | null;
  personal_email_2_esp: string | null;
  work_phone: string | null;
  personal_phone_1: string | null;
  personal_phone_2: string | null;
  created_at: string;
  updated_at: string;
}

export interface MappedContact {
  external_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  company: string;
  industry: string;
  position: string;
  primary_email: string;
  all_emails: string[];
  all_phones: string[];
  esp: string | null;
  crm_status: string;
  is_active: boolean;
  synced_from_crm: boolean;
  crm_synced_at: string;
  source: string;
}

// Load/save connection config
export function loadCRMConfig(): CRMConnectionConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(atob(raw));
  } catch {}
  return {
    apiUrl: "",
    apiKey: "",
    autoSyncEnabled: false,
    autoSyncInterval: "24hr",
    lastSyncAt: null,
    lastSyncCount: 0,
    isConnected: false,
  };
}

export function saveCRMConfig(config: CRMConnectionConfig) {
  localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify(config)));
}

function getHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    apikey: apiKey,
    "Content-Type": "application/json",
    Prefer: "count=exact",
  };
}

// Fetch leads with filters
export async function fetchCRMLeads(
  config: CRMConnectionConfig,
  filters: CRMLeadFilters = {}
): Promise<{ leads: CRMLead[]; total: number }> {
  const params = new URLSearchParams();

  if (filters.activeOnly) params.set("is_active", "eq.true");
  if (filters.verifiedOnly) params.set("work_email_verified", "eq.true");
  if (filters.industry) params.set("industry", `eq.${filters.industry}`);
  if (filters.company) params.set("company", `eq.${filters.company}`);
  if (filters.status) params.set("status", `eq.${filters.status}`);
  if (filters.esp) params.set("work_esp", `eq.${filters.esp}`);
  if (filters.since) params.set("created_at", `gte.${filters.since}`);
  if (filters.search) params.set("name", `ilike.*${filters.search}*`);

  params.set(
    "select",
    [
      "id", "name", "position", "company", "industry",
      "work_email", "work_email_verified", "work_esp",
      "personal_email_1", "personal_email_1_verified", "personal_email_1_esp",
      "personal_email_2", "personal_email_2_verified",
      "work_phone", "personal_phone_1", "personal_phone_2",
      "status", "is_active", "created_at",
    ].join(",")
  );

  params.set("limit", String(filters.limit || 100));
  params.set("offset", String(filters.offset || 0));
  params.set("order", filters.sort || "created_at.desc");

  const response = await fetch(
    `${config.apiUrl}/leads?${params.toString()}`,
    { headers: getHeaders(config.apiKey) }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`CRM API error (${response.status}): ${text || response.statusText}`);
  }

  const data: CRMLead[] = await response.json();
  const contentRange = response.headers.get("Content-Range");
  const total = contentRange ? parseInt(contentRange.split("/")[1]) || data.length : data.length;

  return { leads: data, total };
}

// Test connection — fetch 1 lead
export async function testCRMConnection(
  apiUrl: string,
  apiKey: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.set("select", "id");
    params.set("limit", "1");

    const response = await fetch(`${apiUrl}/leads?${params.toString()}`, {
      headers: { ...getHeaders(apiKey) },
    });

    if (!response.ok) {
      return { success: false, count: 0, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const contentRange = response.headers.get("Content-Range");
    const total = contentRange ? parseInt(contentRange.split("/")[1]) || 0 : 0;

    return { success: true, count: total };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || "Connection failed" };
  }
}

// Fetch all leads paginated (for full sync)
export async function fetchAllCRMLeadsPaginated(
  config: CRMConnectionConfig,
  filters: CRMLeadFilters = {},
  onProgress?: (fetched: number, total: number) => void
): Promise<CRMLead[]> {
  const batchSize = 500;
  let offset = 0;
  let allLeads: CRMLead[] = [];
  let hasMore = true;

  // First call to get total
  const first = await fetchCRMLeads(config, { ...filters, limit: batchSize, offset: 0 });
  allLeads = first.leads;
  const total = first.total;
  onProgress?.(allLeads.length, total);

  if (allLeads.length >= total) return allLeads;

  offset = batchSize;
  while (hasMore && offset < total) {
    const batch = await fetchCRMLeads(config, { ...filters, limit: batchSize, offset });
    allLeads = [...allLeads, ...batch.leads];
    onProgress?.(allLeads.length, total);
    offset += batchSize;
    hasMore = offset < total;
  }

  return allLeads;
}

// Fetch unique industries from CRM
export async function fetchCRMIndustries(config: CRMConnectionConfig): Promise<string[]> {
  const response = await fetch(
    `${config.apiUrl}/leads?select=industry&order=industry.asc`,
    { headers: getHeaders(config.apiKey) }
  );
  if (!response.ok) throw new Error("Failed to fetch industries");
  const data = await response.json();
  return [...new Set(data.map((d: any) => d.industry).filter(Boolean))] as string[];
}

// Fetch unique companies
export async function fetchCRMCompanies(config: CRMConnectionConfig, industry?: string): Promise<string[]> {
  let url = `${config.apiUrl}/leads?select=company`;
  if (industry) url += `&industry=eq.${encodeURIComponent(industry)}`;
  const response = await fetch(url, { headers: getHeaders(config.apiKey) });
  if (!response.ok) throw new Error("Failed to fetch companies");
  const data = await response.json();
  return [...new Set(data.map((d: any) => d.company).filter(Boolean))] as string[];
}

// Map CRM lead to local contact format
export function mapCRMLeadToContact(crmLead: CRMLead): MappedContact {
  return {
    external_id: crmLead.id,
    full_name: crmLead.name,
    first_name: crmLead.name?.split(" ")[0] || "",
    last_name: crmLead.name?.split(" ").slice(1).join(" ") || "",
    company: crmLead.company,
    industry: crmLead.industry,
    position: crmLead.position,
    primary_email: crmLead.work_email_verified
      ? crmLead.work_email
      : crmLead.personal_email_1 || crmLead.work_email,
    all_emails: [crmLead.work_email, crmLead.personal_email_1, crmLead.personal_email_2].filter(Boolean) as string[],
    all_phones: [crmLead.work_phone, crmLead.personal_phone_1, crmLead.personal_phone_2].filter(Boolean) as string[],
    esp: crmLead.work_esp || crmLead.personal_email_1_esp || null,
    crm_status: crmLead.status,
    is_active: crmLead.is_active,
    synced_from_crm: true,
    crm_synced_at: new Date().toISOString(),
    source: "NH Production House CRM",
  };
}

// Map CRM lead to local Lead format (for importing into this CRM's lead system)
export function mapCRMLeadToLocalLead(crmLead: CRMLead) {
  return {
    type: crmLead.industry || "Other",
    company: crmLead.company || "",
    companyEmail: "",
    name: crmLead.name || "",
    position: crmLead.position || "",
    phone: crmLead.work_phone || "",
    personalPhone1: crmLead.personal_phone_1 || "",
    personalPhone2: crmLead.personal_phone_2 || "",
    email: crmLead.work_email || "",
    personalEmail: crmLead.personal_email_1 || "",
    personalEmail2: crmLead.personal_email_2 || "",
    linkedin: "",
    facebook: "",
    instagram: "",
    status: (crmLead.status === "NEW" ? "New" : crmLead.status === "CONTACTED" ? "Contacted" : crmLead.status === "QUALIFIED" ? "In Progress" : crmLead.status === "CONVERTED" ? "Closed" : "New") as any,
    active: crmLead.is_active,
    notes: `Imported from CRM (ID: ${crmLead.id})`,
    tags: ["crm-import"],
    listSource: "CRM API Import",
  };
}
