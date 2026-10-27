import React from "react";
import type { Metadata } from "next";
import { ManagementShellServer } from "@/components/layout/management-shell-server";

export const metadata: Metadata = {
  title: "JMD Cart Management",
};

export default function GodownLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ManagementShellServer>{children}</ManagementShellServer>;
}
