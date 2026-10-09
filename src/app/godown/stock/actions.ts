"use server";

import { auth } from "@/auth";
import { stockService } from "@/modules/stock/stock.service";
import { StockFilterOptions } from "@/modules/stock/stock.types";

export async function getStockBalancesAction(filters: StockFilterOptions = {}) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return stockService.listStockBalances(session.user.role, filters);
}

export async function getStockKPIsAction() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return stockService.getStockKPIs(session.user.role);
}
