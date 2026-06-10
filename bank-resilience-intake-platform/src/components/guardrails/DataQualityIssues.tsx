import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import type { GuardrailAlert } from "@/lib/guardrails";

interface DataQualityIssuesProps {
  alerts: GuardrailAlert[];
}

export function DataQualityIssues({ alerts }: DataQualityIssuesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Data Quality Issues / 盤點資料品質警示
        </CardTitle>
        <CardDescription>
          將資料缺漏、矛盾、高風險與待補件轉成可追蹤的治理清單。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="尚無資料品質警示"
            description="目前沒有偵測到保存年限、外部串接、舊型加密、供應商遷移計畫或合約到期缺口。"
            size="sm"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>系統名稱</TableHead>
                  <TableHead>問題類型</TableHead>
                  <TableHead>觸發規則</TableHead>
                  <TableHead>影響</TableHead>
                  <TableHead>建議動作</TableHead>
                  <TableHead>指派角色</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.alertId}>
                    <TableCell>
                      <div className="font-medium">{alert.systemName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{alert.systemId}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={alert.severity === "error" ? "risk" : alert.severity === "warning" ? "warning" : "secondary"}>
                        {classifyIssue(alert)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">{alert.guardrailId}</div>
                      <div className="mt-1 max-w-48 text-xs text-muted-foreground">{alert.guardrailName}</div>
                    </TableCell>
                    <TableCell className="max-w-64 text-sm leading-6 text-muted-foreground">
                      {impactLabel(alert)}
                    </TableCell>
                    <TableCell className="min-w-64 text-sm leading-6">
                      {alert.suggestedAction}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{alert.targetRole}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function classifyIssue(alert: GuardrailAlert) {
  if (alert.guardrailId.includes("01")) return "缺漏";
  if (alert.guardrailId.includes("02")) return "缺漏";
  if (alert.guardrailId.includes("03")) return "待補件";
  if (alert.guardrailId.includes("04")) return "矛盾";
  if (alert.guardrailId.includes("05")) return "待補件";
  if (alert.guardrailId.includes("06")) return "高風險";
  if (alert.guardrailId.includes("07")) return "缺漏";
  return alert.severity === "error" ? "高風險" : "待補件";
}

function impactLabel(alert: GuardrailAlert) {
  if (alert.guardrailId.includes("01")) return "影響 HNDL 風險判斷，可能低估長期資料外洩風險。";
  if (alert.guardrailId.includes("02")) return "影響外部串接與合規判斷，資安無法確認每個資料交換點。";
  if (alert.guardrailId.includes("03")) return "影響供應商準備度與遷移時程。";
  if (alert.guardrailId.includes("04")) return "影響資安判斷，盤點風險與 CMDB 技術標籤不一致。";
  if (alert.guardrailId.includes("05")) return "影響採購與合約治理，續約前需納入 PQC 條款。";
  if (alert.guardrailId.includes("07")) return "影響加密依存盤點，需確認憑證、簽章、Token 或加密傳輸。";
  return alert.detail;
}
