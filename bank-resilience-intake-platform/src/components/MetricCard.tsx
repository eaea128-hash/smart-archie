import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  helper?: string;
  tone?: "default" | "success" | "warn" | "danger";
  className?: string;
}

export function MetricCard({ icon: Icon, label, value, helper, tone = "default", className }: MetricCardProps) {
  const text = {
    default: "text-foreground",
    success: "text-emerald-600",
    warn: "text-amber-600",
    danger: "text-rose-600",
  }[tone];

  return (
    <Card className={className}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className={cn("mt-3 text-3xl font-semibold tabular-nums", text)}>{value}</div>
        {helper && <p className="mt-2 text-xs text-muted-foreground">{helper}</p>}
      </CardContent>
    </Card>
  );
}
