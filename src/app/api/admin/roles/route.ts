import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { Permission } from "@/modules/auth/permissions";
import {
  getRoleMatrixSnapshot,
  toggleRolePermission,
} from "@/modules/auth/role-matrix.service";

const toggleSchema = z.object({
  targetRole: z.nativeEnum(UserRole),
  permission: z.nativeEnum(Permission),
  enabled: z.boolean(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshot = await getRoleMatrixSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actorRole = session.user.role as UserRole;
  if (actorRole !== UserRole.SUPER_ADMIN) {
    return NextResponse.json(
      { error: "Only Super Admin can modify role permissions" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await toggleRolePermission({
      actorId: session.user.id,
      actorRole,
      targetRole: parsed.data.targetRole,
      permission: parsed.data.permission,
      enabled: parsed.data.enabled,
      ip: req.headers.get("x-forwarded-for") || null,
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/roles");
    revalidatePath("/shop/pos");
    revalidatePath("/shop/invoices");

    return NextResponse.json(result);
  } catch (err: any) {
    const status = err?.statusCode === 403 ? 403 : err?.statusCode === 400 ? 400 : 500;
    return NextResponse.json(
      { error: err?.message || "Failed to update role permission" },
      { status }
    );
  }
}
