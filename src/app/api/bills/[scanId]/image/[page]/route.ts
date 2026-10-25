import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import { receivingService } from "@/modules/ocr/receiving.service";

export async function GET(
  req: NextRequest,
  { params }: { params: { scanId: string; page: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(session.user.role, Permission.STOCK_VIEW)) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const pageIdx = parseInt(params.page, 10) - 1 || 0;

  try {
    const { stream, contentType } = await receivingService.getBillImageStream(
      session.user.role,
      params.scanId,
      pageIdx
    );

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    headers.set("X-Content-Type-Options", "nosniff");

    if (Buffer.isBuffer(stream)) {
      return new NextResponse(new Uint8Array(stream), { headers });
    }

    return new NextResponse(stream as any, { headers });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || "Image not found" },
      { status: 404 }
    );
  }
}
