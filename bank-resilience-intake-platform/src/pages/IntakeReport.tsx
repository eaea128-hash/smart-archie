import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { buildEvidenceSnapshotMeta, type EvidenceSnapshotMeta } from "@/lib/evidence";

const RULE_ENGINE_VERSION = "1.2.0";
const RULE_ENGINE_UPDATED = "2026-06";

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initId = searchParams.get("systemId") ?? "latest";
  const [selectedId, setSelectedId] = useState<string>(initId);

  function handleSelectId(id: string) {
    setSelectedId(id);
    navigate(id === "latest" ? "/report" : `/report?systemId=${id}`, { replace: true });
  }
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
  const evidencePayload = {
    systemId: report.system.systemId,
    systemName: report.system.systemName,
    businessUnit: report.system.businessUnit,
    sourceLabel: report.sourceLabel,
    riskLevel: riskExplanation.riskLevel,
    riskScore: riskExplanation.score,
    triggeredRuleIds: riskExplanation.triggeredRules.map(({ rule }) => rule.ruleId),
    guardrailIds: guardrailAlerts.map((alert) => alert.guardrailId),
    taskIds: report.relatedTasks.map((task) => task.taskId),
    complianceLineageIds: report.lineage.map((item) => item.lineageId),
  };
  const evidenceMeta = buildEvidenceSnapshotMeta({
    systemId: report.system.systemId,
    snapshotAt,
    dataVersion: "demo-local-v1",
    ruleEngineVersion: RULE_ENGINE_VERSION,
    ruleEngineUpdated: RULE_ENGINE_UPDATED,
    payload: evidencePayload,
  });
  const markdown = buildMarkdownReport(report, summary, cryptoSignals, vendorItems, gaps, guardrailAlerts, evidenceMeta);

  const exportJson = () => downloadFile(`${report.system.systemId}-evidence-pack.json`, JSON.stringify({
    evidencePack: {
      ...evidenceMeta,
      version: "1.0",
      generatedBy: "Bank Resilience Intake Platform",
      note: "Demo 完整性指紋用於固定本次輸出內容，不等同正式電子簽章。",
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

  const exportCsv = () => downloadFile(`${report.system.systemId}-evidence-pack.csv`, buildCsvReport(report, summary, cryptoSignals, vendorItems, gaps, guardrailAlerts, evidenceMeta), "text/csv;charset=utf-8");
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
          <p className="mt-1 text-sm text-muted-foreground">
            匯出系統盤點、風險依據、防呆告警、待辦與完整性指紋。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson}><FileJson className="mr-2 h-4 w-4" />匯出 JSON</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />匯出 CSV</Button>
          <Button variant="outline" onClick={exportMarkdown}><FileText className="mr-2 h-4 w-4" />匯出 Markdown</Button>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />列印 / 存成 PDF</Button>
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
            onChange={(event) => handleSelectId(event.target.value)}
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
        <h1 className="text-2xl font-semibold">PQC / Quantum Readiness 盤點證據包</h1>
        <p className="mt-1 text-sm text-muted-foreground">{report.system.systemName} / {report.system.businessUnit}</p>
      </div>

      <ConclusionBanner report={report} summary={summary} gaps={gaps} guardrailAlerts={guardrailAlerts} />

      <ReportSection icon={FileText} title="Snapshot" description="固定記錄本次輸出的時間點、資料版本、系統與供應商，作為會議附件與後續追蹤依據。">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryTile label="系統" value={`${report.system.systemName}（${report.system.systemId}）`} strong />
          <SummaryTile label="供應商" value={report.vendor?.vendorName ?? report.submission?.form.vendorName ?? "待補"} />
          <SummaryTile label="匯出時間" value={snapshotTime} />
          <SummaryTile label="資料版本" value={evidenceMeta.dataVersion} />
          <SummaryTile label="證據包 ID" value={evidenceMeta.evidencePackId} />
          <SummaryTile label="規則版本" value={`v${evidenceMeta.ruleEngineVersion} / ${evidenceMeta.ruleEngineUpdated}`} />
          <SummaryTile label="完整性指紋" value={evidenceMeta.integrityDigest} strong />
          <SummaryTile label="資料來源" value={`示範資料 / ${report.sourceLabel}`} />
        </div>
      </ReportSection>

      {/* 量子風險評級卡 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <RatingCard
          title="PQC / Quantum Readiness 初步風險評級"
          rating={riskLabel[summary.riskLevel] + "風險"}
          riskLevel={summary.riskLevel}
          sub={summary.priority}
          icon={ShieldCheck}
        />
        <RatingCard
          title="HNDL 資料生命週期風險"
          rating={summary.isHndlHighRisk ? "高風險" : report.system.dataRetentionYears >= 5 ? "中風險" : "低風險"}
          riskLevel={summary.isHndlHighRisk ? "high" : report.system.dataRetentionYears >= 5 ? "medium" : "low"}
          sub={`HNDL score ${report.system.hndlRiskScore} / 資料保存 ${formatRetention(report.system.dataRetentionYears)}`}
          icon={DatabaseZap}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />核心風險摘要</CardTitle>
            <CardDescription>以業務語言說明為何此系統需納入 PQC 優先盤點。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryTile label="系統名稱" value={report.system.systemName} />
              <SummaryTile label="業務單位" value={report.system.businessUnit} />
              <SummaryTile label="建議優先級" value={summary.priority} strong />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryTile label="初步風險等級" value={`${riskLabel[summary.riskLevel]}風險`} strong tone={summary.riskLevel} />
              <SummaryTile label="風險分數" value={`${riskExplanation.score} 分`} strong tone={summary.riskLevel} />
              <SummaryTile label="主要觸發規則" value={`${riskExplanation.triggeredRules.length} 條`} strong /></div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-2 text-sm font-semibold">核心風險說明（主管版）</div>
              <p className="mb-3 text-sm font-medium leading-7">
                {buildNarrativeSummary(report, summary)}
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

      <ReportSection icon={KeyRound} title="資安與架構接續評估" description="針對 8 類加密相依性，提供資安與架構團隊的接續確認清單與建議行動。">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">類別</th>
                <th className="py-2 pr-3 font-medium">狀態</th>
                <th className="py-2 pr-3 font-medium">發現說明</th>
                <th className="py-2 pr-3 font-medium">建議行動</th>
                <th className="py-2 font-medium">負責角色</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {buildSecurityFollowup(report).map((row) => (
                <tr key={row.category} className="align-top">
                  <td className="py-2 pr-3 font-medium leading-6 whitespace-nowrap">{row.category}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={row.status === "高優先確認" ? "risk" : row.status === "需確認" || row.status === "部分完成" ? "warning" : row.status === "待補" || row.status === "待補件" ? "secondary" : "success"}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 leading-6 text-muted-foreground">{row.finding}</td>
                  <td className="py-2 pr-3 leading-6 text-muted-foreground">{row.action}</td>
                  <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportSection>

      <ReportSection icon={KeyRound} title="密碼學資產線索清單" description="將系統 CMDB 標籤、加密訊號與盤點資料轉成資安可接續盤點的線索，用於建立 CBOM 密碼物料清單。">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">線索類型</th>
                <th className="py-2 pr-3 font-medium">來源</th>
                <th className="py-2 pr-3 font-medium">線索內容</th>
                <th className="py-2 pr-3 font-medium">可能影響</th>
                <th className="py-2 pr-3 font-medium">建議確認角色</th>
                <th className="py-2 font-medium">建議下一步</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {buildCryptoAssetClues(report).map((clue, idx) => (
                <tr key={idx} className="align-top">
                  <td className="py-2 pr-3 font-medium leading-6 whitespace-nowrap">{clue.type}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">{clue.source}</td>
                  <td className="py-2 pr-3 leading-6 text-muted-foreground">{clue.content}</td>
                  <td className="py-2 pr-3 leading-6 text-muted-foreground">{clue.impact}</td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">{clue.role}</td>
                  <td className="py-2 leading-6 text-muted-foreground">{clue.nextStep}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

      <ReportSection icon={ClipboardList} title="PQC 遷移準備度檢核" description="對齊相關趨勢與檢核方向，逐項確認準備度、缺口與建議補件角色。">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">檢核項目</th>
                <th className="py-2 pr-3 font-medium">狀態</th>
                <th className="py-2 pr-3 font-medium">對應資料欄位</th>
                <th className="py-2 pr-3 font-medium">缺口說明</th>
                <th className="py-2 font-medium">建議補件角色</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {buildFscChecklist(report).map((row) => (
                <tr key={row.item} className="align-top">
                  <td className="py-2 pr-3 font-medium leading-6">{row.item}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <Badge variant={row.status === "已完成" ? "success" : row.status === "已初步盤點" ? "secondary" : row.status === "部分完成" ? "warning" : "risk"}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 leading-6 text-muted-foreground">{row.source}</td>
                  <td className="py-2 pr-3 leading-6 text-muted-foreground">{row.gap || "—"}</td>
                  <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{row.role || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-mono">Risk Engine v{RULE_ENGINE_VERSION}</Badge>
            <span>最後更新：{RULE_ENGINE_UPDATED}・對應金管會 PQC 治理指引</span>
          </div>
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

function ConclusionBanner({ report, summary, gaps, guardrailAlerts }: {
  report: ReportSource;
  summary: ReturnType<typeof buildExecutiveSummary>;
  gaps: string[];
  guardrailAlerts: GuardrailAlert[];
}) {
  const isUrgent = summary.riskLevel === "critical" || (summary.riskLevel === "high" && summary.isHndlHighRisk);
  const isAttention = !isUrgent && (summary.riskLevel === "high" || (summary.riskLevel === "medium" && gaps.length > 0));
  const verdict = isUrgent ? "需立即處理" : isAttention ? "需主管關注" : "持續追蹤";
  const bg = isUrgent ? "border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/40"
    : isAttention ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
    : "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40";
  const textColor = isUrgent ? "text-rose-800 dark:text-rose-200" : isAttention ? "text-amber-800 dark:text-amber-200" : "text-emerald-800 dark:text-emerald-200";
  const badgeVariant = isUrgent ? "risk" : isAttention ? "warning" : "success";

  const vendorMissing = report.vendor && report.vendor.pqcRoadmapStatus !== "已提供";
  const errorAlerts = guardrailAlerts.filter((a) => a.severity === "error").length;
  const warnAlerts = guardrailAlerts.filter((a) => a.severity === "warning").length;

  return (
    <div className={`rounded-xl border-2 p-5 ${bg}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className={`text-xs font-semibold uppercase tracking-widest ${textColor} opacity-70`}>盤點結論</div>
          <div className={`mt-1 text-2xl font-bold ${textColor}`}>{report.system.systemName}</div>
          <div className={`text-sm ${textColor} opacity-80`}>{report.system.businessUnit}</div>
        </div>
        <Badge variant={badgeVariant} className="text-base px-4 py-1.5 shrink-0">{verdict}</Badge>
      </div>
      <div className={`mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4 ${textColor}`}>
        <div className="flex items-center gap-2">
          <span className="font-semibold">量子風險：</span>
          <span>{riskLabel[summary.riskLevel]}風險（{summary.riskLevel === "critical" || summary.riskLevel === "high" ? "優先處理" : summary.riskLevel === "medium" ? "持續追蹤" : "低優先"}）</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">HNDL 資料風險：</span>
          <span>{summary.isHndlHighRisk ? "高——長期敏感資料已達高風險門檻" : "未達高風險門檻，仍需確認"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">供應商狀態：</span>
          <span>{vendorMissing ? `${report.vendor!.vendorName} 尚未提供 PQC 計畫` : report.vendor ? `${report.vendor.vendorName} 已部分回覆` : "供應商資料待補"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">補件壓力：</span>
          <span>{errorAlerts > 0 ? `${errorAlerts} 項 Error、${warnAlerts} 項 Warning 待補` : warnAlerts > 0 ? `${warnAlerts} 項 Warning 待補` : "無重大防呆告警"}</span>
        </div>
      </div>
      <div className={`mt-3 text-sm leading-6 ${textColor} opacity-90 border-t border-current/20 pt-3`}>
        <span className="font-semibold">建議行動：</span>{summary.priority}
      </div>
    </div>
  );
}

function buildSecurityFollowup(report: ReportSource) {
  const form = report.submission?.form;
  const tags = [...report.system.cmdbTags, ...report.system.cryptoSignals].join(" ").toLowerCase();
  const v = report.vendor;
  return [
    {
      category: "TLS / HTTPS",
      status: form?.usesHttps || tags.includes("tls") || tags.includes("https") ? "需確認" : "待補" as const,
      finding: form?.usesHttps || tags.includes("tls") ? "系統具備 TLS/HTTPS 相依，需確認版本與憑證有效性" : "TLS/HTTPS 使用情況未填答",
      action: "確認 TLS 版本（需 1.2+）、憑證有效期、是否有舊版協定殘留",
      role: "資安",
    },
    {
      category: "憑證 / PKI",
      status: form?.hasDigitalSig || tags.includes("certificate") || tags.includes("pki") ? "高優先確認" : "待補" as const,
      finding: form?.hasDigitalSig || tags.includes("certificate") ? "偵測到 PKI 憑證或數位憑證相依" : "憑證使用情況待確認",
      action: "確認 RSA/ECC 憑證有效期、CA 鏈完整性，列入 CBOM",
      role: "資安 / 架構",
    },
    {
      category: "數位簽章 / JWT / XML Sig",
      status: form?.hasDigitalSig || tags.includes("signature") || tags.includes("jwt") ? "高優先確認" : "待補" as const,
      finding: form?.hasDigitalSig || tags.includes("signature") ? "系統涉及數位簽章或 JWT，演算法待確認" : "簽章使用情況待確認",
      action: "確認 RS256/ES256 或 XML 簽章演算法是否為量子脆弱演算法",
      role: "架構",
    },
    {
      category: "HSM / 硬體加密設備",
      status: form?.hasHsm || tags.includes("hsm") ? "需確認" : "待補" as const,
      finding: form?.hasHsm || tags.includes("hsm") ? "系統涉及 HSM，需確認型號與 PQC 支援路徑" : "HSM 使用情況待確認",
      action: "確認 HSM 廠牌型號、韌體版本與後量子演算法支援計畫",
      role: "架構 / 採購",
    },
    {
      category: "API Token / mTLS / API Key",
      status: report.system.hasExternalApi || form?.hasApiCertOrToken ? "高優先確認" : "待補" as const,
      finding: report.system.hasExternalApi || form?.hasApiCertOrToken ? "有外部 API 串接或 API Token，傳輸加密需確認" : "API 加密使用情況待確認",
      action: "確認 API token 演算法、mTLS 憑證版本、JWT signing key 是否為量子脆弱",
      role: "資安",
    },
    {
      category: "Legacy Crypto / TLS 1.0 / 1.1",
      status: tags.includes("legacy") || tags.includes("tls 1.0") || tags.includes("tls 1.1") ? "高優先確認" : "需確認" as const,
      finding: tags.includes("legacy") ? "偵測到 legacy crypto 標籤，需優先停用" : "Legacy crypto 使用情況待確認",
      action: "停用 TLS 1.0/1.1，淘汰舊型憑證，確認無 RC4/DES/3DES/MD5",
      role: "資安",
    },
    {
      category: "Unknown Crypto Module",
      status: tags.includes("unknown") ? "高優先確認" : "待補" as const,
      finding: tags.includes("unknown") ? "存在未知加密模組，需強制列入 CBOM" : "未偵測到 unknown crypto 標籤",
      action: "要求系統 Owner 或廠商列出完整加密函式庫清單",
      role: "資安 / 系統Owner",
    },
    {
      category: "供應商 PQC 遷移計畫 / 加密調整能力",
      status: v?.pqcRoadmapStatus === "已提供" && v?.cryptoAgilityStatus === "已支援" ? "部分完成" : "待補件" as const,
      finding: v ? `${v.vendorName}：PQC 遷移計畫 ${v.pqcRoadmapStatus}、加密調整能力 ${v.cryptoAgilityStatus}` : "供應商加密能力待確認",
      action: "向供應商索取 PQC 遷移計畫、加密演算法清單與加密調整能力書面說明",
      role: "採購 / 資安",
    },
  ];
}

function buildCryptoAssetClues(report: ReportSource) {
  const s = report.system;
  const form = report.submission?.form;
  const clues: { type: string; source: string; content: string; impact: string; role: string; nextStep: string }[] = [];

  for (const tag of s.cmdbTags) {
    clues.push({
      type: "CMDB Tag",
      source: "系統 CMDB",
      content: tag,
      impact: tag.toLowerCase().includes("legacy") || tag.toLowerCase().includes("rsa") || tag.toLowerCase().includes("ecc") ? "可能涉及量子脆弱演算法，需列入 CBOM" : "需由資安確認實際加密使用情境",
      role: "架構 / 資安",
      nextStep: "由系統 Owner 確認此標籤對應的加密函式庫版本",
    });
  }

  for (const signal of s.cryptoSignals) {
    clues.push({
      type: "Crypto Signal",
      source: "盤點填答 / 掃描標籤",
      content: signal,
      impact: signal.toLowerCase().includes("rsa") || signal.toLowerCase().includes("ecc") ? "RSA/ECC 為 PQC 遷移核心依存" : signal.toLowerCase().includes("unknown") ? "未知模組需強制納入 CBOM" : "需確認加密演算法版本",
      role: "資安",
      nextStep: "列入 CBOM 密碼物料清單，確認演算法版本與遷移時程",
    });
  }

  if (form?.usesHttps) clues.push({ type: "TLS/HTTPS", source: "盤點資料", content: "系統使用 HTTPS", impact: "需確認 TLS 版本與憑證有效期", role: "資安", nextStep: "確認 TLS 1.2+ 並記錄憑證到期日" });
  if (form?.hasDigitalSig) clues.push({ type: "數位簽章", source: "盤點資料", content: "系統具備數位簽章", impact: "RSA/ECC 簽章為 PQC 遷移核心依存", role: "架構", nextStep: "確認簽章演算法，列入 CBOM" });
  if (form?.hasHsm) clues.push({ type: "HSM", source: "盤點資料", content: "系統使用 HSM", impact: "需確認 HSM 廠牌是否支援後量子演算法", role: "採購 / 架構", nextStep: "確認 HSM 型號與 PQC 韌體路徑" });
  if (form?.hasApiCertOrToken) clues.push({ type: "API Token / 憑證", source: "盤點資料", content: "系統有 API 憑證或 Token", impact: "API 認證可能使用量子脆弱演算法", role: "資安", nextStep: "確認 token 類型與 signing 演算法" });
  if (form?.hasBatchFile) clues.push({ type: "批次檔加密", source: "盤點資料", content: "系統有批次檔交換", impact: "批次檔可能使用 PGP 或對稱金鑰，需確認金鑰長度與保存", role: "資安", nextStep: "確認批次檔加密方式與金鑰管理機制" });

  if (clues.length === 0) {
    clues.push({ type: "無線索", source: "—", content: "未填答加密使用情境或無 CMDB 標籤", impact: "無法評估密碼學風險", role: "系統Owner", nextStep: "請至 PQC Intake 補充填答加密使用情境" });
  }
  return clues;
}

function RatingCard({ title, rating, riskLevel, sub, icon: Icon }: {
  title: string; rating: string; riskLevel: RiskLevel; sub: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const bg = riskLevel === "critical" || riskLevel === "high" ? "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30"
    : riskLevel === "medium" ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
    : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30";
  const textColor = riskLevel === "critical" || riskLevel === "high" ? "text-rose-700 dark:text-rose-300"
    : riskLevel === "medium" ? "text-amber-700 dark:text-amber-300"
    : "text-emerald-700 dark:text-emerald-300";
  return (
    <div className={`rounded-xl border p-5 ${bg}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${textColor}`}>
        <Icon className="h-4 w-4" />{title}
      </div>
      <div className={`mt-3 text-3xl font-bold ${textColor}`}>{rating}</div>
      <div className={`mt-1 text-xs ${textColor} opacity-80`}>{sub}</div>
    </div>
  );
}

function buildNarrativeSummary(report: ReportSource, summary: ReturnType<typeof buildExecutiveSummary>): string {
  const s = report.system;
  const v = report.vendor;
  const parts: string[] = [];

  const retentionDesc = s.dataRetentionYears >= 999 ? "永久" : `${s.dataRetentionYears} 年`;
  const dataTypeDesc = s.dataTypes.slice(0, 3).join("、");
  parts.push(`${s.systemName}（${s.businessUnit}）保存${dataTypeDesc}等敏感資料，保存年限為${retentionDesc}。`);

  if (summary.isHndlHighRisk) {
    parts.push("因保存期限長、資料具長期商業或個人識別價值，攻擊者若現在攔截傳輸中的加密資料，未來量子運算成熟後仍可能解密，構成 HNDL（Harvest Now, Decrypt Later）高風險。");
  }

  if (s.hasExternalApi && s.externalParties.length > 0) {
    parts.push(`系統涉及與 ${s.externalParties.slice(0, 2).join("、")} 等外部機構的 API 串接，需確認各串接點的傳輸加密方式與憑證有效性。`);
  } else if (s.hasExternalApi) {
    parts.push("系統具有外部 API 串接，但外部對象尚未列明，需補充跨機構交換的加密傳輸確認。");
  }

  if (v) {
    if (v.pqcRoadmapStatus !== "已提供") {
      parts.push(`供應商 ${v.vendorName} 尚未提供 PQC 遷移計畫，建議採購與資安共同發出正式詢問，要求在 30 天內回覆。`);
    } else {
      parts.push(`供應商 ${v.vendorName} 已提供 PQC 遷移計畫，建議進一步確認本系統相依的加密演算法遷移時程。`);
    }
  }

  return parts.join("") || "請參閱下方觸發規則清單取得詳細風險說明。";
}

function buildFscChecklist(report: ReportSource) {
  const s = report.system;
  const v = report.vendor;
  const form = report.submission?.form;
  const tags = [...s.cmdbTags, ...s.cryptoSignals].join(" ").toLowerCase();
  const hasCryptoTags = tags.length > 0;

  return [
    {
      item: "加密使用情境初步盤點",
      status: hasCryptoTags ? "已初步盤點" : "待確認",
      source: "Crypto Signals / CMDB Tags",
      gap: hasCryptoTags ? "需資安確認實際演算法版本，建立 CBOM" : "尚未填入加密標籤，無法評估",
      role: "資安",
    },
    {
      item: "業務衝擊與風險評估",
      status: "已初步盤點",
      source: `業務重要性：${s.businessCriticality} / HNDL score：${s.hndlRiskScore}`,
      gap: "初步評估完成，需資安與業務共同確認正式風險等級",
      role: "業務 / 資安",
    },
    {
      item: "長期敏感資料 / HNDL 風險辨識",
      status: s.dataRetentionYears >= 10 ? "已完成" : "部分完成",
      source: `保存年限：${formatRetention(s.dataRetentionYears)} / 資料類型：${s.dataTypes.slice(0,2).join("、")}`,
      gap: s.dataRetentionYears >= 10 ? "" : "確認是否有法定或業務義務延長保存年限",
      role: "業務 / 法遵",
    },
    {
      item: "外部 API / 跨機構資料交換盤點",
      status: s.hasExternalApi ? (s.externalParties.length > 0 ? "部分完成" : "待確認") : "已完成",
      source: s.hasExternalApi ? `外部串接：${s.externalParties.slice(0,2).join("、") || "待列明"}` : "無外部串接",
      gap: s.hasExternalApi && s.externalParties.length === 0 ? "需補充外部對象名稱與加密傳輸方式" : s.hasExternalApi ? "需補 mTLS / TLS 版本 / 憑證明細" : "",
      role: "架構 / 資安",
    },
    {
      item: "供應商 PQC 遷移計畫準備度",
      status: v?.pqcRoadmapStatus === "已提供" ? "部分完成" : "待確認",
      source: v ? `${v.vendorName} / PQC 遷移計畫：${v.pqcRoadmapStatus}` : (form?.vendorName ?? "待補"),
      gap: v?.pqcRoadmapStatus !== "已提供" ? "供應商尚未提供 PQC 遷移計畫，需採購追蹤" : "建議索取本系統相依加密元件清單",
      role: "採購",
    },
    {
      item: "加密調整能力",
      status: v?.cryptoAgilityStatus === "已支援" || form?.vendorCryptoAgility ? "部分完成" : "待確認",
      source: v ? `加密調整能力：${v.cryptoAgilityStatus}` : (form?.vendorCryptoAgility ? "填答已具備" : "待補"),
      gap: v?.cryptoAgilityStatus !== "已支援" && !form?.vendorCryptoAgility ? "需廠商書面說明可替換演算法能力" : "",
      role: "採購 / 資安",
    },
    {
      item: "採購 / 合約資安升級責任",
      status: v?.contractUpgradeClause === "有" || form?.contractHasSecurityClause ? "部分完成" : "待確認",
      source: v ? `合約加密升級條款：${v.contractUpgradeClause}` : (form?.contractHasSecurityClause ? "填答已有條款" : "待補"),
      gap: v?.contractUpgradeClause !== "有" && !form?.contractHasSecurityClause ? "採購需在合約中納入 PQC 升級責任條款" : "",
      role: "採購 / 法遵",
    },
    {
      item: "資安團隊接續確認事項",
      status: hasCryptoTags ? "部分完成" : "待確認",
      source: `觸發規則數：${explainRiskForSystem(s, v ?? null).triggeredRules.length} 條 / Guardrail 待確認`,
      gap: "需由資安覆核觸發規則、確認密碼學資產線索清單並排定 CBOM 建立時程",
      role: "資安",
    },
  ] as { item: string; status: "已完成" | "已初步盤點" | "部分完成" | "待確認"; source: string; gap: string; role: string }[];
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
  const riskLevel: RiskLevel = explanation.riskLevel;
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
  evidenceMeta: EvidenceSnapshotMeta,
) {
  const explanation = explainRiskForSystem(report.system, report.vendor ?? null);
  return `# PQC 盤點證據包
> Bank Resilience Intake Platform — 將新興科技風險的分散填報，轉化為跨部門可查閱、可追蹤、可稽核的治理紀錄

## 1. Snapshot
- 系統 ID：${report.system.systemId}
- 系統名稱：${report.system.systemName}
- 業務單位：${report.system.businessUnit}
- 資料版本：${evidenceMeta.dataVersion}
- 報告來源：${report.sourceLabel}
- 匯出時間：${evidenceMeta.snapshotAt}
- 證據包 ID：${evidenceMeta.evidencePackId}
- 規則版本：v${evidenceMeta.ruleEngineVersion}（${evidenceMeta.ruleEngineUpdated}）
- 完整性指紋：${evidenceMeta.integrityDigest}
- 指紋說明：Demo 完整性指紋用於固定本次輸出內容，不等同正式電子簽章。

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
> 風險評估引擎版本：v${RULE_ENGINE_VERSION}（${RULE_ENGINE_UPDATED} 更新，對應金管會 PQC 治理指引）
${KNOWN_LIMITS.map((limit) => `- ${limit.id} ${limit.title}：${limit.detail}`).join("\n")}
- 免責聲明：本報告為 POC 展示，所有資料均為模擬假資料，不代表任何真實機構之盤點結果。

## 8. Security & Architecture Follow-up / 資安與架構接續評估
${(() => {
  const items = buildSecurityFollowup(report);
  return items.map((item) => `| ${item.category} | ${item.finding} | ${item.status} | ${item.role} | ${item.action} |`).join("\n");
})()}

## 9. Cryptographic Asset Clues / 密碼學資產線索清單
${(() => {
  const clues = buildCryptoAssetClues(report);
  return clues.map((c) => `| ${c.type} | ${c.source} | ${c.content} | ${c.impact} | ${c.role} | ${c.nextStep} |`).join("\n");
})()}`;
}

function buildCsvReport(
  report: ReportSource,
  summary: ReturnType<typeof buildExecutiveSummary>,
  cryptoSignals: ReturnType<typeof buildCryptoSignals>,
  vendorItems: ReturnType<typeof buildVendorItems>,
  gaps: string[],
  guardrailAlerts: GuardrailAlert[],
  evidenceMeta: EvidenceSnapshotMeta,
) {
  const explanation = explainRiskForSystem(report.system, report.vendor ?? null);
  const rows = [
    ["section", "field", "value"],
    ["Snapshot", "systemId", report.system.systemId],
    ["Snapshot", "systemName", report.system.systemName],
    ["Snapshot", "businessUnit", report.system.businessUnit],
    ["Snapshot", "reportSource", report.sourceLabel],
    ["Snapshot", "evidencePackId", evidenceMeta.evidencePackId],
    ["Snapshot", "snapshotAt", evidenceMeta.snapshotAt],
    ["Snapshot", "dataVersion", evidenceMeta.dataVersion],
    ["Snapshot", "ruleEngineVersion", `v${evidenceMeta.ruleEngineVersion} / ${evidenceMeta.ruleEngineUpdated}`],
    ["Snapshot", "integrityDigest", evidenceMeta.integrityDigest],
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
    ...buildSecurityFollowup(report).map((item) => ["Security Follow-up", item.category, `${item.finding} / 狀態：${item.status} / 角色：${item.role} / 行動：${item.action}`]),
    ...buildCryptoAssetClues(report).map((c) => ["Crypto Asset Clues", c.type, `${c.source} / ${c.content} / 衝擊：${c.impact} / 角色：${c.role} / 下一步：${c.nextStep}`]),
  ];
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
