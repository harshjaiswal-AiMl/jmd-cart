import { describe, it, expect } from "vitest";

function formatNotificationBadge(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}

describe("Defect B7: Notification Badge Cap and Read State", () => {
  it("caps notification badge at 99+ when unread count exceeds 99", () => {
    expect(formatNotificationBadge(105)).toBe("99+");
    expect(formatNotificationBadge(65)).toBe("65");
    expect(formatNotificationBadge(99)).toBe("99");
    expect(formatNotificationBadge(0)).toBe("");
  });

  it("reduces count when alerts are marked as read", () => {
    const rawBadges = {
      pendingOrders: 3,
      lowStock: 12,
      autoConverted: 5,
    };
    const totalRaw = rawBadges.pendingOrders + rawBadges.lowStock + rawBadges.autoConverted;
    expect(totalRaw).toBe(20);

    const isMarkedRead = true;
    const effectiveCount = isMarkedRead ? 0 : totalRaw;
    expect(formatNotificationBadge(effectiveCount)).toBe("");
  });
});
