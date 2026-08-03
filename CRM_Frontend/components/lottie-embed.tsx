"use client";

import Lottie from "lottie-react";
import { useEffect, useState } from "react";

/** Load a free LottieFiles JSON animation by URL (no local asset required). */
export function LottieEmbed({
  src,
  className,
  loop = true,
}: {
  src: string;
  className?: string;
  loop?: boolean;
}) {
  const [data, setData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!data) {
    return <div className={className} aria-hidden />;
  }

  return <Lottie animationData={data} loop={loop} className={className} />;
}

/** Curated free Lottie CDN URLs used on the marketing home */
export const LOTTIE = {
  team: "https://assets9.lottiefiles.com/packages/lf20_jcikwtux.json",
  analytics: "https://assets2.lottiefiles.com/packages/lf20_qp1q7mct.json",
  secure: "https://assets10.lottiefiles.com/packages/lf20_xlmz9xwm.json",
  rocket: "https://assets5.lottiefiles.com/packages/lf20_llpgw8kd.json",
};
