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
  
  let cleanRef = ref.trim();

  // Data URL
  if (cleanRef.startsWith("data:")) return cleanRef;

  // Extract from full Supabase URL if present (to handle expired signed URLs or private public URLs)
  try {
    const urlObj = new URL(cleanRef);
    if (urlObj.pathname.includes('/storage/v1/object/')) {
      const parts = urlObj.pathname.split('/');
      const selfiesIdx = parts.indexOf('selfies');
      if (selfiesIdx !== -1) {
        cleanRef = parts.slice(selfiesIdx + 1).join('/');
      } else {
        // Not in 'selfies' bucket but still a full URL? Return as is.
        return ref;
      }
    } else {
      // Some other full URL (e.g. external hosting), just return it
      return ref;
    }
  } catch (e) {
    // Not a valid full URL, proceed with path parsing
  }
  
  // Fix for paths that accidentally included the bucket name or a leading slash
  if (cleanRef.startsWith("/")) {
    cleanRef = cleanRef.substring(1);
  }
  if (cleanRef.startsWith("selfies/")) {
    cleanRef = cleanRef.substring(8);
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

