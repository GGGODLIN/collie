import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setStatus } from "@/lib/status";

import { CopyableBlock } from "./copyable-block";

vi.mock("@/lib/status", () => ({ setStatus: vi.fn() }));

const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});

afterEach(() => {
  if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});

describe("CopyableBlock", () => {
  it("copies the caller's literal rather than the rendered child", async () => {
    const original = "  line one\n\tline two\n\n";
    const { container } = render(<CopyableBlock text={original}><pre>short preview</pre></CopyableBlock>);
    fireEvent.click(within(container).getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(original);
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("Copied to clipboard", "success"));
    expect(container.querySelector("pre")?.textContent).toBe("short preview");
  });

  it("waits for the clipboard instead of announcing a pending write as success", async () => {
    let accept: () => void = () => {};
    writeText.mockImplementation(() => new Promise<void>((resolve) => { accept = resolve; }));
    const { container } = render(<CopyableBlock text="raw"><p>rendered</p></CopyableBlock>);
    const button = within(container).getByRole("button", { name: "Copy" });
    fireEvent.click(button);
    expect(setStatus).not.toHaveBeenCalled();
    accept();
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("Copied to clipboard", "success"));
    expect(button.textContent).toBe("Copy");
    expect(button.className).toContain("h-11");
  });

  it("announces a rejected write as failure and never as success", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { container } = render(<CopyableBlock text="raw"><p>rendered</p></CopyableBlock>);
    fireEvent.click(within(container).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith("Couldn't copy to clipboard", "error"));
    expect(setStatus).toHaveBeenCalledTimes(1);
    expect(within(container).getByText("rendered")).toBeInTheDocument();
  });

  it("hides only the action when the clipboard API is absent", () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const { container } = render(<CopyableBlock text="raw"><pre>rendered</pre></CopyableBlock>);
    expect(within(container).queryByRole("button")).toBeNull();
    expect(container.querySelector("pre")?.textContent).toBe("rendered");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("lets a caller name the action without changing its copied text", async () => {
    const { container } = render(<CopyableBlock text="ls -la" label="Copy command"><code>ls</code></CopyableBlock>);
    fireEvent.click(within(container).getByRole("button", { name: "Copy command" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("ls -la"));
  });
});
