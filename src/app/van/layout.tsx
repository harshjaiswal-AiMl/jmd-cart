import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ManagementShellServer } from "@/components/layout/management-shell-server";
import { VanBottomNav } from "./van-nav";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JMD Cart Management",
  description: "On-Van Billing, Distribution & Inventory System",
};

export default async function VanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const allowedRoles: UserRole[] = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALESPERSON,
    UserRole.GODOWN,
    UserRole.ACCOUNTS,
  ];

  if (!allowedRoles.includes(session.user.role)) {
    redirect("/login");
  }

  return (
    <ManagementShellServer>
      <div className="min-h-screen bg-[#FAF7F2] text-slate-900 pb-20 sm:pb-10">
        {children}
        <VanBottomNav />
      </div>
    </ManagementShellServer>
  );
}
