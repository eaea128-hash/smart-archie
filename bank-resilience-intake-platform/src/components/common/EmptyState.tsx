import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const iconSize = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-12 w-12" : "h-8 w-8";
  const py = size === "sm" ? "py-6" : size === "lg" ? "py-16" : "py-10";

  return (
    <div className={cn("flex flex-col items-center justify-center text-center", py, className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40 mb-3">
        <Icon className={cn(iconSize, "text-muted-foreground opacity-50")} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
