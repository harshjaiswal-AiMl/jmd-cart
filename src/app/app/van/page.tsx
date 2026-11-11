import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { VanMobileHomeClient } from "./van-mobile-home-client";
import { VanLanguageProvider } from "@/lib/i18n/van-language-context";

export const dynamic = "force-dynamic";

export default async function VanAppPage() {
  const session = await auth();

  // Find assigned van
  const van = await prisma.location.findFirst({
    where: {
      type: "VAN",
      active: true,
      ...(session?.user?.id ? { assignedUserId: session.user.id } : {}),
    },
    include: {
      vanDays: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const activeVanDay = van?.vanDays?.[0] || null;

  return (
    <VanLanguageProvider>
      <div data-app="van" className="van-hindi-shell text-base">
        <VanMobileHomeClient
      van={van ? { id: van.id, name: van.name } : null}
      activeVanDay={
        activeVanDay
          ? { id: activeVanDay.id, issueSheetNo: activeVanDay.issueSheetNo }
          : null
      }
        />
      </div>
    </VanLanguageProvider>
  );
}
