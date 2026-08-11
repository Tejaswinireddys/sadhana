import { useEffect, useMemo, useRef, useState } from "react";
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
import { APP_SHELL_ID } from "./FullScreenOverlay";
import { useAuth } from "@/lib/auth";
import { useRecentSearches } from "@/context/RecentSearchesContext";
import { searchPoses } from "@/lib/poseSearch";
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
    label: "Today",
    items: [
      { href: "/", label: "Today", icon: Home },
      { href: "/adaptive", label: "Adaptive", icon: Sparkles },
      { href: "/guided", label: "Practice", icon: Timer },
      { href: "/trainer", label: "Coach", icon: UserRound },
    ],
  },
  {
    label: "Explore",
    items: [
      { href: "/asanas", label: "Poses", icon: LayoutGrid },
      { href: "/pathways", label: "Programs", icon: RouteIcon },
      { href: "/instructors", label: "Teachers", icon: Compass },
      { href: "/pose-coach", label: "Pose self-check", icon: Smile },
      { href: "/breathing", label: "Breathing", icon: Wind },
      { href: "/affirmations", label: "Affirmations", icon: Sparkles },
      { href: "/kids", label: "Kids", icon: Smile },
      { href: "/builder", label: "Builder", icon: PlusCircle },
      { href: "/challenges", label: "Challenges", icon: Sparkles },
    ],
  },
  {
    label: "Progress",
    items: [
      { href: "/journal", label: "Journal", icon: NotebookPen },
      { href: "/profiles", label: "My path", icon: Compass },
      { href: "/household", label: "Household", icon: UserRound },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/account", label: "Account", icon: UserRound },
      // Workplace/Corporate is an unfinished prototype (local-only, no real
      // tenancy/SSO), so it is intentionally kept out of consumer navigation.
      // The /corporate route still resolves for anyone with a direct link.
    ],
  },
];

const MOBILE_PRIMARY: NavItem[] = [
  { href: "/", label: "Today", icon: Home },
  { href: "/guided", label: "Practice", icon: Timer },
  { href: "/trainer", label: "Coach", icon: UserRound },
  { href: "/pathways", label: "Programs", icon: RouteIcon },
  { href: "/asanas", label: "Poses", icon: LayoutGrid },
];

function SidebarSearch() {
  const [location, navigate] = useLocation();
  const { recents, addRecent } = useRecentSearches();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  // Explicit dismissal. Blur alone wasn't enough: pressing Enter navigated but
  // left the panel open on top of the sidebar, covering the nav links, with two
  // search boxes on screen holding the same value.
  const [dismissed, setDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => searchPoses(value, 6), [value]);

  const close = () => {
    setDismissed(true);
    setFocused(false);
    inputRef.current?.blur();
  };

  const go = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    close();
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    addRecent(trimmed);
    go(trimmed);
  };

  // Any route change closes the panel — including one triggered from inside it.
  useEffect(() => {
    setDismissed(true);
    setFocused(false);
  }, [location]);

  const open = focused && !dismissed && (value.trim() !== "" || recents.length > 0);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDismissed(false);
          }}
          onFocus={() => {
            setFocused(true);
            setDismissed(false);
          }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
          placeholder="Search poses, breathing, kids…"
          className="pl-9"
          aria-label="Search Sadhana"
          aria-expanded={open}
          aria-controls="sidebar-search-suggestions"
          role="combobox"
          data-testid="input-sidebar-search"
        />
      </div>
      {open && (
        <div
          id="sidebar-search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-soft-lg"
          data-testid="recent-searches"
        >
          {/* Live preview. Showing only "Search for …" made the user navigate
              just to discover whether anything matched. */}
          {suggestions.items.length > 0 && (
            <>
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Poses
              </p>
              {suggestions.items.map((pose) => (
                <button
                  key={pose.slug}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addRecent(value.trim());
                    navigate(`/asanas/${pose.slug}`);
                    close();
                  }}
                  data-testid={`search-suggestion-${pose.slug}`}
                >
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-accent/30">
                    <img
                      src={`${import.meta.env.BASE_URL}poses/${pose.slug}.png`}
                      alt=""
                      aria-hidden
                      className="h-full w-full scale-[1.35] object-contain"
                      loading="eager"
                      decoding="async"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{pose.english}</span>
                    <span className="block truncate text-xs italic text-muted-foreground">
                      {pose.sanskrit}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}
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
              {suggestions.total > 0
                ? `See all ${suggestions.total} results for \u201C${value.trim()}\u201D`
                : `Search for \u201C${value.trim()}\u201D`}
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
  const { user, isSignedIn } = useAuth();
  const isChromeFree =
    location === "/welcome" ||
    location === "/register" ||
    location === "/start" ||
    location === "/verify";

  if (isChromeFree) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      {/* Full-screen experiences (the guided player) mark this inert so the
          chrome underneath leaves the tab order and the a11y tree. */}
      <div id={APP_SHELL_ID} className="contents">
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
            asChild
            data-testid="sidebar-account"
          >
            <Link href="/account">
              <UserRound className="h-4 w-4" />
              <span className="truncate">
                {isSignedIn ? (user?.displayName || user?.email) : "Sign in"}
              </span>
            </Link>
          </Button>
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
          <Button variant="ghost" size="sm" className="min-h-11 w-full cursor-pointer justify-start gap-2" asChild>
            <Link href="/welcome">
              <Info className="h-4 w-4" />
              About Sadhana
            </Link>
          </Button>
          <p className="px-2 pt-1 text-xs text-muted-foreground">
            <Link href="/privacy" className="underline-offset-2 hover:underline">
              Privacy
            </Link>
            {" · "}
            <Link href="/terms" className="underline-offset-2 hover:underline">
              Terms
            </Link>
            {" · "}
            <Link href="/health-disclaimer" className="underline-offset-2 hover:underline">
              Health
            </Link>
          </p>
          <p className="px-2 pt-2 text-xs text-muted-foreground">
            Sādhanā — a daily, dedicated practice.
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur lg:px-6">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div className="min-w-0 flex-1 lg:hidden">
            <Logo />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto cursor-pointer lg:hidden"
            asChild
            data-testid="mobile-header-search"
          >
            <Link href="/search" aria-label="Search Sadhana">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
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
      </div>
    </SidebarProvider>
  );
}
