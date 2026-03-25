// ── Email Verification Cache (localStorage) ──
// Caches verification results by email address for 14 days to save API credits.

import { storeSecure, loadSecure } from "@/lib/security";

const CACHE_KEY = "nhproductionhouse_ev_cache";
const CACHE_SETTINGS_KEY = "nhproductionhouse_ev_cache_settings";
const CACHE_HIT_LOG_KEY = "nhproductionhouse_ev_cache_hits";

// ── Types ──

export interface CachedVerification {
  email: string; // normalized lowercase
  verificationStatus: string; // ok, invalid, catch_all, unknown, disposable, error
  quality: string;
  resultcode: number;
  subresult: string;
  free: boolean;
  role: boolean;
  didyoumean: string;
  esp: string;
  verifiedAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
}

export interface CacheSettings {
  cacheEnabled: boolean;
  cacheDurationDays: number;
}

export interface CacheHitEntry {
  email: string;
  hitAt: string;
  leadId?: string;
}

export interface CacheStats {
  total: number;
  active: number;
  expired: number;
  creditsSavedThisWeek: number;
}

// ── Settings ──

export function loadCacheSettings(): CacheSettings {
  return loadSecure(CACHE_SETTINGS_KEY, { cacheEnabled: true, cacheDurationDays: 14 });
}

export function saveCacheSettings(settings: CacheSettings): void {
  storeSecure(CACHE_SETTINGS_KEY, settings);
}

// ── Cache Operations ──

function loadCache(): CachedVerification[] {
  return loadSecure(CACHE_KEY, []);
}

function saveCache(cache: CachedVerification[]): void {
  storeSecure(CACHE_KEY, cache);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Look up a cached (non-expired) result for an email */
export function lookupCache(email: string): CachedVerification | null {
  const settings = loadCacheSettings();
  if (!settings.cacheEnabled) return null;

  const normalized = normalizeEmail(email);
  const cache = loadCache();
  const now = new Date().toISOString();

  const entry = cache.find(
    (c) => c.email === normalized && c.expiresAt > now
  );
  return entry || null;
}

/** Save a verification result to the cache (upsert by email) */
export function saveToCache(
  email: string,
  data: {
    result: string;
    quality: string;
    resultcode: number;
    subresult: string;
    free: boolean;
    role: boolean;
    didyoumean: string;
    esp: string;
  }
): void {
  const settings = loadCacheSettings();
  const normalized = normalizeEmail(email);
  const cache = loadCache();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + settings.cacheDurationDays * 24 * 60 * 60 * 1000);

  const entry: CachedVerification = {
    email: normalized,
    verificationStatus: data.result,
    quality: data.quality,
    resultcode: data.resultcode,
    subresult: data.subresult,
    free: data.free,
    role: data.role,
    didyoumean: data.didyoumean,
    esp: data.esp,
    verifiedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const idx = cache.findIndex((c) => c.email === normalized);
  if (idx >= 0) {
    cache[idx] = entry;
  } else {
    cache.push(entry);
  }
  saveCache(cache);
}

/** Record a cache hit for statistics */
export function recordCacheHit(email: string, leadId?: string): void {
  const hits: CacheHitEntry[] = loadSecure(CACHE_HIT_LOG_KEY, []);
  hits.push({ email: normalizeEmail(email), hitAt: new Date().toISOString(), leadId });
  // Keep last 2000 entries
  if (hits.length > 2000) hits.splice(0, hits.length - 2000);
  storeSecure(CACHE_HIT_LOG_KEY, hits);
}

/** Get cache statistics */
export function getCacheStats(): CacheStats {
  const cache = loadCache();
  const now = new Date().toISOString();
  const active = cache.filter((c) => c.expiresAt > now).length;
  const expired = cache.length - active;

  // Credits saved this week
  const hits: CacheHitEntry[] = loadSecure(CACHE_HIT_LOG_KEY, []);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const creditsSavedThisWeek = hits.filter((h) => h.hitAt > oneWeekAgo).length;

  return { total: cache.length, active, expired, creditsSavedThisWeek };
}

/** Clear all cached entries */
export function clearCache(): void {
  storeSecure(CACHE_KEY, []);
  storeSecure(CACHE_HIT_LOG_KEY, []);
}

/** Clean up expired entries (call on app load) */
export function cleanupExpiredCache(): void {
  const cache = loadCache();
  const now = new Date().toISOString();
  const cleaned = cache.filter((c) => c.expiresAt > now);
  if (cleaned.length < cache.length) {
    saveCache(cleaned);
  }
}
