import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "./Logo";
import { useTheme } from "./ThemeProvider";
import { useRecentSearches } from "@/context/RecentSearchesContext";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutGrid,
  Route as RouteIcon,
  Timer,
  Wind,
  Sparkles,
  NotebookPen,
  Moon,
  Sun,
  Compass,
  Smile,
  Search,
  PlusCircle,
  Settings,
  UserRound,
  Info,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: typeof Home };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Practice",
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/trainer", label: "Yoga Trainer", icon: UserRound },
      { href: "/guided", label: "Start practice", icon: Timer },
      { href: "/pathways", label: "Pathways", icon: RouteIcon },
      { href: "/builder", label: "Builder", icon: PlusCircle },
    ],
  },
  {
    label: "Explore",
    items: [
      { href: "/asanas", label: "Asana Library", icon: LayoutGrid },
      { href: "/breathing", label: "Breathing", icon: Wind },
      { href: "/affirmations", label: "Affirmations", icon: Sparkles },
      { href: "/kids", label: "Kids", icon: Smile },
    ],
  },
  {
    label: "You",
    items: [
      { href: "/journal", label: "Journal", icon: NotebookPen },
      { href: "/profiles", label: "Profiles", icon: Compass },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const MOBILE_PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/asanas", label: "Library", icon: LayoutGrid },
  { href: "/guided", label: "Practice", icon: Timer },
  { href: "/trainer", label: "Trainer", icon: UserRound },
  { href: "/profiles", label: "Paths", icon: Compass },
];

function SidebarSearch() {
  const [, navigate] = useLocation();
  const { recents, addRecent } = useRecentSearches();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const go = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    addRecent(trimmed);
    go(trimmed);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Search poses, breathing, kids…"
          className="pl-9"
          aria-label="Search Sadhana"
          data-testid="input-sidebar-search"
        />
      </div>
      {focused && (value.trim() || recents.length > 0) && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-border bg-popover p-1 shadow-soft-lg"
          data-testid="recent-searches"
        >
          {value.trim() ? (
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                submit();
              }}
              data-testid="search-submit-suggestion"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              Search for “{value.trim()}”
            </button>
          ) : null}
          {recents.length > 0 && (
            <>
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Recent
              </p>
              {recents.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setValue(r);
                    addRecent(r);
                    go(r);
                  }}
                  data-testid={`recent-search-${r.slice(0, 12)}`}
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  {r}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function isNavActive(href: string, location: string): boolean {
  if (href === "/") return location === "/";
  if (href === "/guided") return location === "/guided" || location === "/practice";
  return location.startsWith(href);
}

function NavMenu() {
  const [location] = useLocation();
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isNavActive(item.href, location);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      data-testid={`nav-${item.label.toLowerCase().split(" ")[0]}`}
                    >
                      <Link href={item.href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

function MobileBottomNav() {
  const [location] = useLocation();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Primary"
      data-testid="mobile-bottom-nav"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {MOBILE_PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(item.href, location);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const isWelcome = location === "/welcome";

  if (isWelcome) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-soft-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Skip to content
      </a>
      <Sidebar>
        <SidebarHeader className="px-4 py-4">
          <Link href="/">
            <Logo />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-2 pb-2">
              <SidebarSearch />
            </SidebarGroupContent>
          </SidebarGroup>
          <NavMenu />
        </SidebarContent>
        <SidebarFooter className="px-3 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full cursor-pointer justify-start gap-2"
            onClick={toggle}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <Button variant="ghost" size="sm" className="w-full cursor-pointer justify-start gap-2" asChild>
            <Link href="/welcome">
              <Info className="h-4 w-4" />
              About Sadhana
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="w-full cursor-pointer justify-start gap-2" asChild>
            <Link href="/design-system">
              <Sparkles className="h-4 w-4" />
              Design system
            </Link>
          </Button>
          <p className="px-2 pt-2 text-xs text-muted-foreground">
            Sādhanā — a daily, dedicated practice.
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div className="lg:hidden">
            <Logo />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-28 outline-none lg:px-8 lg:py-10 lg:pb-10"
        >
          {children}
        </main>
        <MobileBottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}
