import { Mark, mergeAttributes } from "@tiptap/core";

const DiffMarker = Mark.create({
  name: "diffMarker",

  parseHTML() {
    return [
      {
        tag: "span[data-diff-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes)];
  },
});

export default DiffMarker;
