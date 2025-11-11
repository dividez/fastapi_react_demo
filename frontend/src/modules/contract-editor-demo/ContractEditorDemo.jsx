import { useEffect, useMemo, useState } from "react";
import {
  EditorContent,
  useEditor,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Node, mergeAttributes } from "@tiptap/core";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";

const DEMO_DATA = {
  title: "股份转让合同（示例，多级 Markdown）",
  blocks: [
    {
      type: "paragraph",
      text: [
        "# 股份转让合同",
        "",
        "本**股份转让合同**（以下简称“本合同”）由以下双方于【】年【】月【】日在【】签署：",
        "",
        "## 一、主体信息",
        "",
        "**转让方（甲方）**：",
        "- 法定代表人：",
        "- 统一社会信用代码：",
        "- 通讯地址：",
        "- 联系人：",
        "- 联系电话：",
        "",
        "**受让方（乙方）**：",
        "- 法定代表人：",
        "- 统一社会信用代码：",
        "- 通讯地址：",
        "- 联系人：",
        "- 联系电话：",
      ].join("\n"),
    },
    {
      type: "paragraph",
      text: "## 二、鉴于",
    },
    {
      type: "paragraph",
      text:
        "1. 甲方系依法设立并有效存续的企业，合法持有【目标公司全称】（以下简称‘目标公司’）的股份。",
      variants: [
        {
          text:
            "1. 甲方为依中国法律合法设立并存续的企业，合法持有目标公司相关股份。",
          description: "简化表述，去除占位符，更直接",
        },
        {
          text:
            "1. 甲方系目标公司股东，对其持有之股份享有完全、合法、有效的所有权。",
          description: "强调所有权属性，表述更严谨",
        },
      ],
      selected: 0,
    },
    {
      type: "paragraph",
      text:
        "2. 乙方系依法设立并有效存续的企业，具有履行本合同项下义务的资信及能力，愿意依据本合同约定受让标的股份。",
      variants: [
        {
          text:
            "2. 乙方具备良好资信及决策程序，同意按照本合同条款受让标的股份。",
          description: "简化表述，突出资信和决策程序",
        },
      ],
      selected: 0,
    },
    {
      type: "paragraph",
      text:
        "3. 甲方有意将其持有的目标公司【】%股份（\"标的股份\"）转让予乙方，乙方亦同意受让该等标的股份。",
      variants: [
        {
          text:
            "3. 双方同意依本合同约定的条件和程序完成标的股份的转让与交割。",
          description: "强调双方合意和程序性要求",
        },
      ],
      selected: 0,
    },
    {
      type: "paragraph",
      text:
        "为此，双方本着平等、自愿、公平和诚信原则，经友好协商，根据《中华人民共和国民法典》《中华人民共和国公司法》等相关法律法规之规定，订立本合同，共同遵守。",
    },
    {
      type: "paragraph",
      text: [
        "## 三、定义与解释",
        "",
        "1.1 **目标公司**：指本合同项下所涉的公司，其名称、注册地址、统一社会信用代码等信息以本合同签署页及附件一载明为准。",
        "1.2 **标的股份**：指甲方拟根据本合同约定转让给乙方的目标公司股份，具体数量、类别及比例以附件二为准。",
        "1.3 **转让价款**：指乙方向甲方支付的用于受让标的股份的对价金额，具体金额及支付安排以本合同第三条及相关附件约定为准。",
        "",
        "（以下条款仅作示例，可继续扩展……）",
      ].join("\n"),
    },
    {
      type: "paragraph",
      text: [
        "## 四、多级编号示例",
        "",
        "1. 第一级项目",
        "  1.1 第二级项目",
        "  1.2 第二级项目",
        "  1.3 第二级项目",
        "2. 另一个第一级项目",
        "  2.1 第二级项目",  
        "  2.2 第二级项目",
        "  2.3 第二级项目",
      ].join("\n"),
    },
    {
      type: "paragraph",
      text: [
        "## 五、多级编号示例",
        "",
        "1. 第一级项目",
        "  1. 第二级项目",
        "  2. 第二级项目",
        "  3. 第二级项目",
        "2. 另一个第一级项目",
        "  1. 第二级项目",  
        "  2. 第二级项目",
        "  3. 第二级项目",
      ].join("\n"),
    },
  ],
};

