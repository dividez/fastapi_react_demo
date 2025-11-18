import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import OrderedList from "@tiptap/extension-ordered-list";
import BulletList from "@tiptap/extension-bullet-list";
import Underline from "@tiptap/extension-underline";
import { markdownExtension, NumberedHeading, ContractPlaceholder, hydratePlaceholders, serializeMarkdown, serializeSelection } from "./extensions";
import "./contract-draft.css";

const SAMPLE_CONTRACT_MARKDOWN = `# 战略合作协议

1. 总则  
本协议由 {{甲方名称|text|上海云杉科技有限公司}} （以下简称“甲方”）与 {{乙方名称|text|北京远航供应链管理有限公司}} （以下简称“乙方”）签订。

1.1 定义  
本协议中的术语，如无特别说明，均应以下列含义理解。

1.2 适用范围  
本协议适用于双方在本协议项下达成的全部合作事项。

1.2.1 合同主体  
双方确认，合同主体为甲方与乙方。

1.2.2 合同期限  
合同期限为 {{合同期限|text|一年}} 。

2. 费用与支付  
租金金额为 {{租金金额|text|人民币壹万元整}} ，支付方式为 {{租金支付方式|single_select|按月支付|按月支付,按季度支付,一次性支付}}。

2.1 支付安排  
乙方应按照以下顺序支付租金：
1. 首次支付在合同签署后五个工作日内完成；
2. 之后每期租金应在对应计费周期开始前支付。`;

const AI_ACTIONS = [
  { id: "rewrite", label: "改写" },
  { id: "expand", label: "扩写" },
  { id: "rephrase", label: "重写" },
];

interface ContractDraftModuleProps {
  title: string;
  subtitle: string;
  apiBaseUrl: string;
}

