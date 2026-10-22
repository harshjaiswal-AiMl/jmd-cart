/**
 * Image format detection and validation via magic bytes.
 * Strictly blocks SVGs, HTML, executables, and scriptable formats.
 */

export type AllowedImageType = "jpeg" | "png" | "webp" | "gif";
export type AllowedMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export function isSvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 1024).toString("utf8").toLowerCase();
  return (
    head.includes("<svg") ||
    head.includes("xmlns=\"http://www.w3.org/2000/svg\"") ||
    head.includes("xmlns='http://www.w3.org/2000/svg'") ||
    (head.includes("<?xml") && head.includes("<svg"))
  );
}

export function detectImageType(buffer: Buffer): AllowedImageType | null {
  if (buffer.length < 12) return null;

  // Strict check: if it looks like an SVG or XML/HTML, reject immediately
  if (isSvg(buffer)) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }

  // GIF: GIF87a or GIF89a
  const gifHeader = buffer.toString("ascii", 0, 6);
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return "gif";
  }

  return null;
}

export function detectImageMimeType(buffer: Buffer): AllowedMimeType | null {
  const type = detectImageType(buffer);
  if (!type) return null;
  switch (type) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
  }
}

export function imageTypeToExt(type: AllowedImageType): string {
  switch (type) {
    case "jpeg":
      return "jpg";
    case "png":
      return "png";
    case "webp":
      return "webp";
    case "gif":
      return "gif";
  }
}
