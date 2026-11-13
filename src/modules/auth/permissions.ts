import { UserRole } from "@prisma/client";

export enum Permission {
  // System Administration
  SYSTEM_ADMIN = "SYSTEM_ADMIN",
  MANAGE_SETTINGS = "MANAGE_SETTINGS",
  MANAGE_USERS = "MANAGE_USERS",
  VIEW_AUDIT_LOGS = "VIEW_AUDIT_LOGS",

  // Catalog
  MANAGE_PRODUCTS = "MANAGE_PRODUCTS",
  VIEW_PRODUCTS = "VIEW_PRODUCTS",
  IMPORT_PRODUCTS = "IMPORT_PRODUCTS",

  // Stock & Godown
  STOCK_RECEIVE = "STOCK_RECEIVE",
  GRN_ADD_PRODUCT = "grn.addProduct",
  GRN_EDIT_PRODUCT = "grn.editProduct",
  STOCK_TRANSFER = "STOCK_TRANSFER",
  STOCK_CARTON_BREAK = "STOCK_CARTON_BREAK",
  STOCK_AUDIT = "STOCK_AUDIT",
  STOCK_VIEW = "STOCK_VIEW",
  STOCK_ADJUST = "STOCK_ADJUST",

  // Shop POS & Billing
  POS_BILL = "POS_BILL",
  POS_HOLD_RESUME = "POS_HOLD_RESUME",
  POS_CASH_CLOSE = "POS_CASH_CLOSE",
  BILL_CANCEL = "BILL_CANCEL", // Admin only
  POS_DELETE_BILL = "pos.deleteBill",
  INVOICE_VOID = "invoice.void",

  // Van Sales & Cash Handover
  VAN_BILL = "VAN_BILL",
  VAN_RECONCILE = "VAN_RECONCILE",
  VAN_ISSUE_LOAD = "VAN_ISSUE_LOAD",
  CONFIRM_CASH_HANDOVER = "CONFIRM_CASH_HANDOVER",

  // Ecommerce Orders & Pick Lists
  MANAGE_ORDERS = "MANAGE_ORDERS",
  VIEW_ORDERS = "VIEW_ORDERS",

  // Delivery
  DELIVERY_EXECUTE = "DELIVERY_EXECUTE",

  // Parties & Credit
  MANAGE_PARTIES = "MANAGE_PARTIES",
  VIEW_PARTIES = "VIEW_PARTIES",
  RECORD_COLLECTION = "RECORD_COLLECTION",
  VIEW_LEDGER = "VIEW_LEDGER",
  OVERRIDE_CREDIT_LIMIT = "OVERRIDE_CREDIT_LIMIT",

  // Accounts & Reports
  ACCOUNTS_VIEW = "ACCOUNTS_VIEW",
  REPORTS_VIEW = "REPORTS_VIEW",

  // Invoices & Dispatch
  VIEW_INVOICES = "VIEW_INVOICES",
  DISPATCH_MANAGE = "DISPATCH_MANAGE",

  // Returns to Company & Debit Notes
  RETURN_TO_COMPANY = "RETURN_TO_COMPANY",
}

