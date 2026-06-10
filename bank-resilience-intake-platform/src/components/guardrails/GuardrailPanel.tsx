/**
 * GuardrailPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 顯示 guardrails.ts 產生的資料品質防呆警示。
 * 設計為可嵌入 Dashboard 或任何頁面的獨立元件。
 */

import { useState } from "react";
import {
  AlertTriangle, ChevronDown, ChevronUp, Info,
  ShieldAlert, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GuardrailAlert, GuardrailSeverity } from "@/lib/guardrails";
import { countBySeverity } from "@/lib/guardrails";
import { cn } from "@/lib/utils";

// ─── Severity config ──────────────────────────────────────────────────────────

const SEV_CFG: Record<GuardrailSeverity, {
  Icon: typeof AlertTriangle;
  label: string;
  cardCls: string;
  iconCls: string;
  badgeCls: string;
}> = {
  error: {
    Icon: XCircle,
    label: "錯誤",
    cardCls: "border-rose-200 bg-rose-50/40",
    iconCls: "text-rose-500",
    badgeCls: "border-rose-200 bg-rose-100 text-rose-800",
  },
  warning: {
    Icon: AlertTriangle,
    label: "警告",
    cardCls: "border-amber-200 bg-amber-50/40",
    iconCls: "text-amber-500",
    badgeCls: "border-amber-200 bg-amber-100 text-amber-800",
  },
  info: {
    Icon: Info,
    label: "資訊",
    cardCls: "border-blue-200 bg-blue-50/40",
    iconCls: "text-blue-500",
    badgeCls: "border-blue-200 bg-blue-100 text-blue-800",
  },
};

// ─── Components ────────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: GuardrailAlert }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEV_CFG[alert.severity];
  const Icon = cfg.Icon;

  return (
    <div className={cn("rounded-lg border", cfg.cardCls)}>
      <button
        type="button"
        className="w-full text-left flex items-start gap-3 px-4 py-3"
        onClick={() => setExpanded(v => !v)}
      >
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.iconCls)} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", cfg.badgeCls)}>
              {alert.guardrailId}
            </span>
            <span className="text-xs text-muted-foreground font-mono">{alert.systemId}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium",
              alert.targetRole === "資安" ? "bg-rose-100 text-rose-700" :
              alert.targetRole === "採購" ? "bg-amber-100 text-amber-700" :
              alert.targetRole === "業務" ? "bg-blue-100 text-blue-700" :
              "bg-slate-100 text-slate-700")}>
              → {alert.targetRole}
            </span>
          </div>
          <p className="text-sm font-medium leading-snug">{alert.title}</p>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <p className="text-sm text-muted-foreground">{alert.detail}</p>
          <div className="rounded-md border bg-background px-3 py-2.5">
            <div className="text-xs font-semibold text-foreground mb-1">建議行動</div>
            <p className="text-xs text-muted-foreground leading-relaxed">{alert.suggestedAction}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">政策來源：</span>{alert.policySource}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

interface GuardrailPanelProps {
  alerts: GuardrailAlert[];
  /** 預設是否展開 */
  defaultOpen?: boolean;
  /** 限制顯示數量（其餘收折） */
  maxVisible?: number;
}

export function GuardrailPanel({
  alerts,
  defaultOpen = true,
  maxVisible = 8,
}: GuardrailPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const counts = countBySeverity(alerts);
  const visible = showAll ? alerts : alerts.slice(0, maxVisible);

  if (alerts.length === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="pt-4 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-emerald-800">資料品質防呆：無告警</div>
            <div className="text-xs text-emerald-700 mt-0.5">
              所有系統資料已通過 {Object.keys(SEV_CFG).length} 項防呆規則檢查，未偵測到資料缺口或矛盾。
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(counts.error > 0 ? "border-rose-200" : "border-amber-200")}>
      <CardHeader>
        <button
          type="button"
          className="w-full flex items-center justify-between text-left"
          onClick={() => setOpen(v => !v)}
        >
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4" />
              資料品質防呆
            </CardTitle>
            <div className="flex gap-1.5">
              {counts.error > 0 && (
                <span className="rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                  {counts.error} 個錯誤
                </span>
              )}
              {counts.warning > 0 && (
                <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                  {counts.warning} 個警告
                </span>
              )}
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {!open && (
          <p className="text-xs text-muted-foreground mt-1">
            點擊展開查看 {alerts.length} 個需要處理的資料品質問題
          </p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="space-y-2">
          {visible.map(alert => (
            <AlertCard key={alert.alertId} alert={alert} />
          ))}

          {alerts.length > maxVisible && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full rounded-lg border border-dashed py-2.5 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              還有 {alerts.length - maxVisible} 個防呆告警 — 點擊展開全部
            </button>
          )}

          <div className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">防呆規則說明：</span>
            以上警示由 <code className="font-mono">guardrails.ts</code> 的明確規則產生，
            每條告警都有觸發條件、政策來源與建議行動。
            告警不等同於最終風險評估結論，僅提示資料填報可能有缺口或矛盾。
          </div>
        </CardContent>
      )}
    </Card>
  );
}
