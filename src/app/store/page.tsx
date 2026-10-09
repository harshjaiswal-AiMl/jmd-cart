import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import Link from "next/link";

export default async function StorePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { party: true },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-blue-600 tracking-tight">JMD CART</span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
              Saharsa Storefront
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="text-right hidden sm:block">
              <div className="font-semibold text-slate-900">{user?.name}</div>
              <div className="text-xs text-slate-500 font-mono">{user?.phone}</div>
            </div>
            <Link
              href="/api/auth/signout"
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Log out
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Verification Status Banner if pending */}
        {!user?.phoneVerifiedAt && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-600 text-xl font-bold">ℹ️</span>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Phone Verification Pending</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                {user?.verificationMode === "admin"
                  ? "Your account is active for ordering! Our Saharsa dispatch team will confirm your shop address on your first delivery call."
                  : "Please verify your mobile number to enjoy express delivery."}
              </p>
            </div>
          </div>
        )}

        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 md:p-8 text-white shadow-sm">
          <h1 className="text-2xl md:text-3xl font-extrabold">Welcome, {user?.name}!</h1>
          <p className="mt-2 text-blue-100 text-sm max-w-xl">
            Order FMCG products directly from JMD Cart Distributors in Saharsa. Live dynamic slab pricing, town delivery, and order tracking coming up!
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="bg-white/10 px-3 py-1 rounded-full border border-white/20">
              Role: {user?.role}
            </span>
            <span className="bg-white/10 px-3 py-1 rounded-full border border-white/20">
              Status: {user?.phoneVerifiedAt ? "✓ Phone Verified" : "Pending First Call"}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
