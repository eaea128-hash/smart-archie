import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  GitBranch,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadDemoData, systems as systemsData } from "@/lib/storage";
import { explainRiskForSystem } from "@/lib/risk-rules";
import { assessHndlRisk, formatRetention } from "@/lib/hndl-risk";
import { cn } from "@/lib/utils";

// ─── Governance basis mapping ──────────────────────────────────────────────────

const GOVERNANCE_BASIS: Record<string, { label: string; ref: string; source: string }> = {
  hndl: {
    label: "CISA Quantum Readiness（量子準備）",
    ref: "HNDL Threat Prioritization 2023",
    source: "長期敏感資料優先納入 PQC 遷移",
  },
  crypto: {
    label: "NIST SP 800-131A Rev.3（密碼演算法轉換）",
    ref: "Transitioning Cryptographic Algorithms",
    source: "舊型加密協定須限期汰換",
  },
  vendor: {
    label: "FSC 科技外包治理（供應商韌性）",
    ref: "Technology Outsourcing Governance §5.3",
    source: "供應商須提供加密升級責任聲明",
  },
  external: {
    label: "FSC 金融資安韌性（PQC 檢核方向）",
    ref: "金管會 2026-06-18 PQC 遷移參考指引",
    source: "外部 API 串接點須逐一盤點加密協定",
  },
  criticality: {
    label: "NSA CNSA 2.0（演算法套件遷移）",
    ref: "Commercial National Security Algorithm Suite 2.0",
    source: "關鍵業務系統為 PQC 遷移最高優先對象",
  },
};

const OWNER_MAP: Record<string, string[]> = {
  hndl: ["資安", "系統Owner"],
  crypto: ["資安", "架構"],
  vendor: ["採購", "系統Owner"],
  external: ["資安", "業務"],
  criticality: ["系統Owner", "業務"],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenceRow {
  systemId: string;
  systemName: string;
  businessUnit: string;
  riskType: string;
  primaryCategory: string;
  triggerSummary: string;
  governanceBasis: string;
  governanceRef: string;
  owners: string[];
  status: string;
  score: number;
  hndlLevel: "high" | "medium" | "low";
  triggeredRules: Array<{ ruleId: string; name: string; message: string; policySource: string; policyReference: string }>;
  retention: string;
  hasExternalApi: boolean;
}

const RISK_TYPE_LABEL: Record<string, string> = {
  hndl: "HNDL（長期資料解密風險）",
  crypto: "Crypto（加密協定缺口）",
  vendor: "供應商準備度缺口",
  external: "API（外部串接風險）",
  criticality: "關鍵業務系統",
};

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "risk" | "outline" | "secondary" }> = {
  completed: { label: "已完成", variant: "success" },
  in_progress: { label: "進行中", variant: "secondary" },
  security_review: { label: "資安審查中", variant: "warning" },
  procurement_followup: { label: "採購跟進", variant: "warning" },
  not_started: { label: "未啟動", variant: "risk" },
};

// ─── Policy Change Demo (compact) ─────────────────────────────────────────────

type DemoPhase = "impact" | "gaps" | "tasks" | "report";

const draftApiDetailCompleteness: Record<string, "missingParties" | "missingCryptoDetails" | "complete"> = {
  "SYS-001": "missingCryptoDetails",
  "SYS-002": "missingCryptoDetails",
  "SYS-003": "missingCryptoDetails",
  "SYS-004": "missingCryptoDetails",
  "SYS-005": "missingCryptoDetails",
  "SYS-006": "complete",
  "SYS-007": "missingCryptoDetails",
  "SYS-008": "complete",
  "SYS-011": "missingCryptoDetails",
  "SYS-012": "missingParties",
};

// ─── Main Component ────────────────────────────────────────────────────────────

