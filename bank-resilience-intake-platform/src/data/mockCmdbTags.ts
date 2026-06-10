import { systems } from "@/data/demo-data";

export const mockCmdbTags = systems.map((system) => ({
  systemId: system.systemId,
  systemName: system.systemName,
  cmdbTags: system.cmdbTags,
  cryptoSignals: system.cryptoSignals,
}));
