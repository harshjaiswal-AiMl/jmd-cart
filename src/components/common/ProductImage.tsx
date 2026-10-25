"use client";

import { useState } from "react";
import { mediaUrl } from "@/lib/media";
import { ImageIcon } from "lucide-react";

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  size?: 400 | 800 | 1200;
  className?: string;
  placeholderClassName?: string;
}

export function ProductImage({
  src,
  alt = "Product",
  size,
  className = "w-full h-full object-contain",
  placeholderClassName = "w-full h-full flex items-center justify-center bg-gray-50 text-gray-300",
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = mediaUrl(src, size);

  if (!resolvedUrl || hasError) {
    return (
      <div className={placeholderClassName}>
        <ImageIcon className="w-6 h-6 stroke-1 text-gray-300" />
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
