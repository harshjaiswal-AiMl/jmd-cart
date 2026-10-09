import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDMS - Distribution Management System",
  description: "Distribution Management System for FMCG",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-subtle text-content antialiased">
        {children}
      </body>
    </html>
  );
}
