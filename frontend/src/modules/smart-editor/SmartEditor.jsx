import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import clsx from "clsx";

import "./smart-editor.css";

const outlineSections = [
  {
    id: "overview",
    title: "产品概述",
    summary: "梳理功能愿景与目标受众。",
    badge: "已同步",
  },
  {
    id: "workflow",
    title: "核心流程设计",
    summary: "拆解用户路径与交互节点。",
    badge: "校对中",
  },
  {
    id: "guardrails",
    title: "文案与风格基准",
    summary: "定义品牌语气与安全策略。",
    badge: "上线版",
  },
  {
    id: "qa",
    title: "质检清单",
    summary: "交互自检，提升可用性。",
    badge: "必做",
  },
];

const toolbarItems = [
  {
    id: "heading-2",
    label: "H2",
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
  },
  {
    id: "heading-3",
    label: "H3",
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive("heading", { level: 3 }),
  },
  {
    id: "bold",
    label: "加粗",
    action: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive("bold"),
  },
  {
    id: "italic",
    label: "斜体",
    action: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive("italic"),
  },
  {
    id: "underline",
    label: "下划线",
    action: (editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor) => editor.isActive("underline"),
  },
  {
    id: "highlight",
    label: "高亮",
    action: (editor) => editor.chain().focus().toggleHighlight({ color: "#fff3cd" }).run(),
    isActive: (editor) => editor.isActive("highlight"),
  },
  {
    id: "bullet",
    label: "列表",
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive("bulletList"),
  },
  {
    id: "ordered",
    label: "编号",
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive("orderedList"),
  },
  {
    id: "quote",
    label: "引用",
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive("blockquote"),
  },
  {
    id: "align-left",
    label: "居左",
    action: (editor) => editor.chain().focus().setTextAlign("left").run(),
    isActive: (editor) => editor.isActive({ textAlign: "left" }),
  },
  {
    id: "align-center",
    label: "居中",
    action: (editor) => editor.chain().focus().setTextAlign("center").run(),
    isActive: (editor) => editor.isActive({ textAlign: "center" }),
  },
  {
    id: "align-right",
    label: "居右",
    action: (editor) => editor.chain().focus().setTextAlign("right").run(),
    isActive: (editor) => editor.isActive({ textAlign: "right" }),
  },
  {
    id: "undo",
    label: "撤销",
    action: (editor) => editor.chain().focus().undo().run(),
    isActive: () => false,
  },
  {
    id: "redo",
    label: "重做",
    action: (editor) => editor.chain().focus().redo().run(),
    isActive: () => false,
  },
];

const aiSuggestions = [
  {
    id: "consistency",
    title: "术语一致性",
    description: "自动替换同义表达，保持用户视角一致。",
    preview: "将“用户”统一为“创作者”，突出产品定位。",
  },
  {
    id: "risk",
    title: "风险提示",
    description: "补充敏感操作的安全提醒，突出撤销路径。",
    preview: "在删除模板时提示：本操作不可撤销，可先导出备份。",
  },
  {
    id: "benefit",
    title: "价值补强",
    description: "强调智能填充与批量导出的效率收益。",
    preview: "智能字段在导出 PDF/Word 时自动同步，减少人工校对。",
  },
];

const bubbleActions = [
  {
    id: "concise",
    title: "精炼表达",
    description: "压缩赘述，保留用户收益与约束。",
    buildText: (selected) => `【精炼】${selected}`,
    badge: "语气一致",
  },
  {
    id: "risk",
    title: "补充风险",
    description: "提醒可回退路径或导出备份。",
    buildText: (selected) => `${selected}（操作前请确认导出备份，并提供撤销路径）`,
    badge: "合规",
  },
  {
    id: "list",
    title: "转为要点",
    description: "拆成要点，便于快速扫读。",
    buildText: (selected) => `• ${selected.replace(/。/g, "；")}`,
    badge: "结构化",
  },
];

