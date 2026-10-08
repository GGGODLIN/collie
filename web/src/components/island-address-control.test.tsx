import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IslandAddressControl } from "./island-address-control";

describe("IslandAddressControl", () => {
  it("renders nothing outside Collie Island", () => {
    const { container } = render(<IslandAddressControl host={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing in an ordinary browser window", () => {
    const { container } = render(<IslandAddressControl />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asks the app to open its own address screen", async () => {
    const openAddress = vi.fn();
    render(<IslandAddressControl host={{ collieIsland: { openAddress } }} />);
    expect(screen.getByText("Gaddi address")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(openAddress).toHaveBeenCalledTimes(1);
  });
});
