import { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import clsx from "clsx";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const MODULES = [
  {
    id: "word-preview",
    name: "Word 导入预览",
    subtitle: "支持 Word (.docx) 上传，自动转换为接近原稿的排版，仅展示正文内容。",
    status: "ready",
  },
  {
    id: "bilingual-editor",
    name: "中英对照编辑器",
    subtitle: "规划中：基于 TipTap 的中英文句子对齐与译文应用体验。",
    status: "planned",
    highlights: [
      "句子对齐展示：左右两栏按 segid 一一对应显示，便于快速比对。",
      "Hover 联动高亮：鼠标悬停中文句，自动高亮右侧对应英文。",
      "译文操作：支持替换原句或在下方插入英文段落，生成中英对照文档。",
      "错误防护：封装 TipTap 生命周期，避免视图未就绪时的报错。",
    ],
  },
  {
    id: "doc-diff",
    name: "文档对比编辑器",
    subtitle: "规划中：原稿与修改稿并排对比，可视化展示差异并选择接受。",
    status: "planned",
    highlights: [
      "双栏展示：左侧原始文档，右侧 AI / 修改版本，保持滚动同步。",
      "差异高亮：插入、删除、修改分别使用不同标记直观呈现。",
      "审校操作：逐段接受或拒绝修改，实时回传 FastAPI 后端。",
      "版本管理：与后端联动生成版本历史，支持回滚与复核记录。",
    ],
  },
];

const editorExtensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3, 4, 5, 6],
    },
  }),
  TextStyle,
  Link.configure({
    openOnClick: true,
    validate: (href) => /^https?:\/\//i.test(href),
  }),
];

const initialPlaceholder =
  "上传 .docx 合同文件后即可在下方预览。页面会尽力还原 Word 的排版与格式，并支持后续细节编辑。";

