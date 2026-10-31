import type { ImgHTMLAttributes } from "react";
/** Existing pose PNGs have reviewed WebP equivalents; preserve the PNG fallback. */
export function PoseReferenceImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const src = props.src;
  const webp = src?.includes("/poses/") && src.endsWith(".png") ? src.slice(0, -4) + ".webp" : null;
  return <picture className="contents">
    {webp && <source srcSet={webp} type="image/webp" />}
    <img {...props} loading={props.loading ?? "lazy"} />
  </picture>;
}
