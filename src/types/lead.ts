export type PipelineStatus = "New" | "Contacted" | "In Progress" | "Closed" | "Not Interested";

export type EmailQuality = "good" | "bad" | "risky" | "";
export type EmailResult = "ok" | "catch_all" | "unknown" | "error" | "disposable" | "invalid";

export interface EmailVerification {
  quality: EmailQuality;
  result: EmailResult;
  resultcode: number;
  subresult: string;
  free: boolean;
  role: boolean;
  didyoumean: string;
  esp: string;
  verifiedAt: string;
  creditsUsed: number;
  fromCache?: boolean;
  cacheExpiresAt?: string;
}

export interface Lead {
  id: string;
  type: string;
  company: string;
  companyEmail: string;
  name: string;
  position: string;
  phone: string;           // Work Phone
  personalPhone1: string;  // Personal Phone 1
  personalPhone2: string;  // Personal Phone 2
  email: string;           // Work Email
  personalEmail: string;   // Personal Email 1
  personalEmail2: string;  // Personal Email 2
  linkedin: string;
  facebook: string;
  instagram: string;
  status: PipelineStatus;
  active: boolean;
  dateAdded: string;
  notes: string;
  listSource?: string;
  folder?: string;
  tags?: string[];
  createdBy?: string;
  emailVerification?: EmailVerification;
  personalEmailVerification?: EmailVerification;
  personalEmail2Verification?: EmailVerification;
}

export type ViewMode = "dashboard" | "all" | "active" | "inactive" | "users" | "workforce-live" | "workforce-timelogs" | "workforce-salary" | "workforce-settings" | "my-activity" | "ev-report" | "ev-settings" | "api-integrations" | "backups" | "client-communications";

export interface FilterState {
  industry: string | null;
  company: string | null;
  status: PipelineStatus | null;
  search: string;
  workESP?: string | null;
  personalESP?: string | null;
  personal2ESP?: string | null;
  activeFilter?: "all" | "active" | "inactive";
  showDuplicatesOnly?: boolean;
}

export interface ImportOptions {
  ignoreFirstRow: boolean;
  updateExisting: boolean;
  listSource: string;
  folder: string;
  tags: string[];
}
