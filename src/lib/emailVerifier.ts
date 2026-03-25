// ── Million Verifier API Integration ──
// Single API: https://api.millionverifier.com (uses `api` param)
// Bulk API:   https://bulkapi.millionverifier.com (uses `key` param)

import { storeSecure, loadSecure } from "@/lib/security";

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

// ── API Calls ──

export async function getCredits(apiKey: string) {
  const res = await fetch(
    `https://api.millionverifier.com/api/v3/credits?api=${encodeURIComponent(apiKey)}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function verifySingle(apiKey: string, email: string, timeout = 10) {
  const url = `https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}&timeout=${timeout}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function bulkUpload(apiKey: string, emails: string[]) {
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
  const res = await fetch(
    `https://bulkapi.millionverifier.com/bulkapi/v2/fileinfo?key=${encodeURIComponent(apiKey)}&file_id=${fileId}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function stopVerification(apiKey: string, fileId: string) {
  const res = await fetch(
    `https://bulkapi.millionverifier.com/bulkapi/stop?key=${encodeURIComponent(apiKey)}&file_id=${fileId}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function downloadResults(apiKey: string, fileId: string, filter = "all") {
  const res = await fetch(
    `https://bulkapi.millionverifier.com/bulkapi/v2/download?key=${encodeURIComponent(apiKey)}&file_id=${fileId}&filter=${filter}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

export async function deleteFile(apiKey: string, fileId: string) {
  await fetch(
    `https://bulkapi.millionverifier.com/bulkapi/v2/delete?key=${encodeURIComponent(apiKey)}&file_id=${fileId}`
  );
}

export async function getFileList(apiKey: string, limit = 50, offset = 0) {
  const res = await fetch(
    `https://bulkapi.millionverifier.com/bulkapi/v2/filelist?key=${encodeURIComponent(apiKey)}&limit=${limit}&offset=${offset}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
