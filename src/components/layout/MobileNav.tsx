import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  PlusCircle,
  Users,
  Settings,
} from "lucide-react";
import { RoleGate } from "@/components/auth/RoleGate";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/jobs", icon: Briefcase, label: "Jobs" },
  { to: "/jobs/new", icon: PlusCircle, label: "New Job", highlight: true },
  { to: "/clients", icon: Users, label: "Clients", adminOnly: true },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function MobileNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-xs transition-all duration-200",
                  isActive
                    ? "text-brand"
                    : "text-muted-foreground hover:text-foreground",
                  item.highlight && !isActive && "text-brand/70"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "transition-all duration-200",
                      item.highlight ? "h-6 w-6" : "h-5 w-5",
                      isActive && "scale-110"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span
                    className={cn(
                      "text-[10px] leading-tight",
                      isActive && "font-semibold"
                    )}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-brand" />
                  )}
                </>
              )}
            </NavLink>
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
    </nav>
  );
}
