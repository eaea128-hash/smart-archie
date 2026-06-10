import { useMemo, useState } from "react";
import { RiskExplanationPanel } from "@/components/common/RiskExplanationPanel";
import { explainRiskForSystem } from "@/lib/risk-rules";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  Download,
  FileJson,
  FileText,
  GitBranch,
  KeyRound,
  Printer,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComplianceLineage, RiskLevel, System, Task, Vendor } from "@/data/demo-data";
import { downloadFile } from "@/lib/export-utils";
import { loadDemoData, loadIntakeSubmissions, type IntakeSubmission } from "@/lib/storage";
import { runGuardrails, type GuardrailAlert } from "@/lib/guardrails";
import { GuardrailPanel } from "@/components/guardrails/GuardrailPanel";
import { cn } from "@/lib/utils";

const KNOWN_LIMITS = [
  {
    id: "KL-01",
    title: "示範假資料",
    detail: "所有系統、供應商與任務資料均為虛構示範資料，不代表任何真實機構或系統。",
  },
  {
    id: "KL-02",
    title: "非資安掃描工具",
    detail: "本平台不取代 CBOM、CMDB、GRC、SIEM、弱點掃描或原始碼掃描。風險判斷以填答資料與系統標籤為基礎，仍須由資安團隊進行專業覆核。",
  },
  {
    id: "KL-03",
    title: "風險評分為初步估算",
    detail: "11 條規則屬概念驗證階段，尚未依正式量化風險方法論（如 FAIR）驗證，不得作為唯一決策依據。",
  },
  {
    id: "KL-04",
    title: "供應商資料需供應商確認",
    detail: "PQC 遷移計畫、加密調整能力狀態以填答或假資料為準，正式治理需取得供應商書面文件。",
  },
  {
    id: "KL-05",
    title: "無登入與多人協作",
    detail: "本示範平台未設身分驗證機制，資料儲存於瀏覽器本機，重設後即清除，不適用於正式稽核或多人協作環境。",
  },
] as const;

type ReportSource = {
  sourceLabel: string;
  system: System;
  vendor?: Vendor;
  submission?: IntakeSubmission;
  relatedTasks: Task[];
  lineage: ComplianceLineage[];
};

const riskLabel: Record<RiskLevel, string> = {
  critical: "極高",
  high: "高",
  medium: "中",
  low: "低",
};

