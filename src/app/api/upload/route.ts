import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import crypto from "node:crypto";
import { getStorage } from "@/lib/storage";
import { mediaUrl } from "@/lib/media";

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DIMENSION = 8000;

// In-memory rate limiting per user: max 30 uploads per 60 seconds
const uploadRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = uploadRateLimit.get(userId);
  if (!entry || now > entry.resetAt) {
    uploadRateLimit.set(userId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 30) {
    return false;
  }
  entry.count++;
  return true;
}

import { detectImageType, imageTypeToExt } from "@/lib/storage/image-validation";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "GODOWN") {
      return NextResponse.json(
        { error: "Forbidden: insufficient permissions to upload media" },
        { status: 403 }
      );
    }

    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: "Too many uploads. Please wait a moment before uploading again." },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 1. Validate magic bytes
    const detectedType = detectImageType(buffer);
    if (!detectedType) {
      return NextResponse.json(
        {
          error:
            "Invalid file format. Only JPEG, PNG, WebP, and GIF images are accepted. SVG and scriptable formats are strictly blocked for security.",
        },
        { status: 400 }
      );
    }

    const storage = getStorage();
    const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);

    const ext = imageTypeToExt(detectedType);
    const mime = `image/${detectedType === "jpeg" ? "jpeg" : detectedType}`;
    const primaryKey = `products/${hash}/original.${ext}`;
    await storage.put(primaryKey, buffer, {
      contentType: mime,
      cacheControl: "public, max-age=31536000, immutable",
    });
    const variants: string[] = [primaryKey];
    const publicUrl = mediaUrl(primaryKey);

    return NextResponse.json({
      success: true,
      key: primaryKey,
      url: publicUrl,
      variants,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
