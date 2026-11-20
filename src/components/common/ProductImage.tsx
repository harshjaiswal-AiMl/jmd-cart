"use client";

import { useState } from "react";
import { mediaUrl, mediaSrcSet, MediaVariantSize } from "@/lib/media";
import { ImageIcon } from "lucide-react";

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  size?: MediaVariantSize;
  className?: string;
  placeholderClassName?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export function ProductImage({
  src,
  alt = "Product",
  size = 320,
  className = "w-full h-full object-contain",
  placeholderClassName = "w-full h-full flex items-center justify-center bg-gray-50 text-gray-300",
  width = 180,
  height = 180,
  priority = false,
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);

  const resolvedUrl = mediaUrl(src, size);
  const srcSet = mediaSrcSet(src, [160, 320, 640]);

  if (!src || hasError) {
    return (
      <div className={placeholderClassName}>
        <ImageIcon className="w-6 h-6 stroke-1 text-gray-300" />
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      srcSet={srcSet || undefined}
      sizes="(max-width: 640px) 160px, (max-width: 1024px) 240px, 320px"
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setHasError(true)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
