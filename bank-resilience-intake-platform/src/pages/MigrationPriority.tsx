import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Layers,
  ShieldAlert,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDemoData } from "@/lib/storage";
import { explainRiskForSystem } from "@/lib/risk-rules";
import type { System, Vendor } from "@/data/demo-data";

// ─── Scoring ────────────────────────────────────────────────────────────────

const CRITICALITY_MULTIPLIER: Record<string, number> = {
  critical: 2.0,
  high: 1.5,
  medium: 1.0,
  low: 0.7,
};

function calcUrgency(system: System, vendor: Vendor | null): number {
  const explanation = explainRiskForSystem(system, vendor);
  let score = explanation.score * 0.5; // base 0–50

  const isHndlHighRisk = system.dataRetentionYears >= 10 || system.hndlRiskScore >= 80;
  if (isHndlHighRisk) score += 20;

  const tags = [...system.cmdbTags, ...system.cryptoSignals].join(" ").toLowerCase();
  const involvesRegulatory = tags.includes("regulatory") || tags.includes("監理") || system.dataTypes.some((d) => d.includes("監理"));
  if (involvesRegulatory) score += 10;

  score *= CRITICALITY_MULTIPLIER[system.businessCriticality] ?? 1.0;

  return Math.min(100, Math.round(score));
}

function calcFeasibility(system: System, vendor: Vendor | null): number {
  let score = 50; // baseline

  if (vendor) {
    if (vendor.pqcRoadmapStatus === "已提供") score += 15;
    else if (vendor.pqcRoadmapStatus === "部分提供") score += 5;
    else if (vendor.pqcRoadmapStatus === "未提供") score -= 10;

    if (vendor.cryptoAgilityStatus === "已支援") score += 10;
    else if (vendor.cryptoAgilityStatus === "部分支援") score += 5;
    else if (vendor.cryptoAgilityStatus === "不支援") score -= 15;
  } else {
    score += 10; // self-maintained — more control
  }

  const tags = [...system.cmdbTags, ...system.cryptoSignals].join(" ").toLowerCase();
  const unknownCrypto = tags.includes("unknown crypto");
  if (unknownCrypto) score -= 15;

  const signalCount = system.cryptoSignals.length;
  if (signalCount <= 2) score += 10;
  else if (signalCount >= 5) score -= 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}

type Wave = "Wave 1" | "Wave 2" | "Wave 3" | "觀察";

function assignWave(urgency: number, feasibility: number): Wave {
  const highU = urgency >= 60;
  const highF = feasibility >= 55;
  if (highU && highF) return "Wave 1";
  if (highU && !highF) return "Wave 2";
  if (!highU && highF) return "Wave 3";
  return "觀察";
}

function waveQuarter(wave: Wave): string {
  if (wave === "Wave 1") return "2026 Q3";
  if (wave === "Wave 2") return "2026 Q4";
  if (wave === "Wave 3") return "2027 Q1";
  return "持續追蹤";
}

function buildBlockers(system: System, vendor: Vendor | null): string[] {
  const blockers: string[] = [];
  const tags = [...system.cmdbTags, ...system.cryptoSignals].join(" ").toLowerCase();

  if (vendor?.pqcRoadmapStatus === "未提供") blockers.push(`供應商 ${vendor.vendorName} 尚未提供 PQC 計畫`);
  if (vendor?.cryptoAgilityStatus === "不支援") blockers.push(`供應商 ${vendor.vendorName} 加密調整能力不支援`);
  if (tags.includes("unknown crypto")) blockers.push("存在未知加密模組，責任歸屬待釐清");
  if (tags.includes("legacy certificate")) blockers.push("舊憑證來源不明，需先完成 CBOM 盤點");
  if (system.cryptoSignals.length >= 5) blockers.push("加密訊號複雜度高，需專項技術評估");
  return blockers;
}

