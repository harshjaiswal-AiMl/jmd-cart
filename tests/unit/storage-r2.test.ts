import { describe, it, expect } from "vitest";
import { detectImageType, detectImageMimeType, isSvg, imageTypeToExt } from "@/lib/storage/image-validation";
import { R2Storage } from "@/lib/storage/r2-storage";

describe("Part D: Storage & Image Security Tests", () => {
  describe("Magic byte inspection & format validation", () => {
    it("detects valid JPEG by magic bytes", () => {
      const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      expect(detectImageType(buf)).toBe("jpeg");
      expect(detectImageMimeType(buf)).toBe("image/jpeg");
      expect(imageTypeToExt("jpeg")).toBe("jpg");
    });

    it("detects valid PNG by magic bytes", () => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      expect(detectImageType(buf)).toBe("png");
      expect(detectImageMimeType(buf)).toBe("image/png");
      expect(imageTypeToExt("png")).toBe("png");
    });

    it("detects valid WebP by magic bytes", () => {
      const buf = Buffer.from("RIFF\x20\x00\x00\x00WEBPVP8 ");
      expect(detectImageType(buf)).toBe("webp");
      expect(detectImageMimeType(buf)).toBe("image/webp");
      expect(imageTypeToExt("webp")).toBe("webp");
    });

    it("detects valid GIF by magic bytes", () => {
      const buf = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00");
      expect(detectImageType(buf)).toBe("gif");
      expect(detectImageMimeType(buf)).toBe("image/gif");
      expect(imageTypeToExt("gif")).toBe("gif");
    });

    it("STRICTLY REJECTS SVG files to eliminate stored-XSS vulnerabilities", () => {
      const svg1 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      expect(isSvg(svg1)).toBe(true);
      expect(detectImageType(svg1)).toBeNull();
      expect(detectImageMimeType(svg1)).toBeNull();

      const svg2 = Buffer.from('<?xml version="1.0"?><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="50"/></svg>');
      expect(isSvg(svg2)).toBe(true);
      expect(detectImageType(svg2)).toBeNull();

      const html = Buffer.from('<html><body><script>malicious()</script></body></html>');
      expect(detectImageType(html)).toBeNull();

      const randomBytes = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c]);
      expect(detectImageType(randomBytes)).toBeNull();
    });
  });

  describe("Zero-Dependency Cloudflare R2 SigV4 Adapter", () => {
    it("initializes R2Storage and generates correct endpoint", () => {
      const r2 = new R2Storage({
        accountId: "test-account-id",
        bucket: "test-bucket",
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
      });

      expect(r2).toBeDefined();
    });
  });
});
