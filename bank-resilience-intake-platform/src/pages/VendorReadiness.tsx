import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FilterBar } from "@/components/common/FilterBar";
import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Filter,
  ShieldCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadDemoData } from "@/lib/storage";
import type { CryptoAgilityStatus, PqcRoadmapStatus, RiskLevel, System, Vendor } from "@/data/demo-data";
import { contractClauseLabel, cryptoAgilityLabel, pqcRoadmapLabel, riskLevelLabel, vendorReadinessScore } from "@/lib/labels";
import { cn } from "@/lib/utils";

type VendorWithScore = Vendor & { readinessScore: number };

interface ApplyScenario {
  vendor: Vendor;
  sourceSystemName: string;
  targetSystemName: string;
}

const roadmapFilters: (PqcRoadmapStatus | "all")[] = ["all", "已提供", "部分提供", "未提供", "不適用"];
const agilityFilters: (CryptoAgilityStatus | "all")[] = ["all", "已支援", "部分支援", "未確認", "不支援"];
const riskFilters: (RiskLevel | "all")[] = ["all", "critical", "high", "medium", "low"];

const vendorPending: Record<string, string[]> = {
  "VND-001": ["提供 PQC 遷移計畫文件", "補充加密調整能力聲明", "確認合約資安升級責任"],
  "VND-002": ["補充 HSM 演算法與韌體版本", "提供 SWIFT PKI hybrid mode 測試計畫"],
  "VND-003": ["完成整合測試計畫定稿"],
  "VND-004": ["補充企業網銀 PKI 遷移證據", "確認可套用回覆的系統特定例外"],
  "VND-005": ["提供 PQC 遷移計畫", "說明不支援加密調整能力的替代方案", "確認合約升級義務"],
  "VND-006": [],
  "VND-007": ["確認 SaaS 平台後量子計畫"],
  "VND-008": ["補充電子簽章演算法清單", "確認合約升級條款談判結果"],
};

const vendorHistory: Record<string, Array<{ date: string; event: string; author: string }>> = {
  "VND-001": [
    { date: "2026-04-10", author: "採購部", event: "首次催繳 PQC 遷移計畫，供應商尚未提供正式文件。" },
  ],
  "VND-002": [
    { date: "2026-05-15", author: "供應商", event: "提供部分 TLS inventory，HSM 細節仍待補件。" },
  ],
  "VND-003": [
    { date: "2026-05-28", author: "供應商", event: "提交 PQC 遷移計畫與演算法清單，整合測試計畫仍為草案。" },
  ],
  "VND-004": [
    { date: "2026-06-01", author: "供應商", event: "已對企業網銀系統提供 PQC 遷移計畫與加密調整框架。" },
    { date: "2026-06-05", author: "架構部", event: "確認該回覆可引用至同供應商維護系統，但需逐系統確認 PKI 與憑證依賴。" },
  ],
  "VND-005": [
    { date: "2026-03-18", author: "採購部", event: "第一次正式發函，尚無實質回覆。" },
    { date: "2026-05-30", author: "採購部", event: "第三次催繳，設定 2026-07-15 為最終期限。" },
  ],
  "VND-006": [
    { date: "2026-05-30", author: "供應商", event: "提交 API Gateway 遷移計畫與 token signing 遷移選項。" },
  ],
  "VND-007": [
    { date: "2026-04-20", author: "供應商", event: "說明知識庫 SaaS 為低優先度，待補充後量子計畫。" },
  ],
  "VND-008": [
    { date: "2026-05-12", author: "供應商", event: "提供電子簽章部分演算法清單，合約升級條款待確認。" },
  ],
};

