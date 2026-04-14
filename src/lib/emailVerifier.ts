// ── Million Verifier API Integration ──
// All API calls go through the mv-proxy edge function to avoid CORS issues

import { storeSecure, loadSecure } from "@/lib/security";
import { supabase } from "@/integrations/supabase/client";

const MV_SETTINGS_KEY = "nhproductionhouse_mv_settings";

export interface MVSettings {
  apiKey: string;
  useDemo: boolean;
}

export function saveMVSettings(settings: MVSettings): void {
  storeSecure(MV_SETTINGS_KEY, settings);
}

export function loadMVSettings(): MVSettings {
  return loadSecure(MV_SETTINGS_KEY, { apiKey: "", useDemo: false });
}

// ── ESP Detection ──
export function getESP(email: string): string {
  if (!email) return "Other";
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (["gmail.com", "googlemail.com", "google.com"].includes(domain)) return "Google";
  if (["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.com.bd"].includes(domain)) return "Outlook";
  if (["zoho.com", "zohomail.com"].includes(domain)) return "Zoho";
  if (["yahoo.com", "yahoo.co.uk", "yahoo.com.bd", "ymail.com"].includes(domain)) return "Yahoo";
  return "Other";
}

// ── Quality Display ──
export interface QualityDisplay {
  label: string;
  color: string;
  icon: string;
}

export function getQualityDisplay(quality: string, result: string): QualityDisplay {
  if (result === "ok" && quality === "good") return { label: "Good", color: "text-green-600 bg-green-50 border-green-200", icon: "✓" };
  if (result === "catch_all") return { label: "Catch-all", color: "text-amber-600 bg-amber-50 border-amber-200", icon: "⚠" };
  if (result === "unknown") return { label: "Unknown", color: "text-amber-600 bg-amber-50 border-amber-200", icon: "?" };
  if (result === "disposable") return { label: "Disposable", color: "text-red-600 bg-red-50 border-red-200", icon: "🗑" };
  if (result === "invalid") return { label: "Invalid", color: "text-red-600 bg-red-50 border-red-200", icon: "✗" };
  if (result === "error") return { label: "Error", color: "text-red-600 bg-red-50 border-red-200", icon: "✗" };
  return { label: "Unknown", color: "text-muted-foreground bg-muted border-border", icon: "—" };
}

// ── Error Messages ──
export function getErrorMessage(error: string): string {
  const map: Record<string, string> = {
    apikey_not_found: "Invalid API key",
    "No email specified": "Email field is empty",
    insufficient_credits: "Not enough credits",
    ip_blocked: "IP blocked by provider",
  };
  return map[error] || error || "Unknown error";
}

// ── Status Badge ──
export function getFileStatusBadge(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    finished: { label: "Finished", color: "text-green-600 bg-green-50 border-green-200" },
    in_progress: { label: "In Progress", color: "text-blue-600 bg-blue-50 border-blue-200" },
    in_queue_to_start: { label: "Queued", color: "text-muted-foreground bg-muted border-border" },
    paused: { label: "Paused", color: "text-amber-600 bg-amber-50 border-amber-200" },
    canceled: { label: "Canceled", color: "text-red-600 bg-red-50 border-red-200" },
    error: { label: "Error", color: "text-red-600 bg-red-50 border-red-200" },
  };
  return map[status] || { label: status, color: "text-muted-foreground bg-muted border-border" };
}

// ── Proxy helper ──
async function callProxy(body: Record<string, any>): Promise<any> {
  const { data, error } = await supabase.functions.invoke("mv-proxy", {
    body,
  });
  if (error) throw new Error(error.message || "Proxy call failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── API Calls (via edge function proxy) ──

export async function getCredits(apiKey: string) {
  return callProxy({ action: "credits", apiKey });
}

export async function verifySingle(apiKey: string, email: string, timeout = 10) {
  return callProxy({ action: "verify_single", apiKey, email, timeout });
}

export async function bulkUpload(apiKey: string, emails: string[]) {
  // Bulk upload still needs direct call for FormData file upload
  const fileContent = emails.join("\n");
  const blob = new Blob([fileContent], { type: "text/plain" });
  const file = new File([blob], "ns-production-emails.txt", { type: "text/plain" });
  const formData = new FormData();
  formData.append("file_contents", file);
  const res = await fetch(
    `https://bulkapi.millionverifier.com/bulkapi/v2/upload?key=${encodeURIComponent(apiKey)}`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error === "insufficient_credits") {
    throw new Error(`Not enough credits. Need ${data.unique_emails}, have ${data.credits}`);
  }
  return data;
}

export async function pollFileStatus(apiKey: string, fileId: string) {
  return callProxy({ action: "file_info", apiKey, fileId });
}

export async function stopVerification(apiKey: string, fileId: string) {
  return callProxy({ action: "stop", apiKey, fileId });
}

export async function downloadResults(apiKey: string, fileId: string, filter = "all") {
  const { data, error } = await supabase.functions.invoke("mv-proxy", {
    body: { action: "download", apiKey, fileId, filter },
  });
  if (error) throw new Error(error.message);
  // download returns text, but supabase invoke may parse it
  return typeof data === "string" ? data : JSON.stringify(data);
}

export async function deleteFile(apiKey: string, fileId: string) {
  await callProxy({ action: "delete", apiKey, fileId });
}

export async function getFileList(apiKey: string, limit = 50, offset = 0) {
  return callProxy({ action: "file_list", apiKey, limit, offset });
}
