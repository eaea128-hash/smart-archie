import { useMemo, useState } from "react";
import { Download, FileJson, Info, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDemoData } from "@/lib/storage";
import type { System, Vendor } from "@/data/demo-data";

// ─── CycloneDX 1.6 Types (simplified) ────────────────────────────────────────

interface CdxComponent {
  type: "cryptographic-asset";
  "bom-ref": string;
  name: string;
  version?: string;
  cryptoProperties: {
    assetType: "algorithm" | "certificate" | "protocol" | "related-crypto-material";
    algorithmProperties?: {
      primitive: string;
      parameterSetIdentifier?: string;
      executionEnvironment?: string;
    };
    protocolProperties?: {
      type: string;
      version?: string;
    };
    oid?: string;
  };
  description?: string;
  tags?: string[];
}

interface CdxBom {
  bomFormat: "CycloneDX";
  specVersion: "1.6";
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: Array<{ vendor: string; name: string; version: string }>;
    component: { type: "application"; name: string; version: string };
  };
  components: CdxComponent[];
}

// ─── Signal → CycloneDX mapping ───────────────────────────────────────────────

function signalToComponents(signal: string, systemId: string): CdxComponent[] {
  const ref = (tag: string) => `${systemId}-${tag}`;
  const s = signal.toLowerCase();
  // Use includes to handle compound signals like "RSA-2048 certificate", "HSM signing"
  if (s.includes("rsa") && !s.includes("certificate")) {
    return [{
      type: "cryptographic-asset",
      "bom-ref": ref("rsa"),
      name: "RSA",
      version: signal.match(/\d{4}/)?.[0] ?? "2048",
      cryptoProperties: {
        assetType: "algorithm",
        algorithmProperties: { primitive: "pke", parameterSetIdentifier: signal.match(/\d{4}/)?.[0] ?? "2048" },
      },
      description: "RSA 公鑰加密算法（量子脆弱）",
      tags: ["quantum-vulnerable", "pqc-migration-required"],
    }];
  }
  if (s.includes("certificate") || s.includes("x.509")) {
    return [{
      type: "cryptographic-asset",
      "bom-ref": ref("cert"),
      name: "X.509 Certificate",
      cryptoProperties: {
        assetType: "certificate",
        algorithmProperties: { primitive: "pke" },
        oid: "1.2.840.113549.1.1.11",
      },
      description: "RSA/ECDSA X.509 數位憑證（需換發 Hybrid 憑證）",
      tags: ["quantum-vulnerable"],
    }];
  }
  if (s.includes("hsm")) {
    return [{
      type: "cryptographic-asset",
      "bom-ref": ref("hsm"),
      name: "HSM",
      cryptoProperties: {
        assetType: "related-crypto-material",
        algorithmProperties: { primitive: "other", executionEnvironment: "hardware" },
      },
      description: "硬體安全模組（需確認韌體 PQC 支援路徑）",
      tags: ["hardware-dependency", "vendor-action-required"],
    }];
  }
  if (s.includes("tls")) {
    const ver = signal.match(/[\d.]+/)?.[0] ?? "1.2";
    return [{
      type: "cryptographic-asset",
      "bom-ref": ref(`tls${ver.replace(".", "")}`),
      name: "TLS",
      version: ver,
      cryptoProperties: { assetType: "protocol", protocolProperties: { type: "tls", version: ver } },
      description: `TLS ${ver} 傳輸層加密協定（需升級至 TLS 1.3 + hybrid PQC）`,
      tags: ["quantum-vulnerable", "upgrade-required"],
    }];
  }
  if (s.includes("ecc") || s.includes("ecdsa") || s.includes("ecdh")) {
    return [{
      type: "cryptographic-asset",
      "bom-ref": ref("ecc"),
      name: "ECDSA",
      cryptoProperties: { assetType: "algorithm", algorithmProperties: { primitive: "signature", parameterSetIdentifier: "P-256" } },
      description: "橢圓曲線數位簽章算法（量子脆弱）",
      tags: ["quantum-vulnerable", "pqc-migration-required"],
    }];
  }
  if (s.includes("signature") || s.includes("xml sig") || s.includes("pkcs") || s.includes("jwt")) {
    return [{
      type: "cryptographic-asset",
      "bom-ref": ref("xmlsig"),
      name: "XML Signature",
      cryptoProperties: { assetType: "algorithm", algorithmProperties: { primitive: "signature" }, oid: "1.2.840.10040.4.3" },
      description: "XML 數位簽章（建議替換為 ML-DSA-65）",
      tags: ["quantum-vulnerable", "pqc-migration-required"],
    }];
  }
  if (s.includes("pgp") || s.includes("gpg")) {
    return [{
      type: "cryptographic-asset",
      "bom-ref": ref("pgp"),
      name: "PGP",
      cryptoProperties: { assetType: "algorithm", algorithmProperties: { primitive: "pke" } },
      description: "PGP 批次加密（底層使用 RSA/ECC，需遷移至 ML-KEM）",
      tags: ["quantum-vulnerable"],
    }];
  }
  // Fallback: unknown signal
  return [{
    type: "cryptographic-asset",
    "bom-ref": ref(`unknown-${signal.replace(/\s+/g, "-")}`),
    name: `Unknown: ${signal}`,
    cryptoProperties: {
      assetType: "algorithm",
      algorithmProperties: { primitive: "other" },
    },
    description: "未知加密模組，需完成 CBOM 盤點確認",
    tags: ["unknown", "cbom-investigation-required"],
  }];
}

