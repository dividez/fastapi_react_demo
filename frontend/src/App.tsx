import { useEffect, useMemo, useState } from "react";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { generateHTML } from "@tiptap/html";
import { generateJSON } from "@tiptap/html";
import MarkdownIt from "markdown-it";
import PlaceholderNode, { formatPlaceholder } from "./extensions/placeholder";
import type { JSONContent } from "@tiptap/core";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const SAMPLE_MARKDOWN = `# 战略合作协议

## 总则
本协议由 {{甲方名称|text|上海云杉科技有限公司}} （以下简称“甲方”）与 {{乙方名称|text|北京远航供应链管理有限公司}} （以下简称“乙方”）签订。

### 定义
本协议中的术语，如无特别说明，均应以下列含义理解。

### 适用范围
本协议适用于双方在本协议项下达成的全部合作事项。

#### 合同主体
双方确认，合同主体为甲方与乙方。

#### 合同期限
合同期限为 {{合同期限|text|一年}} 。

## 费用与支付
租金金额为 {{租金金额|text|人民币壹万元整}} ，支付方式为 {{租金支付方式|single_select|按月支付|按月支付,按季度支付,一次性支付}}。

### 支付安排
乙方应按照以下顺序支付租金：
1. 首次支付在合同签署后五个工作日内完成；
2. 之后每期租金应在对应计费周期开始前支付。
`;

const md = new MarkdownIt({ html: true, breaks: true });

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizePlaceholderMarkdown(source: string) {
  return source.replace(/\{\{([^}]+)\}\}/g, (_, body: string) => {
    const parts = body.split("|");
    const [name = "占位符", type = "text", defaultValue = "", options = ""] = parts;
    return `<placeholder data-name="${escapeAttribute(name.trim())}" data-type="${escapeAttribute(
      type.trim()
    )}" data-default="${escapeAttribute(defaultValue.trim())}" data-options="${escapeAttribute(
      options.trim()
    )}"></placeholder>`;
  });
}

function markdownToDoc(markdown: string, extensions: any[]): JSONContent {
  const html = md.render(normalizePlaceholderMarkdown(markdown));
  return generateJSON(html, extensions);
}

function serializeInline(content: JSONContent[] = []): string {
  return content
    .map((node) => {
      if (node.type === "text") {
        let text = node.text ?? "";
        const marks = node.marks ?? [];
        marks.forEach((mark) => {
          if (mark.type === "bold") {
            text = `**${text}**`;
          }
          if (mark.type === "italic") {
            text = `*${text}*`;
          }
        });
        return text;
      }
      if (node.type === "placeholder") {
        return formatPlaceholder(node.attrs ?? {});
      }
      if (node.content) {
        return serializeInline(node.content);
      }
      return "";
    })
    .join("");
}

