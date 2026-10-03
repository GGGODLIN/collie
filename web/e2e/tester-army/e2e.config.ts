import { resolve } from "node:path";
import type { E2EConfig } from "e2e";

import { engine } from "./engine.ts";

const dist = process.env.COLLIE_E2E_DIST;
if (dist === undefined) throw new Error("COLLIE_E2E_DIST must name the isolated Collie build");
const webRoot = resolve(import.meta.dirname, "../..");

export default {
  targets: [{
    name: "web-phone",
    engine,
    app: {
      url: "http://127.0.0.1:0",
      environment: "test",
      command: {
        executable: process.execPath,
        args: [resolve(webRoot, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", "{port}", "--strictPort", "--outDir", dist],
        cwd: webRoot,
        env: { COLLIE_DEV_TARGET: "http://127.0.0.1:9" },
        log: ".e2e/logs/app.log",
      },
    },
  }],
  tests: ["agent-palette.e2e.ts"],
  workers: 1,
  retries: 0,
  timeout: 30_000,
  assertionTimeout: 5_000,
  cache: "off",
  trace: "on",
  video: "off",
  output: `.e2e/${process.env.COLLIE_E2E_RUN_ID ?? "local"}`,
  reporters: ["list", "junit"],
} satisfies E2EConfig;