export default function ContractDraftModule({ title, subtitle, apiBaseUrl }: ContractDraftModuleProps) {
  const [customInstruction, setCustomInstruction] = useState("语气更正式，保持编号");
  const [htmlPreview, setHtmlPreview] = useState("");
  const [markdownPreview, setMarkdownPreview] = useState("");
  const [aiPending, setAiPending] = useState(false);

  const normalizedApiBase = useMemo(() => apiBaseUrl.replace(/\/$/, ""), [apiBaseUrl]);

  const editor = useEditor({
    extensions: [
      NumberedHeading,
      ContractPlaceholder,
      markdownExtension,
      StarterKit.configure({ heading: false }),
      OrderedList.configure({ keepMarks: true }),
      BulletList,
      Underline,
    ],
    autofocus: true,
    editorProps: {
      attributes: {
        class: "ai-contract-editor__content",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const parsed = editor.storage.markdown.manager.parse(SAMPLE_CONTRACT_MARKDOWN);
    editor.commands.setContent(parsed);
    hydratePlaceholders(editor);
  }, [editor]);

  const handleExportHtml = () => {
    if (!editor) return;
    const html = editor.getHTML();
    setHtmlPreview(html);
    setMarkdownPreview(serializeMarkdown(editor));
  };

  const handleExportDocx = async () => {
    if (!editor) return;
    const markdown = serializeMarkdown(editor);
    setMarkdownPreview(markdown);

    const response = await fetch(`${normalizedApiBase}/api/export/docx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown }),
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "合同AI导出.docx";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const applyAi = async (mode: string) => {
    if (!editor) return;
    const markdown = serializeSelection(editor);
    if (!markdown.trim()) return;
    setAiPending(true);

    const response = await fetch(`${normalizedApiBase}/api/ai/transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, markdown, user_instruction: customInstruction }),
    });

    const result = await response.json();
    const fragment = editor.storage.markdown.manager.parse(result.markdown || "");
    editor.chain().focus().insertContentAt({ from: editor.state.selection.from, to: editor.state.selection.to }, fragment.content || fragment).run();
    hydratePlaceholders(editor);
    setAiPending(false);
  };

  const toolbarButton = (label: string, action: () => void, active?: boolean) => (
    <button
      key={label}
      type="button"
      className={`ai-contract-toolbar__btn ${active ? "is-active" : ""}`}
      onClick={action}
    >
      {label}
    </button>
  );

  return (
    <div className="ai-contract-page">
      <header className="ai-contract-header">
        <div className="ai-contract-hero">
          <div>
            <p className="badge">第八模块 · AI 合同起草</p>
            <div className="ai-contract-hero__title">
              <h1>{title}</h1>
              <span className="pill">Notion 风格</span>
            </div>
            <p className="subtitle">{subtitle}</p>
          </div>
          <div className="ai-contract-meta">
            <span>⌘/ 快捷输入</span>
            <span>选中段落唤起 AI 气泡</span>
            <span>保持编号、占位符结构</span>
          </div>
        </div>
        <div className="ai-contract-actions">
          <button type="button" onClick={handleExportHtml} className="primary">导出 HTML</button>
          <button type="button" onClick={handleExportDocx} className="secondary">导出 Word</button>
        </div>
      </header>

      <div className="ai-contract-surface">
        <div className="ai-contract-toolbar">
          <div className="ai-contract-toolbar__row">
            <div className="ai-contract-toolbar__label">常用样式</div>
            <div className="ai-contract-toolbar__group">
              {toolbarButton("标题1", () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), editor?.isActive("heading", { level: 1 }))}
              {toolbarButton("标题2", () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), editor?.isActive("heading", { level: 2 }))}
              {toolbarButton("标题3", () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), editor?.isActive("heading", { level: 3 }))}
              {toolbarButton("加粗", () => editor?.chain().focus().toggleBold().run(), editor?.isActive("bold"))}
              {toolbarButton("斜体", () => editor?.chain().focus().toggleItalic().run(), editor?.isActive("italic"))}
              {toolbarButton("下划线", () => editor?.chain().focus().toggleUnderline().run(), editor?.isActive("underline"))}
              {toolbarButton("有序列表", () => editor?.chain().focus().toggleOrderedList().run(), editor?.isActive("orderedList"))}
              {toolbarButton("无序列表", () => editor?.chain().focus().toggleBulletList().run(), editor?.isActive("bulletList"))}
              {toolbarButton("撤销", () => editor?.chain().focus().undo().run())}
              {toolbarButton("重做", () => editor?.chain().focus().redo().run())}
            </div>
          </div>
          <div className="ai-contract-toolbar__row ai-contract-toolbar__hint">
            <span>Notion 式悬浮气泡已启用，选区会展示改写、扩写等 AI 操作。</span>
          </div>
        </div>

        <div className="ai-contract-editor">
          <EditorContent editor={editor} />
        </div>
      </div>

      {editor && (
        <BubbleMenu className="ai-contract-bubble" tippyOptions={{ duration: 150 }} editor={editor} shouldShow={({ editor: ed }) => !ed.state.selection.empty}>
          <div className="ai-contract-bubble__header">
            <div>
              <div className="ai-contract-bubble__title">AI 助手</div>
              <p className="ai-contract-bubble__hint">灵感气泡 · 贴近 Notion 的悬浮体验</p>
            </div>
            <span className="ai-contract-bubble__status">选中内容</span>
          </div>

          <div className="ai-contract-bubble__actions">
            {AI_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => applyAi(action.id)}
                className="ai-contract-bubble__chip"
                disabled={aiPending}
              >
                {action.label}
              </button>
            ))}
            <div className="ai-contract-bubble__custom">
              <input
                type="text"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="更礼貌、更正式…"
              />
              <button
                type="button"
                onClick={() => applyAi("custom")}
                className="ai-contract-bubble__chip ai-contract-bubble__chip--primary"
                disabled={aiPending}
              >
                自定义
              </button>
            </div>
          </div>
        </BubbleMenu>
      )}

      <section className="ai-contract-preview">
        <div>
          <div className="preview-header">
            <h3>Markdown</h3>
            <span>与后端交互的数据</span>
          </div>
          <textarea readOnly value={markdownPreview} placeholder="点击导出查看 Markdown" />
        </div>
        <div>
          <div className="preview-header">
            <h3>HTML</h3>
            <span>前端渲染/预览</span>
          </div>
          <textarea readOnly value={htmlPreview} placeholder="点击导出查看 HTML" />
        </div>
      </section>
    </div>
  );
}
