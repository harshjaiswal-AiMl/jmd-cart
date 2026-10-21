"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { crudService } from "@/modules/crud/crud.service";
import { CrudEntityKey } from "@/modules/crud/crud.registry";

export async function crudCreateAction(
  entity: CrudEntityKey,
  data: Record<string, unknown>
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const record = await crudService.createRecord(
      session.user.role,
      session.user.id,
      entity,
      data
    );

    revalidatePath(`/admin/crud/${entity}`);
    revalidatePath("/admin/crud");
    revalidatePath("/admin/catalog");
    revalidatePath("/admin/parties");
    revalidatePath("/admin");

    return { success: true, record };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create record",
    };
  }
}

export async function crudUpdateAction(
  entity: CrudEntityKey,
  id: string,
  data: Record<string, unknown>
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const record = await crudService.updateRecord(
      session.user.role,
      session.user.id,
      entity,
      id,
      data
    );

    revalidatePath(`/admin/crud/${entity}`);
    revalidatePath("/admin/crud");
    revalidatePath("/admin/catalog");
    revalidatePath("/admin/parties");
    revalidatePath("/admin");

    return { success: true, record };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update record",
    };
  }
}

export async function crudDeleteOrArchiveAction(
  entity: CrudEntityKey,
  id: string,
  reason?: string
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const res = await crudService.deleteOrArchiveRecord(
      session.user.role,
      session.user.id,
      entity,
      id,
      reason
    );

    revalidatePath(`/admin/crud/${entity}`);
    revalidatePath("/admin/crud");
    revalidatePath("/admin/catalog");
    revalidatePath("/admin/parties");
    revalidatePath("/admin");

    return { success: true, ...res };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to delete/archive record",
    };
  }
}

export async function crudRestoreAction(entity: CrudEntityKey, id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    await crudService.restoreRecord(
      session.user.role,
      session.user.id,
      entity,
      id
    );

    revalidatePath(`/admin/crud/${entity}`);
    revalidatePath("/admin/crud");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to restore record",
    };
  }
}
