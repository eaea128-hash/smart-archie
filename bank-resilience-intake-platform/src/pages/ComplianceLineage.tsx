import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  Filter,
  GitBranch,
  Layers,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { systems } from "@/lib/storage";
import { cn } from "@/lib/utils";

type PolicyCategory =
  | "FSC 金管會金融資安韌性"
  | "NIST NCCoE PQC Migration"
  | "CISA Quantum Readiness"
  | "Internal Policy 內部政策";

type LineageKind = "question" | "riskRule" | "reportField";
type LineageStatus = "active" | "draft";

interface LineageItem {
  lineageId: string;
  kind: LineageKind;
  questionId: string;
  title: string;
  questionText: string;
  sourceType: PolicyCategory;
  sourceName: string;
  sourceReference: string;
  rationale: string;
  relatedRisk: string;
  version: string;
  lastUpdated: string;
  status: LineageStatus;
  usedBy: string[];
}

interface PolicyGap {
  gapId: string;
  systemId: string;
  systemName: string;
  missingField: string;
  ownerRole: string;
  priority: "P1" | "P2";
  reportImpact: string;
}

const policyConfig: Record<PolicyCategory, { icon: typeof BookOpen; className: string; badge: string; shortLabel: string }> = {
  "FSC 金管會金融資安韌性": {
    icon: BookOpen,
    shortLabel: "FSC",
    className: "border-blue-200 bg-blue-50",
    badge: "border-blue-200 bg-blue-100 text-blue-800",
  },
  "NIST NCCoE PQC Migration": {
    icon: Layers,
    shortLabel: "NIST NCCoE",
    className: "border-indigo-200 bg-indigo-50",
    badge: "border-indigo-200 bg-indigo-100 text-indigo-800",
  },
  "CISA Quantum Readiness": {
    icon: Search,
    shortLabel: "CISA",
    className: "border-rose-200 bg-rose-50",
    badge: "border-rose-200 bg-rose-100 text-rose-800",
  },
  "Internal Policy 內部政策": {
    icon: FileText,
    shortLabel: "Internal",
    className: "border-slate-200 bg-slate-50",
    badge: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

const kindLabel: Record<LineageKind, string> = {
  question: "盤點問題",
  riskRule: "風險規則",
  reportField: "報告欄位",
};

const lineageItems: LineageItem[] = [
  {
    lineageId: "LIN-Q-001",
    kind: "question",
    questionId: "Q-CRYPTO-001",
    title: "密碼技術相依性盤點",
    questionText: "系統是否使用 RSA、ECC、PKI、HSM、TLS、XML signature 或 JWT signing?",
    sourceType: "NIST NCCoE PQC Migration",
    sourceName: "Migration to Post-Quantum Cryptography",
    sourceReference: "NIST SP 1800-38B, Cryptographic Discovery and Inventory",
    rationale: "PQC 遷移必須先知道哪些系統依賴傳統公鑰密碼。若沒有密碼技術清單，無法估算遷移工作量與排程。",
    relatedRisk: "未知密碼相依性導致遷移工作量低估",
    version: "v2.0",
    lastUpdated: "2026-03-01",
    status: "active",
    usedBy: ["Dashboard HNDL 排行", "Evidence Pack 加密相依性章節", "資安待確認任務"],
  },
  {
    lineageId: "LIN-Q-002",
    kind: "question",
    questionId: "Q-HNDL-001",
    title: "長期保存敏感資料",
    questionText: "敏感資料是否保存超過 10 年，或是否為永久保存?",
    sourceType: "CISA Quantum Readiness",
    sourceName: "Post-Quantum Cryptography Initiative",
    sourceReference: "CISA PQC Roadmap 2023, HNDL Threat Prioritization",
    rationale: "HNDL 風險取決於資料在未來是否仍具價值。保存超過 10 年的敏感資料需優先納入 PQC 準備度盤點。",
    relatedRisk: "長期保存資料面臨現在攔截、未來解密風險",
    version: "v1.1",
    lastUpdated: "2026-02-18",
    status: "active",
    usedBy: ["HNDL Analysis", "Dashboard 高風險指標", "Evidence Pack executive summary"],
  },
  {
    lineageId: "LIN-Q-003",
    kind: "question",
    questionId: "Q-VENDOR-001",
    title: "供應商 PQC 準備度",
    questionText: "供應商是否提供 PQC 遷移計畫、加密調整能力聲明與合約資安升級責任?",
    sourceType: "FSC 金管會金融資安韌性",
    sourceName: "金融機構科技外包與資安韌性要求",
    sourceReference: "FSC Technology Outsourcing Governance, Section 5.3",
    rationale: "銀行系統常由供應商維護。供應商若無法提供準備度證據，內部系統即使完成盤點也無法推進遷移。",
    relatedRisk: "供應商相依性阻礙 PQC 遷移",
    version: "v1.2",
    lastUpdated: "2026-04-10",
    status: "active",
    usedBy: ["Vendor Readiness", "Cross-functional Tasks", "採購補件清單"],
  },
  {
    lineageId: "LIN-Q-004",
    kind: "question",
    questionId: "Q-API-001",
    title: "外部 API 與跨機構串接",
    questionText: "系統是否透過 API、檔案交換或憑證通道與外部機構交換資料?",
    sourceType: "Internal Policy 內部政策",
    sourceName: "內部 API 安全標準",
    sourceReference: "API-SEC-STD Rev.1.5, Section 4",
    rationale: "外部串接是 HNDL 攔截風險最高的傳輸路徑。若未識別外部交換點，資安無法確認 TLS、憑證與簽章責任。",
    relatedRisk: "跨機構傳輸加密強度未知",
    version: "v1.5",
    lastUpdated: "2026-04-15",
    status: "active",
    usedBy: ["PQC Intake", "HNDL Analysis", "外部 API 補件任務"],
  },
  {
    lineageId: "LIN-R-001",
    kind: "riskRule",
    questionId: "RULE-HNDL-001",
    title: "HNDL 高風險判斷規則",
    questionText: "若資料保存 >= 10 年或永久保存，且資料類型含個資、保單、醫療、授信、財務或交易資料，且系統為高重要性或具外部 API，標示為 HNDL 高風險。",
    sourceType: "CISA Quantum Readiness",
    sourceName: "Quantum Readiness Technical Report",
    sourceReference: "CISA Quantum Readiness 2023, Data Classification for PQC Priority",
    rationale: "這條規則把 CISA 的 HNDL 概念轉換成平台可執行的風險分類，讓主管看到可追溯的判斷依據。",
    relatedRisk: "高敏感長期資料未被優先遷移",
    version: "v1.0",
    lastUpdated: "2026-05-20",
    status: "active",
    usedBy: ["HNDL Analysis 高風險清單", "Dashboard 高 HNDL 系統數"],
  },
  {
    lineageId: "LIN-R-002",
    kind: "riskRule",
    questionId: "RULE-TLS-001",
    title: "Legacy crypto 防呆規則",
    questionText: "若 CMDB tag 或 cryptoSignals 顯示 TLS 1.1、legacy certificate 或 unknown crypto module，不允許直接維持低風險結論。",
    sourceType: "NIST NCCoE PQC Migration",
    sourceName: "NIST SP 800-131A Rev.3",
    sourceReference: "NIST SP 800-131A Rev.3, Transitioning Cryptographic Algorithms",
    rationale: "舊型 TLS 與 legacy certificate 是技術標籤回補業務風險的典型案例，可避免業務低估遷移難度。",
    relatedRisk: "舊型加密協定造成合規與傳輸風險",
    version: "v1.0",
    lastUpdated: "2026-06-03",
    status: "active",
    usedBy: ["Cross-functional Tasks 防呆提示", "Evidence Pack 缺口清單"],
  },
  {
    lineageId: "LIN-R-003",
    kind: "riskRule",
    questionId: "RULE-VENDOR-001",
    title: "供應商遷移計畫缺口規則",
    questionText: "若供應商 PQC 遷移計畫為未提供，或加密調整能力為未確認/不支援，自動產生採購與供應商補件提示。",
    sourceType: "FSC 金管會金融資安韌性",
    sourceName: "金融資安韌性與科技外包治理",
    sourceReference: "FSC Outsourcing Risk Governance, Vendor Technology Resilience",
    rationale: "將監理對委外管理的要求轉成可執行規則，確保供應商資料缺口會進入責任追蹤。",
    relatedRisk: "委外供應商阻礙科技韌性與加密升級",
    version: "v1.1",
    lastUpdated: "2026-06-05",
    status: "active",
    usedBy: ["Vendor Readiness", "Cross-functional Tasks", "Dashboard 遷移計畫缺口指標"],
  },
  {
    lineageId: "LIN-F-001",
    kind: "reportField",
    questionId: "RPT-HNDL-001",
    title: "報告欄位：HNDL 高風險系統數",
    questionText: "報告需揭露 HNDL 高風險系統數、系統清單與主要風險原因。",
    sourceType: "Internal Policy 內部政策",
    sourceName: "科技韌性主管報告標準",
    sourceReference: "RESILIENCE-REPORT Rev.1.0, Section 2",
    rationale: "主管報告不只列盤點完成率，還要揭露風險判斷如何由問題與規則推導而來。",
    relatedRisk: "報告指標無法追溯判斷來源",
    version: "v1.0",
    lastUpdated: "2026-06-02",
    status: "active",
    usedBy: ["Evidence Pack", "Dashboard executive summary"],
  },
  {
    lineageId: "LIN-DRAFT-001",
    kind: "question",
    questionId: "Q-API-002",
    title: "新增政策草案：跨機構 API 串接點明細",
    questionText: "請列出所有跨機構 API 串接點，並逐點填寫外部對象、資料類型、傳輸頻率、TLS 版本與憑證種類。",
    sourceType: "FSC 金管會金融資安韌性",
    sourceName: "金融資安韌性指引修訂草案",
    sourceReference: "FSC Draft 2026, Section 6.1, Cross-institution API Disclosure",
    rationale: "現行 Q-API-001 只確認是否有外部串接，新政策要求逐點揭露，才能支援更細緻的 HNDL 與傳輸加密風險評估。",
    relatedRisk: "外部串接點加密協定未知，無法評估 HNDL 傳輸暴露",
    version: "v1.0 草案",
    lastUpdated: "2026-06-08",
    status: "draft",
    usedBy: ["政策變更模擬", "補件任務生成", "報告缺口更新"],
  },
];

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

type DemoPhase = "impact" | "gaps" | "tasks" | "report";

export function ComplianceLineage() {
  const [categoryFilter, setCategoryFilter] = useState<PolicyCategory | "all">("all");
  const [kindFilter, setKindFilter] = useState<LineageKind | "all">("all");
  const [demoPhase, setDemoPhase] = useState<DemoPhase>("impact");

  const filteredItems = lineageItems
    .filter((item) => categoryFilter === "all" || item.sourceType === categoryFilter)
    .filter((item) => kindFilter === "all" || item.kind === kindFilter);

  const policyGaps = useMemo(() => buildPolicyGaps(), []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitBranch className="h-4 w-4" />
          合規軌跡 / 合規應變
        </div>
        <h2 className="mt-1 text-2xl font-semibold">合規軌跡</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
          平台中每一個盤點問題、風險規則與報告欄位，都能追溯它回應哪一項監理要求、國際指引或內部政策。
          這不是靜態法規對照表，而是未來政策變更後可以快速找出缺口、產生補件任務與更新報告的合規應變基礎。
        </p>
      </div>

      <Card className="border-primary/20">
        <CardContent className="pt-5">
          <div className="grid gap-3 md:grid-cols-4">
            <ConceptStep icon={BookOpen} title="政策來源" text="FSC、NIST、CISA、內部政策" />
            <ConceptStep icon={ClipboardList} title="盤點問題" text="每題都有題號與提問原因" />
            <ConceptStep icon={ShieldCheck} title="風險規則" text="規則可追溯到政策依據" />
            <ConceptStep icon={FileText} title="報告欄位" text="報告數字能追溯來源" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        {(Object.keys(policyConfig) as PolicyCategory[]).map((category) => {
          const config = policyConfig[category];
          const Icon = config.icon;
          const count = lineageItems.filter((item) => item.sourceType === category).length;
          return (
            <button
              className={cn(
                "rounded-lg border p-4 text-left transition-all hover:shadow-sm",
                config.className,
                categoryFilter === category && "ring-2 ring-primary ring-offset-1"
              )}
              key={category}
              onClick={() => setCategoryFilter(categoryFilter === category ? "all" : category)}
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4" />
                {config.shortLabel}
              </div>
              <div className="text-2xl font-semibold">{count}</div>
              <div className="mt-1 text-xs text-muted-foreground">{category}</div>
            </button>
          );
        })}
      </div>

      <PolicyChangeDemo phase={demoPhase} setPhase={setDemoPhase} gaps={policyGaps} />

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            篩選合規軌跡
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FilterGroup label="政策來源分類">
              <FilterChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>全部</FilterChip>
              {(Object.keys(policyConfig) as PolicyCategory[]).map((category) => (
                <FilterChip key={category} active={categoryFilter === category} onClick={() => setCategoryFilter(category)}>
                  {policyConfig[category].shortLabel}
                </FilterChip>
              ))}
            </FilterGroup>
            <FilterGroup label="Lineage 類型">
              <FilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>全部</FilterChip>
              {(["question", "riskRule", "reportField"] as LineageKind[]).map((kind) => (
                <FilterChip key={kind} active={kindFilter === kind} onClick={() => setKindFilter(kind)}>
                  {kindLabel[kind]}
                </FilterChip>
              ))}
            </FilterGroup>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">問題、風險規則與報告欄位清單</h3>
          <Badge variant="outline">{filteredItems.length} 筆</Badge>
        </div>
        <div className="grid gap-3">
          {filteredItems.map((item) => <LineageCard item={item} key={item.lineageId} />)}
        </div>
      </section>
    </div>
  );
}

function ConceptStep({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{text}</div>
    </div>
  );
}

function PolicyChangeDemo({ phase, setPhase, gaps }: { phase: DemoPhase; setPhase: (phase: DemoPhase) => void; gaps: PolicyGap[] }) {
  const phases: DemoPhase[] = ["impact", "gaps", "tasks", "report"];
  const currentIndex = phases.indexOf(phase);
  const nextPhase = phases[Math.min(currentIndex + 1, phases.length - 1)];
  const highPriority = gaps.filter((gap) => gap.priority === "P1").length;

  return (
    <Card className="border-amber-300 ring-2 ring-amber-200 ring-offset-1">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              管理場景模擬：新增監理要求「需列出跨機構 API 串接點」
            </CardTitle>
            <CardDescription>
              模擬 FSC 草案 Q-API-002 正式生效後，平台如何在 4 個步驟內完成影響評估、缺口標示、補件任務產生與報告更新。
            </CardDescription>
          </div>
          <Button variant={phase === "report" ? "outline" : "default"} onClick={() => phase === "report" ? setPhase("impact") : setPhase(nextPhase)}>
            {phase === "report" ? <><RefreshCw className="mr-1.5 h-4 w-4" />重新模擬</> : <>下一步<ArrowRight className="ml-1.5 h-4 w-4" /></>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 5 management metrics always visible */}
        <div className="grid gap-2 sm:grid-cols-5">
          {[
            { label: "受影響系統", value: systems.filter((s) => s.hasExternalApi).length, active: true },
            { label: "已補齊系統", value: Object.values(draftApiDetailCompleteness).filter((v) => v === "complete").length, active: currentIndex >= 1 },
            { label: "需補件系統", value: gaps.length, active: currentIndex >= 1 },
            { label: "自動產生任務", value: gaps.length, active: currentIndex >= 2 },
            { label: "受影響報告欄位", value: 3, active: currentIndex >= 3 },
          ].map(({ label, value, active }) => (
            <div key={label} className={cn("rounded-lg border p-3 text-center", active ? "border-primary/30 bg-primary/5" : "bg-muted/20 opacity-40")}>
              <div className={cn("text-2xl font-semibold tabular-nums", active ? "text-primary" : "text-muted-foreground")}>{active ? value : "—"}</div>
              <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* Assigned roles row */}
        {currentIndex >= 2 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">指派角色</span>
            {["系統Owner", "資安", "業務"].map((role) => (
              <span key={role} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{role}</span>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">補件後更新：API 串接點列表 / 傳輸加密方式 / HNDL 評分</span>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-4">
          {[
            ["1", "找出受影響系統", "impact"],
            ["2", "標示需補件", "gaps"],
            ["3", "產生補件任務", "tasks"],
            ["4", "更新報告缺口", "report"],
          ].map(([step, label, key]) => (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                phases.indexOf(key as DemoPhase) <= currentIndex ? "border-primary/30 bg-primary/5" : "bg-muted/20"
              )}
              key={key}
            >
              <div className="text-xs text-muted-foreground">Step {step}</div>
              <div className="font-semibold">{label}</div>
            </div>
          ))}
        </div>

        {phase === "impact" && (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              新政策 Q-API-002 要求不只回答「是否有外部 API」，還要逐點列出外部對象、資料類型、傳輸頻率、TLS 版本與憑證種類。
              平台掃描所有 <code className="rounded bg-muted px-1 text-xs">hasExternalApi = true</code> 的系統，並區分已補齊與需補件。
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="text-3xl font-semibold text-primary">{systems.filter((s) => s.hasExternalApi).length}</div>
                <div className="text-sm text-muted-foreground">個系統受新政策影響</div>
              </div>
              <div className="rounded-lg border bg-emerald-50 p-4">
                <div className="text-3xl font-semibold text-emerald-700">{Object.values(draftApiDetailCompleteness).filter((v) => v === "complete").length}</div>
                <div className="text-sm text-muted-foreground">已有足夠 API 串接明細</div>
              </div>
              <div className="rounded-lg border bg-amber-50 p-4">
                <div className="text-3xl font-semibold text-amber-700">{gaps.length}</div>
                <div className="text-sm text-muted-foreground">需補件，缺少串接明細或加密資訊</div>
              </div>
            </div>
          </div>
        )}

        {phase === "gaps" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="font-semibold">缺口偵測結果</span>
              <Badge variant="warning">{gaps.length} 個需補件缺口</Badge>
              <Badge variant="risk">{highPriority} 個 P1</Badge>
            </div>
            <div className="grid gap-2">
              {gaps.map((gap) => <GapRow gap={gap} key={gap.gapId} />)}
            </div>
          </div>
        )}

        {phase === "tasks" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <span className="font-semibold">已產生補件任務</span>
              <Badge variant="secondary">{gaps.length} 筆</Badge>
            </div>
            <div className="grid gap-2">
              {gaps.map((gap, index) => (
                <div className="rounded-lg border bg-background p-3" key={gap.gapId}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={gap.priority === "P1" ? "risk" : "warning"}>{gap.priority}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">TASK-API-{String(index + 1).padStart(3, "0")}</span>
                    <span className="font-semibold">{gap.systemName}</span>
                    <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{gap.ownerRole}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">補件內容：{gap.missingField}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === "report" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-3 text-sm font-semibold">政策更新前</div>
              <ReportBar label="Q-API-001 外部 API 是否存在" value={92} />
              <ReportBar label="Q-HNDL-001 長期資料保存" value={100} />
              <ReportBar label="整體合規覆蓋率" value={88} />
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
                <Sparkles className="h-4 w-4" />
                政策更新後
              </div>
              <ReportBar label="Q-API-002 串接點明細" value={0} alert />
              <ReportBar label="新增補件任務完成率" value={0} alert />
              <ReportBar label="整體合規覆蓋率" value={74} warning />
              <p className="mt-3 rounded-md border border-amber-300 bg-white/70 p-3 text-sm text-amber-800">
                報告已新增缺口章節：{gaps.length} 個系統需補充跨機構 API 串接點明細，完成前不得標示 Q-API-002 合規。
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GapRow({ gap }: { gap: PolicyGap }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={gap.priority === "P1" ? "risk" : "warning"}>{gap.priority}</Badge>
        <span className="font-mono text-xs text-muted-foreground">{gap.systemId}</span>
        <span className="font-semibold">{gap.systemName}</span>
        <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">{gap.ownerRole}</span>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">缺口：{gap.missingField}</div>
      <div className="mt-1 text-xs text-amber-700">報告影響：{gap.reportImpact}</div>
    </div>
  );
}

function ReportBar({ label, value, alert, warning }: { label: string; value: number; alert?: boolean; warning?: boolean }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", alert ? "bg-rose-400" : warning ? "bg-amber-400" : "bg-emerald-500")}
          style={{ width: `${Math.max(value, alert ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function LineageCard({ item }: { item: LineageItem }) {
  const config = policyConfig[item.sourceType];
  const Icon = config.icon;
  return (
    <Card className={cn(item.status === "draft" && "border-amber-300 ring-1 ring-amber-200")}>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.kind === "riskRule" ? "warning" : item.kind === "reportField" ? "secondary" : "outline"}>{kindLabel[item.kind]}</Badge>
              <span className="font-mono text-xs text-muted-foreground">{item.questionId}</span>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", config.badge)}>
                <Icon className="h-3 w-3" />
                {config.shortLabel}
              </span>
              <Badge variant={item.status === "draft" ? "warning" : "success"}>{item.status === "draft" ? "草案" : "現行"}</Badge>
            </div>
            <h4 className="mt-2 font-semibold">{item.title}</h4>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.questionText}</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-xs lg:w-56">
            <Detail label="version" value={item.version} />
            <Detail label="lastUpdated" value={item.lastUpdated} />
          </div>
        </div>

        <div className={cn("rounded-lg border p-3", config.className)}>
          <div className="text-xs font-semibold">{item.sourceName}</div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{item.sourceReference}</div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <InfoPanel title="rationale：為什麼要問這題" text={item.rationale} />
          <InfoPanel title="relatedRisk：對應風險" text={item.relatedRisk} tone="warning" />
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">使用此合規軌跡的頁面或欄位</div>
          <div className="flex flex-wrap gap-1">
            {item.usedBy.map((usage) => <Badge key={usage} variant="outline">{usage}</Badge>)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          <span>政策來源</span>
          <ArrowRight className="h-3 w-3" />
          <span>{item.questionId}</span>
          <ArrowRight className="h-3 w-3" />
          <span>{item.kind === "question" ? "盤點問題" : item.kind === "riskRule" ? "風險判斷" : "報告輸出"}</span>
          <ArrowRight className="h-3 w-3" />
          <span>補件與報告缺口</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function InfoPanel({ title, text, tone }: { title: string; text: string; tone?: "warning" }) {
  return (
    <div className={cn("rounded-lg border p-3", tone === "warning" ? "border-amber-200 bg-amber-50" : "bg-muted/20")}>
      <div className={cn("mb-1 text-xs font-semibold", tone === "warning" ? "text-amber-700" : "text-muted-foreground")}>{title}</div>
      <p className="text-sm leading-6">{text}</p>
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

function buildPolicyGaps(): PolicyGap[] {
  return systems
    .filter((system) => system.hasExternalApi)
    .map((system) => {
      const completeness = draftApiDetailCompleteness[system.systemId] ?? "missingCryptoDetails";
      const missingField = completeness === "missingParties"
        ? "尚未填外部串接對象；需列出外部機構、資料類型、傳輸頻率與加密協定。"
        : "已填外部對象名稱，但尚未逐點填寫 TLS 版本、憑證種類與資料交換頻率。";
      const priority: PolicyGap["priority"] = system.hndlRiskScore >= 80 ? "P1" : "P2";
      return {
        gapId: `GAP-${system.systemId}`,
        systemId: system.systemId,
        systemName: system.systemName,
        missingField,
        ownerRole: system.hndlRiskScore >= 80 ? "業務 + 資安" : "系統Owner",
        priority,
        reportImpact: `${system.systemName} 在 Q-API-002 欄位不可標示合規，需列入報告缺口。`,
      };
    })
    .filter((gap) => draftApiDetailCompleteness[gap.systemId] !== "complete")
    .sort((a, b) => (a.priority === "P1" ? -1 : 1) - (b.priority === "P1" ? -1 : 1));
}
