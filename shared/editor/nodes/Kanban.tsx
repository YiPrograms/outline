import * as React from "react";
import type { NodeSpec, Node as ProsemirrorNode } from "prosemirror-model";
import type { MarkdownSerializerState } from "../lib/markdown/serializer";
import type { ComponentProps } from "../types";
import Node from "./Node";
import { KanbanBoard } from "../components/KanbanBoard";

/**
 * A Kanban board node for the Outline editor.
 */
export default class Kanban extends Node {
  get name() {
    return "kanban";
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        board: {
          default: {
            columns: [
              { id: "todo", title: "To Do", taskIds: [] },
              { id: "doing", title: "Doing", taskIds: [] },
              { id: "done", title: "Done", taskIds: [] },
            ],
            tasks: {},
          },
        },
      },
      group: "block",
      atom: true,
      draggable: true,
      parseDOM: [
        {
          tag: "div.kanban-board",
          getAttrs: (dom: HTMLElement) => {
            const board = dom.getAttribute("data-board");
            return {
              board: board ? JSON.parse(board) : undefined,
            };
          },
        },
      ],
      toDOM: (node) => [
        "div",
        {
          class: "kanban-board",
          "data-board": JSON.stringify(node.attrs.board),
        },
      ],
    };
  }

  component = (props: ComponentProps) => {
    return <KanbanBoard {...props} />;
  };

  commands({ type }) {
    return {
      kanban:
        () =>
        (state, dispatch) => {
          const { tr } = state;
          const node = type.create();
          if (dispatch) {
            dispatch(tr.replaceSelectionWith(node).scrollIntoView());
          }
          return true;
        },
    };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.ensureNewLine();
    state.write(`:::kanban\n${JSON.stringify(node.attrs.board, null, 2)}\n:::\n`);
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      block: "kanban",
      getAttrs: (tok) => ({
        board: JSON.parse(tok.content),
      }),
    };
  }
}
