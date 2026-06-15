import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDemoData } from "@/lib/storage";
import { explainRiskForSystem } from "@/lib/risk-rules";
import type { System, Vendor } from "@/data/demo-data";

const ROADMAP_VERSION = "1.1.0";
const ROADMAP_UPDATED = "2026-06";

// ─── Algorithm Replacement Map ───────────────────────────────────────────────

interface AlgoReplacement {
  signal: string;
  current: string;
  replacement: string;
  fips: string;
  mode: string;
  role: string;
  note?: string;
}

const ALGO_MAP: AlgoReplacement[] = [
  {
    signal: "rsa",
    current: "RSA-2048 / RSA-4096",
    replacement: "ML-KEM-768（金鑰封裝）/ ML-DSA-65（簽章）",
    fips: "FIPS 203 + FIPS 204",
    mode: "Hybrid: RSA + ML-KEM 並行",
    role: "架構",
  },
  {
    signal: "ecc",
    current: "ECC / ECDSA / ECDH",
    replacement: "ML-KEM-768（KEM）/ ML-DSA-65（簽章）",
    fips: "FIPS 203 + FIPS 204",
    mode: "Hybrid: ECDH + ML-KEM 並行",
    role: "架構",
  },
  {
    signal: "tls",
    current: "TLS 1.1 / TLS 1.2",
    replacement: "TLS 1.3 + hybrid PQC cipher suite",
    fips: "IETF draft-ietf-tls-hybrid-design",
    mode: "Hybrid mode 過渡期",
    role: "資安",
    note: "禁用 TLS 1.0 / 1.1；TLS 1.2 允許過渡期保留至 2026 Q4",
  },
  {
    signal: "certificate",
    current: "X.509 RSA/ECDSA 憑證",
    replacement: "Hybrid 憑證（傳統 + ML-DSA）",
    fips: "FIPS 204",
    mode: "發行新憑證同時保留舊憑證",
    role: "資安",
  },
  {
    signal: "hsm",
    current: "HSM（現有韌體）",
    replacement: "HSM 韌體升級或換型支援 ML-KEM / ML-DSA",
    fips: "FIPS 203 + FIPS 204",
    mode: "確認廠商支援路徑後更新",
    role: "架構",
  },
  {
    signal: "signature",
    current: "XML Signature / PKCS#7 / JWT RS256",
    replacement: "ML-DSA-65 或 SLH-DSA-128s（無狀態）",
    fips: "FIPS 204 / FIPS 205",
    mode: "依應用場景選擇：高速用 ML-DSA，長效保存用 SLH-DSA",
    role: "架構",
  },
  {
    signal: "pgp",
    current: "PGP / GPG（批次檔加密）",
    replacement: "ML-KEM + symmetric AES-256-GCM",
    fips: "FIPS 203",
    mode: "Hybrid: PGP + ML-KEM 並行測試",
    role: "系統Owner",
  },
  {
    signal: "unknown",
    current: "未知加密模組",
    replacement: "需先完成 CBOM 盤點再決定",
    fips: "待定（依 CBOM 結果）",
    mode: "Phase 1 完成前暫緩替換",
    role: "系統Owner",
    note: "未知模組是最高阻礙，必須在 Phase 1 解決",
  },
];

function matchAlgos(system: System): AlgoReplacement[] {
  const tags = [...system.cmdbTags, ...system.cryptoSignals].join(" ").toLowerCase();
  return ALGO_MAP.filter((a) => tags.includes(a.signal));
}

// ─── Phase Timeline ───────────────────────────────────────────────────────────

type Wave = "Wave 1" | "Wave 2" | "Wave 3" | "觀察";

function getWave(system: System, vendor: Vendor | null): Wave {
  const exp = explainRiskForSystem(system, vendor);
  const isHndl = system.dataRetentionYears >= 10 || system.hndlRiskScore >= 80;
  const urgency = Math.min(100, Math.round(exp.score * 0.5 + (isHndl ? 20 : 0)));
  const tags = [...system.cmdbTags, ...system.cryptoSignals].join(" ").toLowerCase();
  let feasibility = 50;
  if (vendor?.pqcRoadmapStatus === "已提供") feasibility += 15;
  else if (vendor?.pqcRoadmapStatus === "未提供") feasibility -= 10;
  if (vendor?.cryptoAgilityStatus === "不支援") feasibility -= 15;
  if (tags.includes("unknown crypto")) feasibility -= 15;
  const highU = urgency >= 60;
  const highF = feasibility >= 55;
  if (highU && highF) return "Wave 1";
  if (highU && !highF) return "Wave 2";
  if (!highU && highF) return "Wave 3";
  return "觀察";
}

