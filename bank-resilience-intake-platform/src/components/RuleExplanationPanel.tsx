import { GitBranch, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RiskExplanation } from "@/lib/risk-rules";
import { RiskBadge } from "@/components/RiskBadge";
import { EmptyState } from "@/components/EmptyState";

interface RuleExplanationPanelProps {
  items: Array<{
    systemId: string;
    systemName: string;
    explanation: RiskExplanation;
  }>;
}

export function RuleExplanationPanel({ items }: RuleExplanationPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          風險規則透明化
        </CardTitle>
        <CardDescription>
          每個風險等級都由明確規則觸發，顯示分數、原因與政策來源，避免黑箱判斷。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="尚無風險規則觸發紀錄"
            description="目前沒有符合篩選條件的系統風險解釋。"
            size="sm"
          />
        ) : (
          items.map((item) => (
            <div className="rounded-lg border bg-muted/20 p-3" key={item.systemId}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{item.systemName}</div>
                  <div className="font-mono text-xs text-muted-foreground">{item.systemId}</div>
                </div>
                <div className="flex items-center gap-2">
                  <RiskBadge level={item.explanation.riskLevel} />
                  <Badge variant="outline">{item.explanation.score} 分</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.explanation.summary}</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {item.explanation.reasons.slice(0, 4).map((reason) => (
                  <div className="rounded-md border bg-background px-3 py-2 text-xs leading-5" key={reason}>
                    {reason}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {item.explanation.policySources.map((source) => (
                  <Badge variant="secondary" key={source}>{source}</Badge>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
