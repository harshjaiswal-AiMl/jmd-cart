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

  // Van Sales
  VAN_BILL = "VAN_BILL",
  VAN_RECONCILE = "VAN_RECONCILE",

  // Delivery
  DELIVERY_EXECUTE = "DELIVERY_EXECUTE",

  // Accounts & Reports
  ACCOUNTS_VIEW = "ACCOUNTS_VIEW",
  REPORTS_VIEW = "REPORTS_VIEW",
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

  GODOWN: [
    Permission.VIEW_PRODUCTS,
    Permission.STOCK_RECEIVE,
    Permission.STOCK_TRANSFER,
    Permission.STOCK_CARTON_BREAK,
    Permission.STOCK_AUDIT,
    Permission.STOCK_VIEW,
    Permission.STOCK_ADJUST,
  ],

  SHOP: [
    Permission.VIEW_PRODUCTS,
    Permission.STOCK_VIEW,
    Permission.POS_BILL,
    Permission.POS_HOLD_RESUME,
    Permission.POS_CASH_CLOSE,
  ],

  SALESPERSON: [
    Permission.VIEW_PRODUCTS,
    Permission.STOCK_VIEW,
    Permission.VAN_BILL,
    Permission.VAN_RECONCILE,
  ],

  DELIVERY: [
    Permission.DELIVERY_EXECUTE,
  ],

  ACCOUNTS: [
    Permission.VIEW_PRODUCTS,
    Permission.STOCK_VIEW,
    Permission.ACCOUNTS_VIEW,
    Permission.REPORTS_VIEW,
  ],

  CUSTOMER: [
    Permission.VIEW_PRODUCTS,
  ],
};

/**
 * Route prefixes allowed for each role.
 */
export const ROLE_ALLOWED_ROUTES: Record<UserRole, string[]> = {
  SUPER_ADMIN: ["/admin", "/godown", "/shop", "/van", "/delivery", "/accounts", "/reports"],
  GODOWN: ["/godown"],
  SHOP: ["/shop"],
  SALESPERSON: ["/van"],
  DELIVERY: ["/delivery"],
  ACCOUNTS: ["/accounts", "/admin/reports"],
  CUSTOMER: ["/store"],
};

/**
 * Check if a role possesses a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role];
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
  if (role === UserRole.SUPER_ADMIN) {
    return true;
  }

  const allowedPrefixes = ROLE_ALLOWED_ROUTES[role] ?? [];
  return allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
}
