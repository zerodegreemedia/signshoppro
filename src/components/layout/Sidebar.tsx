import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { RoleGate } from "@/components/auth/RoleGate";
import { useAuth } from "@/hooks/useAuth";
import { useJobStats } from "@/hooks/useJobs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  adminOnly?: boolean;
  badge?: number;
}

const mainItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/jobs", icon: Briefcase, label: "Jobs" },
  { to: "/clients", icon: Users, label: "Clients", adminOnly: true },
  { to: "/estimates", icon: FileText, label: "Estimates" },
];

const toolItems: NavItem[] = [
  { to: "/ai/logo", icon: Sparkles, label: "AI Logo Studio" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function NavSection({
  label,
  items,
  collapsed,
}: {
  label: string;
  items: NavItem[];
  collapsed: boolean;
}) {
  return (
    <div className="space-y-1">
      {!collapsed && (
        <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {label}
        </span>
      )}
      {items.map((item) => {
        const link = (
          <Tooltip key={item.to}>
            <TooltipTrigger asChild>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-brand-glow text-primary"
                      : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
                    collapsed && "justify-center px-2"
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <span className="flex-1">{item.label}</span>
                )}
                {!collapsed && item.badge !== undefined && item.badge > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-auto bg-primary text-primary-foreground text-[10px] px-1.5 py-0 min-w-[20px] justify-center"
                  >
                    {item.badge}
                  </Badge>
                )}
              </NavLink>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                {item.label}
                {item.badge !== undefined && item.badge > 0 && ` (${item.badge})`}
              </TooltipContent>
            )}
          </Tooltip>
        );

        if (item.adminOnly) {
          return (
            <RoleGate key={item.to} requiredRole="admin">
              {link}
            </RoleGate>
          );
        }

        return link;
      })}
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, isAdmin } = useAuth();
  const { data: stats } = useJobStats();

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  // Inject active job count badge into the Jobs nav item
  const mainWithBadges = mainItems.map((item) => {
    if (item.to === "/jobs" && stats) {
      return { ...item, badge: stats.activeJobs };
    }
    return item;
  });

  return (
    <aside
      className={cn(
        "noise-overlay relative hidden md:flex flex-col border-r border-border transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
      style={{
        background: "linear-gradient(180deg, var(--background), oklch(0.13 0.02 260))",
      }}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <img src="/logo.svg" alt="SignShop Pro" className="h-8 w-8 shrink-0 rounded-lg" />
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight font-[family-name:var(--font-display)]">
            SignShop Pro
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 p-2 pt-4">
        <TooltipProvider delayDuration={0}>
          <NavSection label="Main" items={mainWithBadges} collapsed={collapsed} />
          <NavSection label="Tools" items={toolItems} collapsed={collapsed} />
        </TooltipProvider>
      </nav>

      {/* User info */}
      <div className="border-t border-border p-2">
        {!collapsed ? (
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-brand-glow text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {profile?.full_name ?? "User"}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {isAdmin ? "Admin" : "Client"}
              </p>
            </div>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center py-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-brand-glow text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {profile?.full_name ?? "User"} ({isAdmin ? "Admin" : "Client"})
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Collapse toggle */}
      <Separator />
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full min-h-[44px] transition-all duration-200",
            collapsed && "px-2"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
