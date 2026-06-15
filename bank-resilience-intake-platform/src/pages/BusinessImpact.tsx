import { useMemo, useState } from "react";
import { TrendingDown, DollarSign, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDemoData } from "@/lib/storage";
import { explainRiskForSystem } from "@/lib/risk-rules";
import type { System, Vendor } from "@/data/demo-data";

// ─── Impact Estimation ───────────────────────────────────────────────────────

interface ImpactRange {
  minM: number; // minimum cost NTD million
  maxM: number; // maximum cost NTD million
  downtimeHrs: [number, number];
  dataBreachRisk: "低" | "中" | "高" | "極高";
  regulatoryFine: string;
  reasoning: string[];
}

function estimateImpact(system: System, vendor: Vendor | null): ImpactRange {
  const exp = explainRiskForSystem(system, vendor);
  const score = exp.score;
  const isHndl = system.dataRetentionYears >= 10 || system.hndlRiskScore >= 80;
  const isCritical = system.businessCriticality === "critical";
  const isHigh = system.businessCriticality === "high";

  // Base cost range by criticality
  let [minM, maxM] = isCritical ? [50, 500] : isHigh ? [20, 200] : [5, 50];

  // Score multiplier
  const mult = score >= 75 ? 2.0 : score >= 50 ? 1.4 : score >= 25 ? 1.0 : 0.7;
  minM = Math.round(minM * mult);
  maxM = Math.round(maxM * mult);

  // HNDL surcharge
  if (isHndl) {
    minM = Math.round(minM * 1.5);
    maxM = Math.round(maxM * 1.5);
  }

  // Downtime hours
  const downtimeHrs: [number, number] = isCritical
    ? [8, 72]
    : isHigh
    ? [2, 24]
    : [1, 8];

  // Data breach risk
  const dataBreachRisk =
    score >= 75 && isHndl ? "極高"
    : score >= 60 ? "高"
    : score >= 35 ? "中"
    : "低";

  // Regulatory fine estimate
  const regulatoryFine =
    isCritical && score >= 60
      ? "NTD 300萬–3,000萬（金管會裁罰基準）"
      : isHigh && score >= 40
      ? "NTD 60萬–600萬（金管會行政裁量）"
      : "NTD 0–60萬（依違規程度）";

  // Reasoning
  const reasoning: string[] = [];
  if (isCritical) reasoning.push("業務重要性：關鍵系統，影響核心業務");
  else if (isHigh) reasoning.push("業務重要性：高重要性系統");
  else reasoning.push("業務重要性：一般系統");
  if (isHndl) reasoning.push("HNDL 威脅：長期保存資料面臨量子解密風險，衝擊成本倍增");
  if (score >= 60) reasoning.push(`風險評分 ${score}/100：已達高風險門檻，供應商或加密基礎設施有明顯缺口`);
  if (vendor?.cryptoAgilityStatus === "不支援") reasoning.push("供應商不支援加密敏捷性，緊急替換成本高");
  if (system.cryptoSignals.length >= 3) reasoning.push(`偵測到 ${system.cryptoSignals.length} 項加密訊號，替換範圍廣`);

  return { minM, maxM, downtimeHrs, dataBreachRisk, regulatoryFine, reasoning };
}

// ─── Component ───────────────────────────────────────────────────────────────

const BREACH_COLOR: Record<string, string> = {
  "低": "bg-emerald-100 text-emerald-700",
  "中": "bg-amber-100 text-amber-700",
  "高": "bg-rose-100 text-rose-700",
  "極高": "bg-red-200 text-red-800",
};

