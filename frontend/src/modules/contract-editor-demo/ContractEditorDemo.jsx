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
        "1. 甲方系依法设立并有效存续的企业，合法持有【目标公司全称】（以下简称“目标公司”）的股份。",
      variants: [
        {
          text:
            "1. 甲方为依中国法律合法设立并存续的企业，合法持有目标公司相关股份。",
        },
        {
          text:
            "1. 甲方系目标公司股东，对其持有之股份享有完全、合法、有效的所有权。",
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
        },
      ],
      selected: 0,
    },
    {
      type: "paragraph",
      text:
        "3. 甲方有意将其持有的目标公司【】%股份（“标的股份”）转让予乙方，乙方亦同意受让该等标的股份。",
      variants: [
        {
          text:
            "3. 双方同意依本合同约定的条件和程序完成标的股份的转让与交割。",
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
  ],
};

const mdInlineToNodes = (line) => {
  const nodes = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldRegex.exec(line))) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: line.slice(lastIndex, match.index) });
    }
    nodes.push({
      type: "text",
      text: match[1],
      marks: [{ type: "bold" }],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    nodes.push({ type: "text", text: line.slice(lastIndex) });
  }

  if (!nodes.length) {
    nodes.push({ type: "text", text: "" });
  }

  return nodes;
};

const mdTextToInlineWithBreaks = (md) => {
  const content = [];
  const lines = (md || "").split(/\n/);

  lines.forEach((line, index) => {
    content.push(...mdInlineToNodes(line));
    if (index < lines.length - 1) {
      content.push({ type: "hardBreak" });
    }
  });

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
              title={v.text}
            >
              方案{i + 1}
            </button>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
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
      const heading = parseSingleLineHeading(trimmed);
      if (heading && !trimmed.includes("\n")) {
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
  });

  if (!content.length) {
    content.push({ type: "paragraph", content: [{ type: "text", text: "" }] });
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
};

runSelfTests();

const BASE_EXTENSIONS = [StarterKit.configure({}), VariantParagraph];

const ContractEditorDemo = ({ title, subtitle }) => {
  const [exported, setExported] = useState(
    "// 点击“导出 JSON”查看当前极简结构 (title + blocks)\n",
  );

  const extensions = useMemo(() => BASE_EXTENSIONS, []);

  const editor = useEditor({
    extensions,
    content: buildDocFromApi(DEMO_DATA),
    editorProps: {
      attributes: {
        class: "variant-editor__content",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const updateExport = () => {
      const apiDoc = exportToApi(editor);
      setExported(JSON.stringify(apiDoc, null, 2));
    };

    updateExport();
    editor.on("update", updateExport);

    return () => {
      editor.off("update", updateExport);
    };
  }, [editor]);

  const onExport = () => {
    if (!editor) return;
    const apiDoc = exportToApi(editor);
    setExported(JSON.stringify(apiDoc, null, 2));
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
