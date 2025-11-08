import { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
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

const initialPlaceholder =
  "上传 .docx 合同文件后即可在下方预览。页面会尽力还原 Word 的排版与格式。";

export default function WordPreview({ title, subtitle, apiBaseUrl }) {
  const [html, setHtml] = useState(`<p>${initialPlaceholder}</p>`);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState([]);

  const editor = useEditor({
    editable: false,
    extensions: editorExtensions,
    content: html,
    parseOptions: {
      preserveWhitespace: "full",
    },
  });

  useEffect(() => {
    if (editor && html) {
      editor.commands.setContent(html, false, {
        preserveWhitespace: "full",
      });
      editor.commands.scrollIntoView();
    }
  }, [editor, html]);

  const tiptapClassName = useMemo(
    () =>
      clsx("contract-sheet", {
        "contract-sheet--loading": isLoading,
      }),
    [isLoading]
  );

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiBaseUrl}/convert`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ detail: "转换失败" }));
        throw new Error(payload.detail || "转换失败");
      }

      const payload = await response.json();
      setHtml(payload.html || "<p>未能读取到正文内容。</p>");
      setNotes(payload.notes ?? []);
    } catch (err) {
      setError(err.message || "上传失败，请稍后再试。");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  };

  return (
    <>
      <header className="page__header">
        <div>
          <h1>{title}</h1>
          <p className="page__subtitle">{subtitle}</p>
        </div>
        <label className="upload-button">
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleUpload}
            disabled={isLoading}
          />
          {isLoading ? "处理中..." : "导入 Word"}
        </label>
      </header>

      {error && <div className="banner banner--error">{error}</div>}
      {notes.length > 0 && !error && (
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
        <div className="paper-shadow">
          <EditorContent editor={editor} className={tiptapClassName} />
        </div>
      </main>
    </>
  );
}
