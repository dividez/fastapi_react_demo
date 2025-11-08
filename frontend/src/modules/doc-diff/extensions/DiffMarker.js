import { Mark, mergeAttributes } from "@tiptap/core";

const DiffMarker = Mark.create({
  name: "diffMarker",

  addAttributes() {
    return {
      "data-diff-id": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-diff-id"),
        renderHTML: (attributes) => {
          if (!attributes["data-diff-id"]) {
            return {};
          }
          return {
            "data-diff-id": attributes["data-diff-id"],
          };
        },
      },
      "data-diff-type": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-diff-type"),
        renderHTML: (attributes) => {
          if (!attributes["data-diff-type"]) {
            return {};
          }
          return {
            "data-diff-type": attributes["data-diff-type"],
          };
        },
      },
      "data-diff-role": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-diff-role"),
        renderHTML: (attributes) => {
          if (!attributes["data-diff-role"]) {
            return {};
          }
          return {
            "data-diff-role": attributes["data-diff-role"],
          };
        },
      },
      "data-diff-type-label": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-diff-type-label"),
        renderHTML: (attributes) => {
          if (!attributes["data-diff-type-label"]) {
            return {};
          }
          return {
            "data-diff-type-label": attributes["data-diff-type-label"],
          };
        },
      },
      "data-diff-number": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-diff-number"),
        renderHTML: (attributes) => {
          if (!attributes["data-diff-number"]) {
            return {};
          }
          return {
            "data-diff-number": attributes["data-diff-number"],
          };
        },
      },
      "data-diff-placeholder": {
        default: null,
        parseHTML: (element) => element.getAttribute("data-diff-placeholder"),
        renderHTML: (attributes) => {
          if (!attributes["data-diff-placeholder"]) {
            return {};
          }
          return {
            "data-diff-placeholder": attributes["data-diff-placeholder"],
          };
        },
      },
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute("class"),
        renderHTML: (attributes) => {
          if (!attributes.class) {
            return {};
          }
          return {
            class: attributes.class,
          };
        },
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute("title"),
        renderHTML: (attributes) => {
          if (!attributes.title) {
            return {};
          }
          return {
            title: attributes.title,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-diff-id]",
        getAttrs: (node) => {
          if (typeof node === "string") return false;
          return node.hasAttribute("data-diff-id");
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes)];
  },
});

export default DiffMarker;
