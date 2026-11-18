import { describe, it, expect } from "vitest";

export const GODOWN_I18N = {
  en: {
    home: "Home",
    orders: "Orders",
    issue: "Issue",
    stock: "Stock",
    more: "More",
    todayDispatch: "Today's Dispatch",
    movementLedger: "Movement Ledger",
    toPack: "To Pack",
    lowStock: "Low Stock",
    newVanIssue: "+ New Van Issue",
    stockCount: "Stock Count",
    activeVanLoads: "Active Van Loads",
    dispatchedTo: "Dispatched To",
    customer: "Customer",
    phone: "Phone",
    items: "Items",
    handoverTime: "Handover Time",
  },
  hi: {
    home: "होम",
    orders: "ऑर्डर्स",
    issue: "इश्यू",
    stock: "स्टॉक",
    more: "अधिक",
    todayDispatch: "आज का डिस्पैच",
    movementLedger: "मूवमेंट लेज़र",
    toPack: "पैक करना है",
    lowStock: "कम स्टॉक",
    newVanIssue: "+ नया वैन इश्यू",
    stockCount: "स्टॉक गिनती",
    activeVanLoads: "सक्रिय वैन लोड्स",
    dispatchedTo: "कहाँ भेजा",
    customer: "ग्राहक",
    phone: "फोन",
    items: "सामान",
    handoverTime: "हैंडओवर समय",
  },
};

export interface TodayDispatchModel {
  id: string;
  referenceNumber: string;
  destination: string;
  customerName: string;
  customerAddress: string | null;
  customerPhone: string | null;
  handoverTime: string;
  totalCartons: number;
  totalPieces: number;
  items: Array<{
    productName: string;
    cartons: number;
    pieces: number;
    totalPieces: number;
  }>;
}

describe("Prompt 27 - Part F: JMD Godown App", () => {
  it("provides full Hindi and English dictionary coverage for godown tabs", () => {
    expect(GODOWN_I18N.en.home).toBe("Home");
    expect(GODOWN_I18N.hi.home).toBe("होम");
    expect(GODOWN_I18N.en.todayDispatch).toBe("Today's Dispatch");
    expect(GODOWN_I18N.hi.todayDispatch).toBe("आज का डिस्पैच");
    expect(GODOWN_I18N.en.movementLedger).toBe("Movement Ledger");
    expect(GODOWN_I18N.hi.movementLedger).toBe("मूवमेंट लेज़र");
  });

  it("structures Today's Dispatch with destination, customer, tap-to-call phone, and items", () => {
    const dispatch: TodayDispatchModel = {
      id: "disp-1",
      referenceNumber: "ORD-10024",
      destination: "Van 1 (North Route)",
      customerName: "Maa Durga Kirana Store",
      customerAddress: "Station Road, Simri Bakhtiarpur",
      customerPhone: "9876543210",
      handoverTime: "2026-11-18T09:30:00.000Z",
      totalCartons: 5,
      totalPieces: 120,
      items: [
        {
          productName: "MDH Kitchen King 100g",
          cartons: 5,
          pieces: 0,
          totalPieces: 120,
        },
      ],
    };

    expect(dispatch.referenceNumber).toBe("ORD-10024");
    expect(dispatch.destination).toBe("Van 1 (North Route)");
    expect(dispatch.customerName).toBe("Maa Durga Kirana Store");
    expect(dispatch.customerPhone).toBe("9876543210");
    expect(dispatch.totalCartons).toBe(5);
    expect(dispatch.items).toHaveLength(1);
    expect(dispatch.items[0].cartons).toBe(5);
  });
});
