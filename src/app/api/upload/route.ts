import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "node:fs/promises";
import path from "node:path";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "GODOWN") {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPG, PNG, WEBP, and SVG are supported." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10MB limit." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
    await fs.mkdir(uploadDir, { recursive: true });

    // Clean filename
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").toLowerCase();
    const extension = path.extname(originalName) || ".webp";
    const baseName = path.basename(originalName, extension);
    const uniqueFileName = `${Date.now()}_${baseName.slice(0, 30)}${extension}`;
    const destinationPath = path.join(uploadDir, uniqueFileName);

    await fs.writeFile(destinationPath, buffer);

    const publicUrl = `/uploads/products/${uniqueFileName}`;
    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: uniqueFileName,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