export function VendorReadiness() {
  const { systems, vendors } = loadDemoData();
  const vendorSystems = useMemo(() => new Map(vendors.map((vendor) => [
    vendor.vendorId,
    systems.filter((system) => system.vendorId === vendor.vendorId),
  ])), [systems, vendors]);
  const [search, setSearch] = useState("");
  const [roadmapFilter, setRoadmapFilter] = useState<PqcRoadmapStatus | "all">("all");
  const [agilityFilter, setAgilityFilter] = useState<CryptoAgilityStatus | "all">("all");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [selectedVendor, setSelectedVendor] = useState<VendorWithScore | null>(null);
  const [applyScenario, setApplyScenario] = useState<ApplyScenario | null>(null);

  const rows = useMemo<VendorWithScore[]>(() => {
    const q = search.trim().toLowerCase();
    return vendors
      .map((vendor) => ({
        ...vendor,
        relatedSystemCount: vendorSystems.get(vendor.vendorId)?.length ?? vendor.relatedSystemCount,
        readinessScore: vendorReadinessScore(vendor.pqcRoadmapStatus, vendor.cryptoAgilityStatus, vendor.contractUpgradeClause),
      }))
      .filter((vendor) => !q || vendor.vendorName.toLowerCase().includes(q) || vendor.notes.toLowerCase().includes(q))
      .filter((vendor) => roadmapFilter === "all" || vendor.pqcRoadmapStatus === roadmapFilter)
      .filter((vendor) => agilityFilter === "all" || vendor.cryptoAgilityStatus === agilityFilter)
      .filter((vendor) => riskFilter === "all" || vendor.riskLevel === riskFilter)
      .sort((a, b) => a.readinessScore - b.readinessScore);
  }, [vendors, vendorSystems, search, roadmapFilter, agilityFilter, riskFilter]);

  const stats = {
    total: vendors.length,
    missingRoadmap: vendors.filter((vendor) => vendor.pqcRoadmapStatus === "未提供").length,
    reusable: vendors.filter((vendor) => (vendorSystems.get(vendor.vendorId)?.length ?? 0) > 1).length,
    pending: Object.values(vendorPending).reduce((sum, items) => sum + items.length, 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          供應商 PQC 準備度資料庫
        </div>
        <h2 className="mt-1 text-2xl font-semibold">供應商準備度資料庫</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          集中追蹤供應商 PQC 遷移計畫、加密調整能力與關聯系統。
        </p>
      </div>

      <Card className="border-primary/20">
        <CardContent className="pt-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">平台差異：以供應商為單位管理準備度</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                若 A 廠商有 5 個系統，只要完成一次 PQC 遷移計畫、加密調整能力與合約升級責任回覆，
                其他系統即可引用同一份供應商層級資料；但 TLS 版本、憑證 CA、HSM 設定等系統特定加密依賴仍需逐系統確認。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric value={stats.total} label="總供應商" helper="納入 PQC 準備度追蹤" />
        <Metric value={stats.missingRoadmap} label="未提供遷移計畫" helper="需補件催繳" tone="risk" />
        <Metric value={stats.reusable} label="多系統供應商" helper="可套用既有回覆" tone="primary" />
        <Metric value={stats.pending} label="待補件事項" helper="供應商層級缺口" tone="warning" />
      </div>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            篩選供應商
          </div>
          <FilterBar
            search={search}
            onSearch={setSearch}
            placeholder="搜尋供應商名稱或備註…"
            resultCount={rows.length}
          />
          <FilterGroup label="PQC 遷移計畫狀態">
            {roadmapFilters.map((status) => (
              <FilterChip key={status} active={roadmapFilter === status} onClick={() => setRoadmapFilter(status)}>
                {status === "all" ? "全部" : pqcRoadmapLabel[status]}
              </FilterChip>
            ))}
          </FilterGroup>
          <div className="grid gap-4 lg:grid-cols-2">
            <FilterGroup label="加密調整能力狀態">
              {agilityFilters.map((status) => (
                <FilterChip key={status} active={agilityFilter === status} onClick={() => setAgilityFilter(status)}>
                  {status === "all" ? "全部" : cryptoAgilityLabel[status]}
                </FilterChip>
              ))}
            </FilterGroup>
            <FilterGroup label="風險等級">
              {riskFilters.map((risk) => (
                <FilterChip key={risk} active={riskFilter === risk} onClick={() => setRiskFilter(risk)}>
                  {risk === "all" ? "全部" : `${riskLevelLabel[risk]}風險`}
                </FilterChip>
              ))}
            </FilterGroup>
          </div>
        </CardContent>
      </Card>

      {(search || roadmapFilter !== "all" || agilityFilter !== "all" || riskFilter !== "all") && (
        <div className="flex justify-end">
          <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setSearch(""); setRoadmapFilter("all"); setAgilityFilter("all"); setRiskFilter("all"); }}>
            清除所有篩選
          </Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">供應商準備度總覽</CardTitle>
          <CardDescription>以供應商層級回覆、合約條款與關聯系統數管理追蹤，並支援套用供應商既有回覆。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>供應商</TableHead>
                <TableHead>關聯系統</TableHead>
                <TableHead>PQC 遷移計畫</TableHead>
                <TableHead>加密調整能力</TableHead>
                <TableHead>合約條款</TableHead>
                <TableHead>待補件</TableHead>
                <TableHead>風險狀態</TableHead>
                <TableHead>下一次追蹤</TableHead>
                <TableHead className="w-[88px]">動作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((vendor) => (
                <TableRow key={vendor.vendorId}>
                  <TableCell>
                    <div className="font-medium">{vendor.vendorName}</div>
                    <div className="text-xs text-muted-foreground">{vendor.vendorId}</div>
                  </TableCell>
                  <TableCell>{vendor.relatedSystemCount} 個</TableCell>
                  <TableCell><StatusBadge label={pqcRoadmapLabel[vendor.pqcRoadmapStatus]} status={vendor.pqcRoadmapStatus} /></TableCell>
                  <TableCell><StatusBadge label={cryptoAgilityLabel[vendor.cryptoAgilityStatus]} status={vendor.cryptoAgilityStatus} /></TableCell>
                  <TableCell>{contractClauseLabel[vendor.contractUpgradeClause]}</TableCell>
                  <TableCell>{vendorPending[vendor.vendorId]?.length ?? 0} 項</TableCell>
                  <TableCell><Badge variant={vendor.riskLevel === "critical" || vendor.riskLevel === "high" ? "risk" : vendor.riskLevel === "medium" ? "warning" : "success"}>{riskLevelLabel[vendor.riskLevel]}風險</Badge></TableCell>
                  <TableCell>{vendor.nextFollowUpDate}</TableCell>
                  <TableCell>
                    <Button className="h-8 px-3 text-xs" variant="outline" onClick={() => setSelectedVendor(vendor)}>查看</Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                    目前沒有符合條件的供應商。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {rows.map((vendor) => (
          <VendorRow key={vendor.vendorId} vendor={vendor} onOpen={() => setSelectedVendor(vendor)} />
        ))}
      </div>

      {selectedVendor && (
        <VendorDetail
          vendor={selectedVendor}
          relatedSystems={vendorSystems.get(selectedVendor.vendorId) ?? []}
          onApply={(scenario) => setApplyScenario(scenario)}
          onClose={() => setSelectedVendor(null)}
        />
      )}

      {applyScenario && (
        <ApplyResponseModal scenario={applyScenario} onClose={() => setApplyScenario(null)} />
      )}
    </div>
  );
}

function Metric({ value, label, helper, tone = "default" }: { value: number; label: string; helper: string; tone?: "default" | "risk" | "warning" | "primary" }) {
  const color = tone === "risk" ? "text-rose-600" : tone === "warning" ? "text-amber-600" : tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className={`text-3xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{helper}</div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted/60"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function VendorRow({ vendor, onOpen }: { vendor: VendorWithScore; onOpen: () => void }) {
  const pending = vendorPending[vendor.vendorId] ?? [];
  return (
    <Card className="cursor-pointer transition-all hover:shadow-md" onClick={onOpen}>
      <CardContent className="flex flex-col gap-4 pt-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{vendor.vendorName}</h3>
            <span className="font-mono text-xs text-muted-foreground">{vendor.vendorId}</span>
            <Badge variant={vendor.riskLevel === "critical" || vendor.riskLevel === "high" ? "risk" : vendor.riskLevel === "low" ? "success" : "warning"}>
              {riskLevelLabel[vendor.riskLevel]}風險
            </Badge>
            {vendor.relatedSystemCount > 1 && <Badge variant="secondary">可跨 {vendor.relatedSystemCount} 系統引用</Badge>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{vendor.notes}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge label={`遷移計畫：${pqcRoadmapLabel[vendor.pqcRoadmapStatus]}`} status={vendor.pqcRoadmapStatus} />
            <StatusBadge label={`加密調整能力：${cryptoAgilityLabel[vendor.cryptoAgilityStatus]}`} status={vendor.cryptoAgilityStatus} />
            <StatusBadge label={`升級責任：${contractClauseLabel[vendor.contractUpgradeClause]}`} status={vendor.contractUpgradeClause} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />關聯系統 {vendor.relatedSystemCount}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />最近回覆 {vendor.lastResponseDate}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />下次追蹤 {vendor.nextFollowUpDate}</span>
            <span>{pending.length} 項待補件</span>
          </div>
        </div>
        <div className="w-full lg:w-64">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>準備度分數</span>
            <span className="font-semibold text-foreground">{vendor.readinessScore}/100</span>
          </div>
          <Progress value={vendor.readinessScore} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ label, status }: { label: string; status: string }) {
  const variant = status === "未提供" || status === "不支援" || status === "無"
    ? "risk"
    : status === "部分提供" || status === "部分支援" || status === "未確認" || status === "待確認"
      ? "warning"
      : "success";
  return <Badge variant={variant}>{label}</Badge>;
}

function VendorDetail({ vendor, relatedSystems, onClose, onApply }: { vendor: VendorWithScore; relatedSystems: System[]; onClose: () => void; onApply: (scenario: ApplyScenario) => void }) {
  const history = vendorHistory[vendor.vendorId] ?? [];
  const pending = vendorPending[vendor.vendorId] ?? [];
  const canApply = vendor.vendorId === "VND-004" && relatedSystems.length > 1 && vendor.pqcRoadmapStatus !== "未提供";
  const sourceSystem = relatedSystems.find((system) => system.systemId === "SYS-007") ?? relatedSystems[0];
  const targetSystems = relatedSystems.filter((system) => system.systemId !== sourceSystem?.systemId);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="relative h-full w-full max-w-3xl overflow-y-auto bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={vendor.riskLevel === "critical" || vendor.riskLevel === "high" ? "risk" : vendor.riskLevel === "low" ? "success" : "warning"}>
                {riskLevelLabel[vendor.riskLevel]}風險
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{vendor.vendorId}</span>
            </div>
            <h3 className="mt-2 text-xl font-semibold">{vendor.vendorName}</h3>
            <p className="text-sm text-muted-foreground">供應商準備度與關聯系統</p>
          </div>
          <button className="rounded-md p-1.5 hover:bg-muted" onClick={onClose} aria-label="Close vendor detail">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {canApply && sourceSystem && targetSystems.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-emerald-700">此供應商已有 PQC 準備度回覆，可套用至本系統</div>
                  <p className="mt-1 text-sm text-emerald-700">
                    {vendor.vendorName} 已經對 {sourceSystem.systemName} 提供 PQC 遷移計畫。若另一個系統也由此供應商維護，
                    可引用同一份供應商層級回覆，但仍需確認系統特定加密依賴。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {targetSystems.map((system) => (
                      <Button
                        key={system.systemId}
                        variant="outline"
                        onClick={() => onApply({ vendor, sourceSystemName: sourceSystem.systemName, targetSystemName: system.systemName })}
                      >
                        <Copy className="mr-1.5 h-4 w-4" />
                        套用至 {system.systemName}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-3">
            <DetailTile label="PQC 遷移計畫" value={pqcRoadmapLabel[vendor.pqcRoadmapStatus]} />
            <DetailTile label="加密調整能力" value={cryptoAgilityLabel[vendor.cryptoAgilityStatus]} />
            <DetailTile label="合約資安升級責任" value={contractClauseLabel[vendor.contractUpgradeClause]} />
            <DetailTile label="最近回覆日期" value={vendor.lastResponseDate} />
            <DetailTile label="下一次追蹤日期" value={vendor.nextFollowUpDate} />
            <DetailTile label="關聯系統數" value={`${relatedSystems.length} 個`} />
          </section>

          <Section title="關聯系統清單">
            <div className="space-y-2">
              {relatedSystems.map((system) => (
                <div key={system.systemId} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{system.systemName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{system.systemId}</span>
                    <Badge variant="outline">{system.systemType}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {system.cryptoSignals.map((signal) => <Badge key={signal} variant="outline">{signal}</Badge>)}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="供應商回覆紀錄">
            <div className="space-y-2">
              {history.map((item) => (
                <div className="rounded-lg border bg-muted/20 p-3" key={`${item.date}-${item.event}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{item.date}</span>
                    <span>{item.author}</span>
                  </div>
                  <p className="mt-1 text-sm">{item.event}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="待補件事項">
            {pending.length > 0 ? (
              <div className="space-y-2">
                {pending.map((item) => (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" key={item}>
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                目前無待補件事項。
              </div>
            )}
          </Section>

          <Section title="可套用至其他系統的欄位">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                "PQC 遷移計畫文件與演算法清單",
                "加密調整能力支援聲明",
                "合約資安升級責任條款",
                "供應商層級遷移時程",
                "標準產品支援的後量子演算法",
                "通用測試計畫與窗口",
              ].map((field) => (
                <div className="flex items-start gap-2 rounded-md border bg-muted/20 p-2 text-sm" key={field}>
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {field}
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              注意：TLS 版本、憑證 CA、自建 HSM、客製化加密模組與外部 API 實作仍需逐系統確認，不可直接套用。
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      {children}
    </section>
  );
}

function ApplyResponseModal({ scenario, onClose }: { scenario: ApplyScenario; onClose: () => void }) {
  const [applied, setApplied] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border bg-background shadow-2xl">
        <div className="flex items-start justify-between border-b px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Copy className="h-4 w-4" />
              套用供應商既有回覆
            </div>
            <h3 className="mt-1 text-lg font-semibold">示範：引用供應商層級回覆</h3>
          </div>
          <button className="rounded-md p-1.5 hover:bg-muted" onClick={onClose} aria-label="Close apply modal">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          {!applied ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                {scenario.vendor.vendorName} 已對 <strong className="text-foreground">{scenario.sourceSystemName}</strong> 提供 PQC 準備度回覆。
                你可以把供應商層級欄位套用至 <strong className="text-foreground">{scenario.targetSystemName}</strong>。
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                仍需確認系統特定加密依賴：TLS 版本、憑證 CA、HSM 設定、外部 API 實作與客製化加密模組。
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>取消</Button>
                <Button onClick={() => setApplied(true)}>
                  <Copy className="mr-1.5 h-4 w-4" />
                  確認套用
                </Button>
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
              <h4 className="text-lg font-semibold">已套用供應商既有回覆</h4>
              <p className="mt-2 text-sm text-muted-foreground">
                {scenario.targetSystemName} 已引用 {scenario.vendor.vendorName} 的 PQC 準備度回覆。（示範模式，未寫入後端）
              </p>
              <Button className="mt-4" onClick={onClose}>完成</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
