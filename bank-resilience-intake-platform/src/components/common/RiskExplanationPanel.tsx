/**
 * RiskExplanationPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 透明風險判斷面板 — 讓主管與資安人員看到「為什麼被判定為高/中/低風險」。
 *
 * 資料來源：explainRiskForSystem()，每條規則都有 ruleId + policySource + 貢獻分數
 * 沒有黑箱判斷 — 所有觸發規則都明確列出
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import type { System, Vendor } from "@/data/demo-data";
import { explainRiskForSystem } from "@/lib/risk-rules";
import { RISK_CONFIG } from "@/components/common/RiskBadge";
import { cn } from "@/lib/utils";

interface RiskExplanationPanelProps {
  system: System;
  vendor: Vendor | null | undefined;
  /** 預設收折（用於卡片嵌入） */
  defaultCollapsed?: boolean;
  className?: string;
}

export function RiskExplanationPanel({
  system,
  vendor,
  defaultCollapsed = false,
  className,
}: RiskExplanationPanelProps) {
  const [open, setOpen] = useState(!defaultCollapsed);
  const explanation = explainRiskForSystem(system, vendor ?? null);
  const cfg = RISK_CONFIG[explanation.riskLevel];

  return (
    <div className={cn("rounded-lg border", cfg.bgCls, className)}>
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className={cn("h-4 w-4 shrink-0", cfg.iconCls)} />
          <span className={cn("text-sm font-semibold", cfg.textCls)}>
            風險判斷：{cfg.label}風險（評分 {explanation.score} / 100）
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Narrative summary sentence */}
          <p className={cn("text-sm leading-6", cfg.textCls)}>
            {explanation.summary}
          </p>

          {/* Triggered rules */}
          {explanation.triggeredRules.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-semibold text-foreground uppercase tracking-wide">
                觸發原因（{explanation.triggeredRules.length} 條規則）
              </div>
              <div className="space-y-2">
                {explanation.triggeredRules.map(({ rule, message, contribution }) => (
                  <div
                    key={rule.ruleId}
                    className="rounded-md border bg-background px-3 py-2.5 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {rule.ruleId}
                      </span>
                      <span className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-semibold",
                        cfg.badgeCls,
                      )}>
                        +{contribution}
                      </span>
                      <span className="text-xs text-muted-foreground">{rule.name}</span>
                    </div>
                    <p className="text-sm leading-5 text-foreground">{message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      依據：{rule.policySource}
                    </p>
                    {rule.policyReference && (
                      <p className="mt-0.5 text-xs text-muted-foreground/70 font-mono">
                        條文：{rule.policyReference}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              未觸發主要 PQC / HNDL 風險規則；請確認資料保存年限與供應商資訊是否完整。
            </p>
          )}

          {/* Policy sources summary */}
          {explanation.policySources.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-foreground uppercase tracking-wide">
                對應政策依據
              </div>
              <ul className="space-y-1">
                {explanation.policySources.map(source => (
                  <li key={source} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-0.5 text-primary">•</span>
                    {source}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
