import { supabase } from "@/integrations/supabase/client";

// Simple in-memory cache: path -> { url, expiresAt }
const cache = new Map<string, { url: string; expiresAt: number }>();
const EXPIRES_IN = 3600; // 1 hour signed URL

/**
 * Resolve a stored selfie reference (either a legacy public URL or a private storage path)
 * to a URL usable in <img src>. Returns null on failure.
 */
export async function getSelfieUrl(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  // Legacy: already a full URL
  if (/^https?:\/\//i.test(ref)) return ref;
  // Data URL
  if (ref.startsWith("data:")) return ref;
  const now = Date.now();
  const hit = cache.get(ref);
  if (hit && hit.expiresAt > now + 60_000) return hit.url;
  try {
    const { data, error } = await supabase.storage.from("selfies").createSignedUrl(ref, EXPIRES_IN);
    if (error || !data?.signedUrl) return null;
    cache.set(ref, { url: data.signedUrl, expiresAt: now + EXPIRES_IN * 1000 });
    return data.signedUrl;
  } catch {
    return null;
  }
}
