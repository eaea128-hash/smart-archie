import { Settings as SettingsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const settings = [
  ["示範資料儲存", "localStorage", "啟用"],
  ["Data source", "Fake banking systems and vendors", "固定"],
  ["Integration", "No real company systems", "停用"],
  ["Export", "PDF / CSV / JSON", "待開發"],
];

export function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SettingsIcon className="h-4 w-4" />
          Settings
        </div>
        <h2 className="mt-1 text-2xl font-semibold">設定</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          POC 目前只使用本機假資料。後續可加入風險權重、盤點版本、匯出格式與角色權限設定。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>示範設定</CardTitle>
          <CardDescription>確認這個 POC 不會串接真實銀行或供應商系統。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {settings.map(([name, value, status]) => (
            <div key={name} className="flex items-center justify-between rounded-lg border bg-muted/20 p-4">
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-sm text-muted-foreground">{value}</div>
              </div>
              <Badge variant={status === "待開發" ? "warning" : "secondary"}>{status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
