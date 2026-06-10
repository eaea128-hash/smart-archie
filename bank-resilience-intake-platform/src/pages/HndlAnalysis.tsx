import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FilterBar } from "@/components/common/FilterBar";
import { RiskExplanationPanel } from "@/components/common/RiskExplanationPanel";
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  DatabaseZap,
  FileWarning,
  Globe,
  Info,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { loadDemoData } from "@/lib/storage";
import type { System, Vendor } from "@/data/demo-data";
import { pqcRoadmapLabel, riskLevelLabel, systemStatusLabel } from "@/lib/labels";
import {
  assessHndlRisk,
  formatRetention,
  hasSensitiveData,
  isPermanentRetention,
  isSensitiveDataType,
} from "@/lib/hndl-risk";
import { cn } from "@/lib/utils";

const spotlightSystems = new Set(["SYS-001", "SYS-002", "SYS-011"]);

type EnrichedSystem = System & {
  vendor?: Vendor;
  risk: ReturnType<typeof assessHndlRisk>;
};

const riskConfig = {
  high: {
    label: "高風險",
    badge: "risk" as const,
    icon: ShieldAlert,
    border: "border-rose-200",
    panel: "border-rose-200 bg-rose-50",
    text: "text-rose-700",
    metric: "text-rose-600",
  },
  medium: {
    label: "中風險",
    badge: "warning" as const,
    icon: AlertTriangle,
    border: "border-amber-200",
    panel: "border-amber-200 bg-amber-50",
    text: "text-amber-700",
    metric: "text-amber-600",
  },
  low: {
    label: "低風險",
    badge: "success" as const,
    icon: CheckCircle2,
    border: "border-emerald-200",
    panel: "border-emerald-200 bg-emerald-50",
    text: "text-emerald-700",
    metric: "text-emerald-600",
  },
};

type HndlRiskFilter = "all" | "high" | "medium" | "low";

