export interface EvidenceSnapshotMeta {
  evidencePackId: string;
  snapshotAt: string;
  dataVersion: string;
  ruleEngineVersion: string;
  ruleEngineUpdated: string;
  integrityDigest: string;
}

export function buildEvidenceSnapshotMeta(input: {
  systemId: string;
  snapshotAt: string;
  dataVersion: string;
  ruleEngineVersion: string;
  ruleEngineUpdated: string;
  payload: unknown;
}): EvidenceSnapshotMeta {
  const digest = createStableDigest({
    systemId: input.systemId,
    snapshotAt: input.snapshotAt,
    dataVersion: input.dataVersion,
    ruleEngineVersion: input.ruleEngineVersion,
    payload: input.payload,
  });

  return {
    evidencePackId: `EP-${input.systemId}-${input.snapshotAt.slice(0, 10).replace(/-/g, "")}`,
    snapshotAt: input.snapshotAt,
    dataVersion: input.dataVersion,
    ruleEngineVersion: input.ruleEngineVersion,
    ruleEngineUpdated: input.ruleEngineUpdated,
    integrityDigest: digest,
  };
}

export function createStableDigest(value: unknown): string {
  const text = stableStringify(value);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return `DEMO-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