const initialContent = `
<h1>SmartEditor 产品说明</h1>
<p>SmartEditor 是为产品文档、合同与规范场景打造的富文本工作台，提供类似桌面端的工具栏体验、结构化章节导航，以及内置 AI 审稿能力。</p>
<h2>产品概述</h2>
<p>核心目标是帮助团队快速沉淀规范化内容：支持片段库复用、分级样式套用，并保持移动端与桌面端的一致排版。当前版本适配桌面端体验，后续将接入多人协作与注释。</p>
<h2>核心流程设计</h2>
<p>1）从模版中心选择场景文档；2）根据提示区补充空白字段；3）通过左侧大纲快速跳转章节；4）使用右侧 AI 区检查术语统一、风险提示与风格。</p>
<h3>交互节点</h3>
<ul>
  <li>顶部工具栏：快捷字号、样式、对齐与撤销。</li>
  <li>智能浮层：选中文本后显示操作建议。</li>
  <li>状态栏：展示自动保存、字数与版本。</li>
</ul>
<h2>文案与风格基准</h2>
<p>建议使用“友好、简洁、可执行”的语气，避免模糊描述。字段示例：{{产品名称}}, {{受众}}, {{上线季度}}。</p>
<blockquote>引用示例：保持功能描述与约束同时出现，避免仅写收益。</blockquote>
<h2>质检清单</h2>
<ul>
  <li>每个标题下至少包含 2 段正文或列表。</li>
  <li>模板名、产品名、渠道名需校对一致。</li>
  <li>检查是否给出撤销或回退路径。</li>
</ul>
`;

