import { NextRequest, NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";
import { isValidMediaKey } from "@/lib/media";
import fs from "node:fs/promises";
import path from "node:path";

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