function urgencyReason(system: System, vendor: Vendor | null): string {
  const explanation = explainRiskForSystem(system, vendor);
  const top = explanation.triggeredRules[0];
  const isHndl = system.dataRetentionYears >= 10 || system.hndlRiskScore >= 80;
  if (isHndl) return `HNDL 高風險（保存 ${system.dataRetentionYears === 0 ? "永久" : system.dataRetentionYears + " 年"}）`;
  if (top) return `${top.rule.name}（+${top.contribution} 分）`;
  return `${system.businessCriticality} 業務重要性`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PriorityItem {
  rank: number;
  system: System;
  vendor: Vendor | null;
  urgency: number;
  feasibility: number;
  wave: Wave;
  quarter: string;
  blockers: string[];
  reason: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const WAVE_CONFIG: Record<Wave, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2 }> = {
  "Wave 1": { label: "Wave 1 立即啟動", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", icon: AlertTriangle },
  "Wave 2": { label: "Wave 2 解鎖阻礙後啟動", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: Clock },
  "Wave 3": { label: "Wave 3 排入年度計畫", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: TrendingUp },
  "觀察": { label: "持續觀察", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", icon: CheckCircle2 },
};

export function MigrationPriority() {
  const { systems, vendors } = useMemo(() => loadDemoData(), []);
  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.vendorId, v])), [vendors]);

  const items: PriorityItem[] = useMemo(() => {
    return systems
      .map((system) => {
        const vendor = system.vendorId ? (vendorMap.get(system.vendorId) ?? null) : null;
        const urgency = calcUrgency(system, vendor);
        const feasibility = calcFeasibility(system, vendor);
        const wave = assignWave(urgency, feasibility);
        return {
          rank: 0,
          system,
          vendor,
          urgency,
          feasibility,
          wave,
          quarter: waveQuarter(wave),
          blockers: buildBlockers(system, vendor),
          reason: urgencyReason(system, vendor),
        };
      })
      .sort((a, b) => b.urgency * 2 + b.feasibility - (a.urgency * 2 + a.feasibility))
      .map((item, i) => ({ ...item, rank: i + 1 }));
  }, [systems, vendorMap]);

  const wave1 = items.filter((i) => i.wave === "Wave 1");
  const wave2 = items.filter((i) => i.wave === "Wave 2");
  const wave3 = items.filter((i) => i.wave === "Wave 3");
  const watch = items.filter((i) => i.wave === "觀察");

  const topBlockers = items.filter((i) => i.blockers.length > 0).slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          遷移優先序與主管決策輸出
        </div>
        <h2 className="mt-1 text-2xl font-semibold">PQC 遷移優先序規劃</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          依據<strong>緊迫度</strong>（風險分數 × HNDL × 業務重要性）與<strong>可行性</strong>（供應商準備度 × 加密複雜度）
          交叉計算，將所有系統分為三波啟動計畫，協助主管決定資源配置順序。
        </p>
      </div>

      {/* Executive One-Pager */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-primary" />
            主管決策摘要
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            {(["Wave 1", "Wave 2", "Wave 3", "觀察"] as Wave[]).map((wave) => {
              const cfg = WAVE_CONFIG[wave];
              const count = items.filter((i) => i.wave === wave).length;
              const Icon = cfg.icon;
              return (
                <div key={wave} className={`rounded-lg border p-4 ${cfg.bg} ${cfg.border}`}>
                  <Icon className={`h-5 w-5 ${cfg.color} mb-2`} />
                  <div className={`text-2xl font-bold ${cfg.color}`}>{count}</div>
                  <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{waveQuarter(wave)}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border bg-muted/30 p-4 text-sm leading-7">
            <strong>建議行動：</strong>
            {wave1.length > 0 && (
              <span> 本季優先啟動 <strong>{wave1.length} 個系統</strong>（{wave1.map((i) => i.system.systemName).join("、")}）的 PQC 前期評估。</span>
            )}
            {wave2.length > 0 && (
              <span> 同步解鎖 <strong>{wave2.length} 個系統</strong>的供應商補件與加密盤點阻礙，目標 Q4 啟動。</span>
            )}
            {wave3.length > 0 && (
              <span> 其餘 <strong>{wave3.length} 個系統</strong>排入 2027 年度計畫。</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Priority Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">系統優先序排名</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">排名</th>
                <th className="pb-2 pr-4">系統</th>
                <th className="pb-2 pr-4">Wave</th>
                <th className="pb-2 pr-4">緊迫度</th>
                <th className="pb-2 pr-4">可行性</th>
                <th className="pb-2 pr-4">主要理由</th>
                <th className="pb-2 pr-4">啟動季度</th>
                <th className="pb-2">2030 缺口</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                const cfg = WAVE_CONFIG[item.wave];
                const gap2030 =
                  item.wave === "Wave 1" ? { label: "達標可期", cls: "bg-emerald-100 text-emerald-700" } :
                  item.wave === "Wave 2" ? { label: "需解阻礙", cls: "bg-amber-100 text-amber-700" } :
                  item.wave === "Wave 3" ? { label: "有缺口風險", cls: "bg-rose-100 text-rose-700" } :
                                          { label: "持續觀察", cls: "bg-slate-100 text-slate-600" };
                return (
                  <tr key={item.system.systemId} className="hover:bg-muted/30">
                    <td className="py-3 pr-4">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        item.rank <= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>{item.rank}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{item.system.systemName}</div>
                      <div className="text-xs text-muted-foreground">{item.system.businessUnit}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {item.wave}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <ScoreBar value={item.urgency} color={item.urgency >= 70 ? "bg-rose-500" : item.urgency >= 50 ? "bg-amber-400" : "bg-emerald-400"} />
                    </td>
                    <td className="py-3 pr-4">
                      <ScoreBar value={item.feasibility} color={item.feasibility >= 60 ? "bg-emerald-500" : item.feasibility >= 40 ? "bg-amber-400" : "bg-rose-400"} />
                    </td>
                    <td className="py-3 pr-4 max-w-[200px]">
                      <span className="text-xs leading-5 text-muted-foreground">{item.reason}</span>
                    </td>
                    <td className="py-3 pr-4 text-xs font-medium">{item.quarter}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${gap2030.cls}`}>
                        {gap2030.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Wave Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {([["Wave 1", wave1], ["Wave 2", wave2], ["Wave 3", wave3]] as [Wave, PriorityItem[]][]).map(([wave, waveItems]) => {
          const cfg = WAVE_CONFIG[wave];
          const Icon = cfg.icon;
          return (
            <div key={wave} className={`rounded-xl border-2 p-5 ${cfg.bg} ${cfg.border}`}>
              <div className={`mb-3 flex items-center gap-2 font-semibold ${cfg.color}`}>
                <Icon className="h-4 w-4" />
                {cfg.label}
                <span className="ml-auto text-sm font-normal">{cfg.color === "text-rose-700" ? "🔴" : cfg.color === "text-amber-700" ? "🟡" : "🔵"} {waveQuarter(wave)}</span>
              </div>
              {waveItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">無系統落入此波次</p>
              ) : (
                <ul className="space-y-2">
                  {waveItems.map((item) => (
                    <li key={item.system.systemId} className="flex items-start gap-2 text-sm">
                      <ChevronRight className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                      <div>
                        <span className="font-medium">{item.system.systemName}</span>
                        <span className={`ml-2 text-xs ${cfg.color} opacity-80`}>緊迫 {item.urgency}</span>
                        {item.blockers.length > 0 && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            阻礙：{item.blockers[0]}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Blockers */}
      {topBlockers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-4 w-4 text-rose-500" />
              需優先解鎖的阻礙
              <Badge variant="warning">{topBlockers.reduce((n, i) => n + i.blockers.length, 0)} 項</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topBlockers.map((item) => (
              <div key={item.system.systemId} className="rounded-lg border bg-muted/20 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{item.system.systemName}</span>
                  <Badge variant={item.wave === "Wave 1" ? "risk" : "warning"}>{item.wave}</Badge>
                </div>
                <ul className="space-y-1">
                  {item.blockers.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}