export function HndlAnalysis() {
  const { systems, vendors } = loadDemoData();
  const [selected, setSelected] = useState<EnrichedSystem | null>(null);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<HndlRiskFilter>("all");

  const enriched = useMemo<EnrichedSystem[]>(() => {
    const vendorById = new Map(vendors.map((vendor) => [vendor.vendorId, vendor]));
    return systems.map((system) => {
      const vendor = system.vendorId ? vendorById.get(system.vendorId) : undefined;
      return { ...system, vendor, risk: assessHndlRisk(system, vendor) };
    });
  }, [systems, vendors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((s) => {
      if (riskFilter !== "all" && s.risk.level !== riskFilter) return false;
      if (q && !s.systemName.toLowerCase().includes(q) && !s.systemId.toLowerCase().includes(q) && !s.businessUnit.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, search, riskFilter]);

  const highRisk = filtered
    .filter((system) => system.risk.level === "high")
    .sort((a, b) => b.hndlRiskScore - a.hndlRiskScore);
  const mediumRisk = filtered
    .filter((system) => system.risk.level === "medium")
    .sort((a, b) => b.hndlRiskScore - a.hndlRiskScore);
  const lowRisk = filtered
    .filter((system) => system.risk.level === "low")
    .sort((a, b) => b.hndlRiskScore - a.hndlRiskScore);

  const retentionBuckets = [
    { label: "< 5 年", count: systems.filter((system) => system.dataRetentionYears < 5).length, fill: "#0f766e" },
    { label: "5-9 年", count: systems.filter((system) => system.dataRetentionYears >= 5 && system.dataRetentionYears < 10).length, fill: "#d97706" },
    { label: "10-19 年", count: systems.filter((system) => system.dataRetentionYears >= 10 && system.dataRetentionYears < 20).length, fill: "#e11d48" },
    { label: "20 年以上", count: systems.filter((system) => system.dataRetentionYears >= 20 && !isPermanentRetention(system.dataRetentionYears)).length, fill: "#be123c" },
    { label: "永久保存", count: systems.filter((system) => isPermanentRetention(system.dataRetentionYears)).length, fill: "#7f1d1d" },
  ];

  const sensitiveDistribution = buildSensitiveDistribution(systems);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DatabaseZap className="h-4 w-4" />
            HNDL Analysis / Harvest Now, Decrypt Later
          </div>
          <h2 className="mt-1 text-2xl font-semibold">HNDL 資料生命週期風險分析</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            現在攔截，未來解密。攻擊者可能現在先攔截加密資料，等未來量子電腦能力成熟後再解密。
            因此，保存年限長、敏感度高、未來仍有價值的資料，具有較高 PQC 風險。
          </p>
        </div>
        <Badge variant="secondary">Fake demo data</Badge>
      </div>

      <Card className="border-primary/20">
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Archive className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold">主管閱讀重點</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                HNDL 不是立即被破解，而是「今日被蒐集、未來被解密」。房貸、保單、醫療、授信與財富管理資料通常保存十年以上，
                即使現在加密強度足夠，也可能在資料仍具價值時被量子能力解密。因此這些系統應優先納入 PQC 遷移準備度盤點。
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <ConceptTile icon={Clock} title="保存年限" value="10 年以上或永久保存" />
                <ConceptTile icon={FileWarning} title="資料敏感度" value="個資、保單、醫療、授信、財務、交易資料" />
                <ConceptTile icon={Globe} title="暴露面" value="外部 API 或跨機構串接" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <RiskSummaryCard level="high" count={highRisk.length} subtitle="需立即納入第一批 PQC 盤點" />
        <RiskSummaryCard level="medium" count={mediumRisk.length} subtitle="需列入第二批追蹤與補件" />
        <RiskSummaryCard level="low" count={lowRisk.length} subtitle="維持定期複查即可" />
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        placeholder="搜尋系統名稱、ID 或業務單位…"
        chips={[
          { key: "all", label: "全部風險", active: riskFilter === "all", onClick: () => setRiskFilter("all") },
          { key: "high", label: "高風險", active: riskFilter === "high", onClick: () => setRiskFilter("high") },
          { key: "medium", label: "中風險", active: riskFilter === "medium", onClick: () => setRiskFilter("medium") },
          { key: "low", label: "低風險", active: riskFilter === "low", onClick: () => setRiskFilter("low") },
        ]}
        resultCount={filtered.length}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">高風險系統清單</h3>
          <Badge variant="risk">{highRisk.length} 個系統</Badge>
          <span className="text-xs text-muted-foreground">重點案例已醒目標示，點擊可查看風險詳情與後續確認事項。</span>
        </div>
        <div className="space-y-3">
          {highRisk.map((system) => (
            <SystemRiskCard key={system.systemId} system={system} onOpen={() => setSelected(system)} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>資料保存年限分布圖</CardTitle>
            <CardDescription>保存超過 10 年或永久保存的資料，優先進入 HNDL 高風險檢視。</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={retentionBuckets}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value} 個系統`, "系統數"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {retentionBuckets.map((bucket) => <Cell key={bucket.label} fill={bucket.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>敏感資料類型分布圖</CardTitle>
            <CardDescription>顯示高敏感資料類型在假系統清單中的出現次數。</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sensitiveDistribution} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={92} />
                <Tooltip formatter={(value) => [`${value} 次`, "出現次數"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {sensitiveDistribution.map((item) => <Cell key={item.label} fill={item.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
          <CardContent className="border-t pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              圖表只使用示範假資料，不代表任何真實銀行資料盤點結果。
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <RiskColumn title="中風險系統" systems={mediumRisk} variant="warning" onOpen={setSelected} />
        <RiskColumn title="低風險系統" systems={lowRisk} variant="success" onOpen={setSelected} />
      </section>

      {selected && <RiskDrawer system={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ConceptTile({ icon: Icon, title, value }: { icon: React.ComponentType<{ className?: string }>; title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="mt-1.5 text-sm font-semibold leading-5">{value}</div>
    </div>
  );
}

function RiskSummaryCard({ level, count, subtitle }: { level: keyof typeof riskConfig; count: number; subtitle: string }) {
  const config = riskConfig[level];
  const Icon = config.icon;
  return (
    <div className={`flex items-center gap-4 rounded-lg border p-4 ${config.panel}`}>
      <Icon className={`h-8 w-8 shrink-0 ${config.metric}`} />
      <div>
        <div className={`text-3xl font-semibold ${config.metric}`}>{count}</div>
        <div className={`text-sm font-medium ${config.text}`}>{config.label}系統</div>
        <div className="text-xs opacity-70">{subtitle}</div>
      </div>
    </div>
  );
}

function SystemRiskCard({ system, onOpen }: { system: EnrichedSystem; onOpen: () => void }) {
  const spotlight = spotlightSystems.has(system.systemId);
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        spotlight ? "border-rose-300 ring-2 ring-rose-200 ring-offset-1" : "hover:border-rose-200"
      )}
      onClick={onOpen}
    >
      <CardContent className="pt-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {spotlight && <Badge variant="risk">重點案例</Badge>}
              <h4 className="font-semibold">{system.systemName}</h4>
              <Badge variant="outline">{system.systemType}</Badge>
              <span className="font-mono text-xs text-muted-foreground">{system.systemId}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{system.businessUnit} / {system.owner}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <InfoChip icon={Clock} text={`保存 ${formatRetention(system.dataRetentionYears)}`} tone={isPermanentRetention(system.dataRetentionYears) || system.dataRetentionYears >= 10 ? "risk" : "warning"} />
              {system.hasExternalApi && <InfoChip icon={Globe} text={`跨機構 API：${system.externalParties.length} 個對象`} tone="warning" />}
              <InfoChip icon={Building2} text={`業務重要性：${riskLevelLabel[system.businessCriticality]}`} tone={system.businessCriticality === "critical" ? "risk" : "warning"} />
            </div>
            <div className="mt-3 space-y-1">
              {system.risk.reasons.slice(0, 2).map((reason) => (
                <div className="flex items-start gap-2 text-xs text-muted-foreground" key={reason}>
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" />
                  {reason}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {system.dataTypes.map((dataType) => (
                <Badge key={dataType} variant={isSensitiveDataType(dataType) ? "risk" : "outline"}>{dataType}</Badge>
              ))}
            </div>
            <div className="mt-3" onClick={(event) => event.stopPropagation()}>
              <RiskExplanationPanel system={system} vendor={system.vendor ?? null} defaultCollapsed />
            </div>
          </div>
          <div className="flex shrink-0 items-end justify-between gap-4 lg:flex-col">
            <div className="text-right">
              <div className="text-4xl font-semibold tabular-nums text-rose-600">{system.hndlRiskScore}</div>
              <div className="text-xs text-muted-foreground">HNDL score</div>
              <div className="mt-2 w-28"><Progress value={system.hndlRiskScore} /></div>
            </div>
            <Button variant="outline" className="gap-1" onClick={(event) => { event.stopPropagation(); onOpen(); }}>
              詳情
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoChip({ icon: Icon, text, tone }: { icon: React.ComponentType<{ className?: string }>; text: string; tone: "risk" | "warning" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
      tone === "risk" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"
    )}>
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}

function RiskColumn({
  title,
  systems: rows,
  variant,
  onOpen,
}: {
  title: string;
  systems: EnrichedSystem[];
  variant: "warning" | "success";
  onOpen: (system: EnrichedSystem) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>主管可快速檢視後續追蹤範圍。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((system) => (
          <button
            className="w-full rounded-lg border bg-muted/10 p-3 text-left transition-colors hover:bg-muted/30"
            key={system.systemId}
            onClick={() => onOpen(system)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{system.systemName}</div>
                <div className="mt-1 text-xs text-muted-foreground">{system.risk.reasons[0]}</div>
              </div>
              <Badge variant={variant}>{system.hndlRiskScore}</Badge>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function RiskDrawer({ system, onClose }: { system: EnrichedSystem; onClose: () => void }) {
  const config = riskConfig[system.risk.level];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="relative h-full w-full max-w-2xl overflow-y-auto bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className={`sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-6 py-5 ${config.panel}`}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={config.badge}>{config.label}</Badge>
              {spotlightSystems.has(system.systemId) && <Badge variant="risk">重點案例</Badge>}
              <span className="font-mono text-xs text-muted-foreground">{system.systemId}</span>
            </div>
            <h3 className="mt-2 text-xl font-semibold">{system.systemName}</h3>
            <p className="text-sm text-muted-foreground">{system.businessUnit} / {system.owner}</p>
          </div>
          <button className="rounded-md p-1.5 transition-colors hover:bg-black/10" onClick={onClose} aria-label="Close detail drawer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <DetailTile label="系統類型" value={system.systemType} />
            <DetailTile label="業務重要性" value={riskLevelLabel[system.businessCriticality]} />
            <DetailTile label="資料保存年限" value={formatRetention(system.dataRetentionYears)} highlight={system.dataRetentionYears >= 10} />
            <DetailTile label="外部介接" value={system.hasExternalApi ? `是，${system.externalParties.length} 個對象` : "否"} />
            <DetailTile label="HNDL score" value={`${system.hndlRiskScore} / 100`} highlight={system.hndlRiskScore >= 80} />
            <DetailTile label="盤點狀態" value={systemStatusLabel[system.status]} />
            <DetailTile label="供應商" value={system.vendor?.vendorName ?? "無"} />
            <DetailTile label="PQC 遷移計畫" value={system.vendor ? pqcRoadmapLabel[system.vendor.pqcRoadmapStatus] : "無供應商"} />
            <DetailTile label="最後更新" value={system.lastUpdated} />
          </div>

          <Section title="資料類型">
            <div className="flex flex-wrap gap-1.5">
              {system.dataTypes.map((dataType) => (
                <Badge key={dataType} variant={isSensitiveDataType(dataType) ? "risk" : "outline"}>{dataType}</Badge>
              ))}
            </div>
          </Section>

          <Section title="加密技術訊號">
            <div className="space-y-1.5">
              {system.cryptoSignals.map((signal) => (
                <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm" key={signal}>
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  {signal}
                </div>
              ))}
            </div>
          </Section>

          {system.externalParties.length > 0 && (
            <Section title="外部介接對象">
              <div className="flex flex-wrap gap-1.5">
                {system.externalParties.map((party) => (
                  <div className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs" key={party}>
                    <Globe className="h-3 w-3 text-muted-foreground" />
                    {party}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <RiskExplanationPanel
            system={system}
            vendor={system.vendor ?? null}
          />

          <div className="rounded-lg border border-primary/20 bg-secondary/20 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              建議後續確認事項
            </h4>
            <ol className="space-y-2.5">
              {system.risk.suggestions.map((suggestion, index) => (
                <li className="flex items-start gap-3 text-sm" key={suggestion}>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{index + 1}</span>
                  <span className="leading-relaxed">{suggestion}</span>
                </li>
              ))}
            </ol>
          </div>

          <Section title="CMDB tags">
            <div className="flex flex-wrap gap-1">
              {system.cmdbTags.map((tag) => <Badge key={tag} variant="outline" className="font-mono text-xs">{tag}</Badge>)}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function DetailTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/10 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 break-words text-sm font-medium", highlight && "font-semibold text-rose-600")}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      {children}
    </div>
  );
}

function buildSensitiveDistribution(systems: System[]) {
  const counts: Record<string, number> = {};
  systems.forEach((system) => {
    system.dataTypes.forEach((dataType) => {
      if (isSensitiveDataType(dataType)) {
        counts[dataType] = (counts[dataType] ?? 0) + 1;
      }
    });
  });

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([label, count], index) => ({
      label,
      count,
      fill: index < 3 ? "#e11d48" : index < 6 ? "#d97706" : "#1d4ed8",
    }));
}