function buildCbom(system: System, vendor: Vendor | null): CdxBom {
  const signals = [...system.cryptoSignals, ...system.cmdbTags.filter(t =>
    ["rsa", "ecc", "tls", "certificate", "hsm", "signature", "pgp"].some(k => t.toLowerCase().includes(k))
  )];
  const uniqueSignals = [...new Set(signals)];
  const allComponents = uniqueSignals.flatMap(s => signalToComponents(s, system.systemId));
  // Deduplicate by bom-ref
  const seen = new Set<string>();
  const components = allComponents.filter(c => {
    if (seen.has(c["bom-ref"])) return false;
    seen.add(c["bom-ref"]);
    return true;
  });

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${system.systemId.toLowerCase()}-cbom-poc`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{ vendor: "CloudFrame", name: "PQC Governance Platform", version: "1.0.0-poc" }],
      component: {
        type: "application",
        name: system.systemName,
        version: "POC",
      },
    },
    components,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CbomExport() {
  const { systems, vendors } = useMemo(() => loadDemoData(), []);
  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.vendorId, v])), [vendors]);
  const [selectedId, setSelectedId] = useState(systems[0]?.systemId ?? "");

  const system = useMemo(() => systems.find(s => s.systemId === selectedId) ?? systems[0], [systems, selectedId]);
  const vendor = system.vendorId ? (vendorMap.get(system.vendorId) ?? null) : null;
  const cbom = useMemo(() => buildCbom(system, vendor), [system, vendor]);
  const json = useMemo(() => JSON.stringify(cbom, null, 2), [cbom]);

  function handleDownload() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cbom-${system.systemId}-cyclonedx-1.6.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          CBOM 匯出
        </div>
        <h2 className="mt-1 text-2xl font-semibold">CBOM 匯出（CycloneDX 1.6）</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          依據系統加密訊號產生符合 CycloneDX 1.6 規範的加密資產清冊（CBOM），
          可直接提交稽核單位或匯入 GRC 系統。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-mono">CycloneDX 1.6</Badge>
          <span>格式：JSON</span>
          <span>·</span>
          <span>schema: cyclonedx.org/schema/bom-1.6.schema.json</span>
        </div>
      </div>

      {/* POC Warning */}
      <div className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-sm">
          <strong>POC 聲明：</strong>此 CBOM 由系統盤點欄位自動產生，為示範用途。
          正式 CBOM 應透過原始碼掃描（SAST）、SCA、CMDB 匯出等工具產生，並由資安團隊審核後提交。
          本輸出不具法律效力。
        </div>
      </div>

      {/* System Selector */}
      <Card>
        <CardContent className="pt-5">
          <label className="mb-2 block text-sm font-medium">選擇系統</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            {systems.map(s => (
              <option key={s.systemId} value={s.systemId}>
                {s.systemName} / {s.businessUnit}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">加密訊號：</span>
            {system.cryptoSignals.length > 0
              ? system.cryptoSignals.map(sig => (
                  <Badge key={sig} variant="outline" className="text-xs">{sig}</Badge>
                ))
              : <span className="text-xs text-muted-foreground">無偵測訊號</span>
            }
          </div>
        </CardContent>
      </Card>

      {/* CBOM Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Components", value: cbom.components.length, color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "量子脆弱", value: cbom.components.filter(c => c.tags?.includes("quantum-vulnerable")).length, color: "bg-rose-50 border-rose-200 text-rose-700" },
          { label: "待確認", value: cbom.components.filter(c => c.tags?.includes("cbom-investigation-required")).length, color: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "供應商行動", value: cbom.components.filter(c => c.tags?.includes("vendor-action-required")).length, color: "bg-purple-50 border-purple-200 text-purple-700" },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border-2 p-4 text-center ${c.color}`}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="mt-0.5 text-xs font-medium">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Components Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">加密資產清冊（{cbom.components.length} 項）</CardTitle>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="h-3.5 w-3.5" />
              下載 CycloneDX JSON
            </button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4">bom-ref</th>
                <th className="pb-2 pr-4">名稱</th>
                <th className="pb-2 pr-4">類型</th>
                <th className="pb-2 pr-4">說明</th>
                <th className="pb-2">標籤</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cbom.components.map(c => (
                <tr key={c["bom-ref"]} className={c.tags?.includes("quantum-vulnerable") ? "bg-rose-50/40" : ""}>
                  <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{c["bom-ref"]}</td>
                  <td className="py-2.5 pr-4 font-medium">{c.name}{c.version ? ` ${c.version}` : ""}</td>
                  <td className="py-2.5 pr-4">
                    <Badge variant="outline" className="text-xs">{c.cryptoProperties.assetType}</Badge>
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{c.description}</td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {c.tags?.map(t => (
                        <span key={t} className={`rounded px-1.5 py-0.5 text-xs ${t === "quantum-vulnerable" ? "bg-rose-100 text-rose-700" : "bg-muted text-muted-foreground"}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* JSON Preview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">CycloneDX JSON 預覽</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
            {json}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
