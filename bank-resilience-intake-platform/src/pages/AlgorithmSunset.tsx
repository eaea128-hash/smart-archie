import { useMemo, useState } from "react";
import { AlertTriangle, Ban, Clock, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDemoData } from "@/lib/storage";
import type { System } from "@/data/demo-data";

// ─── Algorithm Sunset Dates ───────────────────────────────────────────────────

interface AlgoSunset {
  signal: string;     // matches cryptoSignals keywords
  label: string;      // display name
  sunsetDate: string; // ISO date
  sunsetLabel: string;
  authority: string;
  basis: string;
  severity: "critical" | "high" | "medium";
}

const SUNSETS: AlgoSunset[] = [
  {
    signal: "rsa",
    label: "RSA-2048 / RSA-4096",
    sunsetDate: "2030-01-01",
    sunsetLabel: "2030-01-01",
    authority: "NSA CNSA 2.0",
    basis: "CNSA 2.0 Advisory (2022-09) — 全面停用傳統公鑰算法",
    severity: "critical",
  },
  {
    signal: "ecc",
    label: "ECC / ECDSA / ECDH",
    sunsetDate: "2030-01-01",
    sunsetLabel: "2030-01-01",
    authority: "NSA CNSA 2.0",
    basis: "CNSA 2.0 Advisory (2022-09) — 全面停用橢圓曲線算法",
    severity: "critical",
  },
  {
    signal: "tls",
    label: "TLS 1.2（非 PQC）",
    sunsetDate: "2027-12-31",
    sunsetLabel: "2027-12-31",
    authority: "IETF / MAS TRM",
    basis: "IETF TLS WG + MAS TRM 2021 — TLS 1.3 + hybrid PQC 成為強制標準",
    severity: "high",
  },
  {
    signal: "certificate",
    label: "RSA/ECDSA X.509 憑證",
    sunsetDate: "2030-01-01",
    sunsetLabel: "2030-01-01",
    authority: "NSA CNSA 2.0",
    basis: "CNSA 2.0 — 新憑證應改用 Hybrid X.509（ML-DSA）",
    severity: "critical",
  },
  {
    signal: "hsm",
    label: "HSM 舊韌體（不支援 PQC）",
    sunsetDate: "2029-06-30",
    sunsetLabel: "2029-06-30（估計）",
    authority: "內部風險估算",
    basis: "HSM 韌體升級週期約 2-3 年，需在 2030 前完成換型或升級",
    severity: "high",
  },
  {
    signal: "signature",
    label: "XML Sig / PKCS#7 / JWT RS256",
    sunsetDate: "2030-01-01",
    sunsetLabel: "2030-01-01",
    authority: "NSA CNSA 2.0",
    basis: "CNSA 2.0 — 簽章應替換為 ML-DSA-65 或 SLH-DSA-128s",
    severity: "critical",
  },
  {
    signal: "pgp",
    label: "PGP / GPG 批次加密",
    sunsetDate: "2030-01-01",
    sunsetLabel: "2030-01-01",
    authority: "NIST FIPS 203",
    basis: "PGP 底層使用 RSA/ECC，NIST FIPS 203 定案後應遷移至 ML-KEM",
    severity: "high",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcDaysLeft(isoDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((new Date(isoDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function matchSunsets(system: System): AlgoSunset[] {
  const tags = [...system.cmdbTags, ...system.cryptoSignals].join(" ").toLowerCase();
  return SUNSETS.filter((s) => tags.includes(s.signal));
}

function urgencyColor(days: number) {
  if (days <= 365) return "text-rose-700";
  if (days <= 730) return "text-orange-600";
  if (days <= 1460) return "text-amber-600";
  return "text-blue-600";
}

function urgencyBg(days: number) {
  if (days <= 365) return "bg-rose-50 border-rose-200";
  if (days <= 730) return "bg-orange-50 border-orange-200";
  if (days <= 1460) return "bg-amber-50 border-amber-200";
  return "bg-blue-50 border-blue-200";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AlgorithmSunset() {
  const { systems } = useMemo(() => loadDemoData(), []);
  const [sortBy, setSortBy] = useState<"urgency" | "system">("urgency");

  // Build flat rows: system × algo
  const rows = useMemo(() => {
    const result: Array<{
      system: System;
      algo: AlgoSunset;
      daysLeft: number;
    }> = [];
    for (const s of systems) {
      for (const algo of matchSunsets(s)) {
        result.push({ system: s, algo, daysLeft: calcDaysLeft(algo.sunsetDate) });
      }
    }
    if (sortBy === "urgency") result.sort((a, b) => a.daysLeft - b.daysLeft);
    else result.sort((a, b) => a.system.systemName.localeCompare(b.system.systemName));
    return result;
  }, [systems, sortBy]);

  // Summary: systems with at least one vulnerable algo
  const affectedSystems = useMemo(
    () => new Set(rows.map((r) => r.system.systemId)).size,
    [rows]
  );
  const criticalCount = rows.filter((r) => r.daysLeft <= 365 * 2).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Ban className="h-4 w-4" />
          算法退場追蹤
        </div>
        <h2 className="mt-1 text-2xl font-semibold">脆弱算法退場追蹤器</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          追蹤各系統仍在使用的量子脆弱算法，對照官方退場截止日（NSA CNSA 2.0 / IETF / MAS TRM），
          計算距退場剩餘天數，識別需優先處理的高風險系統。
        </p>
        <div className="mt-2 text-xs text-muted-foreground">
          退場基準：NSA CNSA 2.0（2030）/ IETF TLS（2027）/ MAS TRM 2021
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "受影響系統", value: affectedSystems, color: "bg-rose-50 border-rose-200 text-rose-700" },
          { label: "高風險組合（2年內）", value: criticalCount, color: "bg-orange-50 border-orange-200 text-orange-700" },
          { label: "追蹤算法種類", value: SUNSETS.length, color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "總曝險記錄", value: rows.length, color: "bg-slate-50 border-slate-200 text-slate-600" },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border-2 p-4 text-center ${c.color}`}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="mt-0.5 text-xs font-medium">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Algorithm Sunset Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">算法退場日期參照表</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">算法</th>
                <th className="pb-2 pr-4">退場截止</th>
                <th className="pb-2 pr-4">距今天數</th>
                <th className="pb-2 pr-4">主管機關</th>
                <th className="pb-2">嚴重性</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SUNSETS.map((s) => {
                const days = calcDaysLeft(s.sunsetDate);
                return (
                  <tr key={s.signal}>
                    <td className="py-2.5 pr-4 font-medium">{s.label}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{s.sunsetLabel}</td>
                    <td className={`py-2.5 pr-4 font-semibold ${urgencyColor(days)}`}>
                      {days > 0 ? `${days} 天` : `已逾期 ${Math.abs(days)} 天`}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground">{s.authority}</td>
                    <td className="py-2.5">
                      <Badge
                        variant={s.severity === "critical" ? "risk" : s.severity === "high" ? "warning" : "outline"}
                        className="text-xs"
                      >
                        {s.severity === "critical" ? "嚴重" : s.severity === "high" ? "高" : "中"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* System × Algo Exposure Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">系統曝險明細（{rows.length} 筆）</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">排序：</span>
            {(["urgency", "system"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`rounded px-2 py-1 ${sortBy === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {s === "urgency" ? "緊迫度" : "系統名稱"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5">系統</th>
                <th className="px-4 py-2.5">業務單位</th>
                <th className="px-4 py-2.5">脆弱算法</th>
                <th className="px-4 py-2.5">退場截止</th>
                <th className="px-4 py-2.5">距今</th>
                <th className="px-4 py-2.5">風險級別</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, i) => {
                const days = row.daysLeft;
                return (
                  <tr key={`${row.system.systemId}-${row.algo.signal}-${i}`} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{row.system.systemName}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.system.businessUnit}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${urgencyBg(days)} ${urgencyColor(days)}`}>
                        {row.algo.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{row.algo.sunsetLabel}</td>
                    <td className={`px-4 py-2.5 font-semibold ${urgencyColor(days)}`}>
                      {days > 0 ? `${days} 天` : `逾期`}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {days <= 365 * 2
                          ? <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                          : days <= 365 * 4
                          ? <Clock className="h-3.5 w-3.5 text-amber-500" />
                          : <Shield className="h-3.5 w-3.5 text-blue-400" />}
                        <span className={`text-xs ${urgencyColor(days)}`}>
                          {days <= 365 * 2 ? "高風險" : days <= 365 * 4 ? "追蹤中" : "計畫中"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        ⚠️ <strong>免責聲明：</strong>本頁面退場日期以 NSA CNSA 2.0 Advisory（2022-09）與 IETF 草案為基準，
        僅適用美國聯邦機構及關鍵基礎設施的正式要求。台灣金融機構應以金管會最終指引為準，
        2030 年為國際參考目標，非法定強制截止日。所有系統資料均為模擬假資料。
      </div>
    </div>
  );
}
