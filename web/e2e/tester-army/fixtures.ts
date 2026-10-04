import { surfaceOf, test as base } from "@e2e-dev/web";

import { installApiStub } from "../fixtures/api.ts";
import { resetTypedDraft } from "../../src/test/handlers.ts";
import { engine } from "./engine.ts";

export const test = base.extend<{ prepared: boolean }>({
  prepared: async ({ app }, use) => {
    const live = surfaceOf(engine);
    if (live === undefined) throw new Error("TesterArmy has no active browser surface");
    const context = live.context();
    const origin = new URL(app.baseUrl ?? "").origin;
    await context.route("**/*", async (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
    // Create the engine-owned page without booting the app before its fixtures exist.
    await context.route("**/__e2e_bootstrap", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Fixture bootstrap</title>" }));
    await app.open("/__e2e_bootstrap");
    const page = live.page();
    await page.evaluate((key) => window.localStorage.setItem(key, "en"), "collie:locale:v1");
    await installApiStub(page);
    await page.route("**/*", async (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.fallback();
    });
    resetTypedDraft();
    await use(true);
    resetTypedDraft();
  },
});
