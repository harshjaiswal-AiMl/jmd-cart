import sharp from "sharp";

export interface GeneratedVariant {
  size: 160 | 320 | 640 | 1080;
  key: string;
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
}

export interface ImageVariantsResult {
  originalKey: string;
  primaryKey: string; // Default recommended thumbnail variant
  variants: GeneratedVariant[];
}

export const VARIANT_SIZES: Array<160 | 320 | 640 | 1080> = [160, 320, 640, 1080];

/**
 * Generates responsive WebP variants for an image buffer using sharp.
 * Keeps aspect ratio intact using 'inside' fit without distorting or upscaling unnecessarily.
 */
export async function generateImageVariants(
  inputBuffer: Buffer,
  hash: string,
  ext: string = "webp"
): Promise<ImageVariantsResult> {
  const originalKey = `products/${hash}/original.${ext}`;
  const metadata = await sharp(inputBuffer).metadata();
  const origWidth = metadata.width || 1080;
  const origHeight = metadata.height || 1080;

  const variants: GeneratedVariant[] = [];

  for (const size of VARIANT_SIZES) {
    // Determine target dimensions (do not upscale smaller images beyond original)
    const targetWidth = Math.min(size, origWidth);
    const targetHeight = Math.min(size, origHeight);

    const quality = size <= 160 ? 75 : size <= 320 ? 80 : size <= 640 ? 82 : 85;

    const pipeline = sharp(inputBuffer)
      .resize({
        width: targetWidth,
        height: targetHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality,
        effort: 4,
      });

    const { data: buffer, info } = await pipeline.toBuffer({ resolveWithObject: true });

    variants.push({
      size,
      key: `products/${hash}/${size}.webp`,
      buffer,
      contentType: "image/webp",
      width: info.width,
      height: info.height,
    });
  }

  // Primary key defaults to 320.webp for crisp, high-DPI product cards on mobile
  const primaryKey = `products/${hash}/320.webp`;

  return {
    originalKey,
    primaryKey,
    variants,
  };
}
