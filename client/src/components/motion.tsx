import { type ReactNode, useEffect, useState } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/** Shared motion tokens — opacity/transform only; short for controls. */
export const motionTokens = {
  duration: {
    fast: 0.15,
    base: 0.22,
    slow: 0.4,
  },
  ease: [0.22, 1, 0.36, 1] as const,
  distance: 10,
};

function motionOff(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("motion-off");
}

export function useMotionEnabled() {
  const prefersReduced = useReducedMotion();
  const [enabled, setEnabled] = useState(() => !prefersReduced && !motionOff());

  useEffect(() => {
    const sync = () => setEnabled(!prefersReduced && !motionOff());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [prefersReduced]);

  return enabled;
}

type FadeProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** Page or block entrance — opacity + slight rise. */
export function FadeIn({ children, className, delay = 0, ...rest }: FadeProps) {
  const enabled = useMotionEnabled();
  if (!enabled) {
    return (
      <div className={className} {...(rest as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: motionTokens.distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: motionTokens.duration.base,
        ease: motionTokens.ease,
        delay,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Scroll/section reveal — runs once when in view. */
export function Reveal({ children, className, delay = 0, ...rest }: FadeProps) {
  const enabled = useMotionEnabled();
  if (!enabled) {
    return (
      <div className={className} {...(rest as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: motionTokens.distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: motionTokens.duration.slow,
        ease: motionTokens.ease,
        delay,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Press feedback wrapper for custom controls. */
export function Pressable({
  children,
  className,
  ...rest
}: FadeProps) {
  const enabled = useMotionEnabled();
  if (!enabled) {
    return (
      <div className={cn("cursor-pointer", className)} {...(rest as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={cn("cursor-pointer", className)}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: motionTokens.duration.fast }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
