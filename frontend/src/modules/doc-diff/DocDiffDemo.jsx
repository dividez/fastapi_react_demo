import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import clsx from "clsx";

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

const emptyPlaceholder =
  "请上传两份 .docx 文件，我们会将其转换为可阅读的格式并展示差异。";

function useReadonlyEditor(content) {
  const editor = useEditor({
    editable: false,
    extensions: editorExtensions,
    content,
    parseOptions: {
      preserveWhitespace: "full",
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(content, false, {
      preserveWhitespace: "full",
    });
    editor.commands.scrollIntoView();
  }, [editor, content]);

  return editor;
}

export default function DocDiffDemo({ title, subtitle, apiBaseUrl }) {
  const [originalFile, setOriginalFile] = useState(null);
  const [modifiedFile, setModifiedFile] = useState(null);
  const [originalHtml, setOriginalHtml] = useState(`<p>${emptyPlaceholder}</p>`);
  const [modifiedHtml, setModifiedHtml] = useState(`<p>${emptyPlaceholder}</p>`);
  const [diffHtml, setDiffHtml] = useState("<p>待生成差异视图。</p>");
  const [stats, setStats] = useState(null);
  const [originalNotes, setOriginalNotes] = useState([]);
  const [modifiedNotes, setModifiedNotes] = useState([]);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState("");

  const originalEditor = useReadonlyEditor(originalHtml);
  const modifiedEditor = useReadonlyEditor(modifiedHtml);

  useEffect(() => {
    if (!originalFile || !modifiedFile) {
      setDiffHtml("<p>待生成差异视图。</p>");
      setStats(null);
    }
  }, [originalFile, modifiedFile]);

  const disableCompare = useMemo(
    () => !originalFile || !modifiedFile || isComparing,
    [originalFile, modifiedFile, isComparing]
  );

  const handleOriginalChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setOriginalFile(file);
    setOriginalHtml(`<p>原始文档：${file.name}，请继续上传对比文档。</p>`);
    setOriginalNotes([]);
    setStats(null);
    setDiffHtml("<p>待生成差异视图。</p>");
    setError("");
    event.target.value = "";
  };

  const handleModifiedChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setModifiedFile(file);
    setModifiedHtml(`<p>对比文档：${file.name}，点击生成对比。</p>`);
    setModifiedNotes([]);
    setStats(null);
    setDiffHtml("<p>待生成差异视图。</p>");
    setError("");
    event.target.value = "";
  };

  const handleCompare = async () => {
    if (!originalFile || !modifiedFile) {
      setError("请先选择两份 Word 文件。");
      return;
    }

    setError("");
    setIsComparing(true);

    try {
      const formData = new FormData();
      formData.append("original", originalFile);
      formData.append("modified", modifiedFile);

      const response = await fetch(`${apiBaseUrl}/diff`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ detail: "对比失败" }));
        throw new Error(payload.detail || "对比失败");
      }

      const payload = await response.json();
      setOriginalHtml(payload.original_html || `<p>${emptyPlaceholder}</p>`);
      setModifiedHtml(payload.modified_html || `<p>${emptyPlaceholder}</p>`);
      setDiffHtml(payload.diff_html || "<p>未检测到差异。</p>");
      setStats(payload.stats ?? null);
      setOriginalNotes(payload.original_notes ?? []);
      setModifiedNotes(payload.modified_notes ?? []);
    } catch (err) {
      setError(err.message || "对比失败，请稍后重试。");
    } finally {
      setIsComparing(false);
    }
  };

  const renderNotes = (notes, prefix) => {
    if (!notes?.length) return null;
    return (
      <div className="banner banner--info">
        {prefix}
        <ul>
          {notes.map((note, index) => (
            <li key={`${note.message}-${index}`}>{note.message}</li>
          ))}
        </ul>
      </div>
    );
  };

  const statsSummary = useMemo(() => {
    if (!stats) return "";
    const parts = [];
    if (stats.inserted_tokens) {
      parts.push(`新增 ${stats.inserted_tokens} 处内容`);
    }
    if (stats.deleted_tokens) {
      parts.push(`删除 ${stats.deleted_tokens} 处内容`);
    }
    if (stats.replaced_tokens) {
      parts.push(`替换 ${stats.replaced_tokens} 处内容`);
    }
    return parts.length ? parts.join("，") : "未检测到差异";
  }, [stats]);

  return (
    <>
      <header className="page__header">
        <div>
          <h1>{title}</h1>
          <p className="page__subtitle">{subtitle}</p>
        </div>
        <div className="doc-diff__actions">
          <label className="upload-button">
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleOriginalChange}
              disabled={isComparing}
            />
            {originalFile ? `原始文档：${originalFile.name}` : "上传原始文档"}
          </label>
          <label className="upload-button">
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleModifiedChange}
              disabled={isComparing}
            />
            {modifiedFile ? `对比文档：${modifiedFile.name}` : "上传对比文档"}
          </label>
          <button
            type="button"
            className={clsx("doc-diff__compare-button", {
              "doc-diff__compare-button--disabled": disableCompare,
            })}
            onClick={handleCompare}
            disabled={disableCompare}
          >
            {isComparing ? "生成中..." : "生成对比"}
          </button>
        </div>
      </header>

      {error && <div className="banner banner--error">{error}</div>}
      {renderNotes(originalNotes, "原始文档提示：")}
      {renderNotes(modifiedNotes, "对比文档提示：")}

      <main className="page__content doc-diff">
        <section className="doc-diff__panes">
          <div className="doc-diff__pane">
            <div className="doc-diff__pane-header">原始文档</div>
            <div className="paper-shadow">
              <EditorContent
                editor={originalEditor}
                className={clsx("contract-sheet", {
                  "contract-sheet--loading": isComparing && !originalHtml,
                })}
              />
            </div>
          </div>
          <div className="doc-diff__pane">
            <div className="doc-diff__pane-header">
              修改稿
              {statsSummary && (
                <span className="doc-diff__pane-meta">{statsSummary}</span>
              )}
            </div>
            <div className="paper-shadow">
              <EditorContent
                editor={modifiedEditor}
                className={clsx("contract-sheet", {
                  "contract-sheet--loading": isComparing && !modifiedHtml,
                })}
              />
            </div>
          </div>
        </section>

        <section className="doc-diff__result">
          <header className="doc-diff__result-header">差异高亮</header>
          <div
            className={clsx("doc-diff__diff-html", {
              "doc-diff__diff-html--loading": isComparing,
            })}
            dangerouslySetInnerHTML={{ __html: diffHtml }}
          />
        </section>
      </main>
    </>
  );
}