export default function SmartEditor({ title, subtitle }) {
  const [activeSectionId, setActiveSectionId] = useState(outlineSections[0].id);
  const [previewMode, setPreviewMode] = useState(false);
  const [aiLog, setAiLog] = useState([]);
  const [statusMessage, setStatusMessage] = useState("已自动保存至云端");

  const editor = useEditor(
    {
      editable: true,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4] },
          history: { depth: 100 },
        }),
        Underline,
        Highlight,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Placeholder.configure({
          placeholder: "和示例工程一样的交互：点击左侧大纲跳转，右侧 AI 给出增补建议…",
        }),
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class: "smart-editor__tiptap",
        },
      },
      onSelectionUpdate: ({ editor: instance }) => {
        const { from } = instance.state.selection;
        let currentSection = outlineSections[0].id;

        instance.state.doc.descendants((node, pos) => {
          if (node.type.name === "heading" && node.attrs.level <= 2) {
            if (pos <= from) {
              const target = outlineSections.find((section) =>
                node.textContent.trim().startsWith(section.title),
              );
              if (target) {
                currentSection = target.id;
              }
            }
          }
        });

        setActiveSectionId(currentSection);
      },
    },
    [],
  );

  useEffect(() => {
    if (editor) {
      editor.setEditable(!previewMode);
    }
  }, [editor, previewMode]);

  const jumpToSection = (sectionId) => {
    if (!editor) return;
    const sectionMeta = outlineSections.find((section) => section.id === sectionId);
    if (!sectionMeta) return;

    let targetPos = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading" && node.textContent.startsWith(sectionMeta.title)) {
        targetPos = pos + node.nodeSize;
        return false;
      }
      return true;
    });

    editor.chain().focus().setTextSelection(targetPos).run();
    setActiveSectionId(sectionId);
  };

  const applySuggestion = (suggestion) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`\n${suggestion.preview}\n`).run();
    setAiLog((prev) => [
      { id: `${suggestion.id}-${Date.now()}`, title: suggestion.title, preview: suggestion.preview },
      ...prev,
    ]);
    setStatusMessage("AI 已插入建议，记得校对上下文");
  };

  const applyBubbleAction = (action) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const selectedText = editor.state.doc.textBetween(from, to, " ").trim();
    if (!selectedText) return;

    const replacement = action.buildText(selectedText);
    editor.chain().focus().insertContentAt({ from, to }, replacement).run();
    setAiLog((prev) => [
      { id: `${action.id}-${Date.now()}`, title: action.title, preview: replacement },
      ...prev,
    ]);
    setStatusMessage(`已通过气泡操作「${action.title}」更新正文`);
  };

  const handleToolbarAction = (item) => {
    if (!editor) return;
    item.action(editor);
  };

  const computedWordCount = useMemo(() => {
    if (!editor) return 0;
    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, " ");
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [editor?.state?.doc]);

  return (
    <div className="smart-editor">
      <div className="smart-editor__header">
        <div>
          <p className="smart-editor__eyebrow">{subtitle}</p>
          <h1 className="smart-editor__title">{title}</h1>
          <p className="smart-editor__desc">
            交互和 SmartEditor 示例一致：三栏布局、工具栏操作、章节跳转与 AI 增补。
          </p>
        </div>
        <div className="smart-editor__header-actions">
          <label className="smart-editor__toggle">
            <input
              type="checkbox"
              checked={previewMode}
              onChange={(event) => setPreviewMode(event.target.checked)}
            />
            <span>{previewMode ? "预览模式" : "编辑模式"}</span>
          </label>
          <button type="button" className="smart-editor__ghost">导出 PDF</button>
          <button type="button" className="smart-editor__primary">发布更新</button>
        </div>
      </div>

      <div className="smart-editor__layout">
        <aside className="smart-editor__sidebar">
          <div className="smart-editor__panel">
            <div className="smart-editor__panel-header">
              <span>章节导航</span>
              <span className="smart-editor__badge">实时同步</span>
            </div>
            <div className="smart-editor__outline">
              {outlineSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => jumpToSection(section.id)}
                  className={clsx("smart-editor__outline-item", {
                    "smart-editor__outline-item--active": activeSectionId === section.id,
                  })}
                >
                  <div className="smart-editor__outline-top">
                    <span>{section.title}</span>
                    <span className="smart-editor__badge smart-editor__badge--muted">
                      {section.badge}
                    </span>
                  </div>
                  <p className="smart-editor__outline-summary">{section.summary}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="smart-editor__panel smart-editor__panel--muted">
            <div className="smart-editor__panel-header">
              <span>模版片段</span>
              <span className="smart-editor__badge smart-editor__badge--outline">快捷插入</span>
            </div>
            <ul className="smart-editor__snippet-list">
              <li>版本声明 · 适用于低风险发布</li>
              <li>更新日志 · 强调可回退路径</li>
              <li>隐私合规 · 支持数据最小化表述</li>
            </ul>
          </div>
        </aside>

        <main className="smart-editor__main">
          <div className="smart-editor__toolbar">
            {toolbarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx("smart-editor__toolbar-btn", {
                  "smart-editor__toolbar-btn--active": editor && item.isActive(editor),
                })}
                onClick={() => handleToolbarAction(item)}
                disabled={!editor}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="smart-editor__editor-surface">
            {editor && (
              <BubbleMenu
                editor={editor}
                tippyOptions={{ duration: 120 }}
                className="smart-editor__bubble"
                shouldShow={({ editor: instance }) => !instance.state.selection.empty}
              >
                <div className="smart-editor__bubble-actions">
                  {bubbleActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="smart-editor__bubble-btn"
                      onClick={() => applyBubbleAction(action)}
                    >
                      <span className="smart-editor__bubble-title">{action.title}</span>
                      <span className="smart-editor__bubble-desc">{action.description}</span>
                      <span className="smart-editor__badge smart-editor__badge--muted">
                        {action.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </BubbleMenu>
            )}
            <EditorContent editor={editor} />
          </div>
          <div className="smart-editor__status-bar">
            <span>{statusMessage}</span>
            <span>字数：{computedWordCount}</span>
          </div>
        </main>

        <aside className="smart-editor__right">
          <div className="smart-editor__panel smart-editor__panel--muted">
            <div className="smart-editor__panel-header">
              <span>AI 审稿助手</span>
              <span className="smart-editor__badge">Beta</span>
            </div>
            <p className="smart-editor__hint">
              参考 Vue 版交互：阅读建议、点击插入到正文，再在正文中微调。
            </p>
            <div className="smart-editor__suggestions">
              {aiSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="smart-editor__suggestion-card">
                  <div className="smart-editor__suggestion-top">
                    <div>
                      <p className="smart-editor__suggestion-title">{suggestion.title}</p>
                      <p className="smart-editor__suggestion-desc">{suggestion.description}</p>
                    </div>
                    <button
                      type="button"
                      className="smart-editor__ghost"
                      onClick={() => applySuggestion(suggestion)}
                    >
                      插入
                    </button>
                  </div>
                  <p className="smart-editor__suggestion-preview">{suggestion.preview}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="smart-editor__panel">
            <div className="smart-editor__panel-header">
              <span>AI 插入记录</span>
              <span className="smart-editor__badge smart-editor__badge--outline">
                {aiLog.length} 条
              </span>
            </div>
            {aiLog.length === 0 ? (
              <p className="smart-editor__empty">还没有插入记录，试着在上方添加一条建议。</p>
            ) : (
              <ul className="smart-editor__log">
                {aiLog.map((item) => (
                  <li key={item.id}>
                    <p className="smart-editor__log-title">{item.title}</p>
                    <p className="smart-editor__log-preview">{item.preview}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
