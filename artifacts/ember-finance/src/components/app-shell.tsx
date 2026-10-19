import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { Button } from "@workspace/ember-design-system/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@workspace/ember-design-system/components/ui/sheet";
import { Flame, LayoutDashboard, ArrowLeftRight, WalletCards, Repeat2, ChartNoAxesCombined, Target, ChartPie, Sparkles, Settings2, Menu, LogOut, Plus } from "lucide-react";
import { cn } from "@workspace/ember-design-system/lib/utils";
import { Toaster } from "@workspace/ember-design-system/components/ui/toaster";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/accounts", label: "Accounts", icon: WalletCards },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat2 },
  { href: "/budgets", label: "Budgets", icon: ChartNoAxesCombined },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/reports", label: "Reports", icon: ChartPie },
  { href: "/coach", label: "Ember Coach", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

function Brand() {
  return <Link href="/dashboard" className="flex items-center gap-2.5" data-testid="link-brand">
    <span className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Flame className="size-5" /></span>
    <span className="text-lg font-semibold tracking-tight">Ember</span>
  </Link>;
}

function NavList({ onClick }: { onClick?: () => void }) {
  const [path] = useLocation();
  return <nav className="grid gap-1" aria-label="Main navigation">
    {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={onClick} data-testid={`nav-${label.toLowerCase().replaceAll(" ", "-")}`} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors", path === href ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <Icon className={cn("size-4", path === href && "text-primary")} />{label}
    </Link>)}
  </nav>;
}

function LogoutControl() {
  const { signOut } = useClerk();
  return <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })} data-testid="button-sign-out"><LogOut />Sign out</Button>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [path, setLocation] = useLocation();
  useEffect(() => {
    if (path === "/transactions") return;
    const openQuickAdd = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        (event.key === "n" || event.key === "N") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !target?.isContentEditable &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        event.preventDefault();
        setLocation("/transactions?quickAdd=1");
      }
    };
    window.addEventListener("keydown", openQuickAdd);
    return () => window.removeEventListener("keydown", openQuickAdd);
  }, [path, setLocation]);
  return <div className="ember-atmosphere dark min-h-[100dvh] text-foreground">
    <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[1600px]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/50 px-5 py-6 lg:flex">
        <Brand />
        <p className="mb-3 mt-10 px-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Your workspace</p>
        <NavList />
        <div className="mt-auto border-t border-border/50 pt-5">
          <div className="mb-4 px-3"><p className="truncate text-sm font-medium">{user?.fullName || user?.primaryEmailAddress?.emailAddress || "Your private space"}</p><p className="mt-1 text-xs text-muted-foreground">Personal finance workspace</p></div>
          <LogoutControl />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/50 bg-background/65 px-4 backdrop-blur-xl sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" data-testid="button-open-menu"><Menu /></Button></SheetTrigger>
              <SheetContent side="left" className="w-72 border-border bg-background p-5">
                <div className="mb-9"><Brand /></div><NavList onClick={() => setMobileOpen(false)} /><div className="mt-8"><LogoutControl /></div>
              </SheetContent>
            </Sheet>
            <span className="lg:hidden"><Brand /></span>
            <div className="hidden text-xs text-muted-foreground sm:block">A clearer view of your money</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/transactions?quickAdd=1" onClick={(event) => { if (path === "/transactions") { event.preventDefault(); window.dispatchEvent(new Event("ember:open-quick-add")); } }} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110" data-testid="button-quick-add"><Plus className="size-4" /><span className="hidden sm:inline">Add activity</span><kbd className="hidden rounded border border-primary-foreground/30 px-1 text-[10px] sm:inline">N</kbd></Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-7 sm:py-9 lg:px-10">{children}</main>
      </div>
    </div>
    <Toaster />
  </div>;
}
