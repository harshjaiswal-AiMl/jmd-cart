import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { RoleAppShell } from "./role-app-shell";

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
    <RoleAppShell user={session.user}>
      {children}
    </RoleAppShell>
  );
}
