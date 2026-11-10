import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { RoleAppShell } from "./role-app-shell";
import { VanLanguageProvider } from "@/lib/i18n/van-language-context";

export const metadata = {
  title: "JMD Cart Staff App",
  description: "Mobile-first operational app for JMD Cart",
};

export default async function RoleAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <VanLanguageProvider>
      <RoleAppShell user={session.user}>
        {children}
      </RoleAppShell>
    </VanLanguageProvider>
  );
}
