export interface StorageObject {
  body: Buffer;
  contentType: string;
  contentLength: number;
  etag?: string;
}

export interface StorageHeadResult {
  contentType: string;
  contentLength: number;
  etag?: string;
}

export type StoragePutOptions = string | { contentType?: string; cacheControl?: string };

export interface StorageAdapter {
  put(key: string, data: Buffer, options?: StoragePutOptions): Promise<{ key: string; etag?: string }>;
  get(key: string): Promise<StorageObject | null>;
  head(key: string): Promise<StorageHeadResult | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}
