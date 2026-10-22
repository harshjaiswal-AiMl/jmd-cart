import crypto from "node:crypto";
import { StorageAdapter, StorageObject, StorageHeadResult, StoragePutOptions } from "./storage.types";

export interface R2StorageConfig {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class R2Storage implements StorageAdapter {
  private accountId: string;
  private bucket: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private host: string;

  constructor(config: R2StorageConfig) {
    if (
      !config.accountId ||
      !config.bucket ||
      !config.accessKeyId ||
      !config.secretAccessKey
    ) {
      throw new Error(
        "R2Storage requires accountId, bucket, accessKeyId, and secretAccessKey"
      );
    }
    this.accountId = config.accountId;
    this.bucket = config.bucket;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.host = `${this.accountId}.r2.cloudflarestorage.com`;
  }

  private hmac(key: Buffer | string, str: string): Buffer {
    return crypto.createHmac("sha256", key).update(str, "utf8").digest();
  }

  private hash(data: string | Buffer): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private signRequest(
    method: string,
    key: string,
    payloadHash: string,
    extraHeaders: Record<string, string> = {}
  ): { url: string; headers: Record<string, string> } {
    const cleanKey = key.replace(/\\/g, "/").replace(/^\/+/, "");
    const canonicalUri = `/${this.bucket}/${cleanKey}`;
    const url = `https://${this.host}${canonicalUri}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const region = "auto";
    const service = "s3";

    const allHeaders: Record<string, string> = {
      host: this.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...extraHeaders,
    };

    const headerKeys = Object.keys(allHeaders).sort();
    const canonicalHeaders =
      headerKeys.map((k) => `${k.toLowerCase()}:${allHeaders[k].trim()}\n`).join("");
    const signedHeaders = headerKeys.map((k) => k.toLowerCase()).join(";");

    const canonicalRequest = `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${this.hash(
      canonicalRequest
    )}`;

    const kDate = this.hmac("AWS4" + this.secretAccessKey, dateStamp);
    const kRegion = this.hmac(kDate, region);
    const kService = this.hmac(kRegion, service);
    const kSigning = this.hmac(kService, "aws4_request");
    const signature = crypto
      .createHmac("sha256", kSigning)
      .update(stringToSign, "utf8")
      .digest("hex");

    const authHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      url,
      headers: {
        ...allHeaders,
        Authorization: authHeader,
      },
    };
  }

  async put(
    key: string,
    data: Buffer,
    options?: StoragePutOptions
  ): Promise<{ key: string; etag?: string }> {
    const contentType =
      typeof options === "string"
        ? options
        : options?.contentType || "application/octet-stream";
    const cacheControl =
      typeof options === "object" ? options.cacheControl : undefined;

    const payloadHash = this.hash(data);
    const extraHeaders: Record<string, string> = {
      "content-type": contentType,
      "content-length": data.length.toString(),
    };
    if (cacheControl) {
      extraHeaders["cache-control"] = cacheControl;
    }

    const { url, headers } = this.signRequest("PUT", key, payloadHash, extraHeaders);

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: new Uint8Array(data),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`R2 PUT failed [${res.status} ${res.statusText}]: ${errText}`);
    }

    const etag = res.headers.get("etag") ?? undefined;
    return { key, etag };
  }

  async get(key: string): Promise<StorageObject | null> {
    const payloadHash = this.hash("");
    const { url, headers } = this.signRequest("GET", key, payloadHash);

    const res = await fetch(url, {
      method: "GET",
      headers,
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`R2 GET failed [${res.status} ${res.statusText}]: ${errText}`);
    }

    const arrayBuf = await res.arrayBuffer();
    const body = Buffer.from(arrayBuf);
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const contentLength = body.length;
    const etag = res.headers.get("etag") ?? undefined;

    return {
      body,
      contentType,
      contentLength,
      etag,
    };
  }

  async head(key: string): Promise<StorageHeadResult | null> {
    const payloadHash = this.hash("");
    const { url, headers } = this.signRequest("HEAD", key, payloadHash);

    const res = await fetch(url, {
      method: "HEAD",
      headers,
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
    const etag = res.headers.get("etag") ?? undefined;

    return {
      contentType,
      contentLength,
      etag,
    };
  }

  async delete(key: string): Promise<boolean> {
    const payloadHash = this.hash("");
    const { url, headers } = this.signRequest("DELETE", key, payloadHash);

    const res = await fetch(url, {
      method: "DELETE",
      headers,
    });

    return res.status === 204 || res.status === 200 || res.status === 404;
  }

  async exists(key: string): Promise<boolean> {
    const res = await this.head(key);
    return res !== null;
  }
}
