import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ManagementShellServer } from "@/components/layout/management-shell-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JMD Cart Management",
  description: "Order Delivery Execution & Payment Collection",
};

export default async function DeliveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.DELIVERY &&
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.ADMIN
  ) {
    redirect("/login");
  }

  return (
    <ManagementShellServer>
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
        {children}
      </div>
    </ManagementShellServer>
  );
}
