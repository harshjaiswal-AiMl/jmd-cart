import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";
import { isValidMediaKey } from "@/lib/media";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  try {
    const rawKey = params.key ? params.key.join("/") : "";
    if (!rawKey || !isValidMediaKey(rawKey)) {
      return new NextResponse("Invalid media key", { status: 400 });
    }

    const storage = getStorage();
    let obj = await storage.get(rawKey);

    // If requested WebP variant (e.g. products/<hash>/320.webp) is missing from storage,
    // on-the-fly dynamically generate from the original image and persist it for future hits.
    if (!obj && rawKey.startsWith("products/") && rawKey.endsWith(".webp")) {
      const parts = rawKey.split("/");
      if (parts.length === 3) {
        const hash = parts[1];
        const requestedSizeStr = parts[2].replace(".webp", "");
        const requestedSize = parseInt(requestedSizeStr, 10);
        if (!isNaN(requestedSize) && [160, 320, 400, 640, 800, 1080, 1200].includes(requestedSize)) {
          const candidateKeys = [
            `products/${hash}/original.jpg`,
            `products/${hash}/original.jpeg`,
            `products/${hash}/original.png`,
            `products/${hash}/original.webp`,
          ];
          for (const cand of candidateKeys) {
            const originalObj = await storage.get(cand);
            if (originalObj) {
              const quality =
                requestedSize <= 160 ? 75 : requestedSize <= 320 ? 80 : requestedSize <= 640 ? 82 : 85;
              const resizedBuffer = await sharp(Buffer.from(originalObj.body))
                .resize({
                  width: requestedSize,
                  height: requestedSize,
                  fit: "inside",
                  withoutEnlargement: true,
                })
                .webp({ quality, effort: 4 })
                .toBuffer();

              // Save into storage asynchronously so next request is an instant CDN hit
              storage
                .put(rawKey, resizedBuffer, {
                  contentType: "image/webp",
                  cacheControl: "public, max-age=31536000, immutable",
                })
                .catch(() => {});

              obj = {
                body: resizedBuffer,
                contentType: "image/webp",
                contentLength: resizedBuffer.length,
              };
              break;
            }
          }
        }
      }
    }

    // Legacy fallback check on local filesystem if not in storage
    if (!obj && rawKey.startsWith("uploads/")) {
      try {
        const localPath = path.join(process.cwd(), "public", rawKey);
        const data = await fs.readFile(localPath);
        const ext = path.extname(rawKey).toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        else if (ext === ".png") contentType = "image/png";
        else if (ext === ".webp") contentType = "image/webp";
        else if (ext === ".gif") contentType = "image/gif";

        obj = {
          body: data,
          contentType,
          contentLength: data.length,
        };
      } catch {
        // Not on local filesystem either
      }
    }

    if (!obj) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", obj.contentType);
    headers.set("Content-Length", obj.contentLength.toString());
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    if (obj.etag) {
      headers.set("ETag", obj.etag);
    }

    // Check If-None-Match for 304 Not Modified
    const clientEtag = req.headers.get("if-none-match");
    if (clientEtag && obj.etag && clientEtag === obj.etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    return new NextResponse(new Uint8Array(obj.body), {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Media stream error";
    return new NextResponse(msg, { status: 500 });
  }
}