function serializeDoc(node: JSONContent): string {
  const lines: string[] = [];
  const headingCounters = [0, 0, 0, 0, 0, 0];

  const walkBlocks = (blocks: JSONContent[] = [], indent = 0) => {
    blocks.forEach((child) => {
      if (child.type === "heading") {
        const level = child.attrs?.level ?? 1;
        headingCounters[level - 1] += 1;
        for (let i = level; i < headingCounters.length; i += 1) {
          headingCounters[i] = 0;
        }
        const numbering = headingCounters.slice(0, level).join(".") + ".";
        const text = serializeInline(child.content ?? []);
        lines.push(`${"#".repeat(level)} ${numbering} ${text}`.trim());
        lines.push("");
      } else if (child.type === "paragraph") {
        const paragraphText = serializeInline(child.content ?? []);
        lines.push(`${" ".repeat(indent)}${paragraphText}`.trimEnd());
        lines.push("");
      } else if (child.type === "orderedList" || child.type === "bulletList") {
        const ordered = child.type === "orderedList";
        child.content?.forEach((item, itemIndex) => {
          const prefix = ordered ? `${itemIndex + 1}. ` : "- ";
          const itemParagraph = item.content?.find((n) => n.type === "paragraph");
          const nestedBlocks = item.content?.filter((n) => n.type !== "paragraph");
          const text = itemParagraph ? serializeInline(itemParagraph.content ?? []) : "";
          lines.push(`${"  ".repeat(indent)}${prefix}${text}`.trimEnd());
          if (nestedBlocks && nestedBlocks.length > 0) {
            walkBlocks(nestedBlocks, indent + 1, { ordered });
          }
        });
        lines.push("");
      } else if (child.content) {
        walkBlocks(child.content, indent);
      }
    });
  };

  walkBlocks(node.content);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const extensions = useMemo(
    () => [
      StarterKit,
      Placeholder,
      PlaceholderNode,
    ],
    []
  );

  const initialContent = useMemo(() => markdownToDoc(SAMPLE_MARKDOWN, extensions), [extensions]);

  const [markdownPreview, setMarkdownPreview] = useState(SAMPLE_MARKDOWN);
  const [htmlPreview, setHtmlPreview] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [status, setStatus] = useState<string>("");

  const editor = useEditor({
    extensions,
    content: initialContent,
    onUpdate({ editor }) {
      const md = serializeDoc(editor.getJSON());
      setMarkdownPreview(md);
    },
  });

  useEffect(() => {
    if (!editor) return;
    setMarkdownPreview(serializeDoc(editor.getJSON()));
  }, [editor]);

  const handleAITransform = async (mode: "rewrite" | "expand" | "rephrase" | "custom") => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      setStatus("请先选择需要处理的文本。");
      return;
    }
    const slice = editor.state.doc.cut(from, to).toJSON() as JSONContent;
    const markdown = serializeDoc(slice);
    setStatus("调用 AI 中...");
    const response = await fetch(`${API_BASE}/api/ai/transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, markdown, user_instruction: customInstruction }),
    });
    const data = await response.json();
    const newContent = markdownToDoc(data.markdown, extensions);
    editor.commands.insertContentAt({ from, to }, newContent.content ?? []);
    setStatus("AI 内容已插入。编号已自动更新。");
  };

  const handleExportHtml = () => {
    if (!editor) return;
    const html = generateHTML(editor.getJSON(), extensions);
    setHtmlPreview(html);
  };

  const handleExportDocx = async () => {
    if (!editor) return;
    setStatus("正在导出 Word...");
    const markdown = serializeDoc(editor.getJSON());
    const response = await fetch(`${API_BASE}/api/export/docx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown }),
    });
    const blob = await response.blob();
    downloadBlob(blob, "合同范本.docx");
    setStatus("Word 导出完成。");
  };

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <p className="page__eyebrow">合同 AI 编辑器 · React + Tiptap</p>
          <h1>多级编号 + 标签占位符 + 气泡 AI</h1>
          <p className="page__subtitle">
            前后端用 Markdown 交互，标题自动多级编号，正文列表、标签、气泡 AI 改写与 Word 导出示例。
          </p>
        </div>
        <div className="badge">MVP Demo</div>
      </header>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>合同编辑器</h2>
            <p>支持标题层级、正文列表、标签节点与选区气泡 AI。</p>
          </div>
          <div className="toolbar">
            <button onClick={() => editor?.chain().focus().setHeading({ level: 1 }).run()}>一级标题</button>
            <button onClick={() => editor?.chain().focus().setHeading({ level: 2 }).run()}>二级标题</button>
            <button onClick={() => editor?.chain().focus().setHeading({ level: 3 }).run()}>三级标题</button>
            <button onClick={() => editor?.chain().focus().setParagraph().run()}>正文</button>
            <button onClick={() => editor?.chain().focus().toggleBold().run()}>加粗</button>
            <button onClick={() => editor?.chain().focus().toggleItalic().run()}>斜体</button>
            <button onClick={() => editor?.chain().focus().toggleBulletList().run()}>无序列表</button>
            <button onClick={() => editor?.chain().focus().toggleOrderedList().run()}>有序列表</button>
            <button onClick={() => editor?.chain().focus().undo().run()}>撤销</button>
            <button onClick={() => editor?.chain().focus().redo().run()}>重做</button>
          </div>
        </div>

        {editor && (
          <BubbleMenu editor={editor} tippyOptions={{ placement: "top" }} className="bubble-menu">
            <button onClick={() => handleAITransform("rewrite")}>改写</button>
            <button onClick={() => handleAITransform("expand")}>扩写</button>
            <button onClick={() => handleAITransform("rephrase")}>重写</button>
            <div className="bubble-menu__custom">
              <input
                type="text"
                value={customInstruction}
                placeholder="自定义指令"
                onChange={(e) => setCustomInstruction(e.target.value)}
              />
              <button onClick={() => handleAITransform("custom")}>应用</button>
            </div>
          </BubbleMenu>
        )}

        <div className="editor-wrapper">
          {editor && <EditorContent editor={editor} className="editor-content" />}
        </div>

        <div className="panel__footer">
          <div className="panel__actions">
            <button onClick={handleExportHtml}>导出 HTML</button>
            <button onClick={handleExportDocx}>导出 Word (DOCX)</button>
          </div>
          <div className="status">{status}</div>
        </div>
      </section>

      <section className="preview-grid">
        <div className="preview">
          <h3>Markdown（与后端交互）</h3>
          <textarea value={markdownPreview} readOnly rows={16} />
        </div>
        <div className="preview">
          <h3>HTML 预览</h3>
          <div className="html-preview" dangerouslySetInnerHTML={{ __html: htmlPreview }} />
        </div>
      </section>
    </div>
  );
}
