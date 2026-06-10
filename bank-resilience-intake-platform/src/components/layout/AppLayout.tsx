import { NavLink, Outlet } from "react-router-dom";
import { Landmark, Menu, Search } from "lucide-react";
import { navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-card lg:block">
        <div className="flex h-20 items-center gap-3 border-b px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Bank Resilience</div>
            <div className="text-xs text-muted-foreground">Intake Platform</div>
          </div>
        </div>
        <nav className="space-y-1 p-4">
          {navigation.slice(0, 8).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-secondary text-primary"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="lg:hidden" aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <div className="text-xs font-medium uppercase text-muted-foreground">銀行科技韌性前期盤點平台</div>
              <h1 className="text-lg font-semibold">PQC / Quantum Readiness 治理</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground md:flex">
            <Search className="h-4 w-4" />
            Search systems, vendors, policies
          </div>
        </header>
        <main className="px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
