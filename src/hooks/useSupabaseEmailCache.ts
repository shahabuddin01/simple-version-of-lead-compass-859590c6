import { supabase } from "@/integrations/supabase/client";

export interface CachedVerification {
  email: string;
  result: string;
  quality: string;
  resultcode: number;
  subresult: string;
  free: boolean;
  role: boolean;
  didyoumean: string;
  esp: string;
  verified_at: string;
  expires_at: string;
}

export async function lookupEmailCache(email: string): Promise<CachedVerification | null> {
  const { data, error } = await supabase
    .from("email_verification_cache")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) return null;
  return data as CachedVerification;
}

export async function saveEmailCache(email: string, verification: Omit<CachedVerification, "email" | "verified_at" | "expires_at">) {
  const { error } = await supabase
    .from("email_verification_cache")
    .upsert({
      email: email.trim().toLowerCase(),
      ...verification,
      verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "email" });

  if (error) console.error("Failed to cache verification:", error);
}

export async function cleanupExpiredEmailCache() {
  await supabase
    .from("email_verification_cache")
    .delete()
    .lt("expires_at", new Date().toISOString());
}
