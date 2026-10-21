import React from "react";
import { ManagementShellServer } from "@/components/layout/management-shell-server";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ManagementShellServer>{children}</ManagementShellServer>;
}
