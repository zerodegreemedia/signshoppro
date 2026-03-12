import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
