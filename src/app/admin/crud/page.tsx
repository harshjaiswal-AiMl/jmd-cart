import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CRUD_ENTITY_LIST } from "@/modules/crud/crud.registry";

export const dynamic = "force-dynamic";

export default async function AdminCrudHubPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.ADMIN
  ) {
    redirect("/login");
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Master Data &amp; System CRUD Registry
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Create, read, update, archive, restore, or void any entity across JMD Cart with full audit logging and accounting protection.
          </p>
        </div>
        <Link
          href="/admin"
          className="bg-[#790E11] hover:bg-[#5f0b0d] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
        >
          ← Owner Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CRUD_ENTITY_LIST.map((entity) => (
          <Link
            key={entity.key}
            href={`/admin/crud/${entity.key}`}
            className="bg-white rounded-2xl border border-gray-200 hover:border-[#FC830D] p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between gap-3"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-50 text-[#790E11] border border-orange-200">
                  {entity.group}
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  {entity.deletePolicy}
                </span>
              </div>
              <h2 className="text-base font-bold text-gray-900">
                {entity.title}
              </h2>
              <p className="text-xs text-gray-600 line-clamp-2">
                {entity.description}
              </p>
            </div>
            <div className="text-xs font-bold text-[#FC830D] flex items-center justify-between pt-2 border-t border-gray-100">
              <span>Manage {entity.title}</span>
              <span>→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
