import { Mark, markInputRule, markPasteRule } from "@tiptap/core";

const PLACEHOLDER_PATTERN = /\{\{([^{}|]+)\|([^{}|]+)(?:\|([^{}|]*))(?:\|([^{}|]+))?\}\}/g;

const singlePlaceholderRegex = /\{\{([^{}|]+)\|([^{}|]+)(?:\|([^{}|]*))(?:\|([^{}|]+))?\}\}/;

export const PlaceholderMark = Mark.create({
  name: "contractPlaceholder",

  inclusive: false,

  addAttributes() {
    return {
      fieldName: { default: "" },
      fieldType: { default: "text" },
      defaultValue: { default: "" },
      options: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-placeholder]",
        getAttrs: (element) => {
          const fieldName = element.getAttribute("data-field-name") ?? "";
          const fieldType = element.getAttribute("data-field-type") ?? "text";
          const defaultValue = element.getAttribute("data-default") ?? "";
          const options = element.getAttribute("data-options") ?? "";
          return { fieldName, fieldType, defaultValue, options };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { fieldName, fieldType, defaultValue, options } = HTMLAttributes;
    const labelParts = [fieldName || "字段", fieldType];
    if (defaultValue) {
      labelParts.push(`默认：${defaultValue}`);
    }
    if (options) {
      labelParts.push(`选项：${options}`);
    }

    return [
      "span",
      {
        ...HTMLAttributes,
        "data-placeholder": "true",
        "data-field-name": fieldName,
        "data-field-type": fieldType,
        "data-default": defaultValue,
        "data-options": options,
        class: "ai-editor__placeholder",
      },
      labelParts.join(" ｜ "),
    ];
  },

  addInputRules() {
    return [
      markInputRule({
        find: singlePlaceholderRegex,
        type: this.type,
        getAttributes: (match) => ({
          fieldName: match[1] ?? "",
          fieldType: match[2] ?? "text",
          defaultValue: match[3] ?? "",
          options: match[4] ?? "",
        }),
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: PLACEHOLDER_PATTERN,
        type: this.type,
        getAttributes: (match) => ({
          fieldName: match[1] ?? "",
          fieldType: match[2] ?? "text",
          defaultValue: match[3] ?? "",
          options: match[4] ?? "",
        }),
      }),
    ];
  },
});

export default PlaceholderMark;
