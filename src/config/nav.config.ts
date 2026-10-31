import { UserRole } from "@prisma/client";

export interface NavItem {
  id: string;
  group: NavGroupName;
  label: string;
  icon: string;
  href: string;
  roles: UserRole[];
  badgeKey?: "pendingOrders" | "lowStock" | "autoConverted";
  readOnlyForRoles?: UserRole[];
}

export type NavGroupName =
  | "Dashboard"
  | "Sales"
  | "Orders & Dispatch"
  | "Inventory"
  | "Catalog"
  | "Parties"
  | "Accounts & Reports"
  | "Settings & People";

export interface NavGroup {
  name: NavGroupName;
  icon: string;
  items: NavItem[];
}

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];
const WAREHOUSE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.WAREHOUSE_MANAGER,
];
const GODOWN_AND_ADMIN: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.WAREHOUSE_MANAGER,
  UserRole.GODOWN,
];

export const NAV_ITEMS: NavItem[] = [
  // 1. Dashboard (Admin, Accounts, Godown)
  {
    id: "dash-owner",
    group: "Dashboard",
    label: "Owner Overview",
    icon: "LayoutDashboard",
    href: "/admin",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "dash-godown",
    group: "Dashboard",
    label: "Godown Overview",
    icon: "Warehouse",
    href: "/godown",
    roles: [...GODOWN_AND_ADMIN],
  },

  // 2. Sales (Shop, Salesperson, Admin, Accounts)
  {
    id: "sales-pos",
    group: "Sales",
    label: "Shop Billing (POS)",
    icon: "Receipt",
    href: "/shop/pos",
    roles: [...ADMIN_ROLES, UserRole.SHOP],
  },
  {
    id: "sales-invoices",
    group: "Sales",
    label: "Invoices",
    icon: "FileText",
    href: "/shop/invoices",
    roles: [...ADMIN_ROLES, UserRole.WAREHOUSE_MANAGER, UserRole.SHOP, UserRole.ACCOUNTS],
  },
  {
    id: "sales-online-orders",
    group: "Sales",
    label: "Online Orders",
    icon: "ShoppingBag",
    href: "/admin/orders",
    roles: [...ADMIN_ROLES, UserRole.SHOP],
    badgeKey: "pendingOrders",
  },
  {
    id: "sales-van-home",
    group: "Sales",
    label: "Van Operations Portal",
    icon: "Truck",
    href: "/van",
    roles: [UserRole.SALESPERSON],
  },
  {
    id: "sales-van-billing",
    group: "Sales",
    label: "Van Billing",
    icon: "Receipt",
    href: "/van/billing",
    roles: [UserRole.SALESPERSON],
  },
  {
    id: "sales-van",
    group: "Sales",
    label: "Van Bills & Invoices",
    icon: "Truck",
    href: "/van/bills",
    roles: [...ADMIN_ROLES, UserRole.SALESPERSON],
  },
  {
    id: "sales-van-cash",
    group: "Sales",
    label: "Van Cash Collections",
    icon: "Banknote",
    href: "/van/collections",
    roles: [...ADMIN_ROLES, UserRole.SALESPERSON],
  },
  {
    id: "sales-van-reconcile",
    group: "Sales",
    label: "Van Reconciliation",
    icon: "CheckCircle2",
    href: "/van/reconciliation",
    roles: [...ADMIN_ROLES, UserRole.SALESPERSON],
  },
  {
    id: "sales-my-incentives",
    group: "Sales",
    label: "My Incentives",
    icon: "Award",
    href: "/shop/my-incentives",
    roles: [UserRole.SHOP, UserRole.SALESPERSON, UserRole.DELIVERY, ...ADMIN_ROLES],
  },

  // 3. Orders & Dispatch
  {
    id: "dispatch-board",
    group: "Orders & Dispatch",
    label: "Dispatch Board",
    icon: "Truck",
    href: "/godown/dispatch",
    roles: [...GODOWN_AND_ADMIN],
  },
  {
    id: "dispatch-create-order",
    group: "Orders & Dispatch",
    label: "+ Create Order",
    icon: "PackageOpen",
    href: "/godown/dispatch/new-order",
    roles: [...WAREHOUSE_ROLES],
  },
  {
    id: "del-orders",
    group: "Orders & Dispatch",
    label: "Delivery Orders",
    icon: "MapPin",
    href: "/delivery",
    roles: [...ADMIN_ROLES, UserRole.DELIVERY],
  },
  {
    id: "del-zones",
    group: "Orders & Dispatch",
    label: "Delivery Zones",
    icon: "Map",
    href: "/admin/crud/delivery_zones",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "del-rules",
    group: "Orders & Dispatch",
    label: "Delivery Charge Rules",
    icon: "Calculator",
    href: "/admin/crud/delivery_charge_rules",
    roles: [...ADMIN_ROLES],
  },

  // 4. Inventory
  {
    id: "inv-overview",
    group: "Inventory",
    label: "Stock Overview",
    icon: "Boxes",
    href: "/godown/stock",
    roles: [...GODOWN_AND_ADMIN, UserRole.SHOP],
  },
  {
    id: "inv-opening-stock",
    group: "Inventory",
    label: "Opening Stock (18-Oct)",
    icon: "PackageCheck",
    href: "/admin/inventory/opening-stock",
    roles: [...ADMIN_ROLES, UserRole.GODOWN],
  },
  {
    id: "inv-item-statement",
    group: "Inventory",
    label: "Item Stock Statement",
    icon: "FileSpreadsheet",
    href: "/admin/reports/item-statement",
    roles: [...ADMIN_ROLES, UserRole.GODOWN, UserRole.ACCOUNTS],
  },
  {
    id: "inv-update",
    group: "Inventory",
    label: "Update Stock & Excel",
    icon: "FileSpreadsheet",
    href: "/godown/stock/update",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "inv-operations",
    group: "Inventory",
    label: "Operations & Transfers",
    icon: "ArrowLeftRight",
    href: "/godown/operations",
    roles: [...GODOWN_AND_ADMIN],
    badgeKey: "autoConverted",
  },
  {
    id: "inv-movements",
    group: "Inventory",
    label: "Stock Movements",
    icon: "History",
    href: "/admin/stock",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "inv-purchases",
    group: "Inventory",
    label: "Purchases / GRN",
    icon: "ClipboardCheck",
    href: "/godown/purchases",
    roles: [...GODOWN_AND_ADMIN],
  },
  {
    id: "inv-receive-goods",
    group: "Inventory",
    label: "Receive Goods (Scan Bill)",
    icon: "FileUp",
    href: "/godown/receive-goods",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "van-issues",
    group: "Inventory",
    label: "Van Morning & Return",
    icon: "Sun",
    href: "/godown/van-issues",
    roles: [...GODOWN_AND_ADMIN],
  },

  // 5. Catalog
  {
    id: "cat-products",
    group: "Catalog",
    label: "Products",
    icon: "Package",
    href: "/admin/catalog",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "cat-companies",
    group: "Catalog",
    label: "Brands / Companies",
    icon: "Building2",
    href: "/admin/crud/companies",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "cat-categories",
    group: "Catalog",
    label: "Categories",
    icon: "Tags",
    href: "/admin/crud/categories",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "cat-price-lists",
    group: "Catalog",
    label: "Price Lists (A/B/C)",
    icon: "IndianRupee",
    href: "/admin/catalog/price-lists",
    roles: [...WAREHOUSE_ROLES],
  },
  {
    id: "cat-price-slabs",
    group: "Catalog",
    label: "Price Slabs",
    icon: "Layers",
    href: "/admin/pricing",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "cat-import",
    group: "Catalog",
    label: "Import Products & Prices",
    icon: "Upload",
    href: "/admin/catalog/import",
    roles: [...WAREHOUSE_ROLES],
  },
  {
    id: "cat-banners",
    group: "Catalog",
    label: "Storefront Banners",
    icon: "Layers",
    href: "/admin/banners",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "cat-diwali",
    group: "Catalog",
    label: "Diwali Store Showcase",
    icon: "Sparkles",
    href: "/admin/diwali",
    roles: [...ADMIN_ROLES],
  },

  // 6. Parties
  {
    id: "party-all",
    group: "Parties",
    label: "Customers & Retailers",
    icon: "Users",
    href: "/admin/parties",
    roles: [...ADMIN_ROLES, UserRole.SHOP, UserRole.ACCOUNTS],
  },
  {
    id: "party-suppliers",
    group: "Parties",
    label: "Suppliers",
    icon: "Factory",
    href: "/admin/parties?type=SUPPLIER",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "party-credit",
    group: "Parties",
    label: "Credit & Limits",
    icon: "CreditCard",
    href: "/admin/crud/parties",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "party-import",
    group: "Parties",
    label: "Party Import",
    icon: "FileUp",
    href: "/admin/parties/import",
    roles: [...ADMIN_ROLES],
  },

  // 7. Accounts & Reports
  {
    id: "acc-receipts",
    group: "Accounts & Reports",
    label: "Receipts & Payments",
    icon: "ArrowDownLeft",
    href: "/admin/crud/receipts",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "acc-payments",
    group: "Accounts & Reports",
    label: "Payments",
    icon: "ArrowUpRight",
    href: "/admin/crud/payments",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "acc-ledger",
    group: "Accounts & Reports",
    label: "Party Ledger",
    icon: "BookOpen",
    href: "/admin/parties",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "acc-reports",
    group: "Accounts & Reports",
    label: "Reports & Day Book",
    icon: "Calendar",
    href: "/reports?tab=daybook",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "acc-outstanding",
    group: "Accounts & Reports",
    label: "Outstanding Balances",
    icon: "Clock",
    href: "/reports?tab=outstanding",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "acc-gst",
    group: "Accounts & Reports",
    label: "GST & Tally Export",
    icon: "Download",
    href: "/reports?tab=gst",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "rep-sales",
    group: "Accounts & Reports",
    label: "Sales Analytics",
    icon: "BarChart3",
    href: "/reports?tab=sales",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "rep-agent-sales",
    group: "Accounts & Reports",
    label: "Agent Sales (Incentives)",
    icon: "Award",
    href: "/admin/reports/agent-sales",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "rep-returns",
    group: "Accounts & Reports",
    label: "Returns & Debit Notes",
    icon: "RotateCcw",
    href: "/godown/returns",
    roles: [...ADMIN_ROLES],
  },

  // 8. Settings & People
  {
    id: "people-users",
    group: "Settings & People",
    label: "Staff & Users",
    icon: "UserCog",
    href: "/admin/crud/users",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "people-incentives-dash",
    group: "Settings & People",
    label: "Incentives Dashboard",
    icon: "Award",
    href: "/admin/incentives",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "people-incentives-rules",
    group: "Settings & People",
    label: "Incentive Rules",
    icon: "Percent",
    href: "/admin/incentives/rules",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-crud-hub",
    group: "Settings & People",
    label: "Master Data Hub",
    icon: "Database",
    href: "/admin/crud",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-business",
    group: "Settings & People",
    label: "Business Settings",
    icon: "Building2",
    href: "/admin/settings?tab=business",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-invoice",
    group: "Settings & People",
    label: "Invoice Settings",
    icon: "FileCheck",
    href: "/admin/settings?tab=invoice",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-discounts",
    group: "Settings & People",
    label: "Discount Limits",
    icon: "Percent",
    href: "/admin/crud/discount_limits",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-locations",
    group: "Settings & People",
    label: "Locations",
    icon: "MapPin",
    href: "/admin/crud/locations",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-storefront",
    group: "Settings & People",
    label: "Storefront Settings",
    icon: "Globe",
    href: "/admin/crud/storefront_settings",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-audit",
    group: "Settings & People",
    label: "Audit Log",
    icon: "ShieldCheck",
    href: "/admin/crud/audit_logs",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-backup",
    group: "Settings & People",
    label: "Backup & Export",
    icon: "HardDriveDownload",
    href: "/admin/settings?tab=backup",
    roles: [...ADMIN_ROLES],
  },
];

