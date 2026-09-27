import { render, within } from "@testing-library/react";

import { PaneDescription } from "./pane-description";
import { en } from "@/lib/i18n/messages/en";

// The pane screen's goal / now / next. Only the fields the bridge sent are drawn, the labels come
// from the dictionary, and the values are rendered verbatim.

describe("PaneDescription", () => {
  it("renders each field the bridge sent, under its translated label", () => {
    const { container } = render(
      <PaneDescription
        description={{ goal: "讀取 hello.txt", now: "已讀取檔案", next: "等待你的下一個指令", source: "recap", at: 1 }}
      />,
    );
    const list = container.querySelector("dl")!;
    expect(list).toHaveTextContent(en["pane.description.goal"]);
    expect(list).toHaveTextContent("讀取 hello.txt");
    expect(list).toHaveTextContent(en["pane.description.now"]);
    expect(list).toHaveTextContent(en["pane.description.next"]);
    expect(within(container).getByText("等待你的下一個指令")).toHaveClass("truncate");
  });

  it("draws only `now` for a prompt fallback", () => {
    const { container } = render(<PaneDescription description={{ now: "你：修 build", source: "prompt", at: 1 }} />);
    expect(container).toHaveTextContent("你：修 build");
    expect(container).not.toHaveTextContent(en["pane.description.goal"]);
    expect(container).not.toHaveTextContent(en["pane.description.next"]);
  });

  it("renders nothing without a description", () => {
    const { container } = render(<PaneDescription description={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
