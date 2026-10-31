import type { LucideIcon } from "lucide-react"
import { Link } from "wouter"

import { cn } from "@/lib/utils"

export type BottomNavItem = {
  href: string
  label: string
  icon: LucideIcon
  active?: boolean
  testId?: string
}

/**
 * Primary mobile bar. min-h-14 = --nav-item-min-height, text-2xs = --text-2xs,
 * px-1 = --space-1, font-medium = --font-weight-medium. The active item uses
 * sage (--primary); the bar sits on --background with a --border hairline.
 */
export function BottomNav({
  items,
  label = "Primary",
  testId = "mobile-bottom-nav",
  className,
  inline = false,
}: {
  items: BottomNavItem[]
  label?: string
  testId?: string
  className?: string
  /** In-flow preview. The app shell uses the fixed bar. */
  inline?: boolean
}) {
  return (
    <nav
      className={cn(
        "border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur",
        inline
          ? "rounded-2xl border shadow-soft"
          : "fixed inset-x-0 bottom-0 z-30 lg:hidden",
        className,
      )}
      aria-label={label}
      data-testid={testId}
    >
      <ul
        className="mx-auto grid max-w-lg"
        style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 px-1 text-2xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  item.active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={item.active ? "page" : undefined}
                data-testid={item.testId}
              >
                <Icon className={cn("h-5 w-5", item.active && "stroke-[2.25]")} />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
