import { web } from "@e2e-dev/web";

export const engine = web({
  viewport: { width: 390, height: 844 },
  // API fixtures cannot intercept a service worker's fetches.
  headers: { "X-Collie-E2E": "isolated-fixture" },
});