export function IntakeReport() {
  const [selectedId, setSelectedId] = useState<string>("latest");
  const data = loadDemoData();
  const submissions = loadIntakeSubmissions();

  const report = useMemo(() => buildReportSource(selectedId, data.systems, data.vendors, data.tasks, data.complianceLineage, submissions), [
    selectedId,
    data.systems,
    data.vendors,
    data.tasks,
    data.complianceLineage,
    submissions,
  ]);

  const summary = buildExecutiveSummary(report);
  const cryptoSignals = buildCryptoSignals(report);
  const vendorItems = buildVendorItems(report);
  const gaps = buildComplianceGaps(report);
  const riskExplanation = explainRiskForSystem(report.system, report.vendor ?? null);
  const guardrailAlerts = runGuardrails(
    [report.system],
    report.vendor ? [report.vendor] : [],
  );
  const snapshotAt = new Date().toISOString();
  const snapshotTime = new Date(snapshotAt).toLocaleString("zh-TW");
  const markdown = buildMarkdownReport(report, summary, cryptoSignals, vendorItems, gaps, guardrailAlerts, snapshotAt);

  const exportJson = () => downloadFile(`${report.system.systemId}-evidence-pack.json`, JSON.stringify({
    evidencePack: {
      version: "1.0",
      snapshotAt,
      generatedBy: "Bank Resilience Intake Platform",
    },
    snapshot: {
      systemId: report.system.systemId,
      systemName: report.system.systemName,
      businessUnit: report.system.businessUnit,
      dataVersion: "demo",
      reportSource: report.sourceLabel,
    },
    businessContext: {
      businessCriticality: report.system.businessCriticality,
      dataTypes: report.system.dataTypes,
      dataRetentionYears: report.system.dataRetentionYears,
      hasExternalApi: report.system.hasExternalApi,
      externalParties: report.system.externalParties,
    },
    riskExplanation: {
      riskLevel: riskExplanation.riskLevel,
      score: riskExplanation.score,
      summary: riskExplanation.summary,
      reasons: riskExplanation.reasons,
      triggeredRules: riskExplanation.triggeredRules.map(({ rule, message, contribution }) => ({
        ruleId: rule.ruleId,
        ruleName: rule.name,
        contribution,
        message,
        policySource: rule.policySource,
        policyReference: rule.policyReference,
      })),
      policySources: riskExplanation.policySources,
    },
    guardrailAlerts: guardrailAlerts.map((alert) => ({
      alertId: alert.alertId,
      guardrailId: alert.guardrailId,
      severity: alert.severity,
      title: alert.title,
      detail: alert.detail,
      targetRole: alert.targetRole,
      suggestedAction: alert.suggestedAction,
      policySource: alert.policySource,
    })),
    complianceLineage: report.lineage,
    complianceGaps: gaps,
    actionItems: report.relatedTasks.map((task) => ({
      taskId: task.taskId,
      priority: task.priority,
      assignedRole: task.assignedRole,
      taskTitle: task.taskTitle,
      taskDescription: task.taskDescription,
      dueDate: task.dueDate,
      status: task.status,
    })),
    knownLimits: KNOWN_LIMITS,
    submission: report.submission,
  }, null, 2), "application/json;charset=utf-8");

  const exportCsv = () => downloadFile(`${report.system.systemId}-evidence-pack.csv`, buildCsvReport(report, summary, cryptoSignals, vendorItems, gaps, guardrailAlerts), "text/csv;charset=utf-8");
  const exportMarkdown = () => downloadFile(`${report.system.systemId}-evidence-pack.md`, markdown, "text/markdown;charset=utf-8");

  return (
    <div className="space-y-6 print:bg-white">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            Evidence Pack
          </div>
          <h2 className="mt-1 text-2xl font-semibold">PQC 盤點證據包</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            治理證據包：將業務填答、風險規則、供應商回覆、防呆告警與政策依據，彙整為主管可讀、稽核可用的完整紀錄。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson}><FileJson className="mr-2 h-4 w-4" />JSON</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" onClick={exportMarkdown}><FileText className="mr-2 h-4 w-4" />Markdown</Button>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / PDF</Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="flex flex-col gap-3 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-medium">報告來源</div>
            <div className="mt-1 text-sm text-muted-foreground">{report.sourceLabel}</div>
          </div>
          <select
            aria-label="選擇報告來源"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            <option value="latest">最新盤點紀錄或示範高風險系統</option>
            {submissions.slice().reverse().map((submission) => (
              <option key={submission.id} value={submission.id}>
                {submission.form.systemName} / {new Date(submission.submittedAt).toLocaleString("zh-TW")}
              </option>
            ))}
            {data.systems.map((system) => <option key={system.systemId} value={system.systemId}>{system.systemName} / 假資料</option>)}
          </select>
        </CardContent>
      </Card>

      <div className="hidden border-b pb-4 print:block">
        <h1 className="text-2xl font-semibold">PQC / Quantum Readiness Evidence Pack</h1>
        <p className="mt-1 text-sm text-muted-foreground">{report.system.systemName} / {report.system.businessUnit}</p>
      </div>

      <ReportSection icon={FileText} title="Snapshot" description="固定記錄本次輸出的時間點、資料版本、系統與供應商，作為會議附件與後續追蹤依據。">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryTile label="系統" value={`${report.system.systemName}（${report.system.systemId}）`} strong />
          <SummaryTile label="供應商" value={report.vendor?.vendorName ?? report.submission?.form.vendorName ?? "待補"} />
          <SummaryTile label="匯出時間" value={snapshotTime} />
          <SummaryTile label="資料版本" value={`示範資料 / ${report.sourceLabel}`} />
        </div>
      </ReportSection>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />主管摘要</CardTitle>
            <CardDescription>主管摘要，聚焦初步風險、原因與處理優先級。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryTile label="系統名稱" value={report.system.systemName} />
              <SummaryTile label="業務單位" value={report.system.businessUnit} />
              <SummaryTile label="初步風險等級" value={`${riskLabel[summary.riskLevel]}風險`} strong tone={summary.riskLevel} />
              <SummaryTile label="建議優先級" value={summary.priority} strong />
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-2 text-sm font-semibold">主要風險原因</div>
              <p className="mb-3 text-sm font-medium leading-6">
                {explainRiskForSystem(report.system, report.vendor ?? null).summary}
              </p>
              <ul className="grid gap-2 text-sm leading-6 text-muted-foreground lg:grid-cols-2">
                {riskExplanation.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={summary.isHndlHighRisk ? "risk" : "success"}>{summary.isHndlHighRisk ? "涉及 HNDL 高風險" : "未達 HNDL 高風險門檻"}</Badge>
              <Badge variant="outline">HNDL score {report.system.hndlRiskScore}</Badge>
              <Badge variant="outline">Report ID {report.system.systemId}</Badge>
            </div>
            <RiskExplanationPanel
              system={report.system}
              vendor={report.vendor}
              defaultCollapsed
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />待處理摘要</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReportMetric label="跨部門待辦" value={report.relatedTasks.length} />
            <ReportMetric label="資安待確認" value={cryptoSignals.filter((item) => item.status !== "已具備").length} />
            <ReportMetric label="供應商補件" value={vendorItems.filter((item) => item.status === "待補件").length} />
            <ReportMetric label="合規缺口" value={gaps.length} danger={gaps.length > 0} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ReportSection icon={BriefcaseBusiness} title="Business Context" description="把業務重要性轉成資安與主管可判讀的衝擊情境。">
          <InfoGrid items={[
            ["業務重要性", riskLabel[report.system.businessCriticality]],
            ["是否影響客戶服務", boolText(report.submission?.form.affectsCustomerTx) ?? inferCustomerImpact(report.system)],
            ["是否涉及監理申報", boolText(report.submission?.form.involvesRegulatory) ?? inferRegulatoryImpact(report.system)],
            ["是否涉及核心交易", inferCoreTransaction(report.system)],
          ]} />
        </ReportSection>

        <ReportSection icon={DatabaseZap} title="Data Lifespan & HNDL Risk" description="說明資料保存年限、敏感資料與 Harvest Now, Decrypt Later 暴露。">
          <InfoGrid items={[
            ["資料保存年限", formatRetention(report.system.dataRetentionYears)],
            ["敏感資料類型", report.system.dataTypes.join("、")],
            ["10 年後是否仍具價值", boolText(report.submission?.form.dataStillSensitiveAt10yr) ?? (report.system.dataRetentionYears >= 10 ? "是，需優先確認" : "待確認")],
            ["HNDL 風險解釋", summary.hndlExplanation],
          ]} />
        </ReportSection>
      </section>

      <ReportSection icon={KeyRound} title="加密使用情境與待確認事項" description="提供資安與架構團隊確認 TLS、憑證、簽章、HSM、API token 與舊型加密相依性。">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {cryptoSignals.map((signal) => (
            <div className="rounded-lg border bg-muted/20 p-3" key={signal.label}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{signal.label}</div>
                <Badge variant={signal.status === "需確認" ? "warning" : signal.status === "高優先確認" ? "risk" : "success"}>{signal.status}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.reason}</p>
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection icon={Users} title="Vendor Readiness（供應商準備度）" description="供應商 PQC 遷移計畫、加密調整能力與合約升級責任。">
        <div className="grid gap-3 lg:grid-cols-2">
          <InfoGrid items={[
            ["供應商名稱", report.vendor?.vendorName ?? report.submission?.form.vendorName ?? "待補"],
            ["PQC 遷移計畫", report.vendor?.pqcRoadmapStatus ?? boolRoadmap(report.submission)],
            ["加密調整能力", report.vendor?.cryptoAgilityStatus ?? boolCryptoAgility(report.submission)],
            ["合約資安升級條款", report.vendor?.contractUpgradeClause ?? boolClause(report.submission)],
          ]} />
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-2 text-sm font-semibold">待供應商補件事項</div>
            <div className="space-y-2">
              {vendorItems.map((item) => (
                <div className="flex items-start gap-2 text-sm" key={item.label}>
                  {item.status === "待補件" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />}
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-muted-foreground">{item.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ReportSection>

      <ReportSection icon={GitBranch} title="Compliance Lineage" description="本報告的問題、風險規則與報告欄位所依據的政策來源。">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr]">
          <div className="space-y-2">
            {report.lineage.map((item) => (
              <div className="rounded-lg border bg-muted/20 p-3" key={item.lineageId}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.questionId}</Badge>
                  <Badge variant="secondary">{item.sourceType}</Badge>
                  <span className="text-xs text-muted-foreground">{item.sourceReference}</span>
                </div>
                <p className="mt-2 text-sm font-medium">{item.questionText}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.rationale}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 text-sm font-semibold text-amber-800">尚未補齊的合規欄位</div>
            {gaps.length ? (
              <div className="space-y-2">
                {gaps.map((gap) => <div className="text-sm leading-6 text-amber-800" key={gap}>• {gap}</div>)}
              </div>
            ) : (
              <div className="text-sm text-amber-800">目前未發現重大缺口；仍需由資安與法遵覆核。</div>
            )}
          </div>
        </div>
      </ReportSection>

      <ReportSection icon={ClipboardList} title="Action Items" description="依角色產生的後續待辦，作為盤點到治理流程的交接清單。">
        <div className="grid gap-3 md:grid-cols-2">
          {report.relatedTasks.map((task) => (
            <div className="rounded-lg border bg-muted/20 p-3" key={task.taskId}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={task.priority === "P1" ? "risk" : task.priority === "P2" ? "warning" : "secondary"}>{task.priority}</Badge>
                <Badge variant="outline">{task.assignedRole}</Badge>
                <span className="text-xs text-muted-foreground">Due {task.dueDate}</span>
              </div>
              <div className="mt-2 font-medium">{task.taskTitle}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{task.taskDescription}</p>
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection icon={AlertTriangle} title="Guardrail Alerts" description="盤點資料防呆檢查結果：列出缺漏欄位、矛盾判斷與待補件，須由對應負責人確認後，本報告方視為完整。">
        {guardrailAlerts.length > 0 ? (
          <GuardrailPanel alerts={guardrailAlerts} defaultOpen />
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            目前未觸發資料品質防呆告警；仍建議由資安、法遵與系統負責人覆核後列入正式會議紀錄。
          </div>
        )}
      </ReportSection>

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            Known Limits — 已知限制
          </CardTitle>
          <CardDescription className="text-amber-700 dark:text-amber-300">使用前請閱讀。這些限制應記錄在主管會議附件中。</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {KNOWN_LIMITS.map((limit) => (
              <li key={limit.id} className="flex items-start gap-3 text-sm">
                <Badge variant="outline" className="shrink-0 border-amber-400 text-amber-700 dark:text-amber-300">{limit.id}</Badge>
                <div>
                  <span className="font-medium text-amber-900 dark:text-amber-100">{limit.title}：</span>
                  <span className="text-amber-800 dark:text-amber-200">{limit.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Markdown 預覽</CardTitle>
          <CardDescription>提供主管報告與稽核附件可複用的文字版摘要。</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/20 p-4 text-xs leading-5">{markdown}</pre>
        </CardContent>
      </Card>
    </div>
  );
}

function buildReportSource(
  selectedId: string,
  systems: System[],
  vendors: Vendor[],
  tasks: Task[],
  lineage: ComplianceLineage[],
  submissions: IntakeSubmission[]
): ReportSource {
  const selectedSubmission = selectedId === "latest" ? submissions.at(-1) : submissions.find((item) => item.id === selectedId);
  if (selectedSubmission) {
    const system = systems.find((item) => item.systemId === selectedSubmission.systemId) ?? systems[0];
    return {
      sourceLabel: "最新送出的 PQC 前期盤點紀錄",
      system,
      vendor: system.vendorId ? vendors.find((vendor) => vendor.vendorId === system.vendorId) : undefined,
      submission: selectedSubmission,
      relatedTasks: tasks.filter((task) => task.relatedSystemId === system.systemId),
      lineage,
    };
  }

  const selectedSystem = systems.find((system) => system.systemId === selectedId) ?? [...systems].sort((a, b) => b.hndlRiskScore - a.hndlRiskScore)[0];
  return {
    sourceLabel: "示範假資料系統",
    system: selectedSystem,
    vendor: selectedSystem.vendorId ? vendors.find((vendor) => vendor.vendorId === selectedSystem.vendorId) : undefined,
    relatedTasks: tasks.filter((task) => task.relatedSystemId === selectedSystem.systemId),
    lineage,
  };
}

function buildExecutiveSummary(report: ReportSource) {
  const system = report.system;
  const explanation = explainRiskForSystem(system, report.vendor ?? null);
  const reasons = [
    ...explanation.reasons,
    report.vendor ? `供應商 ${report.vendor.vendorName} 的 PQC 準備度需納入追蹤。` : "供應商資料待補或自行維護。",
  ];
  const riskLevel: RiskLevel = system.hndlRiskScore >= 80 ? "critical" : system.hndlRiskScore >= 60 ? "high" : system.hndlRiskScore >= 40 ? "medium" : "low";
  return {
    riskLevel,
    priority: riskLevel === "critical" ? "P1 / 立即納入 PQC 前期盤點" : riskLevel === "high" ? "P1 / 本季完成資安確認" : riskLevel === "medium" ? "P2 / 排入年度盤點" : "P3 / 追蹤即可",
    reasons,
    isHndlHighRisk: system.hndlRiskScore >= 80,
    hndlExplanation: system.dataRetentionYears >= 10
      ? "此系統保存長期敏感資料，攻擊者若現在攔截加密資料，未來量子能力成熟後仍可能解密，因此應優先確認資料保存、外部交換與加密依存。"
      : "目前未達高 HNDL 年限門檻，但仍需確認資料是否具長期商業價值或監理保存義務。",
  };
}

function buildCryptoSignals(report: ReportSource) {
  const form = report.submission?.form;
  const tags = [...report.system.cmdbTags, ...report.system.cryptoSignals].join(" ").toLowerCase();
  return [
    {
      label: "TLS / HTTPS",
      status: form?.usesHttps || tags.includes("tls") ? "需確認" : "待補",
      reason: "確認是否使用 TLS 1.2 以上、憑證有效性與是否存在舊版協定。",
    },
    {
      label: "憑證 / 數位簽章",
      status: form?.hasDigitalSig || tags.includes("certificate") || tags.includes("signature") ? "高優先確認" : "待補",
      reason: "RSA / ECC 憑證與簽章是 PQC 遷移的核心依存，需列入 CBOM。",
    },
    {
      label: "HSM",
      status: form?.hasHsm || tags.includes("hsm") ? "需確認" : "待補",
      reason: "確認 HSM 型號、韌體與後量子演算法支援路徑。",
    },
    {
      label: "API 加密 / Token",
      status: form?.hasApiCertOrToken || report.system.hasExternalApi ? "高優先確認" : "待補",
      reason: "API token、mTLS、JWT signing 與批次檔加密都可能涉及量子脆弱演算法。",
    },
    {
      label: "批次檔加密",
      status: form?.hasBatchFile ? "需確認" : "待補",
      reason: "批次檔交換常涉及 PGP、憑證或對稱金鑰管理，需補充交換頻率與加密方式。",
    },
    {
      label: "RSA / ECC / Legacy crypto",
      status: tags.includes("rsa") || tags.includes("ecc") || tags.includes("legacy") ? "高優先確認" : "需確認",
      reason: "需確認是否存在 RSA、ECC、舊憑證或未知 crypto module。",
    },
    {
      label: "加密調整能力",
      status: report.vendor?.cryptoAgilityStatus === "已支援" || form?.vendorCryptoAgility ? "已具備" : "需確認",
      reason: "評估是否能在不中斷業務下調整演算法與憑證。",
    },
  ] as const;
}

function buildVendorItems(report: ReportSource) {
  const vendor = report.vendor;
  const form = report.submission?.form;
  return [
    {
      label: "PQC 遷移計畫",
      status: vendor?.pqcRoadmapStatus === "已提供" || form?.vendorHasRoadmap ? "已具備" : "待補件",
      reason: vendor?.pqcRoadmapStatus === "已提供" || form?.vendorHasRoadmap ? "已有遷移計畫，可要求補充本系統特定相依性。" : "需向供應商索取後量子遷移計畫與版本時程。",
    },
    {
      label: "加密調整能力證據",
      status: vendor?.cryptoAgilityStatus === "已支援" || form?.vendorCryptoAgility ? "已具備" : "待補件",
      reason: "需提供可替換演算法、憑證與金鑰管理方式的證據。",
    },
    {
      label: "合約資安升級條款",
      status: vendor?.contractUpgradeClause === "有" || form?.contractHasSecurityClause ? "已具備" : "待補件",
      reason: "若缺乏加密升級責任條款，採購需在續約或補充協議中納入。",
    },
  ];
}

function buildComplianceGaps(report: ReportSource) {
  const form = report.submission?.form;
  return [
    report.system.hasExternalApi && report.system.externalParties.length === 0 ? "Q-API-001 外部串接對象尚未列明。" : null,
    report.system.hasExternalApi ? "Q-API-002 尚需逐點列出跨機構 API 的 TLS、憑證、傳輸頻率與資料類型。" : null,
    report.system.dataRetentionYears >= 10 && !form?.dataStillSensitiveAt10yr ? "Q-HNDL-001 需補充 10 年後資料價值與敏感性判斷。" : null,
    report.vendor && report.vendor.pqcRoadmapStatus !== "已提供" ? "Q-VENDOR-001 供應商 PQC 遷移計畫證據不足。" : null,
  ].filter(Boolean) as string[];
}

function ReportSection({ icon: Icon, title, description, children }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Icon className="h-4 w-4" />{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SummaryTile({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: RiskLevel }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm", strong && "font-semibold", tone && riskTextClass(tone))}>{value}</div>
    </div>
  );
}

function ReportMetric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-semibold tabular-nums", danger && "text-rose-600")}>{value}</span>
    </div>
  );
}

function InfoGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-3">
      {items.map(([label, value]) => (
        <div className="rounded-lg border bg-muted/20 p-3" key={label}>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-sm leading-6">{value || "待補"}</div>
        </div>
      ))}
    </div>
  );
}

function formatRetention(years: number) {
  if (years >= 999) return "永久保存";
  if (!years) return "待補";
  return `${years} 年`;
}

function boolText(value?: boolean | null) {
  if (value === true) return "是";
  if (value === false) return "否";
  return undefined;
}

function inferCustomerImpact(system: System) {
  return system.hasExternalApi || system.systemType.includes("Banking") || system.systemType.includes("Gateway") ? "是，可能影響對外服務" : "待確認";
}

function inferRegulatoryImpact(system: System) {
  return system.dataRetentionYears >= 10 || system.dataTypes.some((type) => ["授信", "交易", "醫療", "保單"].some((key) => type.includes(key))) ? "是，需確認監理或法定保存要求" : "待確認";
}

function inferCoreTransaction(system: System) {
  return system.businessCriticality === "critical" || system.dataTypes.some((type) => type.includes("交易")) ? "是，需由系統 Owner 確認交易流程" : "否或待確認";
}

function boolRoadmap(submission?: IntakeSubmission) {
  if (!submission) return "待補";
  if (submission.form.vendorHasRoadmap === true) return "已提供";
  if (submission.form.vendorHasRoadmap === false) return "未提供";
  return "未確認";
}

function boolCryptoAgility(submission?: IntakeSubmission) {
  if (!submission) return "待補";
  if (submission.form.vendorCryptoAgility === true) return "已支援";
  if (submission.form.vendorCryptoAgility === false) return "不支援";
  return "未確認";
}

function boolClause(submission?: IntakeSubmission) {
  if (!submission) return "待補";
  if (submission.form.contractHasSecurityClause === true) return "有";
  if (submission.form.contractHasSecurityClause === false) return "無";
  return "待確認";
}

function riskTextClass(risk: RiskLevel) {
  return risk === "critical" || risk === "high" ? "text-rose-600" : risk === "medium" ? "text-amber-600" : "text-emerald-600";
}

function buildMarkdownReport(
  report: ReportSource,
  summary: ReturnType<typeof buildExecutiveSummary>,
  cryptoSignals: ReturnType<typeof buildCryptoSignals>,
  vendorItems: ReturnType<typeof buildVendorItems>,
  gaps: string[],
  guardrailAlerts: GuardrailAlert[],
  snapshotAt: string,
) {
  const explanation = explainRiskForSystem(report.system, report.vendor ?? null);
  return `# PQC Intake Evidence Pack
> Bank Resilience Intake Platform — 將新興科技風險的分散填報，轉化為跨部門可查閱、可追蹤、可稽核的治理紀錄

## 1. Snapshot
- 系統 ID：${report.system.systemId}
- 系統名稱：${report.system.systemName}
- 業務單位：${report.system.businessUnit}
- 資料版本：示範假資料
- 報告來源：${report.sourceLabel}
- 匯出時間：${snapshotAt}

## 2. Business Context
- 業務重要性：${riskLabel[report.system.businessCriticality]}
- 是否影響客戶服務：${boolText(report.submission?.form.affectsCustomerTx) ?? inferCustomerImpact(report.system)}
- 是否涉及監理申報：${boolText(report.submission?.form.involvesRegulatory) ?? inferRegulatoryImpact(report.system)}
- 是否涉及核心交易：${inferCoreTransaction(report.system)}
- 資料保存年限：${formatRetention(report.system.dataRetentionYears)}
- 敏感資料類型：${report.system.dataTypes.join("、")}
- HNDL 風險解釋：${summary.hndlExplanation}

## 3. Risk Explanation（透明規則，無黑箱）
- 初步風險等級：${riskLabel[summary.riskLevel]}風險
- 建議處理優先級：${summary.priority}
- 是否涉及 HNDL 高風險：${summary.isHndlHighRisk ? "是" : "否"}

風險判斷摘要：
${explanation.summary}

觸發規則：
${explanation.triggeredRules.length
  ? explanation.triggeredRules.map(({ rule, message, contribution }) => `- ${rule.ruleId} / ${rule.name} / +${contribution}：${message}（依據：${rule.policySource}；${rule.policyReference}）`).join("\n")
  : "- 未觸發主要 PQC / HNDL 規則；需確認資料完整性。"}

## 4. Data Quality Guardrail Alerts
${guardrailAlerts.length
  ? guardrailAlerts.map((alert) => `- [${alert.severity.toUpperCase()}] ${alert.guardrailId} / ${alert.title}（負責角色：${alert.targetRole}）\n  ${alert.detail}\n  建議：${alert.suggestedAction}（依據：${alert.policySource}）`).join("\n")
  : "- 未觸發資料防呆告警；資料品質符合基本要求。"}

## 5. Compliance Lineage
${report.lineage.map((item) => `- ${item.questionId} / ${item.sourceType} / ${item.sourceReference}：${item.rationale}`).join("\n")}

Compliance Gaps：
${gaps.length ? gaps.map((gap) => `- ${gap}`).join("\n") : "- 目前未發現重大缺口；仍需覆核。"}

## 6. Action Items
${report.relatedTasks.map((task) => `- [${task.assignedRole}] ${task.priority} ${task.taskTitle}（Due ${task.dueDate}）`).join("\n")}

## 7. Known Limits（已知限制）
${KNOWN_LIMITS.map((limit) => `- ${limit.id} ${limit.title}：${limit.detail}`).join("\n")}`;
}

function buildCsvReport(
  report: ReportSource,
  summary: ReturnType<typeof buildExecutiveSummary>,
  cryptoSignals: ReturnType<typeof buildCryptoSignals>,
  vendorItems: ReturnType<typeof buildVendorItems>,
  gaps: string[],
  guardrailAlerts: GuardrailAlert[],
) {
  const explanation = explainRiskForSystem(report.system, report.vendor ?? null);
  const rows = [
    ["section", "field", "value"],
    ["Snapshot", "systemId", report.system.systemId],
    ["Snapshot", "systemName", report.system.systemName],
    ["Snapshot", "businessUnit", report.system.businessUnit],
    ["Snapshot", "reportSource", report.sourceLabel],
    ["Business Context", "businessCriticality", riskLabel[report.system.businessCriticality]],
    ["Business Context", "dataRetentionYears", formatRetention(report.system.dataRetentionYears)],
    ["Business Context", "dataTypes", report.system.dataTypes.join("、")],
    ["Risk Explanation", "riskLevel", `${riskLabel[summary.riskLevel]}風險`],
    ["Risk Explanation", "priority", summary.priority],
    ["Risk Explanation", "riskSummary", explanation.summary],
    ...explanation.triggeredRules.map(({ rule, message, contribution }) => ["Risk Explanation", rule.ruleId, `${rule.name} / +${contribution} / ${message} / ${rule.policySource}`]),
    ...guardrailAlerts.map((alert) => ["Guardrail Alerts", alert.guardrailId, `[${alert.severity}] ${alert.title} / ${alert.targetRole} / ${alert.suggestedAction}`]),
    ["Crypto Signals", "—", "—"],
    ...cryptoSignals.map((signal) => ["Crypto Signals", signal.label, `${signal.status} - ${signal.reason}`]),
    ...vendorItems.map((item) => ["Vendor Readiness", item.label, `${item.status} - ${item.reason}`]),
    ...gaps.map((gap) => ["Compliance Gaps", "gap", gap]),
    ...report.relatedTasks.map((task) => ["Action Items", task.assignedRole, `${task.priority} ${task.taskTitle}`]),
    ...KNOWN_LIMITS.map((limit) => ["Known Limits", limit.id, `${limit.title}: ${limit.detail}`]),
  ];
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
