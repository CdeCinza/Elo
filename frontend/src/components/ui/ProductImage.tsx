'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

export function ProductImage({ src, alt, className = 'w-full h-full object-cover' }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <span role="img" aria-label="Foto indisponível" className="w-full h-full flex items-center justify-center bg-[#F5F1EC]">
        <ImageOff aria-hidden="true" className="w-5 h-5 text-[#A8A199]" />
      </span>
    );
  }

  return (
    <span className="relative block w-full h-full">
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-[#F5F1EC]">
        <ImageOff className="w-5 h-5 text-[#A8A199]" />
      </span>
      <img src={src} alt={alt} className={`absolute inset-0 ${className}`} onError={() => setFailedSrc(src)} />
    </span>
  );
}