function ToolbarButton({ active, disabled, label, onClick }) {
  return (
    <button
      type="button"
      className={clsx("toolbar-button", { "toolbar-button--active": active })}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function EditorToolbar({ editor, disabled }) {
  if (!editor) {
    return null;
  }

  const groups = [
    {
      label: "样式",
      items: [
        {
          label: "正文",
          isActive: () => editor.isActive("paragraph"),
          handler: () => editor.chain().focus().setParagraph().run(),
        },
        {
          label: "标题 1",
          isActive: () => editor.isActive("heading", { level: 1 }),
          handler: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          label: "标题 2",
          isActive: () => editor.isActive("heading", { level: 2 }),
          handler: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: "标题 3",
          isActive: () => editor.isActive("heading", { level: 3 }),
          handler: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
      ],
    },
    {
      label: "强调",
      items: [
        {
          label: "加粗",
          isActive: () => editor.isActive("bold"),
          handler: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: "斜体",
          isActive: () => editor.isActive("italic"),
          handler: () => editor.chain().focus().toggleItalic().run(),
        },
      ],
    },
    {
      label: "列表",
      items: [
        {
          label: "编号列表",
          isActive: () => editor.isActive("orderedList"),
          handler: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          label: "项目符号",
          isActive: () => editor.isActive("bulletList"),
          handler: () => editor.chain().focus().toggleBulletList().run(),
        },
      ],
    },
  ];

  return (
    <div className="editor-toolbar" aria-label="编辑工具栏">
      {groups.map((group) => (
        <div key={group.label} className="editor-toolbar__group">
          <span className="editor-toolbar__label">{group.label}</span>
          <div className="editor-toolbar__actions">
            {group.items.map((item) => (
              <ToolbarButton
                key={item.label}
                label={item.label}
                active={item.isActive()}
                disabled={disabled}
                onClick={item.handler}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [html, setHtml] = useState("<p>" + initialPlaceholder + "</p>");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState([]);
  const [activeModule, setActiveModule] = useState(MODULES[0].id);
  const [isEditable, setIsEditable] = useState(false);

  const activeModuleMeta = useMemo(
    () => MODULES.find((module) => module.id === activeModule) ?? MODULES[0],
    [activeModule]
  );

  const isWordPreview = activeModuleMeta.id === "word-preview";

  const editor = useEditor({
    editable: isEditable,
    extensions: editorExtensions,
    content: html,
    parseOptions: {
      preserveWhitespace: "full",
    },
    onUpdate: ({ editor: currentEditor }) => {
      const content = currentEditor.getHTML();
      setHtml(content);
    },
  });

  useEffect(() => {
    if (!editor || !html) return;
    if (editor.getHTML() === html) return;

    editor.commands.setContent(html, false, {
      preserveWhitespace: "full",
    });
    editor.commands.scrollIntoView();
  }, [editor, html]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditable);
  }, [editor, isEditable]);

  const handleToggleEdit = useCallback(() => {
    setIsEditable((prev) => {
      const next = !prev;
      if (editor) {
        editor.setEditable(next);
        if (next) {
          editor.commands.focus("end");
        } else {
          editor.commands.blur();
        }
      }
      return next;
    });
  }, [editor]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/convert`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ detail: "转换失败" }));
        throw new Error(payload.detail || "转换失败");
      }

      const payload = await response.json();
      const nextHtml = payload.html || "<p>未能读取到正文内容。</p>";
      setHtml(nextHtml);
      if (editor) {
        editor.commands.setContent(nextHtml, false, {
          preserveWhitespace: "full",
        });
        editor.commands.focus("start");
      }
      setNotes(payload.notes ?? []);
    } catch (err) {
      setError(err.message || "上传失败，请稍后再试。");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  };

  const tiptapClassName = useMemo(
    () =>
      clsx("contract-sheet", {
        "contract-sheet--loading": isLoading,
      }),
    [isLoading]
  );

  return (
    <div className="page">
      <div className="page__layout">
        <aside className="module-menu">
          <div className="module-menu__header">
            <h2>功能模块</h2>
            <p>切换不同的合同编辑与审校工具。</p>
          </div>
          <nav className="module-menu__list">
            {MODULES.map((module) => {
              const isActive = module.id === activeModuleMeta.id;
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setActiveModule(module.id)}
                  className={clsx("module-menu__item", {
                    "module-menu__item--active": isActive,
                    "module-menu__item--planned": module.status === "planned",
                  })}
                >
                  <span className="module-menu__item-title">{module.name}</span>
                  {module.status === "planned" && (
                    <span className="module-menu__item-badge">规划中</span>
                  )}
                  <span className="module-menu__item-subtitle">{module.subtitle}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="page__main">
          <header className="page__header">
            <div>
              <h1>{activeModuleMeta.name}</h1>
              <p className="page__subtitle">{activeModuleMeta.subtitle}</p>
            </div>
            {isWordPreview ? (
              <div className="page__actions">
                <button
                  type="button"
                  className={clsx("edit-toggle", { "edit-toggle--active": isEditable })}
                  onClick={handleToggleEdit}
                >
                  {isEditable ? "退出编辑" : "开启编辑"}
                </button>
                <label className="upload-button">
                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleUpload}
                    disabled={isLoading}
                  />
                  {isLoading ? "处理中..." : "导入 Word"}
                </label>
              </div>
            ) : (
              <div className="module-status">功能设计中，欢迎关注更新。</div>
            )}
          </header>

          {isWordPreview && error && <div className="banner banner--error">{error}</div>}
          {isWordPreview && notes.length > 0 && !error && (
            <div className="banner banner--info">
              转换提示：
              <ul>
                {notes.map((message, index) => (
                  <li key={`${message.message}-${index}`}>{message.message}</li>
                ))}
              </ul>
            </div>
          )}

          <main className="page__content">
            {isWordPreview ? (
              <div className="paper-shadow">
                <EditorToolbar editor={editor} disabled={!isEditable} />
                <EditorContent editor={editor} className={tiptapClassName} />
              </div>
            ) : (
              <section className="module-placeholder">
                <h2>核心能力预告</h2>
                <p>以下特性正在规划与设计中：</p>
                <ul>
                  {(activeModuleMeta.highlights ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