interface PhaseTimeline { phase: string; label: string; quarter: string; }

function buildTimeline(wave: Wave): PhaseTimeline[] {
  const offset = wave === "Wave 1" ? 0 : wave === "Wave 2" ? 1 : wave === "Wave 3" ? 2 : 3;
  const quarters = [
    "2026 Q3", "2026 Q4", "2027 Q1", "2027 Q2", "2027 Q3", "2027 Q4",
    "2028 Q1", "2028 Q2",
  ];
  return [
    { phase: "1", label: "盤點確認（CBOM）",       quarter: quarters[0 + offset] ?? "待定" },
    { phase: "2", label: "試點替換（Hybrid Mode）", quarter: quarters[1 + offset] ?? "待定" },
    { phase: "3", label: "全面遷移（PQC Only）",    quarter: quarters[2 + offset] ?? "待定" },
    { phase: "4", label: "舊算法退場",             quarter: quarters[3 + offset] ?? "2027+" },
    { phase: "5", label: "持續敏捷維護",           quarter: quarters[4 + offset] ?? "2028+" },
  ];
}

// ─── Phase Detail ─────────────────────────────────────────────────────────────

interface PhaseDetail {
  phase: string;
  label: string;
  icon: typeof Search;
  color: string;
  bg: string;
  border: string;
  tasks: string[];
  prereqs: string[];
  done: string;
  role: string[];
}