export class ForbiddenError extends Error {
  public readonly statusCode = 403;
  constructor(message: string = "Access forbidden: insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Static permission matrix mapping each role to allowed permissions.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission),
  ADMIN: Object.values(Permission),

  WAREHOUSE_MANAGER: [
    Permission.VIEW_PRODUCTS,
    Permission.MANAGE_PRODUCTS,
    Permission.IMPORT_PRODUCTS,
    Permission.STOCK_RECEIVE,
    Permission.GRN_ADD_PRODUCT,
    Permission.GRN_EDIT_PRODUCT,
    Permission.STOCK_TRANSFER,
    Permission.STOCK_CARTON_BREAK,
    Permission.STOCK_AUDIT,
    Permission.STOCK_VIEW,
    Permission.STOCK_ADJUST,
    Permission.VAN_ISSUE_LOAD,
    Permission.VAN_RECONCILE,
    Permission.RETURN_TO_COMPANY,
    Permission.VIEW_ORDERS,
    Permission.MANAGE_ORDERS,
    Permission.VIEW_PARTIES,
    Permission.VIEW_LEDGER,
    Permission.REPORTS_VIEW,
    Permission.VIEW_INVOICES,
    Permission.DISPATCH_MANAGE,
  ],

  GODOWN: [
    Permission.VIEW_PRODUCTS,
    Permission.STOCK_RECEIVE,
    Permission.STOCK_TRANSFER,
    Permission.STOCK_CARTON_BREAK,
    Permission.STOCK_AUDIT,
    Permission.STOCK_VIEW,
    Permission.STOCK_ADJUST,
    Permission.VAN_ISSUE_LOAD,
    Permission.VAN_RECONCILE,
    Permission.RETURN_TO_COMPANY,
    Permission.VIEW_ORDERS,
    Permission.MANAGE_ORDERS,
    Permission.REPORTS_VIEW,
  ],

  SHOP: [
    Permission.VIEW_PRODUCTS,
    Permission.MANAGE_PRODUCTS,
    Permission.STOCK_VIEW,
    Permission.STOCK_RECEIVE,
    Permission.STOCK_ADJUST,
    Permission.VIEW_PARTIES,
    Permission.VIEW_LEDGER,
    Permission.RECORD_COLLECTION,
    Permission.POS_BILL,
    Permission.POS_HOLD_RESUME,
    Permission.POS_CASH_CLOSE,
    Permission.VIEW_ORDERS,
    Permission.MANAGE_ORDERS,
    Permission.VIEW_INVOICES,
    Permission.REPORTS_VIEW,
  ],

  SALESPERSON: [
    Permission.VIEW_PRODUCTS,
    Permission.STOCK_VIEW,
    Permission.VIEW_PARTIES,
    Permission.VIEW_LEDGER,
    Permission.RECORD_COLLECTION,
    Permission.VAN_BILL,
    Permission.VAN_RECONCILE,
    Permission.VIEW_INVOICES,
  ],

  DELIVERY: [
    Permission.DELIVERY_EXECUTE,
  ],

  ACCOUNTS: [
    Permission.VIEW_PRODUCTS,
    Permission.MANAGE_PRODUCTS,
    Permission.IMPORT_PRODUCTS,
    Permission.STOCK_VIEW,
    Permission.STOCK_RECEIVE,
    Permission.STOCK_TRANSFER,
    Permission.STOCK_CARTON_BREAK,
    Permission.STOCK_AUDIT,
    Permission.STOCK_ADJUST,
    Permission.POS_BILL,
    Permission.POS_HOLD_RESUME,
    Permission.BILL_CANCEL,
    Permission.VIEW_PARTIES,
    Permission.VIEW_LEDGER,
    Permission.MANAGE_PARTIES,
    Permission.RECORD_COLLECTION,
    Permission.CONFIRM_CASH_HANDOVER,
    Permission.OVERRIDE_CREDIT_LIMIT,
    Permission.ACCOUNTS_VIEW,
    Permission.REPORTS_VIEW,
    Permission.RETURN_TO_COMPANY,
    Permission.VIEW_INVOICES,
    Permission.DISPATCH_MANAGE,
  ],

  PRO: [
    Permission.VIEW_PRODUCTS,
    Permission.MANAGE_PRODUCTS,
    Permission.STOCK_VIEW,
    Permission.VIEW_PARTIES,
    Permission.MANAGE_PARTIES,
    Permission.VIEW_ORDERS,
    Permission.MANAGE_ORDERS,
    Permission.VIEW_INVOICES,
  ],

  CUSTOMER: [
    Permission.VIEW_PRODUCTS,
  ],
};

/**
 * Route prefixes allowed for each role.
 */
export const ROLE_ALLOWED_ROUTES: Record<UserRole, string[]> = {
  SUPER_ADMIN: ["/admin", "/godown", "/shop", "/van", "/delivery", "/accounts", "/reports", "/app"],
  ADMIN: ["/admin", "/godown", "/shop", "/van", "/delivery", "/accounts", "/reports", "/app"],
  WAREHOUSE_MANAGER: [
    "/godown",
    "/van",
    "/admin/catalog",
    "/admin/crud/companies",
    "/admin/crud/categories",
    "/admin/crud/products",
    "/admin/reports",
    "/reports",
    "/shop/invoices",
    "/admin/orders",
    "/app/godown",
  ],
  GODOWN: [
    "/godown",
    "/admin/catalog",
    "/admin/crud/companies",
    "/admin/crud/categories",
    "/admin/crud/products",
    "/admin/reports",
    "/reports",
    "/app/godown",
  ],
  SHOP: [
    "/shop",
    "/admin/parties",
    "/admin/orders",
    "/admin/catalog",
    "/admin/reports",
    "/reports",
    "/godown/purchases",
    "/godown/stock",
    "/app/shop",
  ],
  SALESPERSON: ["/van", "/app/van"],
  DELIVERY: ["/delivery", "/app/delivery"],
  ACCOUNTS: ["/accounts", "/admin", "/reports", "/godown", "/shop", "/app/accounts"],
  PRO: [
    "/app/pro",
    "/admin/catalog",
    "/admin/parties",
    "/admin/orders",
    "/store",
  ],
  CUSTOMER: ["/store"],
};

// Optional runtime override map refreshed from DB Setting ("rbac.rolePermissions")
let runtimeRolePermissions: Partial<Record<UserRole, Permission[]>> | null = null;

export function setRuntimeRolePermissions(
  override: Partial<Record<UserRole, Permission[]>> | null
): void {
  runtimeRolePermissions = override;
}

export function getEffectiveRolePermissions(role: UserRole): Permission[] {
  if (runtimeRolePermissions && runtimeRolePermissions[role]) {
    return runtimeRolePermissions[role]!;
  }
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role possesses a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = getEffectiveRolePermissions(role);
  return allowed ? allowed.includes(permission) : false;
}

/**
 * Assert that a role has a specific permission, throwing ForbiddenError if not.
 */
export function assertPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(
      `Role '${role}' is not authorized to perform action requiring '${permission}'`
    );
  }
}

