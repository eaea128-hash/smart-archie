/**
 * RiskBadge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 統一的風險顏色設計系統。
 * 所有頁面的風險等級顯示都應使用此模組，確保色彩一致性。
 *
 * 設計規則（不得在其他地方 hardcode 風險顏色）：
 *   critical / 極高 → Rose 系
 *   high            → Orange 系
 *   medium          → Amber 系
 *   low             → Emerald 系
 */

import type { RiskLevel } from "@/data/demo-data";
import { cn } from "@/lib/utils";

// ─── Risk level config (Single Source of Truth) ───────────────────────────────

export const RISK_CONFIG = {
  critical: {
    label: "重大",
    hndlLabel: "極高風險",
    badgeCls: "border-rose-300 bg-rose-100 text-rose-800",
    textCls:  "text-rose-600",
    bgCls:    "bg-rose-50",
    barCls:   "bg-rose-500",
    dotCls:   "bg-rose-500",
    iconCls:  "text-rose-500",
  },
  high: {
    label: "高",
    hndlLabel: "高風險",
    badgeCls: "border-orange-300 bg-orange-100 text-orange-800",
    textCls:  "text-orange-500",
    bgCls:    "bg-orange-50",
    barCls:   "bg-orange-400",
    dotCls:   "bg-orange-400",
    iconCls:  "text-orange-500",
  },
  medium: {
    label: "中",
    hndlLabel: "中風險",
    badgeCls: "border-amber-300 bg-amber-100 text-amber-800",
    textCls:  "text-amber-500",
    bgCls:    "bg-amber-50",
    barCls:   "bg-amber-400",
    dotCls:   "bg-amber-400",
    iconCls:  "text-amber-500",
  },
  low: {
    label: "低",
    hndlLabel: "低風險",
    badgeCls: "border-emerald-300 bg-emerald-100 text-emerald-800",
    textCls:  "text-emerald-600",
    bgCls:    "bg-emerald-50",
    barCls:   "bg-emerald-400",
    dotCls:   "bg-emerald-400",
    iconCls:  "text-emerald-500",
  },
} as const satisfies Record<RiskLevel, {
  label: string; hndlLabel: string; badgeCls: string; textCls: string;
  bgCls: string; barCls: string; dotCls: string; iconCls: string;
}>;

export function getRiskConfig(level: RiskLevel | string) {
  return RISK_CONFIG[level as RiskLevel] ?? RISK_CONFIG.low;
}

// ─── Components ────────────────────────────────────────────────────────────────

interface RiskBadgeProps {
  level: RiskLevel | string;
  variant?: "business" | "hndl";
  className?: string;
}

/** 業務重要性或 HNDL 風險等級的一致性 Badge */
export function RiskBadge({ level, variant = "business", className }: RiskBadgeProps) {
  const cfg = getRiskConfig(level);
  const label = variant === "hndl" ? cfg.hndlLabel : cfg.label;
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
      cfg.badgeCls,
      className,
    )}>
      {label}
    </span>
  );
}

interface HndlScorePillProps {
  score: number;
  showBar?: boolean;
  className?: string;
}

/** HNDL 評分圓角標籤，顏色自動對應風險等級 */
export function HndlScorePill({ score, showBar = false, className }: HndlScorePillProps) {
  const level: RiskLevel = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "medium" : "low";
  const cfg = getRiskConfig(level);

  if (showBar) {
    return (
      <div className={cn("flex items-center gap-2 min-w-24", className)}>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full", cfg.barCls)} style={{ width: `${score}%` }} />
        </div>
        <span className={cn("text-xs font-semibold tabular-nums", cfg.textCls)}>{score}</span>
      </div>
    );
  }

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
      cfg.badgeCls,
      className,
    )}>
      {score}
    </span>
  );
}

interface PriorityBadgeProps {
  priority: "P1" | "P2" | "P3";
  className?: string;
}

/** 任務優先級 Badge */
export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const cls =
    priority === "P1" ? "border-rose-200 bg-rose-50 text-rose-700" :
    priority === "P2" ? "border-amber-200 bg-amber-50 text-amber-700" :
                        "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", cls, className)}>
      {priority}
    </span>
  );
}

interface SourceTagProps {
  source: string;
  className?: string;
}

/** 政策來源標籤 */
export function SourceTag({ source, className }: SourceTagProps) {
  const cls =
    source.includes("FSC") ? "border-blue-200 bg-blue-50 text-blue-700" :
    source.includes("NIST") ? "border-indigo-200 bg-indigo-50 text-indigo-700" :
    source.includes("CISA") ? "border-rose-200 bg-rose-50 text-rose-700" :
    "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", cls, className)}>
      {source}
    </span>
  );
}