export function ComplianceLineage() {
  const { systems, vendors, tasks } = loadDemoData();
  const [riskTypeFilter, setRiskTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRow, setSelectedRow] = useState<EvidenceRow | null>(null);
  const [demoPhase, setDemoPhase] = useState<DemoPhase>("impact");
  const [showDemo, setShowDemo] = useState(false);

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.vendorId, v])), [vendors]);

  const rows: EvidenceRow[] = useMemo(() => {
    return systems.map((sys) => {
      const vendor = sys.vendorId ? vendorById.get(sys.vendorId) ?? null : null;
      const explanation = explainRiskForSystem(sys, vendor);
      const hndlRisk = assessHndlRisk(sys, vendor ?? undefined);

      // Determine primary risk category
      const catCounts = explanation.triggeredRules.reduce((acc, r) => {
        acc[r.rule.category] = (acc[r.rule.category] ?? 0) + r.rule.scoreContribution;
        return acc;
      }, {} as Record<string, number>);
      const primaryCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "criticality";
      const basis = GOVERNANCE_BASIS[primaryCategory] ?? GOVERNANCE_BASIS.criticality;

      const topRule = explanation.triggeredRules[0];
      const triggerSummary = topRule?.message ?? "無明確觸發原因";

      return {
        systemId: sys.systemId,
        systemName: sys.systemName,
        businessUnit: sys.businessUnit,
        riskType: RISK_TYPE_LABEL[primaryCategory] ?? primaryCategory,
        primaryCategory,
        triggerSummary,
        governanceBasis: basis.label,
        governanceRef: basis.ref,
        owners: OWNER_MAP[primaryCategory] ?? ["系統Owner"],
        status: sys.status,
        score: explanation.score,
        hndlLevel: hndlRisk.level,
        triggeredRules: explanation.triggeredRules.map((r) => ({
          ruleId: r.rule.ruleId,
          name: r.rule.name,
          message: r.message,
          policySource: r.rule.policySource,
          policyReference: r.rule.policyReference,
        })),
        retention: formatRetention(sys.dataRetentionYears),
        hasExternalApi: sys.hasExternalApi,
      };
    });
  }, [systems, vendorById]);

  const filtered = rows.filter((r) => {
    if (riskTypeFilter !== "all" && r.primaryCategory !== riskTypeFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  // KPI counts
  const highRiskCount = rows.filter((r) => r.score >= 50).length;
  const pendingCount = rows.filter((r) => r.status !== "completed").length;
  const externalApiCount = rows.filter((r) => r.hasExternalApi).length;
  const vendorGapCount = vendors.filter((v) => v.pqcRoadmapStatus === "未提供").length;

  const policyGaps = useMemo(() => systemsData
    .filter((s) => s.hasExternalApi && draftApiDetailCompleteness[s.systemId] !== "complete")
    .map((s) => ({
      gapId: `GAP-${s.systemId}`,
      systemId: s.systemId,
      systemName: s.systemName,
      missingField: draftApiDetailCompleteness[s.systemId] === "missingParties"
        ? "外部串接對象未填寫（機構、資料類型、頻率）"
        : "TLS 版本、憑證種類與傳輸頻率尚未逐點填寫",
      ownerRole: s.hndlRiskScore >= 80 ? "業務 + 資安" : "系統Owner",
      priority: (s.hndlRiskScore >= 80 ? "P1" : "P2") as "P1" | "P2",
    })), []);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitBranch className="h-4 w-4" />
          Evidence Lineage
        </div>
        <h2 className="mt-1 text-2xl font-semibold">治理依據追溯</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          各系統風險判定的觸發原因、檢核依據與負責單位，點擊查看完整證據鏈。
        </p>
      </div>

      {/* KPI chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiChip value={rows.length} label="盤點系統總數" />
        <KpiChip value={highRiskCount} label="風險分數 ≥ 50" tone="danger" />
        <KpiChip value={pendingCount} label="治理項目待處理" tone="warn" />
        <KpiChip value={vendorGapCount} label="供應商 PQC 缺口" tone="warn" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">風險類型</span>
        {["all", "hndl", "crypto", "vendor", "external", "criticality"].map((f) => (
          <button
            key={f}
            onClick={() => setRiskTypeFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              riskTypeFilter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted/60"
            )}
          >
            {f === "all" ? "全部" : RISK_TYPE_LABEL[f] ?? f}
          </button>
        ))}
        <span className="ml-4 text-xs font-medium text-muted-foreground">狀態</span>
        {["all", "not_started", "in_progress", "security_review", "completed"].map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted/60"
            )}
          >
            {f === "all" ? "全部" : STATUS_LABEL[f]?.label ?? f}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} / {rows.length} 筆</span>
      </div>

      {/* Main table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">系統</TableHead>
                <TableHead>風險類型</TableHead>
                <TableHead className="max-w-[200px]">觸發原因</TableHead>
                <TableHead>治理依據</TableHead>
                <TableHead>負責單位</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead className="w-[80px]">動作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const st = STATUS_LABEL[row.status] ?? { label: row.status, variant: "outline" as const };
                return (
                  <TableRow key={row.systemId} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium">{row.systemName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.systemId}</div>
                      <div className="text-xs text-muted-foreground">{row.businessUnit}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{row.riskType}</span>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{row.triggerSummary}</p>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium">{row.governanceBasis}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.governanceRef}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.owners.map((o) => (
                          <span key={o} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{o}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button className="h-8 px-3 text-xs" variant="outline" onClick={() => setSelectedRow(row)}>
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Policy change demo toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDemo((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          <Sparkles className="h-4 w-4" />
          檢核方向變更模擬 — 新增跨機構 API 串接點明細要求
          <span className="ml-1 text-xs text-muted-foreground">({showDemo ? "收起" : "展開"})</span>
        </button>
      </div>

      {showDemo && (
        <PolicyChangeDemo phase={demoPhase} setPhase={setDemoPhase} gaps={policyGaps} />
      )}

      {/* Evidence Drawer */}
      {selectedRow && (
        <EvidenceDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </div>
  );
}

// ─── KPI chip ─────────────────────────────────────────────────────────────────

function KpiChip({ value, label, tone }: { value: number; label: string; tone?: "danger" | "warn" }) {
  const color = tone === "danger" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-primary";
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className={cn("text-2xl font-semibold tabular-nums", color)}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

// ─── Evidence Drawer ───────────────────────────────────────────────────────────

function EvidenceDrawer({ row, onClose }: { row: EvidenceRow; onClose: () => void }) {
  const basis = GOVERNANCE_BASIS[row.primaryCategory] ?? GOVERNANCE_BASIS.criticality;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-full flex-col border-l bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b p-5">
          <div>
            <div className="font-mono text-xs text-muted-foreground">{row.systemId}</div>
            <h3 className="mt-0.5 text-lg font-semibold">{row.systemName}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{row.businessUnit}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Risk summary */}
          <section>
            <SectionTitle icon={ShieldCheck}>風險概況</SectionTitle>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <InfoCell label="風險分數" value={String(row.score)} tone={row.score >= 50 ? "danger" : "default"} />
              <InfoCell label="HNDL 等級（長期資料解密風險）" value={row.hndlLevel === "high" ? "高風險" : row.hndlLevel === "medium" ? "中風險" : "低風險"} tone={row.hndlLevel === "high" ? "danger" : "default"} />
              <InfoCell label="資料保存年限" value={row.retention} />
              <InfoCell label="外部 API（跨機構串接）" value={row.hasExternalApi ? "是" : "否"} tone={row.hasExternalApi ? "warn" : "default"} />
            </div>
          </section>

          {/* Triggered rules */}
          <section>
            <SectionTitle icon={AlertTriangle}>觸發規則</SectionTitle>
            <div className="mt-2 space-y-2">
              {row.triggeredRules.length === 0 ? (
                <p className="text-sm text-muted-foreground">無觸發規則</p>
              ) : (
                row.triggeredRules.map((r) => (
                  <div key={r.ruleId} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] text-amber-800">{r.ruleId}</span>
                      <div>
                        <div className="text-sm font-medium">{r.name}</div>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{r.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Governance basis */}
          <section>
            <SectionTitle icon={BookOpen}>檢核依據</SectionTitle>
            <div className="mt-2 rounded-lg border bg-blue-50 p-3 text-sm">
              <div className="font-semibold text-blue-800">{basis.label}</div>
              <div className="mt-0.5 font-mono text-xs text-blue-600">{basis.ref}</div>
              <p className="mt-1 text-xs text-blue-700">{basis.source}</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              本平台對齊相關趨勢與檢核方向；正式合規結論仍需由法遵與資安覆核。
            </p>
          </section>

          {/* Owners & actions */}
          <section>
            <SectionTitle icon={ClipboardList}>負責單位與建議行動</SectionTitle>
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {row.owners.map((o) => (
                  <span key={o} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{o}</span>
                ))}
              </div>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {row.primaryCategory === "hndl" && <>
                  <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />確認敏感資料欄位清單與最長保存年限</li>
                  <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />評估是否優先排入 Wave 1 遷移計畫</li>
                </>}
                {row.primaryCategory === "crypto" && <>
                  <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />盤點 TLS 版本、憑證類型與加密模組清單（CBOM：密碼資產清單）</li>
                  <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />確認舊型演算法汰換時程</li>
                </>}
                {row.primaryCategory === "vendor" && <>
                  <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />向供應商索取 PQC 遷移路線圖</li>
                  <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />在合約中加入加密升級責任條款</li>
                </>}
                {row.primaryCategory === "external" && <>
                  <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />列出所有外部 API 串接對象、傳輸加密協定</li>
                  <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />確認跨機構金鑰交換責任歸屬</li>
                </>}
                {row.primaryCategory === "criticality" && <>
                  <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />評估停機影響範圍與 DR 機制對 PQC 遷移的相依性</li>
                  <li className="flex gap-2"><ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />將系統納入波次規劃優先審視清單</li>
                </>}
              </ul>
            </div>
          </section>

          {/* Exportable */}
          <section>
            <SectionTitle icon={FileText}>可匯出項目</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              {["風險觸發規則清單", "治理依據對照表", "補件待辦任務", "JSON / Markdown"].map((item) => (
                <span key={item} className="rounded border bg-muted/30 px-2.5 py-1 text-xs">{item}</span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">完整匯出請前往「盤點證據包」頁面。</p>
          </section>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-sm font-semibold">
      <Icon className="h-4 w-4 text-primary" />
      {children}
    </div>
  );
}

function InfoCell({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warn" | "default" }) {
  const color = tone === "danger" ? "text-rose-600 font-semibold" : tone === "warn" ? "text-amber-600 font-semibold" : "font-medium";
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm", color)}>{value}</div>
    </div>
  );
}

// ─── Policy Change Demo (compact) ─────────────────────────────────────────────

function PolicyChangeDemo({
  phase,
  setPhase,
  gaps,
}: {
  phase: DemoPhase;
  setPhase: (p: DemoPhase) => void;
  gaps: Array<{ gapId: string; systemId: string; systemName: string; missingField: string; ownerRole: string; priority: "P1" | "P2" }>;
}) {
  const phases: DemoPhase[] = ["impact", "gaps", "tasks", "report"];
  const currentIndex = phases.indexOf(phase);
  const nextPhase = phases[Math.min(currentIndex + 1, phases.length - 1)];
  const affectedCount = systemsData.filter((s) => s.hasExternalApi).length;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-amber-600" />
              檢核方向變更：跨機構 API 串接點明細要求
            </CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              模擬檢核方向更新後，快速找出受影響系統、缺口、補件任務與報告欄位
            </CardDescription>
          </div>
          <Button
            className="h-8 px-3 text-xs"
            variant={phase === "report" ? "outline" : "default"}
            onClick={() => setPhase(phase === "report" ? "impact" : nextPhase)}
          >
            {phase === "report" ? <><RefreshCw className="mr-1 h-3.5 w-3.5" />重新模擬</> : <>下一步 <ArrowRight className="ml-1 h-3.5 w-3.5" /></>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Step indicator */}
        <div className="grid grid-cols-4 gap-2">
          {[["1", "影響評估", "impact"], ["2", "缺口標示", "gaps"], ["3", "任務產生", "tasks"], ["4", "報告更新", "report"]].map(([step, label, key]) => (
            <div
              key={key}
              className={cn(
                "rounded-lg border p-2.5 text-center text-xs",
                phases.indexOf(key as DemoPhase) <= currentIndex ? "border-primary/30 bg-primary/5 font-semibold text-primary" : "bg-muted/20 text-muted-foreground"
              )}
            >
              <div className="text-[10px] opacity-60">Step {step}</div>
              {label}
            </div>
          ))}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2">
          <MetricMini label="受影響系統" value={affectedCount} active />
          <MetricMini label="需補件" value={gaps.length} active={currentIndex >= 1} tone="warn" />
          <MetricMini label="已產生任務" value={currentIndex >= 2 ? gaps.length : 0} active={currentIndex >= 2} />
        </div>

        {/* Phase content */}
        {phase === "impact" && (
          <p className="text-xs text-muted-foreground">
            新增檢核方向要求逐一列出 <code className="rounded bg-muted px-1">hasExternalApi = true</code> 的系統串接明細（外部對象、資料類型、TLS 版本、憑證種類）。掃描完成：{affectedCount} 個系統受影響，{gaps.length} 個需補件。
          </p>
        )}
        {phase === "gaps" && (
          <div className="space-y-2">
            {gaps.slice(0, 4).map((gap) => (
              <div key={gap.gapId} className="flex items-start gap-2 rounded-lg border bg-background p-2.5 text-xs">
                <Badge variant={gap.priority === "P1" ? "risk" : "warning"} className="shrink-0">{gap.priority}</Badge>
                <div>
                  <span className="font-semibold">{gap.systemName}</span>
                  <span className="ml-1 text-muted-foreground">{gap.missingField}</span>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">{gap.ownerRole}</span>
              </div>
            ))}
            {gaps.length > 4 && <p className="text-xs text-muted-foreground">…共 {gaps.length} 筆缺口</p>}
          </div>
        )}
        {phase === "tasks" && (
          <p className="text-xs text-muted-foreground">
            已自動產生 {gaps.length} 筆補件任務，指派至系統Owner / 資安 / 業務，補件內容：API 串接點列表、傳輸加密方式、HNDL（長期資料解密風險）評分更新。
          </p>
        )}
        {phase === "report" && (
          <div className="rounded-lg border border-amber-300 bg-white/60 p-3 text-xs text-amber-800">
            報告已新增缺口章節：{gaps.length} 個系統 Q-API-002 欄位不完整，整體合規檢核覆蓋率由 88% 降至 74%，需完成補件後重新估算。
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricMini({ label, value, active, tone }: { label: string; value: number; active: boolean; tone?: "warn" }) {
  const color = tone === "warn" ? "text-amber-600" : "text-primary";
  return (
    <div className={cn("rounded-lg border p-2.5 text-center", active ? "border-primary/20 bg-primary/5" : "bg-muted/20 opacity-40")}>
      <div className={cn("text-xl font-semibold tabular-nums", active ? color : "text-muted-foreground")}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
