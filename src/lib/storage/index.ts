import { StorageAdapter } from "./storage.types";
import { LocalDiskStorage } from "./local-disk-storage";
import { R2Storage } from "./r2-storage";

export * from "./storage.types";
export * from "./local-disk-storage";
export * from "./r2-storage";

let storageInstance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (storageInstance) {
    return storageInstance;
  }

  const driver = process.env.STORAGE_DRIVER || (process.env.NODE_ENV === "production" ? "r2" : "local");
  const isProd = process.env.NODE_ENV === "production";

  if (driver === "r2" || isProd) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
      if (isProd) {
        throw new Error(
          "FATAL: Cloudflare R2 is required in production but environment variables are missing (R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY). Refusing to fall back to ephemeral local disk."
        );
      }
      // If in dev and R2 vars missing, fall back to local disk
      storageInstance = new LocalDiskStorage();
      return storageInstance;
    }

    storageInstance = new R2Storage({
      accountId,
      bucket,
      accessKeyId,
      secretAccessKey,
    });
    return storageInstance;
  }

  storageInstance = new LocalDiskStorage();
  return storageInstance;
}

export function setStorageInstance(adapter: StorageAdapter | null) {
  storageInstance = adapter;
}
