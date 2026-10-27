import { UserRole } from "@prisma/client";

export type CrudEntityKey =
  | "users"
  | "locations"
  | "companies"
  | "categories"
  | "products"
  | "price_slabs"
  | "parties"
  | "orders"
  | "purchases"
  | "stock_transfers"
  | "van_trips"
  | "delivery_zones"
  | "delivery_charge_rules"
  | "receipts"
  | "payments"
  | "discount_limits"
  | "business_details"
  | "storefront_settings"
  | "audit_logs";

export type CrudFieldType =
  | "text"
  | "number"
  | "rupees"
  | "select"
  | "boolean"
  | "password";

export interface CrudFieldDef {
  key: string;
  label: string;
  type: CrudFieldType;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  showInList?: boolean;
  showInForm?: boolean;
  placeholder?: string;
}

export type DeletePolicyType =
  | "ARCHIVE_OR_HARD_IF_UNREFERENCED"
  | "VOID_WITH_REASON"
  | "HARD_DELETE"
  | "READ_ONLY";

export interface CrudEntityConfig {
  key: CrudEntityKey;
  title: string;
  singularTitle: string;
  description: string;
  group: string;
  deletePolicy: DeletePolicyType;
  allowCreate: boolean;
  allowEdit: boolean;
  readRoles: UserRole[];
  writeRoles: UserRole[];
  fields: CrudFieldDef[];
}

const ADMIN_WRITE: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];
const ADMIN_AND_GODOWN_READ: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.GODOWN,
];
const ADMIN_AND_ACCOUNTS: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTS,
];

