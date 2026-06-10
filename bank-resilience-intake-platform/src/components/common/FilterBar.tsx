import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterChip {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

interface FilterBarProps {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  chips?: FilterChip[];
  resultCount?: number;
  className?: string;
}

export function FilterBar({
  search,
  onSearch,
  placeholder = "搜尋…",
  chips = [],
  resultCount,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border bg-background py-1.5 pl-8 pr-8 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {chips.map(chip => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClick}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            chip.active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:bg-muted",
          )}
        >
          {chip.label}
        </button>
      ))}

      {resultCount !== undefined && (
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {resultCount} 筆
        </span>
      )}
    </div>
  );
}
