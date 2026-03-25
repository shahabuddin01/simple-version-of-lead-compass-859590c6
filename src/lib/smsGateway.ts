// SMS Gateway utilities for Greenweb BD (bdbulksms.net)
// Note: bdbulksms.net may block direct browser fetch due to CORS.
// If CORS errors appear, route the API call through the PHP backend
// or a simple proxy. The API endpoint is: https://api.bdbulksms.net/api.php?json

import { storeSecure, loadSecure } from "@/lib/security";

export interface GatewayConfig {
  provider: "greenweb";
  token: string;
  isDemo: boolean;
}

export interface SMSRecipient {
  name: string;
  phone: string;
  message: string;
}

export interface SMSSendResult {
  name: string;
  phone: string;
  message: string;
  status: "sent" | "failed" | "skipped";
  reason: string;
}

const GATEWAY_CONFIG_KEY = "nhproductionhouse_sms_gateway";
const DEMO_TOKEN = "1234567890123456789";
const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;

export function loadGatewayConfig(): GatewayConfig | null {
  return loadSecure<GatewayConfig | null>(GATEWAY_CONFIG_KEY, null);
}

export function saveGatewayConfig(config: GatewayConfig | null) {
  if (config) {
    storeSecure(GATEWAY_CONFIG_KEY, config);
  } else {
    localStorage.removeItem(GATEWAY_CONFIG_KEY);
  }
}

export function getDemoToken() {
  return DEMO_TOKEN;
}

/** Normalize a phone number to +880XXXXXXXXXX format for Bangladesh */
export function normalizePhoneBD(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, "");
  if (!cleaned) return null;

  let digits = cleaned;

  if (digits.startsWith("+")) digits = digits.slice(1);

  if (digits.startsWith("880")) {
    const local = digits.slice(3);
    if (BD_MOBILE_REGEX.test("0" + local)) return "+" + digits;
    return null;
  }

  if (digits.startsWith("0")) {
    if (BD_MOBILE_REGEX.test(digits)) return "+88" + digits;
    return null;
  }

  if (digits.startsWith("1")) {
    if (BD_MOBILE_REGEX.test("0" + digits)) return "+880" + digits;
    return null;
  }

  return null;
}

/** Validate if a raw phone string is a valid BD mobile number */
export function isValidBDPhone(raw: string): boolean {
  return normalizePhoneBD(raw) !== null;
}

/** Send a test SMS via Greenweb BD API */
export async function sendTestSMS(
  token: string,
  to: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  const normalized = normalizePhoneBD(to);
  if (!normalized) {
    return { success: false, message: "Invalid phone number format" };
  }

  try {
    const url = "https://api.bdbulksms.net/api.php?json";
    const data = new FormData();
    data.set("token", token);
    data.set("message", message);
    data.set("to", normalized);

    const response = await fetch(url, { method: "POST", body: data });
    const result = await response.json();

    const item = Array.isArray(result) ? result[0] : result;
    if (item?.status === "SENT") {
      return { success: true, message: `SMS sent to ${normalized}` };
    } else {
      return {
        success: false,
        message: item?.statusmsg || "SMS failed — unknown reason",
      };
    }
  } catch {
    return {
      success: false,
      message: "Could not reach bdbulksms.net. Check your internet connection.",
    };
  }
}

/** Send bulk personalized SMS via Greenweb BD JSON batch API — no rate limits */
export async function sendBulkSMS(
  token: string,
  recipients: SMSRecipient[]
): Promise<SMSSendResult[]> {
  const results: SMSSendResult[] = [];
  const validRecipients: { to: string; message: string; index: number }[] = [];

  // Validate & normalize all numbers first
  recipients.forEach((r, i) => {
    const normalized = normalizePhoneBD(r.phone);
    if (!normalized) {
      results.push({
        name: r.name,
        phone: r.phone,
        message: r.message,
        status: "skipped",
        reason: "Invalid or missing phone number",
      });
    } else {
      validRecipients.push({ to: normalized, message: r.message, index: i });
    }
  });

  if (validRecipients.length === 0) return results;

  try {
    const url = "https://api.bdbulksms.net/api.php?json";
    // Send entire batch in single JSON request — no rate limiting
    const smsdata = validRecipients.map((v) => ({
      to: v.to,
      message: v.message,
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, smsdata }),
    });

    const apiResults = await response.json();

    if (Array.isArray(apiResults)) {
      apiResults.forEach((item: any, idx: number) => {
        const vr = validRecipients[idx];
        const recipient = recipients[vr?.index ?? idx];
        results.push({
          name: recipient?.name ?? "Unknown",
          phone: item.to ?? vr?.to ?? "",
          message: vr?.message ?? "",
          status: item.status === "SENT" ? "sent" : "failed",
          reason: item.statusmsg || (item.status === "SENT" ? "SMS Sent Successfully" : "Send failed"),
        });
      });
    }
  } catch {
    validRecipients.forEach((vr) => {
      const recipient = recipients[vr.index];
      results.push({
        name: recipient.name,
        phone: vr.to,
        message: vr.message,
        status: "failed",
        reason: "Could not reach bdbulksms.net",
      });
    });
  }

  return results;
}
