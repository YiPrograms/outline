// @vitest-environment jsdom
import "../../../__mocks__/window";
import { EditorView } from "prosemirror-view";
import { vi } from "vitest";
import { codeBlock, createEditorState, doc } from "@shared/test/editor";
import { CodeHighlighting } from "./CodeHighlightingPlugin";

const views: EditorView[] = [];

function createView(text: string, language = "none", lineNumbers = true) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const view = new EditorView(element, {
    state: createEditorState(doc(codeBlock(text, language)), [
      CodeHighlighting({ name: "code_block", lineNumbers }),
    ]),
  });
  views.push(view);
  return view;
}

afterEach(() => {
  for (const view of views.splice(0)) {
    const parent = view.dom.parentElement;
    view.destroy();
    parent?.remove();
  }
});

describe("code highlighting beside line numbers", () => {
  it("wraps unhighlighted text when line numbers are enabled", () => {
    const view = createView("s");
    expect(
      view.dom.querySelector("code > span:not(.code-block-line-number)")
        ?.textContent
    ).toBe("s");
  });

  it("keeps text wrapped when it gains and loses a syntax token", async () => {
    const view = createView("s", "bash");
    view.dispatch(view.state.tr.insertText("u", 2));
    await vi.waitFor(() => {
      expect(view.dom.querySelector(".token.function")?.textContent).toBe("su");
    });

    view.dispatch(view.state.tr.delete(2, 3));
    expect(view.dom.querySelector(".token.function")).toBeNull();
    expect(
      view.dom.querySelector("code > span:not(.code-block-line-number)")
        ?.textContent
    ).toBe("s");
  });

  it("keeps the wrapper while a large block defers highlighting", async () => {
    const tail = "x".repeat(11000);
    const view = createView(`su\n${tail}`, "bash");
    await vi.waitFor(() => {
      expect(view.dom.querySelector(".token.function")?.textContent).toBe("su");
    });

    view.dispatch(view.state.tr.delete(2, 3));
    expect(view.dom.querySelector("code")?.lastElementChild?.textContent).toBe(
      tail
    );
    expect(view.state.doc.textContent).toBe(`s\n${tail}`);
  });

  it("does not add wrappers when line numbers are disabled", () => {
    const view = createView("s", "none", false);
    expect(view.dom.querySelector("code > span")).toBeNull();
    expect(view.dom.querySelector("code")?.textContent).toBe("s");
  });
});
