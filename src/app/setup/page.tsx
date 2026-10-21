import { redirect } from "next/navigation";
import { setupService } from "@/modules/auth/setup.service";
import { SetupClient } from "./setup-client";
import { validateSetupToken } from "./setup-guard";

export const dynamic = "force-dynamic";

interface SetupPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function FirstRunSetupPage({ searchParams }: SetupPageProps) {
  const setupRequired = await setupService.isSetupRequired();

  // Once a Super Admin exists, the first-run setup screen is permanently unreachable
  if (!setupRequired) {
    redirect("/login");
  }

  const check = validateSetupToken(
    searchParams?.token,
    process.env.SETUP_TOKEN,
    process.env.NODE_ENV
  );

  // If token is required but missing or invalid, show the Unlock Setup form
  if (!check.allowed) {
    const rawToken = Array.isArray(searchParams?.token)
      ? searchParams?.token[0]
      : searchParams?.token;
    const hasAttempted = typeof rawToken === "string" && rawToken.length > 0;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FEFDF7] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-[#EAD9CC]">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/jmd-cart-logo.png"
              alt="JMD Cart"
              className="h-16 w-16 mx-auto object-contain mb-2"
            />
            <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#FFF1D6] text-[#790E11] border border-[#FDAF18]/50">
              Security Token Required
            </span>
            <h1 className="mt-2 text-2xl font-black text-[#790E11] tracking-tight">
              Unlock First-Run Setup
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              To initialize the system and create the Owner account, enter the <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[#790E11]">SETUP_TOKEN</code> from your <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">.env.deploy</code> file.
            </p>
          </div>

          <form action="/setup" method="GET" className="space-y-4">
            <div>
              <label
                htmlFor="token"
                className="block text-xs font-bold text-[#2A1010] uppercase tracking-wider mb-1"
              >
                Setup Token
              </label>
              <input
                id="token"
                name="token"
                type="text"
                required
                autoFocus
                placeholder="Enter SETUP_TOKEN..."
                className="w-full px-3 py-2 border border-[#EAD9CC] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#790E11] focus:border-[#790E11] font-mono text-xs"
              />
            </div>

            {hasAttempted && (
              <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-xs text-red-600 font-medium">
                The setup token you entered is invalid. Please check your <code className="font-mono">.env.deploy</code> file.
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#790E11] hover:bg-[#5E0A0D] text-white font-bold text-sm rounded-xl shadow-md transition-colors cursor-pointer"
            >
              Verify & Continue to Setup →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FEFDF7] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-[#EAD9CC]">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/jmd-cart-logo.png"
            alt="JMD Cart"
            className="h-16 w-16 mx-auto object-contain mb-2"
          />
          <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#FFF1D6] text-[#790E11] border border-[#FDAF18]/50">
            First-Run System Setup
          </span>
          <h1 className="mt-2 text-2xl font-black text-[#790E11] tracking-tight">
            Welcome to JMD Cart IDMS
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Create the Owner (Super Admin) account and enter your business details to initialize the system.
          </p>
        </div>

        <SetupClient />
      </div>
    </div>
  );
}
