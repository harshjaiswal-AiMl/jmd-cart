import { setupService } from "@/modules/auth/setup.service";
import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string; setup?: string };
}) {
  const setupRequired = await setupService.isSetupRequired();

  return (
    <LoginClient
      callbackUrl={searchParams?.callbackUrl || "/"}
      setupRequired={setupRequired}
      setupComplete={searchParams?.setup === "complete"}
    />
  );
}
