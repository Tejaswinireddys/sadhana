import * as React from "react"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Quiet label. rounded-full = --radius-full, text-xs = --text-xs,
 * font-semibold = --font-weight-semibold, px-2/py-1 = --space-2/--space-1.
 * Tones: mist (neutral), sage, leaf, and an outline that keeps the ink color.
 */
const tagVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold leading-none",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-muted text-foreground",
        sage: "border-transparent bg-primary text-primary-foreground",
        leaf: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-[color:var(--badge-outline)] bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
)

export interface TagProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof tagVariants> {}

function Tag({ className, tone, ...props }: TagProps) {
  return <span className={cn(tagVariants({ tone }), className)} {...props} />
}

export { Tag, tagVariants }
