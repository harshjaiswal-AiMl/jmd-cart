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
  | "Inventory"
  | "Dispatch"
  | "Van"
  | "Catalog"
  | "Parties"
  | "Delivery"
  | "Accounts"
  | "Reports"
  | "Admin";

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
  // 1. Dashboard
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

  // 2. Sales
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
    id: "sales-van",
    group: "Sales",
    label: "Van Sales",
    icon: "Truck",
    href: "/van/bills",
    roles: [...ADMIN_ROLES, UserRole.SALESPERSON, UserRole.ACCOUNTS],
  },

  // 3. Inventory
  {
    id: "inv-overview",
    group: "Inventory",
    label: "Stock Overview",
    icon: "Boxes",
    href: "/godown/stock",
    roles: [...GODOWN_AND_ADMIN, UserRole.SHOP],
  },
  {
    id: "inv-update",
    group: "Inventory",
    label: "Update Stock & Excel Upload",
    icon: "FileSpreadsheet",
    href: "/godown/stock/update",
    roles: [...GODOWN_AND_ADMIN],
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
    roles: [...GODOWN_AND_ADMIN, UserRole.ACCOUNTS],
  },
  {
    id: "inv-purchases",
    group: "Inventory",
    label: "Purchases / GRN",
    icon: "ClipboardCheck",
    href: "/godown/purchases",
    roles: [...GODOWN_AND_ADMIN, UserRole.ACCOUNTS],
  },
  {
    id: "inv-receive-goods",
    group: "Inventory",
    label: "Receive Goods (Scan Bill)",
    icon: "FileUp",
    href: "/godown/receive-goods",
    roles: [...GODOWN_AND_ADMIN],
  },

  // 4. Dispatch
  {
    id: "dispatch-board",
    group: "Dispatch",
    label: "Dispatch Board",
    icon: "Truck",
    href: "/godown/dispatch",
    roles: [...GODOWN_AND_ADMIN],
  },
  {
    id: "dispatch-create-order",
    group: "Dispatch",
    label: "+ Create Order",
    icon: "PlusCircle",
    href: "/godown/dispatch/new-order",
    roles: [...WAREHOUSE_ROLES],
  },

  // 5. Van
  {
    id: "van-morning",
    group: "Van",
    label: "Morning Issue",
    icon: "Sun",
    href: "/godown/van-issues/new",
    roles: [...GODOWN_AND_ADMIN],
  },
  {
    id: "van-evening",
    group: "Van",
    label: "Evening Return",
    icon: "Sunset",
    href: "/godown/van-issues",
    roles: [...GODOWN_AND_ADMIN, UserRole.SALESPERSON],
  },
  {
    id: "van-reconcile",
    group: "Van",
    label: "Reconciliation",
    icon: "CheckCircle2",
    href: "/van/reconciliation",
    roles: [...GODOWN_AND_ADMIN, UserRole.SALESPERSON, UserRole.ACCOUNTS],
  },
  {
    id: "van-cash",
    group: "Van",
    label: "Van Cash",
    icon: "Banknote",
    href: "/van/collections",
    roles: [...ADMIN_ROLES, UserRole.SALESPERSON, UserRole.ACCOUNTS],
  },

  // 6. Catalog
  {
    id: "cat-products",
    group: "Catalog",
    label: "Products",
    icon: "Package",
    href: "/admin/catalog",
    roles: [...GODOWN_AND_ADMIN],
    readOnlyForRoles: [UserRole.GODOWN],
  },
  {
    id: "cat-companies",
    group: "Catalog",
    label: "Brands / Companies",
    icon: "Building2",
    href: "/admin/crud/companies",
    roles: [...GODOWN_AND_ADMIN],
    readOnlyForRoles: [UserRole.GODOWN],
  },
  {
    id: "cat-categories",
    group: "Catalog",
    label: "Categories",
    icon: "Tags",
    href: "/admin/crud/categories",
    roles: [...GODOWN_AND_ADMIN],
    readOnlyForRoles: [UserRole.GODOWN],
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

  // 6. Parties
  {
    id: "party-customers",
    group: "Parties",
    label: "Customers",
    icon: "Users",
    href: "/admin/parties?type=CUSTOMER",
    roles: [...ADMIN_ROLES, UserRole.SHOP, UserRole.ACCOUNTS],
  },
  {
    id: "party-retailers",
    group: "Parties",
    label: "Retailers (List B)",
    icon: "Store",
    href: "/admin/parties?type=RETAILER",
    roles: [...ADMIN_ROLES, UserRole.SHOP, UserRole.ACCOUNTS],
  },
  {
    id: "party-wholesalers",
    group: "Parties",
    label: "Wholesalers (List A)",
    icon: "Building",
    href: "/admin/parties?type=WHOLESALER",
    roles: [...ADMIN_ROLES, UserRole.SHOP, UserRole.ACCOUNTS],
  },
  {
    id: "party-suppliers",
    group: "Parties",
    label: "Suppliers",
    icon: "Factory",
    href: "/admin/parties?type=SUPPLIER",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "party-credit",
    group: "Parties",
    label: "Credit & Limits",
    icon: "CreditCard",
    href: "/admin/crud/parties",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "party-import",
    group: "Parties",
    label: "Party Import",
    icon: "FileUp",
    href: "/admin/parties/import",
    roles: [...ADMIN_ROLES],
  },

  // 7. Delivery
  {
    id: "del-orders",
    group: "Delivery",
    label: "Delivery Orders",
    icon: "MapPin",
    href: "/delivery",
    roles: [...ADMIN_ROLES, UserRole.DELIVERY],
  },
  {
    id: "del-zones",
    group: "Delivery",
    label: "Zones",
    icon: "Map",
    href: "/admin/crud/delivery_zones",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "del-rules",
    group: "Delivery",
    label: "Delivery Charge Rules",
    icon: "Calculator",
    href: "/admin/crud/delivery_charge_rules",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "del-staff",
    group: "Delivery",
    label: "Delivery Staff",
    icon: "Bike",
    href: "/admin/crud/users?filterRole=DELIVERY",
    roles: [...ADMIN_ROLES],
  },

  // 8. Accounts
  {
    id: "acc-receipts",
    group: "Accounts",
    label: "Receipts",
    icon: "ArrowDownLeft",
    href: "/admin/crud/receipts",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "acc-payments",
    group: "Accounts",
    label: "Payments",
    icon: "ArrowUpRight",
    href: "/admin/crud/payments",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "acc-ledger",
    group: "Accounts",
    label: "Party Ledger",
    icon: "BookOpen",
    href: "/admin/parties",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "acc-outstanding",
    group: "Accounts",
    label: "Outstanding",
    icon: "Clock",
    href: "/reports?tab=outstanding",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "acc-daybook",
    group: "Accounts",
    label: "Day Book",
    icon: "Calendar",
    href: "/reports?tab=daybook",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "acc-cashbook",
    group: "Accounts",
    label: "Cash Book",
    icon: "Wallet",
    href: "/reports?tab=cashbook",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "acc-gst",
    group: "Accounts",
    label: "GST Reports",
    icon: "FileSpreadsheet",
    href: "/reports?tab=gst",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "acc-tally",
    group: "Accounts",
    label: "Tally Export",
    icon: "Download",
    href: "/reports?tab=tally",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },

  // 9. Reports
  {
    id: "rep-sales",
    group: "Reports",
    label: "Sales Reports",
    icon: "BarChart3",
    href: "/reports?tab=sales",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "rep-stock",
    group: "Reports",
    label: "Stock Reports",
    icon: "Boxes",
    href: "/reports?tab=stock",
    roles: [...GODOWN_AND_ADMIN, UserRole.ACCOUNTS],
  },
  {
    id: "rep-van",
    group: "Reports",
    label: "Van Reports",
    icon: "Truck",
    href: "/reports?tab=van",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },
  {
    id: "rep-returns",
    group: "Reports",
    label: "Returns & Debit Notes",
    icon: "RotateCcw",
    href: "/godown/returns",
    roles: [...GODOWN_AND_ADMIN, UserRole.ACCOUNTS],
  },
  {
    id: "rep-staff",
    group: "Reports",
    label: "Staff Performance",
    icon: "Award",
    href: "/reports?tab=staff",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "rep-agent-sales",
    group: "Reports",
    label: "Agent Sales (Incentives)",
    icon: "BadgePercent",
    href: "/admin/reports/agent-sales",
    roles: [...ADMIN_ROLES, UserRole.ACCOUNTS],
  },

  // 10. Admin
  {
    id: "adm-crud-hub",
    group: "Admin",
    label: "Master Data CRUD Hub",
    icon: "Database",
    href: "/admin/crud",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-users",
    group: "Admin",
    label: "Users & Roles",
    icon: "UserCog",
    href: "/admin/crud/users",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-business",
    group: "Admin",
    label: "Business Details",
    icon: "Building2",
    href: "/admin/settings?tab=business",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-invoice",
    group: "Admin",
    label: "Invoice Settings",
    icon: "FileCheck",
    href: "/admin/settings?tab=invoice",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-discounts",
    group: "Admin",
    label: "Discount Limits",
    icon: "Percent",
    href: "/admin/crud/discount_limits",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-locations",
    group: "Admin",
    label: "Locations",
    icon: "MapPin",
    href: "/admin/crud/locations",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-storefront",
    group: "Admin",
    label: "Storefront Settings",
    icon: "Globe",
    href: "/admin/crud/storefront_settings",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-audit",
    group: "Admin",
    label: "Audit Log",
    icon: "ShieldCheck",
    href: "/admin/crud/audit_logs",
    roles: [...ADMIN_ROLES],
  },
  {
    id: "adm-backup",
    group: "Admin",
    label: "Backup & Export",
    icon: "HardDriveDownload",
    href: "/admin/settings?tab=backup",
    roles: [...ADMIN_ROLES],
  },
];

export const NAV_GROUP_ORDER: Array<{ name: NavGroupName; icon: string }> = [
  { name: "Dashboard", icon: "LayoutDashboard" },
  { name: "Sales", icon: "Receipt" },
  { name: "Inventory", icon: "Boxes" },
  { name: "Dispatch", icon: "Truck" },
  { name: "Van", icon: "Navigation" },
  { name: "Catalog", icon: "Package" },
  { name: "Parties", icon: "Users" },
  { name: "Delivery", icon: "MapPin" },
  { name: "Accounts", icon: "Wallet" },
  { name: "Reports", icon: "BarChart3" },
  { name: "Admin", icon: "Settings" },
];

/**
 * Returns the grouped navigation items visible to a given UserRole.
 * For SUPER_ADMIN and ADMIN, every group and every item is visible.
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
