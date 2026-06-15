import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Landmark, Menu, Search, X } from "lucide-react";
import { navigation } from "@/components/layout/navigation";
import { Button } from "@/components/ui/button";
import { loadDemoData } from "@/lib/storage";
import { cn } from "@/lib/utils";

type SearchResult = {
  id: string;
  label: string;
  sub: string;
  path: string;
  type: "system" | "vendor";
};

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { systems, vendors } = useMemo(() => loadDemoData(), []);

  const results: SearchResult[] = query.trim().length < 1 ? [] : [
    ...systems
      .filter((s) =>
        s.systemName.toLowerCase().includes(query.toLowerCase()) ||
        s.systemId.toLowerCase().includes(query.toLowerCase()) ||
        s.businessUnit.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 5)
      .map((s) => ({
        id: s.systemId,
        label: s.systemName,
        sub: `${s.systemId} · ${s.businessUnit}`,
        path: `/report?systemId=${s.systemId}`,
        type: "system" as const,
      })),
    ...vendors
      .filter((v) =>
        v.vendorName.toLowerCase().includes(query.toLowerCase()) ||
        v.vendorId.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 3)
      .map((v) => ({
        id: v.vendorId,
        label: v.vendorName,
        sub: `${v.vendorId} · 供應商`,
        path: `/vendors`,
        type: "vendor" as const,
      })),
  ];

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setQuery(""); }
    }
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => { document.removeEventListener("keydown", handleKey); document.removeEventListener("mousedown", handleClick); };
  }, []);

  function handleSelect(result: SearchResult) {
    navigate(result.path);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative hidden md:block">
      {open ? (
        <div className="flex w-72 items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-md ring-1 ring-primary/30">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋系統、供應商…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={() => { setOpen(false); setQuery(""); }} aria-label="Close search">
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <Search className="h-4 w-4" />
          搜尋系統、供應商…
        </button>
      )}

      {open && query.trim().length > 0 && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border bg-card shadow-lg">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">找不到「{query}」相關結果</div>
          ) : (
            <ul className="py-1">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-muted"
                    onClick={() => handleSelect(result)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        result.type === "system" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {result.type === "system" ? "系統" : "供應商"}
                      </span>
                      <span className="text-sm font-medium">{result.label}</span>
                    </div>
                    <span className="pl-7 text-xs text-muted-foreground">{result.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

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
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex flex-col leading-tight">
                <span>{item.title}</span>
                <span className="text-xs font-normal text-muted-foreground/70">{item.subtitle}</span>
              </span>
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
          <GlobalSearch />
        </header>
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠️ 本平台為 POC 展示，所有資料均為<strong>模擬假資料</strong>，不代表任何真實機構之盤點結果，不取代 CBOM／CMDB／GRC／SIEM 等專業工具。
        </div>
        <main className="px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