const mdInlineToNodes = (line) => {
  const nodes = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldRegex.exec(line))) {
    if (match.index > lastIndex) {
      const text = line.slice(lastIndex, match.index);
      if (text) {
        nodes.push({ type: "text", text });
      }
    }
    nodes.push({
      type: "text",
      text: match[1],
      marks: [{ type: "bold" }],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    const text = line.slice(lastIndex);
    if (text) {
      nodes.push({ type: "text", text });
    }
  }

  return nodes;
};

const mdTextToInlineWithBreaks = (md) => {
  const content = [];
  const lines = (md || "").split(/\n/);

  lines.forEach((line, index) => {
    const lineNodes = mdInlineToNodes(line);
    // 过滤掉空的 text 节点
    const validNodes = lineNodes.filter(
      (node) => node.type !== "text" || (node.text && node.text.length > 0)
    );
    
    if (validNodes.length > 0) {
      content.push(...validNodes);
    }
    
    // 如果不是最后一行，添加换行符
    if (index < lines.length - 1) {
      content.push({ type: "hardBreak" });
    }
  });

  // 如果内容为空，至少返回一个空格，避免空的 text 节点
  if (content.length === 0) {
    return [{ type: "text", text: " " }];
  }

  return content;
};

const parseSingleLineHeading = (text) => {
  const match = /^\s*(#{1,6})\s+(.+)$/.exec(text.trim());
  if (!match) return null;
  const level = match[1].length;
  const title = match[2];
  return { level, inline: mdInlineToNodes(title) };
};

const VariantParagraph = Node.create({
  name: "variantParagraph",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      variants: {
        default: [],
      },
      selected: {
        default: 0,
      },
    };
  },

  parseHTML() {
    return [{ tag: "p[data-variant-paragraph]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, {
        "data-variant-paragraph": "true",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariantParagraphView);
  },
});

// 扩展 ListItem 支持 Tab 缩进，同时保留所有原有功能
// 参考 demo：限制最大 5 层 + Tab/Shift+Tab/Enter 键位行为
const IndentableListItem = ListItem.extend({
  addKeyboardShortcuts() {
    const maxLevel = 5;

    // 获取当前列表深度
    const getListDepth = () => {
      const { state } = this.editor;
      const { $from } = state.selection;
      let depth = 0;
      for (let i = $from.depth; i > 0; i -= 1) {
        const node = $from.node(i);
        if (node.type.name === "bulletList" || node.type.name === "orderedList") {
          depth += 1;
        }
      }
      return depth;
    };

    return {
      ...this.parent?.(),
      // Tab 缩进：仅在 listItem 中生效，且不超过 5 层
      Tab: () => {
        if (!this.editor.isActive("listItem")) return false;
        if (getListDepth() >= maxLevel) return true; // 已达最大层级，吞掉 Tab，保持不变
        return this.editor.commands.sinkListItem("listItem");
      },
      // Shift+Tab 提升一层
      "Shift-Tab": () => {
        if (!this.editor.isActive("listItem")) return false;
        return this.editor.commands.liftListItem("listItem");
      },
      // Enter：在有序列表中插入下一条 listItem
      Enter: () => {
        if (!this.editor.isActive("listItem")) return false;
        
        // 在空的顶层 listItem 回车时，交给默认行为从列表退出
        const { state } = this.editor;
        const { $from } = state.selection;
        const currentNode = $from.node($from.depth);
        const isEmpty = !currentNode.textContent || currentNode.textContent.trim() === "";
        if (isEmpty && getListDepth() === 1) return false;
        
        return this.editor.commands.splitListItem("listItem");
      },
    };
  },
});

const MultiLevelOrderedList = OrderedList.extend({
  name: "orderedList",
  
  addGlobalAttributes() {
    return [
      {
        types: ["orderedList"],
        attributes: {
          class: {
            default: "multi-level-ordered-list",
          },
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "ol",
      mergeAttributes(HTMLAttributes, {
        class: "multi-level-ordered-list",
      }),
      0,
    ];
  },
});

const VariantParagraphView = (props) => {
  const { node, editor, updateAttributes, getPos } = props;
  const variants = node.attrs.variants || [];
  const selected = node.attrs.selected ?? 0;

  const applyVariant = (index) => {
    const variant = variants[index];
    if (!variant || !editor) return;

    const pos = typeof getPos === "function" ? getPos() : null;
    if (typeof pos !== "number") return;

    const { doc } = editor.state;
    const currentNode = doc.nodeAt(pos);
    if (!currentNode) return;

    const from = pos + 1;
    const to = pos + currentNode.nodeSize - 1;

    const tr = editor.state.tr.insertText(variant.text, from, to);
    if (!tr.docChanged) return;

    editor.view.dispatch(tr);
    updateAttributes({ selected: index });
  };

  const hasVariants = variants.length > 0;

  return (
    <NodeViewWrapper className="variant-node">
      <NodeViewContent as="div" className="variant-node__content" />

      {hasVariants && (
        <div className="variant-node__toolbar">
          <span className="variant-node__badge">
            有 {variants.length} 个备选写法
          </span>
          {variants.map((v, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyVariant(i)}
              className={
                "variant-node__button" +
                (i === selected ? " variant-node__button--active" : "")
              }
              title={v.description || v.text}
            >
              方案{i + 1}
              {v.description && (
                <span className="variant-node__button-desc">
                  {v.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
};

const parseOrderedListItem = (line) => {
  const match = /^(\s*)(\d+(?:\.\d+)*)(?:\.)?\s+(.+)$/.exec(line);
  if (!match) return null;
  const indent = match[1].length;
  const number = match[2];
  const content = match[3];
  const indentLevel = Math.max(Math.floor(indent / 2), 0);
  const dotLevel = Math.max(number.split(".").length - 1, 0);
  const level = indentLevel > 0 ? indentLevel : dotLevel;
  return { level, content, number, indent };
};

const parseMultiLineMarkdown = (text) => {
  const lines = (text || "").split(/\n/);
  const blocks = [];
  let currentParagraph = [];
  let listItems = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const paragraphText = currentParagraph.join("\n");
      const trimmed = paragraphText.trim();
      if (trimmed) {
        blocks.push({
          type: "paragraph",
          text: paragraphText,
        });
      }
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      const list = buildNestedList(listItems);
      if (list) {
        blocks.push(list);
      }
      listItems = [];
    }
  };

  const normalizeListLevels = (items) => {
    if (!items.length) return [];
    const minLevel = items.reduce(
      (min, item) => Math.min(min, Math.max(item.level ?? 0, 0)),
      Infinity,
    );
    if (minLevel <= 0) {
      return items.map((item) => ({
        ...item,
        level: Math.max(item.level ?? 0, 0),
      }));
    }
    return items.map((item) => ({
      ...item,
      level: Math.max((item.level ?? 0) - minLevel, 0),
    }));
  };

  const buildNestedList = (items) => {
    if (items.length === 0) return null;

    const normalizedItems = normalizeListLevels(items);

    const walk = (startIndex, currentLevel) => {
      const list = { type: "orderedList", items: [] };
      let index = startIndex;

      while (index < normalizedItems.length) {
        const currentItem = normalizedItems[index];
        const itemLevel = Math.max(currentItem.level ?? 0, 0);

        if (itemLevel < currentLevel) {
          break;
        }

        if (itemLevel > currentLevel) {
          const prevItem = list.items[list.items.length - 1];
          if (!prevItem) {
            list.items.push({
              type: "listItem",
              level: currentLevel,
              content: currentItem.content,
            });
            index += 1;
            continue;
          }

          const nestedResult = walk(index, itemLevel);
          if (nestedResult.list.items.length > 0) {
            prevItem.nested = nestedResult.list;
          }
          index = nestedResult.nextIndex;
          continue;
        }

        list.items.push({
          type: "listItem",
          level: itemLevel,
          content: currentItem.content,
        });
        index += 1;
      }

      return { list, nextIndex: index };
    };

    const startLevel = normalizedItems[0]?.level ?? 0;
    const { list } = walk(0, startLevel);
    return list;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const heading = parseSingleLineHeading(trimmed);
    const listItem = parseOrderedListItem(line);

    if (heading) {
      flushList();
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading.level,
        inline: heading.inline,
      });
    } else if (listItem) {
      flushParagraph();
      listItems.push({
        level: listItem.level,
        content: mdInlineToNodes(listItem.content),
      });
    } else if (trimmed === "") {
      if (listItems.length > 0) {
        flushList();
      } else {
        flushParagraph();
      }
    } else {
      if (listItems.length > 0) {
        flushList();
      }
      currentParagraph.push(line);
    }
  });

  flushList();
  flushParagraph();

  return blocks;
};

const convertListToTipTap = (list) => {
  if (!list || list.type !== "orderedList" || !list.items || list.items.length === 0) {
    return null;
  }

  const items = [];
  
  list.items.forEach((item) => {
    const listItemContent = [
      {
        type: "paragraph",
        content: item.content || [{ type: "text", text: " " }],
      },
    ];

    if (item.nested && item.nested.items && item.nested.items.length > 0) {
      const nestedList = convertListToTipTap(item.nested);
      if (nestedList) {
        listItemContent.push(nestedList);
      }
    }

    items.push({
      type: "listItem",
      content: listItemContent,
    });
  });

  return {
    type: "orderedList",
    content: items,
  };
};

const buildDocFromApi = (data) => {
  const content = [];

  data.blocks.forEach((b) => {
    if (b.type === "heading") {
      content.push({
        type: "heading",
        attrs: { level: b.level },
        content: mdTextToInlineWithBreaks(b.text),
      });
      return;
    }

    if (b.type === "paragraph" && b.variants && b.variants.length > 0) {
      const sel =
        typeof b.selected === "number" && b.variants[b.selected]
          ? b.selected
          : 0;
      const useText = b.variants[sel]?.text || b.text || "";
      content.push({
        type: "variantParagraph",
        attrs: { variants: b.variants, selected: sel },
        content: mdTextToInlineWithBreaks(useText),
      });
      return;
    }

    if (b.type === "paragraph") {
      const trimmed = (b.text || "").trim();
      
      // 如果包含换行符，尝试解析多行 markdown
      if (trimmed.includes("\n")) {
        const parsedBlocks = parseMultiLineMarkdown(b.text);
        parsedBlocks.forEach((block) => {
          if (block.type === "heading") {
            content.push({
              type: "heading",
              attrs: { level: block.level },
              content: block.inline,
            });
          } else if (block.type === "orderedList") {
            const tipTapList = convertListToTipTap(block);
            if (tipTapList) {
              content.push(tipTapList);
            }
          } else if (block.type === "paragraph") {
            const paraText = block.text.trim();
            if (paraText) {
              content.push({
                type: "paragraph",
                content: mdTextToInlineWithBreaks(block.text),
              });
            }
          }
        });
      } else {
        // 单行文本，检查是否是标题
        const heading = parseSingleLineHeading(trimmed);
        if (heading) {
          content.push({
            type: "heading",
            attrs: { level: heading.level },
            content: heading.inline,
          });
        } else {
          content.push({
            type: "paragraph",
            content: mdTextToInlineWithBreaks(b.text),
          });
        }
      }
    }
  });

  if (!content.length) {
    content.push({ type: "paragraph", content: [{ type: "text", text: " " }] });
  }

  return { type: "doc", content };
};

const inlineToMarkdown = (content = []) => {
  let out = "";
  content.forEach((node) => {
    if (node.type === "hardBreak") {
      out += "\n";
    } else if (node.type === "text") {
      const hasBold = (node.marks || []).some((m) => m.type === "bold");
      out += hasBold ? `**${node.text || ""}**` : node.text || "";
    }
  });
  return out;
};

const listToMarkdown = (listNode, level = 0, numberPath = []) => {
  if (!listNode || listNode.type !== "orderedList") {
    return "";
  }

  const lines = [];
  const indent = "  ".repeat(level);

  (listNode.content || []).forEach((item, index) => {
    if (item.type !== "listItem") return;

    const numberingPath = [...numberPath, index + 1];
    const label = numberingPath.join(".");

    const paragraphs = [];
    const childLists = [];

    (item.content || []).forEach((contentNode) => {
      if (contentNode.type === "paragraph") {
        const text = inlineToMarkdown(contentNode.content || []);
        if (text.trim()) {
          paragraphs.push(text);
        }
      } else if (contentNode.type === "orderedList") {
        childLists.push(contentNode);
      }
    });

    const mainText = paragraphs.shift() || "";
    const currentLine = mainText
      ? `${indent}${label}. ${mainText}`
      : `${indent}${label}.`;
    lines.push(currentLine.trimEnd());

    paragraphs.forEach((extra) => {
      lines.push(`${indent}${extra}`);
    });

    childLists.forEach((childList) => {
      const nestedMarkdown = listToMarkdown(
        childList,
        level + 1,
        numberingPath,
      );
      if (nestedMarkdown) {
        lines.push(nestedMarkdown);
      }
    });
  });

  return lines.join("\n");
};

const exportToApi = (editor) => {
  const json = editor.getJSON();
  const blocks = [];

  const pushParagraph = (text) => {
    if (text.trim().length === 0) return;
    blocks.push({ type: "paragraph", text });
  };

  (json.content || []).forEach((node) => {
    if (node.type === "heading") {
      const text = inlineToMarkdown(node.content || []);
      blocks.push({
        type: "heading",
        level: node.attrs?.level ?? 1,
        text,
      });
      return;
    }

    if (node.type === "variantParagraph") {
      const text = inlineToMarkdown(node.content || []);
      blocks.push({
        type: "paragraph",
        text,
        variants: node.attrs?.variants || [],
        selected: node.attrs?.selected ?? 0,
      });
      return;
    }

    if (node.type === "orderedList") {
      const markdown = listToMarkdown(node);
      if (markdown) {
        pushParagraph(markdown);
      }
      return;
    }

    if (node.type === "paragraph") {
      const text = inlineToMarkdown(node.content || []);
      pushParagraph(text);
    }
  });

  return {
    title: DEMO_DATA.title,
    blocks,
  };
};

const runSelfTests = () => {
  const doc = buildDocFromApi(DEMO_DATA);
  if (!doc || doc.type !== "doc" || !Array.isArray(doc.content)) {
    console.error("[SelfTest] buildDocFromApi 结果不合法", doc);
  }

  try {
    buildDocFromApi(DEMO_DATA);
    buildDocFromApi(DEMO_DATA);
  } catch (e) {
    console.error("[SelfTest] buildDocFromApi 多次调用异常", e);
  }

  const testMd = ["# H1", "", "普通段落", "**加粗**文本"].join("\n");
  const testDoc = buildDocFromApi({
    title: "t",
    blocks: [{ type: "paragraph", text: testMd }],
  });
  if (!testDoc.content || testDoc.content.length === 0) {
    console.error("[SelfTest] Markdown 段落未被解析为内容", testDoc);
  }

  const multiListMd = ["1. 顶级", "  1.1 次级", "    1.1.1 三级"].join("\n");
  const listDoc = buildDocFromApi({
    title: "t",
    blocks: [{ type: "paragraph", text: multiListMd }],
  });
  const multiListNode = (listDoc.content || []).find(
    (node) => node.type === "orderedList",
  );
  if (!multiListNode) {
    console.error("[SelfTest] 多级列表未解析为 orderedList");
  } else {
    const hasNestedList = multiListNode.content?.some((item) =>
      (item.content || []).some((child) => child.type === "orderedList"),
    );
    if (!hasNestedList) {
      console.error("[SelfTest] 多级列表未生成嵌套结构", multiListNode);
    }
    const preview = listToMarkdown(multiListNode);
    if (!/1\.1/.test(preview) || !/1\.1\.1/.test(preview)) {
      console.error("[SelfTest] 多级列表导出未包含多层编号", preview);
    }
  }
};

runSelfTests();

const BASE_EXTENSIONS = [
  StarterKit.configure({
    orderedList: false,
    listItem: false, // 禁用 StarterKit 的 listItem，使用我们扩展的
    // 确保其他功能正常
  }),
  MultiLevelOrderedList,
  IndentableListItem, // 使用扩展的 ListItem（包含 Tab 快捷键和所有原有功能）
  VariantParagraph,
];

const ContractEditorDemo = ({ title, subtitle }) => {
  const [exported, setExported] = useState(
    JSON.stringify(DEMO_DATA, null, 2),
  );

  const extensions = useMemo(() => BASE_EXTENSIONS, []);

  const initialContent = useMemo(() => buildDocFromApi(DEMO_DATA), []);

  const editor = useEditor({
    extensions,
    content: initialContent,
    editorProps: {
      attributes: {
        class: "variant-editor__content",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const setInitialContent = () => {
      try {
        editor.commands.setContent(initialContent, false);
      } catch (error) {
        console.error("设置编辑器内容失败:", error);
      }
    };

    setInitialContent();

    const updateExport = () => {
      const apiDoc = exportToApi(editor);
      setExported(JSON.stringify(apiDoc, null, 2));
    };

    updateExport();
    editor.on("update", updateExport);

    return () => {
      editor.off("update", updateExport);
    };
  }, [editor, initialContent]);

  const onExport = () => {
    if (!editor) return;
    const apiDoc = exportToApi(editor);
    setExported(JSON.stringify(apiDoc, null, 2));
  };

  const onDebugHTML = () => {
    if (!editor) return;
    const html = editor.getHTML();
    console.log("=== 编辑器 HTML 结构 ===");
    console.log(html);
    
    // 检查是否有 multi-level-ordered-list class
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const allOl = tempDiv.querySelectorAll("ol");
    console.log(`找到 ${allOl.length} 个 ol 元素`);
    allOl.forEach((ol, index) => {
      console.log(`ol[${index}]:`, {
        className: ol.className,
        hasClass: ol.classList.contains("multi-level-ordered-list"),
        children: ol.children.length,
        html: ol.outerHTML.substring(0, 200),
      });
    });
  };

  return (
    <>
      <header className="page__header">
        <div>
          <h1>{title}</h1>
          <p className="page__subtitle">{subtitle}</p>
        </div>
        <div className="variant-editor__actions">
          <button className="variant-editor__export" onClick={onExport}>
            导出 JSON
          </button>
          <button className="variant-editor__export" onClick={onDebugHTML}>
            调试 HTML
          </button>
        </div>
      </header>

      <main className="page__content variant-editor">
        <div className="paper-shadow variant-editor__paper">
          {editor && <EditorContent editor={editor} />}
        </div>

        <section className="variant-editor__preview">
          <h2>当前极简结构预览（运行态测试）</h2>
          <pre>{exported}</pre>
          <p>
            协议格式：{"{"}"title"{":"} string, "blocks":
            (heading | paragraph(with variants, selected))[] {"}"}. 其中
            paragraph.text 支持少量 Markdown（**加粗**、换行、单行 #/## 标题）。
          </p>
        </section>
      </main>
    </>
  );
};

export default ContractEditorDemo;
