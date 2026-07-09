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
  
  // Fix for paths that accidentally included the bucket name or a leading slash
  let cleanRef = ref.trim();
  if (cleanRef.startsWith("/")) {
    cleanRef = cleanRef.substring(1);
  }
  if (cleanRef.startsWith("selfies/")) {
    cleanRef = cleanRef.replace("selfies/", "");
  }

  const now = Date.now();
  const hit = cache.get(cleanRef);
  if (hit && hit.expiresAt > now + 60_000) return hit.url;
  
  try {
    const { data, error } = await supabase.storage.from("selfies").createSignedUrl(cleanRef, EXPIRES_IN);
    if (error) {
      console.error("Supabase storage error for ref:", cleanRef, error);
      return null;
    }
    if (!data?.signedUrl) return null;
    
    cache.set(cleanRef, { url: data.signedUrl, expiresAt: now + EXPIRES_IN * 1000 });
    return data.signedUrl;
  } catch (err) {
    console.error("Exception getting signed URL:", err);
    return null;
  }
}
