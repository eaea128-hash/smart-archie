import { build } from "esbuild";
import { access, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const tempDir = path.join(os.tmpdir(), `bank-resilience-quality-${Date.now()}`);
const outfile = path.join(tempDir, "quality-tests.mjs");

await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });

await build({
  entryPoints: [path.join(root, "scripts", "quality-tests.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  logLevel: "silent",
  plugins: [
    {
      name: "local-alias",
      setup(build) {
        build.onResolve({ filter: /^@\// }, async (args) => {
          const requested = path.join(root, "src", args.path.slice(2));
          const candidates = [
            requested,
            `${requested}.ts`,
            `${requested}.tsx`,
            path.join(requested, "index.ts"),
            path.join(requested, "index.tsx"),
          ];
          for (const candidate of candidates) {
            try {
              await access(candidate);
              return { path: candidate };
            } catch {
              // Try the next candidate.
            }
          }
          return { path: requested };
        });
      },
    },
  ],
});

try {
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
