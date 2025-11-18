import { Node, mergeAttributes, textblockTypeInputRule } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import { Plugin } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";

const PLACEHOLDER_PATTERN = /\{\{([^{}]+?)\}\}/g;

type PlaceholderAttrs = {
  label: string;
  kind: string;
  defaultValue?: string;
  options?: string[];
};

export const ContractPlaceholder = Node.create({
  name: "contractPlaceholder",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: { default: "" },
      kind: { default: "text" },
      defaultValue: { default: "" },
      options: { default: [] },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-placeholder]",
        getAttrs: (element) => {
          if (!(element instanceof HTMLElement)) return false;
          const rawOptions = element.dataset.options ?? "";
          return {
            label: element.dataset.label ?? "",
            kind: element.dataset.kind ?? "text",
            defaultValue: element.dataset.default ?? "",
            options: rawOptions ? rawOptions.split(",") : [],
          } satisfies PlaceholderAttrs;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = mergeAttributes(
      {
        class: "ai-contract-placeholder",
        "data-placeholder": "true",
        "data-label": node.attrs.label,
        "data-kind": node.attrs.kind,
        "data-default": node.attrs.defaultValue,
        "data-options": (node.attrs.options || []).join(","),
      },
      HTMLAttributes,
    );

    return [
      "span",
      attrs,
      ["span", { class: "ai-contract-placeholder__label" }, node.attrs.label || "字段"],
      node.attrs.defaultValue ? ["span", { class: "ai-contract-placeholder__value" }, node.attrs.defaultValue] : 0,
    ];
  },

  renderText({ node }) {
    const rawOptions = (node.attrs.options as string[] | undefined)?.join(",") ?? "";
    const optionTail = rawOptions ? `|${rawOptions}` : "";
    const defaultPart = node.attrs.defaultValue ? `|${node.attrs.defaultValue}` : "|";
    return `{{${node.attrs.label}|${node.attrs.kind}${defaultPart}${optionTail}}}`;
  },
});

export const NumberedHeading = Node.create({
  name: "heading",
  addOptions() {
    return {
      levels: [1, 2, 3, 4, 5],
      HTMLAttributes: { class: "ai-contract-heading" },
    };
  },
  content: "inline*",
  group: "block",
  defining: true,
  addAttributes() {
    return {
      level: { default: 1, rendered: false },
      number: { default: "", rendered: false },
    };
  },
  parseHTML() {
    return this.options.levels.map((level: number) => ({
      tag: `h${level}`,
      attrs: { level },
    }));
  },
  renderHTML({ node, HTMLAttributes }) {
    const hasLevel = this.options.levels.includes(node.attrs.level);
    const level = hasLevel ? node.attrs.level : this.options.levels[0];
    const numberLabel = node.attrs.number || "";
    return [
      `h${level}`,
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          "data-number": numberLabel,
        },
      ),
      numberLabel ? ["span", { class: "ai-contract-heading__number" }, numberLabel] : 0,
      ["span", { class: "ai-contract-heading__text" }, 0],
    ];
  },
  renderText({ node }) {
    const hash = "#".repeat(node.attrs.level ?? 1);
    const prefix = node.attrs.number ? `${node.attrs.number} ` : "";
    return `${hash} ${prefix}${node.textContent}`;
  },
  addCommands() {
    return {
      setHeading:
        (attributes: { level: number }) =>
        ({ commands }) => {
          if (!this.options.levels.includes(attributes.level)) return false;
          return commands.setNode(this.name, attributes);
        },
      toggleHeading:
        (attributes: { level: number }) =>
        ({ commands }) => {
          if (!this.options.levels.includes(attributes.level)) return false;
          return commands.toggleNode(this.name, "paragraph", attributes);
        },
    };
  },
  addKeyboardShortcuts() {
    return this.options.levels.reduce(
      (items: Record<string, () => boolean>, level: number) => ({
        ...items,
        [`Mod-Alt-${level}`]: () => this.editor.commands.toggleHeading({ level }),
      }),
      {},
    );
  },
  addInputRules() {
    return this.options.levels.map((level: number) =>
      textblockTypeInputRule({
        find: new RegExp(`^(#{${Math.min(...this.options.levels)},${level}})\\s$`),
        type: this.type,
        getAttributes: { level },
      }),
    );
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _oldState, newState) => {
          const tr = newState.tr;
          const counters = [0, 0, 0, 0, 0];
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== this.name) return;
            const level = Math.max(1, Math.min(node.attrs.level || 1, 5));
            counters[level - 1] += 1;
            for (let i = level; i < counters.length; i += 1) counters[i] = 0;
            const numberLabel = counters.slice(0, level).filter(Boolean).join(".");
            if (node.attrs.number !== numberLabel || node.attrs.level !== level) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, number: numberLabel, level }, node.marks);
              modified = true;
            }
          });

          if (modified) return tr;
          return null;
        },
      }),
    ];
  },
});

export const markdownExtension = Markdown.configure({
  transforms: {},
});

export function hydratePlaceholders(editor: Editor) {
  const { state } = editor;
  const tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const matches = Array.from(node.text.matchAll(PLACEHOLDER_PATTERN));
    let offset = 0;

    matches.forEach((match) => {
      const raw = match[1];
      const parts = raw.split("|");
      const [label, kind, defaultValue, optionsRaw] = parts;
      const options = optionsRaw ? optionsRaw.split(",") : [];
      const start = pos + match.index + offset;
      const end = start + match[0].length;
      const placeholderNode = editor.schema.nodes.contractPlaceholder.create({
        label: label?.trim() || "字段",
        kind: kind?.trim() || "text",
        defaultValue: defaultValue?.trim() || "",
        options,
      });
      tr.replaceWith(start, end, placeholderNode);
      offset -= match[0].length - placeholderNode.nodeSize;
    });
  });
  if (tr.docChanged) {
    editor.view.dispatch(tr);
  }
}

export function serializeMarkdown(editor: Editor) {
  const json = editor.getJSON();
  return editor.storage.markdown.manager.serialize(json);
}

export function serializeSelection(editor: Editor) {
  const { selection } = editor.state;
  const slice = selection.content();
  const fragmentJson = slice.content.toJSON();
  const doc = { type: "doc", content: fragmentJson };
  return editor.storage.markdown.manager.serialize(doc);
}
