import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CRUD_ENTITIES, CrudEntityKey } from "@/modules/crud/crud.registry";
import { crudService } from "@/modules/crud/crud.service";
import { CrudDataTable } from "@/components/crud/crud-data-table";

export const dynamic = "force-dynamic";

export default async function AdminCrudEntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string }>;
  searchParams?: Promise<{
    q?: string;
    archived?: string;
    filterRole?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { entity } = await params;
  const sp = await searchParams;

  const entityKey = entity as CrudEntityKey;
  const config = CRUD_ENTITIES[entityKey];
  if (!config) {
    notFound();
  }

  const userRole = session.user.role;
  const isSuperOrAdmin =
    userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN;

  if (!isSuperOrAdmin && !config.readRoles.includes(userRole)) {
    redirect("/login");
  }

  const canWrite = isSuperOrAdmin || config.writeRoles.includes(userRole);
  const includeArchived = sp?.archived === "1" || sp?.archived === "true";

  const records = await crudService.listRecords(userRole, entityKey, {
    search: sp?.q,
    includeArchived: true,
    filterRole: sp?.filterRole,
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-50 text-[#790E11] border border-orange-200">
              {config.group}
            </span>
            {!canWrite && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-gray-200 text-gray-800">
                Read-Only ({userRole})
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {config.title}
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">{config.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperOrAdmin && (
            <Link
              href="/admin/crud"
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-bold px-3.5 py-2.5 rounded-xl transition"
            >
              ← All CRUD Entities
            </Link>
          )}
        </div>
      </div>

      <CrudDataTable
        config={config}
        initialRecords={records}
        canWrite={canWrite}
        initialShowArchived={includeArchived}
      />
    </div>
  );
}