export const NAV_GROUP_ORDER: Array<{ name: NavGroupName; icon: string }> = [
  { name: "Dashboard", icon: "LayoutDashboard" },
  { name: "Sales", icon: "Receipt" },
  { name: "Orders & Dispatch", icon: "Truck" },
  { name: "Inventory", icon: "Boxes" },
  { name: "Catalog", icon: "Package" },
  { name: "Parties", icon: "Users" },
  { name: "Accounts & Reports", icon: "Wallet" },
  { name: "Settings & People", icon: "Settings" },
];

/**
 * Returns the grouped navigation items visible to a given UserRole.
 * For SUPER_ADMIN and ADMIN, every group and every item is visible.
 * For non-admin roles, each role sees at most 6 focused operational items.
 */
export function getNavGroupsForRole(role: UserRole | string): NavGroup[] {
  const isSuperOrAdmin =
    role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;

  return NAV_GROUP_ORDER.map((grp) => {
    const items = NAV_ITEMS.filter(
      (item) =>
        item.group === grp.name &&
        (isSuperOrAdmin || item.roles.includes(role as UserRole))
    );
    return {
      name: grp.name,
      icon: grp.icon,
      items,
    };
  }).filter((grp) => grp.items.length > 0);
}

/**
 * Checks whether a role is allowed to access a given pathname based on nav.config.ts.
 */
export function canRoleAccessNavHref(
  role: UserRole | string,
  pathname: string
): boolean {
  if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
    return true;
  }

  const cleanPath = pathname.split("?")[0];
  const matchingItems = NAV_ITEMS.filter(
    (item) => item.href.split("?")[0] === cleanPath
  );

  if (matchingItems.length === 0) {
    return true;
  }

  return matchingItems.some((item) => item.roles.includes(role as UserRole));
}
