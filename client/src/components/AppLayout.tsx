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
import { Logo } from "./Logo";
import { useTheme } from "./ThemeProvider";
import {
  Home,
  LayoutGrid,
  Route as RouteIcon,
  Timer,
  Sparkles,
  NotebookPen,
  Moon,
  Sun,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/asanas", label: "Asana Library", icon: LayoutGrid },
  { href: "/pathways", label: "Pathways", icon: RouteIcon },
  { href: "/practice", label: "Practice", icon: Timer },
  { href: "/affirmations", label: "Affirmations", icon: Sparkles },
  { href: "/journal", label: "Journal", icon: NotebookPen },
];

function NavMenu() {
  const [location] = useLocation();
  return (
    <SidebarMenu>
      {NAV.map((item) => {
        const active =
          item.href === "/" ? location === "/" : location.startsWith(item.href);
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
