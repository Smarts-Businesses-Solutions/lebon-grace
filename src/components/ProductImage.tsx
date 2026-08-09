"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Product photography, served through Next's image optimizer.
 *
 * Every image on the site was a raw <img> pointing straight at the file in
 * public/, so a visitor downloaded the full-size PNG no matter how small it was
 * rendered. The homepage grid draws these at roughly 300 CSS pixels and was
 * pulling 4.2MB each. The same file through the optimizer at w=640 is 60KB of
 * WebP — about seventy times less — because the optimizer resizes to the
 * requested width and negotiates format from the Accept header.
 *
 * The source files stay PNG. Nothing is renamed, no catalogue URL changes, and
 * a browser that does not accept WebP still gets a correctly sized PNG.
 *
 * Quality is left at Next's default of 75. Next 16 only serves the qualities
 * listed in images.qualities, which defaults to [75] alone, so passing 80 or 85
 * here produced a q=75 URL anyway — a prop that silently did nothing. At 75 a
 * card image is about 60KB of WebP, which is plenty for this photography.
 *
 * `sizes` is not optional in practice. It tells the optimizer which widths to
 * generate for the srcset, and getting it wrong is the one way to make this
 * slower than what it replaced: omit it and every caller falls back to 100vw,
 * so a thumbnail downloads a full-width image. Pass the width the image will
 * actually occupy at each breakpoint.
 */
export default function ProductImage({
  src,
  alt,
  sizes,
  className = "object-cover",
  priority = false,
}: {
  src?: string | null;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  // The call sites this replaces all used onError to set display:none, which
  // left the container showing its placeholder colour. Rendering nothing here
  // reproduces that, rather than leaving a broken-image icon.
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