function buildPhaseDetails(system: System, vendor: Vendor | null, algos: AlgoReplacement[]): PhaseDetail[] {
  const hasUnknown = algos.some((a) => a.signal === "unknown");
  const vendorBlocked = vendor?.pqcRoadmapStatus === "未提供";

  return [
    {
      phase: "1",
      label: "盤點確認（CBOM）",
      icon: Search,
      color: "text-blue-700 dark:text-blue-300",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      border: "border-blue-200 dark:border-blue-800",
      tasks: [
        "完成加密資產清冊（CBOM）：列出所有使用算法與憑證",
        "確認每個 crypto signal 的責任歸屬與現行算法版本",
        hasUnknown ? "【優先】解決未知加密模組來源與責任歸屬" : "確認所有算法版本符合 TLS 1.2+ 最低標準",
        vendorBlocked ? `【供應商】要求 ${vendor?.vendorName ?? "供應商"} 提交 PQC 遷移計畫` : "收集供應商 PQC 路線圖與支援算法清單",
        "對照 NIST FIPS 203/204/205 確認替換目標算法",
      ],
      prereqs: ["取得 CMDB 最新版本", "資安與架構團隊確認 CBOM 範圍"],
      done: "CBOM 清冊完成，每個算法有明確替換目標與負責人",
      role: ["資安", "架構", "系統Owner"],
    },
    {
      phase: "2",
      label: "試點替換（Hybrid Mode）",
      icon: FlaskConical,
      color: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-800",
      tasks: [
        "部署 Hybrid Mode：傳統算法 + PQC 算法並行運作",
        "TLS 憑證：換發 Hybrid 憑證（RSA/ECC + ML-DSA）",
        "API / mTLS：測試 hybrid cipher suite 相容性",
        "HSM 韌體確認：向廠商索取 ML-KEM 支援路徑",
        "效能基準測試：PQC 算法 vs 傳統算法延遲比較",
        "Rollback 計畫：確認任何問題可快速切回傳統模式",
      ],
      prereqs: ["Phase 1 CBOM 完成", "供應商 PQC 計畫已取得", "測試環境備妥"],
      done: "Hybrid mode 在測試環境穩定運作超過 4 週，無相容性問題",
      role: ["架構", "資安", "採購"],
    },
    {
      phase: "3",
      label: "全面遷移（PQC Only）",
      icon: Shield,
      color: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-200 dark:border-emerald-800",
      tasks: [
        "停用傳統算法（RSA/ECC/TLS 1.2 依計畫退場）",
        "全面切換 ML-KEM / ML-DSA / SLH-DSA",
        "更新所有憑證至純 PQC 或下一代 Hybrid",
        "完成 FSC / 金管會要求的遷移驗證文件",
        "更新 CBOM 至最終狀態並存入 GRC 系統",
        "安排外部稽核或內部紅隊驗證",
      ],
      prereqs: ["Phase 2 試點完成且穩定", "監理機關確認時程", "合約已包含加密升級條款"],
      done: "系統完全運行於 NIST PQC 標準算法，無傳統量子脆弱算法殘留",
      role: ["架構", "資安", "業務", "採購"],
    },
    {
      phase: "4",
      label: "舊算法退場（Algorithm Sunset）",
      icon: Ban,
      color: "text-purple-700 dark:text-purple-300",
      bg: "bg-purple-50 dark:bg-purple-950/30",
      border: "border-purple-200 dark:border-purple-800",
      tasks: [
        "正式停用 RSA-2048 / RSA-4096：所有金鑰與憑證完成替換",
        "停用 ECC / ECDSA / ECDH：ML-KEM / ML-DSA 全面接管",
        "停用 TLS 1.2：強制使用 TLS 1.3 + PQC cipher suite",
        "更新採購合約：禁止新採購系統使用傳統算法",
        "廢止所有傳統算法憑證（包含中介憑證 CA）",
        "向金管會 / 監理機關提交算法退場完成證明",
        "NSA CNSA 2.0 對照確認：確認 2030 deadline 達標進度",
      ],
      prereqs: ["Phase 3 遷移完成且驗證通過", "所有供應商確認停止提供傳統算法支援", "監理機關退場確認通知"],
      done: "RSA / ECC / TLS 1.2 完全退場，系統稽核無傳統算法殘留，達 CNSA 2.0 中期要求",
      role: ["資安", "架構", "採購", "法遵"],
    },
    {
      phase: "5",
      label: "持續敏捷維護（Crypto-Agility Operations）",
      icon: RotateCcw,
      color: "text-slate-700 dark:text-slate-300",
      bg: "bg-slate-50 dark:bg-slate-950/30",
      border: "border-slate-200 dark:border-slate-700",
      tasks: [
        "建立 CBOM 自動化更新機制（每季或系統變更時觸發）",
        "追蹤 NIST / ISO / ETSI 後續算法標準更新（如 FIPS 206+）",
        "定期進行加密敏捷性演練：模擬緊急算法替換流程",
        "供應商年度 PQC 合規審查：確認持續支援最新 FIPS 版本",
        "維護「算法壽命追蹤清冊」：預判下一輪潛在脆弱算法",
        "2030 後目標：任何算法替換可在 90 天內完成（加密敏捷成熟度）",
      ],
      prereqs: ["Phase 4 完成", "CBOM 工具整合至 CI/CD 或 GRC 系統", "資安團隊具備 PQC 持續監控能力"],
      done: "機構具備加密敏捷成熟度：新算法標準發布後可在 90 天內完成評估與計畫，180 天內完成試點",
      role: ["資安", "架構", "採購"],
    },
  ];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CryptoAgilityRoadmap() {
  const { systems, vendors } = useMemo(() => loadDemoData(), []);
  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.vendorId, v])), [vendors]);
  const [selectedId, setSelectedId] = useState(systems[0]?.systemId ?? "");

  const system = systems.find((s) => s.systemId === selectedId) ?? systems[0];
  const vendor = system.vendorId ? (vendorMap.get(system.vendorId) ?? null) : null;
  const algos = useMemo(() => matchAlgos(system), [system]);
  const wave = useMemo(() => getWave(system, vendor), [system, vendor]);
  const timeline = useMemo(() => buildTimeline(wave), [wave]);
  const phases = useMemo(() => buildPhaseDetails(system, vendor, algos), [system, vendor, algos]);
  const hasUnknown = algos.some((a) => a.signal === "unknown");

  const waveColor = wave === "Wave 1" ? "text-rose-700" : wave === "Wave 2" ? "text-amber-700" : "text-blue-700";
  const waveBg = wave === "Wave 1" ? "bg-rose-50 border-rose-200" : wave === "Wave 2" ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
          Crypto-Agility 路線圖
        </div>
        <h2 className="mt-1 text-2xl font-semibold">加密敏捷性遷移路線圖</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          依據系統現有加密訊號，自動對應 NIST PQC 標準替換目標，產出三階段遷移計畫。
          所有演算法建議均對應已定案的 FIPS 標準（2024）。
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-mono">Roadmap v{ROADMAP_VERSION}</Badge>
          <span>最後更新：{ROADMAP_UPDATED}</span>
          <span>·</span>
          <span>對應 NIST FIPS 203 / 204 / 205（2024 定案）</span>
        </div>
      </div>

      {/* System Selector */}
      <Card>
        <CardContent className="pt-5">
          <label className="mb-2 block text-sm font-medium">選擇系統</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {systems.map((s) => (
              <option key={s.systemId} value={s.systemId}>
                {s.systemName} / {s.businessUnit}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={wave === "Wave 1" ? "risk" : wave === "Wave 2" ? "warning" : "outline"}>{wave}</Badge>
            <span className="text-xs text-muted-foreground">遷移優先度</span>
            <span className="mx-1 text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              加密訊號：{system.cryptoSignals.length > 0 ? system.cryptoSignals.join("、") : "無"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* POC Notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        ⚠️ <strong>時程說明：</strong>金管會 PQC 指引建議 2025 年完成加密資產盤點。本路線圖為 POC 展示，Phase 1 設為 2026 Q3 起；實際執行應依機構現況調整，盤點工作建議立即啟動。
      </div>

      {/* Timeline Bar */}
      <div className={`rounded-xl border-2 p-5 ${waveBg}`}>
        <div className={`mb-4 text-sm font-semibold ${waveColor}`}>遷移時程概覽（{wave}）</div>
        <div className="flex items-center gap-0">
          {timeline.map((t, i) => (
            <div key={t.phase} className="flex flex-1 items-center">
              <div className="flex flex-col items-center text-center">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${waveColor} border-2 ${waveBg}`}>
                  {t.phase}
                </div>
                <div className={`mt-1.5 text-xs font-medium ${waveColor}`}>{t.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t.quarter}</div>
              </div>
              {i < timeline.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 ${waveColor} opacity-30`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Algorithm Replacement Table */}
      {algos.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">演算法替換對照表</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {hasUnknown && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>偵測到<strong>未知加密模組</strong>，Phase 1 必須優先解決。未知模組無法直接替換，需先完成 CBOM 盤點確認責任歸屬。</span>
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">現有算法</th>
                  <th className="pb-2 pr-4">替換目標</th>
                  <th className="pb-2 pr-4">FIPS 依據</th>
                  <th className="pb-2 pr-4">過渡模式</th>
                  <th className="pb-2">負責角色</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {algos.map((algo) => (
                  <tr key={algo.signal} className={algo.signal === "unknown" ? "bg-rose-50/50" : ""}>
                    <td className="py-3 pr-4 font-medium">{algo.current}</td>
                    <td className="py-3 pr-4 text-emerald-700 dark:text-emerald-400">{algo.replacement}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className="font-mono text-xs">{algo.fips}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {algo.mode}
                      {algo.note && <div className="mt-0.5 text-amber-600">※ {algo.note}</div>}
                    </td>
                    <td className="py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{algo.role}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            此系統未偵測到已知加密訊號，建議先完成 CMDB 標記後重新盤點。
          </CardContent>
        </Card>
      )}

      {/* Phase Details */}
      <div className="space-y-4">
        <h3 className="font-semibold">五階段詳細計畫（2026–2030）</h3>
        {phases.map((phase) => {
          const Icon = phase.icon;
          return (
            <div key={phase.phase} className={`rounded-xl border-2 p-5 ${phase.bg} ${phase.border}`}>
              <div className={`mb-4 flex items-center gap-2 font-semibold ${phase.color}`}>
                <Icon className="h-4 w-4" />
                Phase {phase.phase}：{phase.label}
                <div className="ml-auto flex gap-1">
                  {phase.role.map((r) => (
                    <span key={r} className="rounded-full bg-white/70 px-2 py-0.5 text-xs dark:bg-black/20">{r}</span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className={`mb-1.5 text-xs font-semibold ${phase.color}`}>執行任務</div>
                  <ul className="space-y-1.5">
                    {phase.tasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${phase.color}`} />
                        <span className={task.startsWith("【") ? "font-medium" : ""}>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className={`mb-1.5 text-xs font-semibold ${phase.color}`}>前置條件</div>
                    <ul className="space-y-1">
                      {phase.prereqs.map((p, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`rounded-lg border p-3 ${phase.bg}`}>
                    <div className={`mb-1 text-xs font-semibold ${phase.color}`}>完成標準</div>
                    <p className="flex items-start gap-1.5 text-xs">
                      <CheckCircle2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${phase.color}`} />
                      {phase.done}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