/**
 * Check if a role can navigate to a given route pathname.
 */
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  if (role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
    return true;
  }

  // System notifications, alerts and push subscriptions are accessible to all authenticated users
  if (pathname.startsWith("/api/notifications")) {
    return true;
  }

  // Invoice API endpoints mirror /shop/invoices route access; fine-grained actions enforce matrix permissions server-side
  if (pathname.startsWith("/api/invoices/")) {
    return canAccessRoute(role, "/shop/invoices");
  }

  // GODOWN cannot access /admin/catalog/import or /admin/catalog/price-lists
  if (
    role === UserRole.GODOWN &&
    (pathname.startsWith("/admin/catalog/import") ||
      pathname.startsWith("/admin/catalog/price-lists"))
  ) {
    return false;
  }

  const allowed = ROLE_ALLOWED_ROUTES[role] || [];
  return allowed.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Get the default landing dashboard route for a role after login.
 */

/**
 * Compile-time exhaustiveness map of home dashboard routes for every role.
 */
export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  SUPER_ADMIN: "/admin",
  ADMIN: "/admin",
  WAREHOUSE_MANAGER: "/godown",
  GODOWN: "/godown",
  SHOP: "/shop",
  SALESPERSON: "/van",
  DELIVERY: "/delivery",
  ACCOUNTS: "/accounts",
  PRO: "/app/pro",
  CUSTOMER: "/store",
};

/**
 * Compile-time exhaustiveness map of mobile app routes for every role.
 */
export const ROLE_MOBILE_APPS: Record<UserRole, string> = {
  SUPER_ADMIN: "/app/owner",
  ADMIN: "/app/owner",
  WAREHOUSE_MANAGER: "/app/godown",
  GODOWN: "/app/godown",
  SHOP: "/app/shop",
  SALESPERSON: "/app/van",
  DELIVERY: "/app/delivery",
  ACCOUNTS: "/app/accounts",
  PRO: "/app/pro",
  CUSTOMER: "/store",
};

/**
 * Return default landing dashboard path for each user role.
 */
export function getDefaultDashboard(role?: UserRole): string {
  if (!role) return "/login";
  return ROLE_HOME_ROUTES[role] ?? "/login";
}

/**
 * Return installable mobile app route for each role (Prompt #13 Part E)
 */
export function getDefaultAppForRole(role?: UserRole): string {
  if (!role) return "/login";
  return ROLE_MOBILE_APPS[role] ?? "/login";
}
