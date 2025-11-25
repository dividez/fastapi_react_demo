import { Extension, Mark } from "@tiptap/core";

export const AlignmentMark = Extension.create({
  name: "alignmentMark",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading", "listItem", "blockquote"],
        attributes: {
          alignId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-align-id"),
            renderHTML: (attributes) => {
              if (!attributes.alignId) {
                return {};
              }
              return {
                "data-align-id": attributes.alignId,
              };
            },
          },
        },
      },
    ];
  },
});

export const SentenceMark = Mark.create({
  name: "sentenceMark",

  addAttributes() {
    return {
      sentenceId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-sentence-id"),
        renderHTML: (attributes) => {
          if (!attributes.sentenceId) {
            return {};
          }
          return {
            "data-sentence-id": attributes.sentenceId,
            class: "bilingual-sentence",
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-sentence-id]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          return {
            sentenceId: element.getAttribute("data-sentence-id"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", { ...HTMLAttributes, class: "bilingual-sentence" }, 0];
  },
});

