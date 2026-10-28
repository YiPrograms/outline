// @vitest-environment jsdom
import "../../../__mocks__/window";
import { EditorView } from "prosemirror-view";
import { codeBlock, createEditorState, doc } from "@shared/test/editor";
import { CodeHighlighting } from "./CodeHighlightingPlugin";

const views: EditorView[] = [];

function createView(text: string) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const view = new EditorView(element, {
    state: createEditorState(doc(codeBlock(text, "none")), [
      CodeHighlighting({ name: "code_block", lineNumbers: true }),
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

describe("code block line number widgets", () => {
  it("renders line numbers as non-editable widgets", () => {
    const view = createView("one\n\ntwo");
    const numbers = view.dom.querySelectorAll<HTMLSpanElement>(
      ".code-block-line-number"
    );
    expect(numbers).toHaveLength(3);
    for (const number of numbers) {
      expect(number.contentEditable).toBe("false");
      expect(number.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("updates line markers when line breaks are inserted and deleted", () => {
    const view = createView("one\n\ntwo");
    const lineStarts = () =>
      [...view.dom.querySelectorAll(".code-block-line-number")].map((number) =>
        view.posAtDOM(number, 0)
      );
    expect(lineStarts()).toEqual([1, 5, 6]);

    view.dispatch(view.state.tr.insertText("\n", 5));
    expect(lineStarts()).toEqual([1, 5, 6, 7]);

    view.dispatch(view.state.tr.delete(4, 6));
    expect(lineStarts()).toEqual([1, 5]);
    expect(view.state.doc.textContent).toBe("one\ntwo");
    expect(view.dom.querySelector("code")?.textContent).toBe("one\ntwo");
  });
});
