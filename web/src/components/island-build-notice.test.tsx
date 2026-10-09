import { render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IslandBuildNotice } from "./island-build-notice";

const recommended = { build: 2, tag: "v1.18.101" };
const host = { collieIsland: { openAddress: vi.fn() } };
const url = "https://github.com/GGGODLIN/collie/releases/download/v1.18.101/CollieIsland.ipa";

describe("IslandBuildNotice", () => {
  it("copies the IPA URL without navigating the old shell away from Collie", async () => {
    const user = userEvent.setup();
    const { container } = render(<IslandBuildNotice host={host} recommended={recommended} />);
    expect(within(container).getByText("A newer iPhone app is available")).toBeInTheDocument();
    expect(within(container).getByText(url)).toBeInTheDocument();
    expect(container.querySelector('a[href*="github.com"]')).toBeNull();
    await user.click(within(container).getByRole("button", { name: "Copy" }));
    await expect(navigator.clipboard.readText()).resolves.toBe(url);
  });

  it("remembers the dismissed build across mounts, but shows the next recommendation", async () => {
    const user = userEvent.setup();
    const first = render(<IslandBuildNotice host={host} recommended={recommended} />);
    await user.click(within(first.container).getByRole("button", { name: "Dismiss app update" }));
    await waitFor(() => expect(first.container).toBeEmptyDOMElement());
    first.unmount();
    const next = render(<IslandBuildNotice host={host} recommended={recommended} />);
    expect(next.container).toBeEmptyDOMElement();
    next.rerender(<IslandBuildNotice host={host} recommended={{ build: 3, tag: "v1.18.102" }} />);
    await waitFor(() => expect(within(next.container).getByText("A newer iPhone app is available")).toBeInTheDocument());
  });

  it("keeps the update instructions in Settings after the home notice is dismissed", async () => {
    const user = userEvent.setup();
    const home = render(<IslandBuildNotice host={host} recommended={recommended} />);
    await user.click(within(home.container).getByRole("button", { name: "Dismiss app update" }));
    home.unmount();
    const settings = render(<IslandBuildNotice host={host} recommended={recommended} dismissible={false} />);
    expect(within(settings.container).getByText(url)).toBeInTheDocument();
    expect(within(settings.container).queryByRole("button", { name: "Dismiss app update" })).toBeNull();
  });

  it("stays absent outside the app and with this release's dormant recommendation", () => {
    const { container, rerender } = render(<IslandBuildNotice host={{}} recommended={recommended} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<IslandBuildNotice host={host} />);
    expect(container).toBeEmptyDOMElement();
  });
});
