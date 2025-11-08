import { Mark, mergeAttributes } from "@tiptap/core";

const DiffMarker = Mark.create({
  name: "diffMarker",

  inclusive: false,

  addAttributes() {
    return {
      diffId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-diff-id"),
        renderHTML: (attributes) =>
          attributes.diffId ? { "data-diff-id": attributes.diffId } : {},
      },
      diffType: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-diff-type"),
        renderHTML: (attributes) =>
          attributes.diffType ? { "data-diff-type": attributes.diffType } : {},
      },
      diffRole: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-diff-role"),
        renderHTML: (attributes) =>
          attributes.diffRole ? { "data-diff-role": attributes.diffRole } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-diff-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { diffId, diffType, diffRole, ...rest } = HTMLAttributes;
    const classes = ["diff-marker"];
    if (diffType) {
      classes.push(`diff-marker--${diffType}`);
    }
    if (diffRole) {
      classes.push(`diff-marker--${diffRole}`);
    }

    const attributes = mergeAttributes(rest, {
      class: classes.join(" "),
    });

    if (diffId) {
      attributes["data-diff-id"] = diffId;
    }
    if (diffType) {
      attributes["data-diff-type"] = diffType;
    }
    if (diffRole) {
      attributes["data-diff-role"] = diffRole;
    }

    return ["span", attributes, 0];
  },
});

export default DiffMarker;