export function BusinessImpact() {
  const { systems, vendors } = useMemo(() => loadDemoData(), []);
  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.vendorId, v])), [vendors]);
  const [sortBy, setSortBy] = useState<"maxCost" | "breachRisk" | "name">("maxCost");

  const rows = useMemo(() => {
    return systems.map(sys => {
      const vendor = sys.vendorId ? (vendorMap.get(sys.vendorId) ?? null) : null;
      const impact = estimateImpact(sys, vendor);
      return { sys, vendor, impact };
    }).sort((a, b) => {
      if (sortBy === "maxCost") return b.impact.maxM - a.impact.maxM;
      if (sortBy === "breachRisk") {
        const order = ["極高", "高", "中", "低"];
        return order.indexOf(a.impact.dataBreachRisk) - order.indexOf(b.impact.dataBreachRisk);
      }
      return a.sys.systemName.localeCompare(b.sys.systemName);
    });
  }, [systems, vendorMap, sortBy]);

  const totalMinM = rows.reduce((s, r) => s + r.impact.minM, 0);
  const totalMaxM = rows.reduce((s, r) => s + r.impact.maxM, 0);
  const highRiskCount = rows.filter(r => ["高", "極高"].includes(r.impact.dataBreachRisk)).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingDown className="h-4 w-4" />
          業務衝擊估算
        </div>
        <h2 className="mt-1 text-2xl font-semibold">PQC 遷移不達標業務衝擊估算</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          基於系統風險評分、HNDL 威脅、業務重要性與供應商準備度，估算若 2030 前未完成量子遷移
          的潛在業務衝擊範圍。<strong>所有數字為示範估算，非精算結果。</strong>
        </p>
      </div>

      {/* POC Warning */}
      <div className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-sm">
          <strong>POC 聲明：</strong>此估算使用規則引擎與業務重要性分層推導，屬概念驗證性質。
          正式業務衝擊分析（BIA）應由業務連續性管理（BCM）團隊依 ISO 22301 方法論執行，並結合
          實際 RTO/RPO、財務資料及法律意見。
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "估算最低總衝擊", value: `NTD ${totalMinM.toLocaleString()}M`, color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "估算最高總衝擊", value: `NTD ${totalMaxM.toLocaleString()}M`, color: "bg-rose-50 border-rose-200 text-rose-700" },
          { label: "高/極高洩漏風險", value: `${highRiskCount} 個系統`, color: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "涵蓋系統數", value: `${rows.length} 個`, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border-2 p-4 text-center ${c.color}`}>
            <div className="text-xl font-bold">{c.value}</div>
            <div className="mt-0.5 text-xs font-medium">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">排序：</span>
        {(["maxCost", "breachRisk", "name"] as const).map(k => (
          <button
            key={k}
            onClick={() => setSortBy(k)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              sortBy === k
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-muted-foreground/30 hover:bg-muted"
            }`}
          >
            {k === "maxCost" ? "最高衝擊" : k === "breachRisk" ? "洩漏風險" : "系統名稱"}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            系統衝擊明細（{rows.length} 個系統）
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">系統</th>
                <th className="pb-2 pr-4">估算成本範圍（NTD 百萬）</th>
                <th className="pb-2 pr-4">停機預估</th>
                <th className="pb-2 pr-4">資料洩漏風險</th>
                <th className="pb-2">裁罰估算</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ sys, impact }) => (
                <tr key={sys.systemId} className="hover:bg-muted/30">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{sys.systemName}</div>
                    <div className="text-xs text-muted-foreground">{sys.businessUnit}</div>
                    <Badge
                      variant={sys.businessCriticality === "critical" ? "risk" : sys.businessCriticality === "high" ? "warning" : "outline"}
                      className="mt-1 text-xs"
                    >
                      {sys.businessCriticality}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-rose-700">
                      {impact.minM.toLocaleString()} – {impact.maxM.toLocaleString()}M
                    </div>
                    <div className="mt-1 h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-400"
                        style={{ width: `${Math.min(100, (impact.maxM / totalMaxM) * rows.length * 100)}%` }}
                      />
                    </div>
                    <ul className="mt-1.5 space-y-0.5">
                      {impact.reasoning.slice(0, 2).map((r, i) => (
                        <li key={i} className="text-xs text-muted-foreground leading-4">• {r}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">
                    {impact.downtimeHrs[0]}–{impact.downtimeHrs[1]} 小時
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BREACH_COLOR[impact.dataBreachRisk]}`}>
                      {impact.dataBreachRisk}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground leading-5">
                    {impact.regulatoryFine}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Methodology note */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="pt-5 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            估算方法說明
          </div>
          <p>基準成本依業務重要性分層：關鍵系統 NTD 5,000萬–5億，高重要性 NTD 2,000萬–2億，一般 NTD 500萬–5,000萬。</p>
          <p>風險評分乘數：≥75 分 ×2.0、≥50 分 ×1.4、≥25 分 ×1.0、&lt;25 分 ×0.7。HNDL 加密長期保存資料另加 1.5 倍。</p>
          <p>參考依據：金管會金融資安行動方案 3.0、NSA CNSA 2.0 合規要求、ISO/IEC 22301 業務衝擊分析框架。</p>
          <p className="font-medium text-foreground">本頁面為 POC 展示，所有數字均為模擬假資料，不代表任何真實機構之財務評估。</p>
        </CardContent>
      </Card>
    </div>
  );
}
