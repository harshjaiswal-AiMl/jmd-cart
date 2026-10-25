/**
 * Client-side IndexedDB & localStorage persistence for offline Van Draft Invoices.
 * Allows salespersons to bill even when disconnected on rural routes in Saharsa.
 */

export interface VanDraftItem {
  productId: string;
  productName: string;
  shortCode: string;
  qty: number;
  packSize: number;
  packLabel: string;
  mrpPaise: number;
}

export interface VanDraftInvoice {
  clientTempId: string;
  idempotencyKey: string;
  vanLocationId: string;
  vanName: string;
  partyId?: string | null;
  partyName?: string;
  items: VanDraftItem[];
  payments: Array<{
    mode: "CASH" | "UPI" | "CREDIT" | "CARD";
    amountPaise: number;
  }>;
  orderDiscountBp?: number;
  totalPaise: number;
  createdAt: string;
  syncStatus: "DRAFT" | "SYNCING" | "SYNCED" | "FAILED";
  errorMessage?: string;
  serverInvoiceNumber?: string;
  serverInvoiceId?: string;
}

const DB_NAME = "jmd_cart_van_db";
const DB_VERSION = 1;
const STORE_NAME = "draft_invoices";
const FALLBACK_KEY = "jmd_cart_van_drafts_fallback";

function isIndexedDBSupported(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      return reject(new Error("IndexedDB not supported"));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "clientTempId" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("vanLocationId", "vanLocationId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// LocalStorage Fallback helpers
function getLocalStorageDrafts(): VanDraftInvoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalStorageDrafts(drafts: VanDraftInvoice[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(drafts));
  } catch {
    // quota exceeded or private mode
  }
}

/**
 * Save or update a draft invoice locally.
 */
export async function saveDraftInvoice(draft: VanDraftInvoice): Promise<VanDraftInvoice> {
  if (isIndexedDBSupported()) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(draft);
        req.onsuccess = () => resolve(draft);
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to localStorage on error
    }
  }

  const existing = getLocalStorageDrafts();
  const index = existing.findIndex((d) => d.clientTempId === draft.clientTempId);
  if (index >= 0) {
    existing[index] = draft;
  } else {
    existing.push(draft);
  }
  setLocalStorageDrafts(existing);
  return draft;
}

/**
 * List all draft invoices, optionally filtered by vanLocationId.
 */
export async function listDraftInvoices(vanLocationId?: string): Promise<VanDraftInvoice[]> {
  if (isIndexedDBSupported()) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          let list: VanDraftInvoice[] = req.result || [];
          if (vanLocationId) {
            list = list.filter((d) => d.vanLocationId === vanLocationId);
          }
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback
    }
  }

  let list = getLocalStorageDrafts();
  if (vanLocationId) {
    list = list.filter((d) => d.vanLocationId === vanLocationId);
  }
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list;
}

/**
 * Delete a draft invoice once successfully synced.
 */
export async function deleteDraftInvoice(clientTempId: string): Promise<void> {
  if (isIndexedDBSupported()) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(clientTempId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback
    }
  }

  const drafts = getLocalStorageDrafts().filter((d) => d.clientTempId !== clientTempId);
  setLocalStorageDrafts(drafts);
}

/**
 * Update the sync status of a draft.
 */
export async function updateDraftStatus(
  clientTempId: string,
  status: "DRAFT" | "SYNCING" | "SYNCED" | "FAILED",
  opts?: {
    errorMessage?: string;
    serverInvoiceNumber?: string;
    serverInvoiceId?: string;
  }
): Promise<void> {
  const drafts = await listDraftInvoices();
  const draft = drafts.find((d) => d.clientTempId === clientTempId);
  if (!draft) return;

  draft.syncStatus = status;
  if (opts?.errorMessage !== undefined) draft.errorMessage = opts.errorMessage;
  if (opts?.serverInvoiceNumber !== undefined) draft.serverInvoiceNumber = opts.serverInvoiceNumber;
  if (opts?.serverInvoiceId !== undefined) draft.serverInvoiceId = opts.serverInvoiceId;

  await saveDraftInvoice(draft);
}
