import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test/setup";
import { fixtureTranscript } from "@/test/handlers";
import { useLatestReply } from "./use-latest-reply";

// What the pane view needs from the journal, and what it must not carry across pane switches.

/** Count history requests, keeping the default handler's response. */
function countHistory() {
  let hits = 0;
  server.use(
    http.get(/\/api\/pane\/[^/]+\/history/, () => {
      hits += 1;
      return HttpResponse.json({
        paneId: "w1:p1",
        available: true,
        entries: fixtureTranscript,
        hasMore: false,
        total: fixtureTranscript.length,
        fileTruncated: false,
      });
    }),
  );
  return { hits: () => hits };
}

describe("useLatestReply", () => {
  it("reads the newest spoken turn as soon as the pane opens, with the prompt it answered", async () => {
    const { result } = renderHook(() =>
      useLatestReply({ paneId: "w1:p1", enabled: true, mirrorText: "some output" }),
    );
    await waitFor(() => expect(result.current?.reply.uuid).toBe("t2"));
    // The fixture's turns are "what changed today?" then its answer — the pair is the whole point.
    expect(result.current?.prompt?.uuid).toBe("t1");
  });

  it("fetches nothing while the feature is off", async () => {
    const counter = countHistory();
    const { result } = renderHook(() =>
      useLatestReply({ paneId: "w1:p1", enabled: false, mirrorText: "some output" }),
    );
    await waitFor(() => expect(result.current).toBeNull());
    expect(counter.hits()).toBe(0);
  });

  it("does not carry an exchange across a pane switch", async () => {
    const { result, rerender } = renderHook(
      ({ paneId }) => useLatestReply({ paneId, enabled: true, mirrorText: "some output" }),
      { initialProps: { paneId: "w1:p1" } },
    );
    await waitFor(() => expect(result.current?.reply.uuid).toBe("t2"));

    server.use(
      http.get(/\/api\/pane\/[^/]+\/history/, () =>
        HttpResponse.json({ paneId: "w1:p2", available: false, reason: "no-log" }),
      ),
    );
    rerender({ paneId: "w1:p2" });
    expect(result.current).toBeNull();
    // …and an unavailable journal leaves it null rather than restoring the previous pane's turn.
    await waitFor(() => expect(result.current).toBeNull());
  });

  it("holds null when the pane's journal has nothing spoken in it", async () => {
    server.use(
      http.get(/\/api\/pane\/[^/]+\/history/, () =>
        HttpResponse.json({
          paneId: "w1:p1",
          available: true,
          entries: [fixtureTranscript[0]],
          hasMore: false,
          total: 1,
          fileTruncated: false,
        }),
      ),
    );
    const { result } = renderHook(() =>
      useLatestReply({ paneId: "w1:p1", enabled: true, mirrorText: "some output" }),
    );
    await waitFor(() => expect(result.current).toBeNull());
  });

  // The mirror is empty on a pane that has never been read (a degraded/offline open). There is
  // nothing to compare a reply against yet, so there is no reason to pay for one.
  it("fetches nothing while the mirror is empty", async () => {
    const counter = countHistory();
    renderHook(() => useLatestReply({ paneId: "w1:p1", enabled: true, mirrorText: "" }));
    await waitFor(() => expect(counter.hits()).toBe(0));
  });

});
