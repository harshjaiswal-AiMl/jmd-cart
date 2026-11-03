/**
 * Media URL resolution helper.
 * - If key is empty or null, returns empty string.
 * - If key starts with http:// or https://, returns as-is (or adjusts variant if matching CDN pattern).
 * - Maps legacy "/uploads/products/<file>" to "/media/uploads/products/<file>" or serves directly if local.
 * - If MEDIA_BASE_URL is set (e.g. CDN), formats as `${MEDIA_BASE_URL}/${cleanKey}`.
 * - Otherwise formats as `/media/${cleanKey}`.
 */
export type MediaVariantSize = 160 | 320 | 400 | 640 | 800 | 1080 | 1200;

export function mediaUrl(key: string | null | undefined, size?: MediaVariantSize): string {
  if (!key || typeof key !== "string" || !key.trim()) {
    return "";
  }

  const trimmed = key.trim();

  // If already absolute URL (http/https), return as-is
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    // If it points to our R2 storage and has a variant request
    if (size && trimmed.includes("/products/")) {
      return trimmed.replace(/\/products\/([^/]+)\/[^/]+$/, `/products/$1/${size}.webp`);
    }
    return trimmed;
  }

  // Handle legacy paths like "/uploads/products/abc.jpg"
  let cleanKey = trimmed.replace(/^\/+/, "");

  // If size variant requested and key is in products/<hash>/<file> format
  if (size && cleanKey.startsWith("products/")) {
    const parts = cleanKey.split("/");
    if (parts.length === 3) {
      // parts: ["products", hash, "original.webp" or "320.webp" etc.]
      cleanKey = `products/${parts[1]}/${size}.webp`;
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || process.env.MEDIA_BASE_URL;
  if (baseUrl) {
    const cleanBase = baseUrl.replace(/\/+$/, "");
    return `${cleanBase}/${cleanKey}`;
  }

  return `/media/${cleanKey}`;
}

/**
 * Returns a standard responsive srcset string for a product image key.
 * e.g. "url(160) 160w, url(320) 320w, url(640) 640w"
 */
export function mediaSrcSet(
  key: string | null | undefined,
  sizes: MediaVariantSize[] = [160, 320, 640]
): string {
  if (!key || typeof key !== "string" || !key.trim()) return "";
  return sizes.map((s) => `${mediaUrl(key, s)} ${s}w`).join(", ");
}

/**
 * Validates a storage key pattern to strictly prevent path traversal or invalid characters.
 * Allowed: alphanumeric, hyphens, underscores, dots, and slashes. No ".." or double slashes.
 */
export function isValidMediaKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  if (key.includes("..") || key.includes("//") || key.includes("\\")) return false;
  return /^[a-zA-Z0-9_\-\.\/]+$/.test(key);
}
