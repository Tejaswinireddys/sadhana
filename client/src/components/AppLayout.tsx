import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
} from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/asanas", label: "Asana Library", icon: LayoutGrid },
  { href: "/pathways", label: "Pathways", icon: RouteIcon },
  { href: "/guided", label: "Practice", icon: Timer },
  { href: "/breathing", label: "Breathing", icon: Wind },
  { href: "/affirmations", label: "Affirmations", icon: Sparkles },
  { href: "/journal", label: "Journal", icon: NotebookPen },
  { href: "/profiles", label: "Profiles", icon: Compass },
  { href: "/builder", label: "Builder", icon: PlusCircle },
  { href: "/kids", label: "Kids", icon: Smile },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarSearch() {
  const [, navigate] = useLocation();
  const { recents, addRecent } = useRecentSearches();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (q: string) => {
    const trimmed = q.trim();
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  // Debounced live navigation as the user types (200ms).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) return;
    debounceRef.current = setTimeout(() => {
      go(value);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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
          placeholder="Search poses, breathing, affirmations…"
          className="pl-9"
          aria-label="Search Sadhana"
          data-testid="input-sidebar-search"
        />
      </div>
      {focused && recents.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-border bg-popover p-1 shadow-soft-lg"
          data-testid="recent-searches"
        >
          <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Recent
          </p>
          {recents.map((r) => (
            <button
              key={r}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
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
        </div>
      )}
    </div>
  );
}

function NavMenu() {
  const [location] = useLocation();
  return (
    <SidebarMenu>
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? location === "/"
            : item.href === "/guided"
              ? location === "/guided" || location === "/practice"
              : location.startsWith(item.href);
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton asChild isActive={active} data-testid={`nav-${item.label.toLowerCase().split(" ")[0]}`}>
              <Link href={item.href}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  return (
    <SidebarProvider>
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
          <SidebarGroup>
            <SidebarGroupContent>
              <NavMenu />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="px-3 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={toggle}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <p className="px-2 pt-2 text-xs text-muted-foreground">
            Sādhanā — a daily, dedicated practice.
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div className="md:hidden">
            <Logo />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8 md:py-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
