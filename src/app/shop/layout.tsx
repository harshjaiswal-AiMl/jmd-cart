import React from "react";
import { ManagementShellServer } from "@/components/layout/management-shell-server";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ManagementShellServer>{children}</ManagementShellServer>;
}