export const CRUD_ENTITIES: Record<CrudEntityKey, CrudEntityConfig> = {
  users: {
    key: "users",
    title: "Users & Roles",
    singularTitle: "User",
    description:
      "Staff and buyer accounts. Cannot delete or demote the last SUPER_ADMIN or delete yourself.",
    group: "Admin",
    deletePolicy: "ARCHIVE_OR_HARD_IF_UNREFERENCED",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_WRITE,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "name", label: "Full Name", type: "text", required: true, showInList: true, showInForm: true },
      {
        key: "agentCode",
        label: "Agent Code (Incentives)",
        type: "text",
        required: false,
        showInList: true,
        showInForm: true,
        placeholder: "e.g. AG001, RK07 (3-8 uppercase alphanumeric)",
      },
      { key: "phone", label: "Phone (10-digit)", type: "text", required: true, showInList: true, showInForm: true },
      {
        key: "role",
        label: "System Role",
        type: "select",
        required: true,
        showInList: true,
        showInForm: true,
        options: [
          { label: "SUPER_ADMIN", value: "SUPER_ADMIN" },
          { label: "ADMIN", value: "ADMIN" },
          { label: "GODOWN (Warehouse Manager)", value: "GODOWN" },
          { label: "SHOP (Cashier)", value: "SHOP" },
          { label: "SALESPERSON (Van)", value: "SALESPERSON" },
          { label: "DELIVERY", value: "DELIVERY" },
          { label: "ACCOUNTS", value: "ACCOUNTS" },
          { label: "CUSTOMER (Storefront)", value: "CUSTOMER" },
        ],
      },
      {
        key: "buyerType",
        label: "Storefront Buyer Tier",
        type: "select",
        showInList: true,
        showInForm: true,
        options: [
          { label: "CUSTOMER (List C)", value: "CUSTOMER" },
          { label: "RETAILER (List B)", value: "RETAILER" },
          { label: "WHOLESALER (List A)", value: "WHOLESALER" },
        ],
      },
      { key: "buyerApproved", label: "Tier Approved", type: "boolean", showInList: true, showInForm: true },
      { key: "password", label: "Password (Set / Reset)", type: "password", showInList: false, showInForm: true },
      { key: "active", label: "Active", type: "boolean", showInList: true, showInForm: true },
    ],
  },

  locations: {
    key: "locations",
    title: "Stock Locations",
    singularTitle: "Location",
    description: "Godowns, Retail Shops, and Distribution Vans.",
    group: "Admin",
    deletePolicy: "ARCHIVE_OR_HARD_IF_UNREFERENCED",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_AND_GODOWN_READ,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "name", label: "Location Name", type: "text", required: true, showInList: true, showInForm: true },
      {
        key: "type",
        label: "Location Type",
        type: "select",
        required: true,
        showInList: true,
        showInForm: true,
        options: [
          { label: "GODOWN", value: "GODOWN" },
          { label: "SHOP", value: "SHOP" },
          { label: "VAN", value: "VAN" },
        ],
      },
      { key: "active", label: "Active", type: "boolean", showInList: true, showInForm: true },
    ],
  },

  companies: {
    key: "companies",
    title: "Brands / Companies",
    singularTitle: "Brand / Company",
    description: "Principal brands (SALONI, DAWAT, MDH, etc.). Archived if linked to products.",
    group: "Catalog",
    deletePolicy: "ARCHIVE_OR_HARD_IF_UNREFERENCED",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_AND_GODOWN_READ,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "name", label: "Brand / Company Name", type: "text", required: true, showInList: true, showInForm: true },
      { key: "gstin", label: "Supplier GSTIN", type: "text", showInList: true, showInForm: true },
      { key: "contactPhone", label: "Contact Phone", type: "text", showInList: true, showInForm: true },
      { key: "active", label: "Active", type: "boolean", showInList: true, showInForm: true },
    ],
  },

  categories: {
    key: "categories",
    title: "Product Categories",
    singularTitle: "Category",
    description: "Product categories for catalog and storefront tiles.",
    group: "Catalog",
    deletePolicy: "ARCHIVE_OR_HARD_IF_UNREFERENCED",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_AND_GODOWN_READ,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "name", label: "Category Name", type: "text", required: true, showInList: true, showInForm: true },
      { key: "imageUrl", label: "Category Image URL / Photo", type: "text", showInList: true, showInForm: true, placeholder: "/media/products/... or /brand/..." },
      { key: "active", label: "Active", type: "boolean", showInList: true, showInForm: true },
    ],
  },

  products: {
    key: "products",
    title: "Products (with A/B/C Prices)",
    singularTitle: "Product",
    description: "Catalog items with Pack Size (1 carton pcs), MRP, and A/B/C price lists.",
    group: "Catalog",
    deletePolicy: "ARCHIVE_OR_HARD_IF_UNREFERENCED",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_AND_GODOWN_READ,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "shortCode", label: "SKU / Short Code", type: "text", required: true, showInList: true, showInForm: true },
      { key: "name", label: "Product Name", type: "text", required: true, showInList: true, showInForm: true },
      { key: "weight", label: "Weight / Pack", type: "text", showInList: true, showInForm: true },
      { key: "packSize", label: "Qty in Case (1 Carton Pcs)", type: "number", required: true, showInList: true, showInForm: true },
      { key: "mrpRupees", label: "MRP (₹)", type: "rupees", showInList: true, showInForm: true },
      { key: "priceARupees", label: "List A Wholesaler (₹)", type: "rupees", required: true, showInList: true, showInForm: true },
      { key: "priceBRupees", label: "List B Retailer (₹)", type: "rupees", required: true, showInList: true, showInForm: true },
      { key: "priceCRupees", label: "List C Customer (₹)", type: "rupees", required: true, showInList: true, showInForm: true },
      { key: "reorderLevel", label: "Reorder Level (Pcs)", type: "number", showInList: true, showInForm: true },
      { key: "active", label: "Active", type: "boolean", showInList: true, showInForm: true },
    ],
  },

  price_slabs: {
    key: "price_slabs",
    title: "Quantity Price Slabs",
    singularTitle: "Price Slab",
    description: "Optional quantity-tier price slabs per product.",
    group: "Catalog",
    deletePolicy: "HARD_DELETE",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_WRITE,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "productId", label: "Product ID / SKU", type: "text", required: true, showInList: true, showInForm: true },
      { key: "productName", label: "Product", type: "text", showInList: true, showInForm: false },
      { key: "minQty", label: "Min Qty (Pcs)", type: "number", required: true, showInList: true, showInForm: true },
      { key: "maxQty", label: "Max Qty (Pcs)", type: "number", showInList: true, showInForm: true },
      { key: "priceRupees", label: "Slab Price (₹)", type: "rupees", required: true, showInList: true, showInForm: true },
    ],
  },

  parties: {
    key: "parties",
    title: "Parties (Customers, Retailers, Wholesalers, Suppliers)",
    singularTitle: "Party",
    description: "All B2B/B2C buyers and suppliers with credit limits and GSTIN.",
    group: "Parties",
    deletePolicy: "ARCHIVE_OR_HARD_IF_UNREFERENCED",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_AND_ACCOUNTS,
    writeRoles: ADMIN_AND_ACCOUNTS,
    fields: [
      { key: "name", label: "Party / Firm Name", type: "text", required: true, showInList: true, showInForm: true },
      {
        key: "type",
        label: "Party Type",
        type: "select",
        required: true,
        showInList: true,
        showInForm: true,
        options: [
          { label: "CUSTOMER (List C)", value: "CUSTOMER" },
          { label: "RETAILER (List B)", value: "RETAILER" },
          { label: "WHOLESALER (List A)", value: "WHOLESALER" },
          { label: "SUPPLIER", value: "SUPPLIER" },
        ],
      },
      { key: "phone", label: "Phone", type: "text", showInList: true, showInForm: true },
      { key: "gstin", label: "GSTIN", type: "text", showInList: true, showInForm: true },
      { key: "creditLimitRupees", label: "Credit Limit (₹)", type: "rupees", showInList: true, showInForm: true },
      { key: "address", label: "Address", type: "text", showInList: true, showInForm: true },
      { key: "active", label: "Active", type: "boolean", showInList: true, showInForm: true },
    ],
  },

  orders: {
    key: "orders",
    title: "Orders",
    singularTitle: "Order",
    description: "Online and B2B orders. Never hard-deleted; cancel/void with mandatory reason.",
    group: "Sales",
    deletePolicy: "VOID_WITH_REASON",
    allowCreate: false,
    allowEdit: true,
    readRoles: ADMIN_AND_ACCOUNTS,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "orderNo", label: "Order No", type: "text", showInList: true, showInForm: false },
      { key: "buyerName", label: "Buyer", type: "text", showInList: true, showInForm: false },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        showInList: true,
        showInForm: true,
        options: [
          { label: "PENDING", value: "PENDING" },
          { label: "CONFIRMED", value: "CONFIRMED" },
          { label: "PACKING", value: "PACKING" },
          { label: "OUT_FOR_DELIVERY", value: "OUT_FOR_DELIVERY" },
          { label: "DELIVERED", value: "DELIVERED" },
          { label: "CANCELLED", value: "CANCELLED" },
        ],
      },
      { key: "totalRupees", label: "Total (₹)", type: "rupees", showInList: true, showInForm: false },
      { key: "notes", label: "Order Notes", type: "text", showInList: true, showInForm: true },
    ],
  },

  purchases: {
    key: "purchases",
    title: "Purchases / GRN",
    singularTitle: "Purchase / GRN",
    description: "Supplier purchase bills. Voiding posts reversing ledger movements.",
    group: "Inventory",
    deletePolicy: "VOID_WITH_REASON",
    allowCreate: false,
    allowEdit: true,
    readRoles: ADMIN_AND_GODOWN_READ,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "billNo", label: "Supplier Bill No", type: "text", required: true, showInList: true, showInForm: true },
      { key: "supplierName", label: "Supplier", type: "text", showInList: true, showInForm: false },
      { key: "totalRupees", label: "Total Amount (₹)", type: "rupees", showInList: true, showInForm: false },
      { key: "notes", label: "Notes", type: "text", showInList: true, showInForm: true },
    ],
  },

  stock_transfers: {
    key: "stock_transfers",
    title: "Stock Transfers",
    singularTitle: "Stock Transfer",
    description: "Inter-location stock transfer movements. Voiding posts an exact reversal movement.",
    group: "Inventory",
    deletePolicy: "VOID_WITH_REASON",
    allowCreate: false,
    allowEdit: false,
    readRoles: ADMIN_AND_GODOWN_READ,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "productName", label: "Product", type: "text", showInList: true, showInForm: false },
      { key: "fromLocationName", label: "From Location", type: "text", showInList: true, showInForm: false },
      { key: "toLocationName", label: "To Location", type: "text", showInList: true, showInForm: false },
      { key: "qty", label: "Qty (Pcs)", type: "number", showInList: true, showInForm: false },
      { key: "reason", label: "Reason", type: "text", showInList: true, showInForm: false },
    ],
  },

  van_trips: {
    key: "van_trips",
    title: "Van Trips & Load Sheets",
    singularTitle: "Van Trip",
    description: "Daily van dispatch trips and evening reconciliation.",
    group: "Van",
    deletePolicy: "VOID_WITH_REASON",
    allowCreate: false,
    allowEdit: true,
    readRoles: ADMIN_AND_GODOWN_READ,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "vanName", label: "Van Location", type: "text", showInList: true, showInForm: false },
      { key: "salespersonName", label: "Salesperson", type: "text", showInList: true, showInForm: false },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        showInList: true,
        showInForm: true,
        options: [
          { label: "OPEN", value: "OPEN" },
          { label: "RECONCILED", value: "RECONCILED" },
          { label: "CLOSED", value: "CLOSED" },
        ],
      },
      { key: "notes", label: "Notes", type: "text", showInList: true, showInForm: true },
    ],
  },

  delivery_zones: {
    key: "delivery_zones",
    title: "Delivery Zones",
    singularTitle: "Delivery Zone",
    description: "Saharsa town & district delivery zones with pin codes and slot availability.",
    group: "Delivery",
    deletePolicy: "HARD_DELETE",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_WRITE,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "name", label: "Zone Name", type: "text", required: true, showInList: true, showInForm: true },
      { key: "pincode", label: "Pincode / Area", type: "text", required: true, showInList: true, showInForm: true },
      { key: "estimatedHours", label: "Est. Delivery Hours", type: "number", showInList: true, showInForm: true },
      { key: "active", label: "Active", type: "boolean", showInList: true, showInForm: true },
    ],
  },

  delivery_charge_rules: {
    key: "delivery_charge_rules",
    title: "Delivery Charge Rules",
    singularTitle: "Delivery Charge Rule",
    description: "Order value thresholds and delivery fee rules per buyer tier.",
    group: "Delivery",
    deletePolicy: "HARD_DELETE",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_WRITE,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "name", label: "Rule Name", type: "text", required: true, showInList: true, showInForm: true },
      {
        key: "buyerType",
        label: "Buyer Tier",
        type: "select",
        required: true,
        showInList: true,
        showInForm: true,
        options: [
          { label: "ALL", value: "ALL" },
          { label: "CUSTOMER", value: "CUSTOMER" },
          { label: "RETAILER", value: "RETAILER" },
          { label: "WHOLESALER", value: "WHOLESALER" },
        ],
      },
      { key: "minOrderRupees", label: "Free Delivery Above (₹)", type: "rupees", required: true, showInList: true, showInForm: true },
      { key: "chargeRupees", label: "Delivery Charge Below Min (₹)", type: "rupees", required: true, showInList: true, showInForm: true },
      { key: "active", label: "Active", type: "boolean", showInList: true, showInForm: true },
    ],
  },

  receipts: {
    key: "receipts",
    title: "Customer & Party Receipts",
    singularTitle: "Receipt",
    description: "Posted payment receipts. Cannot be hard-deleted; void with mandatory reason.",
    group: "Accounts",
    deletePolicy: "VOID_WITH_REASON",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_AND_ACCOUNTS,
    writeRoles: ADMIN_AND_ACCOUNTS,
    fields: [
      { key: "receiptNo", label: "Receipt No", type: "text", showInList: true, showInForm: false },
      { key: "partyId", label: "Party ID", type: "text", required: true, showInList: false, showInForm: true },
      { key: "partyName", label: "Party Name", type: "text", showInList: true, showInForm: false },
      { key: "amountRupees", label: "Amount (₹)", type: "rupees", required: true, showInList: true, showInForm: true },
      {
        key: "mode",
        label: "Payment Mode",
        type: "select",
        required: true,
        showInList: true,
        showInForm: true,
        options: [
          { label: "CASH", value: "CASH" },
          { label: "UPI", value: "UPI" },
          { label: "BANK_TRANSFER", value: "BANK_TRANSFER" },
        ],
      },
      { key: "reference", label: "Reference / UTR", type: "text", showInList: true, showInForm: true },
      { key: "notes", label: "Notes", type: "text", showInList: true, showInForm: true },
    ],
  },

  payments: {
    key: "payments",
    title: "Supplier & Expense Payments",
    singularTitle: "Payment",
    description: "Outward payments to suppliers/expenses. Void with mandatory reason.",
    group: "Accounts",
    deletePolicy: "VOID_WITH_REASON",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_AND_ACCOUNTS,
    writeRoles: ADMIN_AND_ACCOUNTS,
    fields: [
      { key: "voucherNo", label: "Voucher No", type: "text", required: true, showInList: true, showInForm: true },
      { key: "payeeName", label: "Payee / Supplier", type: "text", required: true, showInList: true, showInForm: true },
      { key: "amountRupees", label: "Amount (₹)", type: "rupees", required: true, showInList: true, showInForm: true },
      {
        key: "mode",
        label: "Mode",
        type: "select",
        required: true,
        showInList: true,
        showInForm: true,
        options: [
          { label: "CASH", value: "CASH" },
          { label: "UPI", value: "UPI" },
          { label: "BANK_TRANSFER", value: "BANK_TRANSFER" },
        ],
      },
      { key: "notes", label: "Notes / Reason", type: "text", showInList: true, showInForm: true },
      { key: "status", label: "Status", type: "text", showInList: true, showInForm: false },
    ],
  },

  discount_limits: {
    key: "discount_limits",
    title: "Role Discount Limits",
    singularTitle: "Discount Limit",
    description: "Maximum discount % allowed per staff role before requiring Admin override.",
    group: "Admin",
    deletePolicy: "READ_ONLY",
    allowCreate: false,
    allowEdit: true,
    readRoles: ADMIN_WRITE,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "role", label: "Role", type: "text", required: true, showInList: true, showInForm: false },
      { key: "maxDiscountPct", label: "Max Discount (%)", type: "number", required: true, showInList: true, showInForm: true },
    ],
  },

  business_details: {
    key: "business_details",
    title: "Business Details",
    singularTitle: "Business Profile",
    description: "Legal name, trade name, GSTIN, FSSAI, address, and bank details printed on invoices.",
    group: "Admin",
    deletePolicy: "READ_ONLY",
    allowCreate: false,
    allowEdit: true,
    readRoles: ADMIN_WRITE,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "tradeName", label: "Trade Name", type: "text", required: true, showInList: true, showInForm: true },
      { key: "legalName", label: "Legal Name", type: "text", required: true, showInList: true, showInForm: true },
      { key: "gstin", label: "GSTIN", type: "text", showInList: true, showInForm: true },
      { key: "fssai", label: "FSSAI License", type: "text", showInList: true, showInForm: true },
      { key: "phone", label: "Phone", type: "text", showInList: true, showInForm: true },
      { key: "address", label: "Address", type: "text", showInList: true, showInForm: true },
      { key: "upiId", label: "UPI ID", type: "text", showInList: true, showInForm: true },
    ],
  },

  storefront_settings: {
    key: "storefront_settings",
    title: "Storefront Settings & Banners",
    singularTitle: "Storefront Banner / Setting",
    description: "Hero banners, delivery promise text, and minimum order rules on jmdcart.com.",
    group: "Admin",
    deletePolicy: "HARD_DELETE",
    allowCreate: true,
    allowEdit: true,
    readRoles: ADMIN_WRITE,
    writeRoles: ADMIN_WRITE,
    fields: [
      { key: "title", label: "Banner / Setting Title", type: "text", required: true, showInList: true, showInForm: true },
      { key: "subtitle", label: "Subtitle / Offer Text", type: "text", required: true, showInList: true, showInForm: true },
      { key: "badgeText", label: "Badge Text", type: "text", showInList: true, showInForm: true },
      { key: "ctaHref", label: "Target Link", type: "text", showInList: true, showInForm: true },
      { key: "active", label: "Active", type: "boolean", showInList: true, showInForm: true },
    ],
  },

  audit_logs: {
    key: "audit_logs",
    title: "Immutable System Audit Log",
    singularTitle: "Audit Log Entry",
    description: "Every create, update, delete, archive, void, and stock movement across JMD Cart.",
    group: "Admin",
    deletePolicy: "READ_ONLY",
    allowCreate: false,
    allowEdit: false,
    readRoles: ADMIN_WRITE,
    writeRoles: [],
    fields: [
      { key: "createdAt", label: "Timestamp", type: "text", showInList: true, showInForm: false },
      { key: "actorName", label: "Actor", type: "text", showInList: true, showInForm: false },
      { key: "action", label: "Action", type: "text", showInList: true, showInForm: false },
      { key: "entity", label: "Entity", type: "text", showInList: true, showInForm: false },
      { key: "entityId", label: "Entity ID", type: "text", showInList: true, showInForm: false },
    ],
  },
};

export const CRUD_ENTITY_LIST = Object.values(CRUD_ENTITIES);
