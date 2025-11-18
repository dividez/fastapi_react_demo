import { mergeAttributes, Node } from "@tiptap/core";

export interface PlaceholderAttrs {
  name?: string;
  type?: string;
  default?: string;
  options?: string;
}

export function formatPlaceholder(attrs: PlaceholderAttrs): string {
  const name = attrs.name ?? "占位符";
  const type = attrs.type ?? "text";
  const defaultValue = attrs.default ?? "";
  const options = attrs.options ?? "";
  const parts = [name, type, defaultValue, options].filter((part, index) => index < 3 || part);
  return `{{${parts.join("|")}}}`;
}

const PlaceholderNode = Node.create({
  name: "placeholder",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: { default: "占位符" },
      type: { default: "text" },
      default: { default: "" },
      options: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "placeholder",
        getAttrs: (dom) => ({
          name: (dom as HTMLElement).dataset.name,
          type: (dom as HTMLElement).dataset.type,
          default: (dom as HTMLElement).dataset.default,
          options: (dom as HTMLElement).dataset.options,
        }),
      },
      {
        tag: "span[data-placeholder]",
        getAttrs: (dom) => ({
          name: (dom as HTMLElement).dataset.name,
          type: (dom as HTMLElement).dataset.type,
          default: (dom as HTMLElement).dataset.default,
          options: (dom as HTMLElement).dataset.options,
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "placeholder-token",
        "data-placeholder": "true",
      }),
      `${HTMLAttributes.name ?? "占位符"} (${HTMLAttributes.type ?? "text"})`,
    ];
  },

  renderText({ node }) {
    return formatPlaceholder(node.attrs as PlaceholderAttrs);
  },
});

export default PlaceholderNode;
