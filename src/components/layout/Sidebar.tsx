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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/jobs", icon: Briefcase, label: "Jobs" },
  { to: "/clients", icon: Users, label: "Clients", adminOnly: true },
  { to: "/estimates", icon: FileText, label: "Estimates" },
  { to: "/ai/logo", icon: Sparkles, label: "AI Logo Tool" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground font-bold text-sm">
          S
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight">
            SignShop Pro
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
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
                          ? "bg-brand/10 text-brand"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        collapsed && "justify-center px-2"
                      )
                    }
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">{item.label}</TooltipContent>
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
        </TooltipProvider>
      </nav>

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
