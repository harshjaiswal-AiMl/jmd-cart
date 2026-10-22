import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { StorageAdapter, StorageObject, StorageHeadResult } from "./storage.types";

export class LocalDiskStorage implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), ".local-media");
  }

  private resolvePath(key: string): string {
    const cleanKey = key.replace(/\\/g, "/").replace(/^\/+/, "");
    if (cleanKey.includes("..")) {
      throw new Error("Invalid key: path traversal not allowed");
    }
    return path.join(this.baseDir, cleanKey);
  }

  private metaPath(filePath: string): string {
    return `${filePath}.meta.json`;
  }

  async put(
    key: string,
    data: Buffer,
    options?: import("./storage.types").StoragePutOptions
  ): Promise<{ key: string; etag?: string }> {
    const contentType =
      typeof options === "string"
        ? options
        : options?.contentType || "application/octet-stream";
    const filePath = this.resolvePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const hash = crypto.createHash("md5").update(data).digest("hex");
    const etag = `"${hash}"`;

    await Promise.all([
      fs.writeFile(filePath, data),
      fs.writeFile(
        this.metaPath(filePath),
        JSON.stringify({
          contentType,
          contentLength: data.length,
          etag,
          updatedAt: new Date().toISOString(),
        })
      ),
    ]);

    return { key, etag };
  }

  async get(key: string): Promise<StorageObject | null> {
    try {
      const filePath = this.resolvePath(key);
      const [body, metaRaw] = await Promise.all([
        fs.readFile(filePath),
        fs.readFile(this.metaPath(filePath), "utf8").catch(() => null),
      ]);

      let contentType = "application/octet-stream";
      let etag: string | undefined;

      if (metaRaw) {
        try {
          const meta = JSON.parse(metaRaw);
          if (meta.contentType) contentType = meta.contentType;
          if (meta.etag) etag = meta.etag;
        } catch {
          // fallback
        }
      }

      return {
        body,
        contentType,
        contentLength: body.length,
        etag,
      };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  async head(key: string): Promise<StorageHeadResult | null> {
    try {
      const filePath = this.resolvePath(key);
      const [stat, metaRaw] = await Promise.all([
        fs.stat(filePath),
        fs.readFile(this.metaPath(filePath), "utf8").catch(() => null),
      ]);

      let contentType = "application/octet-stream";
      let etag: string | undefined;

      if (metaRaw) {
        try {
          const meta = JSON.parse(metaRaw);
          if (meta.contentType) contentType = meta.contentType;
          if (meta.etag) etag = meta.etag;
        } catch {
          // fallback
        }
      }

      return {
        contentType,
        contentLength: stat.size,
        etag,
      };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = this.resolvePath(key);
      await Promise.all([
        fs.unlink(filePath).catch(() => {}),
        fs.unlink(this.metaPath(filePath)).catch(() => {}),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolvePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
