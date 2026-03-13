import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  MoreHorizontal,
  Plus,
  Camera,
  FileText,
  Search,
  Sparkles,
  Settings,
  HelpCircle,
} from "lucide-react";
import { RoleGate } from "@/components/auth/RoleGate";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/jobs", icon: Briefcase, label: "Jobs" },
  // FAB goes in between
  { to: "/clients", icon: Users, label: "Clients", adminOnly: true },
];

const fabActions = [
  { to: "/jobs/new", icon: Briefcase, label: "New Job" },
  { to: "/photos/quick", icon: Camera, label: "Quick Photo" },
  { to: "/estimates/new", icon: FileText, label: "New Estimate" },
  { action: "search", icon: Search, label: "Search" },
];

const moreItems = [
  { to: "/estimates", icon: FileText, label: "Estimates" },
  { to: "/ai/logo", icon: Sparkles, label: "AI Logo Studio" },
  { to: "/settings", icon: Settings, label: "Settings" },
  { to: "/help", icon: HelpCircle, label: "Help" },
];

function NavButton({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        cn(
          "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs transition-all duration-200",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn("h-5 w-5 transition-all duration-200", isActive && "scale-110")}
            strokeWidth={isActive ? 2.5 : 2}
          />
          <span className={cn("text-[10px] leading-tight", isActive && "font-semibold")}>
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function MobileNav() {
  const [fabOpen, setFabOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  const handleFabAction = (action: (typeof fabActions)[number]) => {
    setFabOpen(false);
    if (action.action === "search") {
      window.dispatchEvent(new CustomEvent("open-command-palette"));
      return;
    }
    if (action.to) {
      navigate(action.to);
    }
  };

  const handleMoreAction = (item: (typeof moreItems)[number]) => {
    setMoreOpen(false);
    navigate(item.to);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-16 items-center justify-around">
        {/* Home */}
        <NavButton item={navItems[0]} />

        {/* Jobs */}
        <NavButton item={navItems[1]} />

        {/* Center FAB */}
        <div className="relative flex items-center justify-center">
          <Sheet open={fabOpen} onOpenChange={setFabOpen}>
            <SheetTrigger asChild>
              <button
                className="absolute -top-5 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg active-press"
                style={{
                  background: "linear-gradient(135deg, var(--primary), oklch(0.65 0.20 35))",
                }}
                aria-label="Quick actions"
              >
                <Plus className="h-6 w-6" strokeWidth={2.5} />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Quick Actions</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-3 py-4">
                {fabActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleFabAction(action)}
                    className="flex min-h-[44px] items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/10 active-press"
                  >
                    <action.icon className="h-5 w-5 text-primary" />
                    {action.label}
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Clients (admin only) */}
        <RoleGate requiredRole="admin">
          <NavButton item={navItems[2]} />
        </RoleGate>

        {/* More */}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs transition-all duration-200",
                moreOpen
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] leading-tight">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="space-y-1 py-4">
              {moreItems.map((item) => (
                <button
                  key={item.to}
                  onClick={() => handleMoreAction(item)}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/10 active-press"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  {item.label}
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
