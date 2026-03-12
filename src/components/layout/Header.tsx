import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/jobs": "Jobs",
  "/jobs/new": "New Job",
  "/clients": "Clients",
  "/settings": "Settings",
  "/ai/logo": "AI Logo Tool",
  "/estimates": "Estimates",
};

function getPageTitle(pathname: string): string {
  // Exact match
  if (routeTitles[pathname]) return routeTitles[pathname];

  // Dynamic routes
  if (pathname.startsWith("/jobs/")) return "Job Detail";
  if (pathname.startsWith("/clients/")) return "Client Detail";
  if (pathname.startsWith("/estimates/")) return "Estimate Builder";

  return "SignShop Pro";
}

export function Header() {
  const { profile, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const title = getPageTitle(location.pathname);
  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      {/* Left: Page title */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      {/* Right: User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-9 w-9 rounded-full"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-brand/10 text-brand text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{profile?.full_name ?? "User"}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {profile?.email}
                </p>
                <Badge
                  variant={isAdmin ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {isAdmin ? "Admin" : "Client"}
                </Badge>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-danger">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
