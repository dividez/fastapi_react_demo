import { useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, TextStyle } from '@tiptap/extension-text-style'
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
  "上传 .docx 合同后即可编辑，支持导出 Word、PDF、JSON 格式。";

const EXPORT_FORMATS = [
  { id: "docx", label: "导出 Word" },
  { id: "pdf", label: "导出 PDF" },
  { id: "json", label: "导出 JSON" },
];

export default function ContractEditor({ title, subtitle, apiBaseUrl }) {
  const [html, setHtml] = useState(`<p>${initialPlaceholder}</p>`);
  const [fileName, setFileName] = useState("合同导入编辑");
  const [isLoading, setIsLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [notes, setNotes] = useState([]);
  const [hasImported, setHasImported] = useState(false);

  const editor = useEditor({
    editable: true,
    extensions: editorExtensions,
    content: html,
    parseOptions: {
      preserveWhitespace: "full",
    },
    onUpdate({ editor: instance }) {
      setHtml(instance.getHTML());
    },
  });

  const tiptapClassName = useMemo(
    () =>
      clsx("contract-sheet", "contract-sheet--editable", {
        "contract-sheet--loading": isLoading || Boolean(exportingFormat),
      }),
    [isLoading, exportingFormat]
  );

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setExportingFormat("");
    setError("");
    setStatusMessage("");

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
          .catch(() => ({ detail: "导入失败" }));
        throw new Error(payload.detail || "导入失败");
      }

      const payload = await response.json();
      const nextHtml = payload.html || "<p>未能读取到正文内容。</p>";
      setNotes(payload.notes ?? []);
      setFileName(file.name.replace(/\.[^.]+$/, "") || "合同导入编辑");
      setStatusMessage("文档已导入，可直接编辑。");
      setHasImported(true);

      if (editor) {
        editor.commands.setContent(nextHtml, false, {
          preserveWhitespace: "full",
        });
        editor.commands.focus("end");
      }
      setHtml(nextHtml);
    } catch (err) {
      setError(err.message || "上传失败，请稍后再试。");
      setStatusMessage("");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  };

  const handleExport = async (format) => {
    if (!editor) return;

    setError("");
    setStatusMessage("");
    setExportingFormat(format);

    try {
      const response = await fetch(`${apiBaseUrl}/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format,
          content: editor.getHTML(),
          filename: fileName,
        }),
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ detail: "导出失败" }));
        throw new Error(payload.detail || "导出失败");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i);
      const fallbackName =
        format === "docx"
          ? `${fileName || "合同导入编辑"}.docx`
          : `${fileName || "合同导入编辑"}.${format}`;
      let downloadName = fallbackName;
      if (match) {
        const rawName = match[1].replace(/"/g, "");
        try {
          downloadName = decodeURIComponent(rawName);
        } catch (err) {
          console.warn("Failed to decode filename", err);
          downloadName = rawName;
        }
      }

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);

      setStatusMessage(`已成功导出 ${downloadName}`);
    } catch (err) {
      setError(err.message || "导出失败，请稍后再试。");
    } finally {
      setExportingFormat("");
    }
  };

  const isBusy = isLoading || Boolean(exportingFormat);

  return (
    <>
      <header className="page__header">
        <div>
          <h1>{title}</h1>
          <p className="page__subtitle">{subtitle}</p>
          {hasImported && fileName && (
            <p className="contract-editor__meta">当前文档：{fileName}</p>
          )}
        </div>
        <div className="contract-editor__actions">
          <label className="upload-button">
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleUpload}
              disabled={isBusy}
            />
            {isLoading ? "导入中..." : "导入 Word"}
          </label>
          {EXPORT_FORMATS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="export-button"
              onClick={() => handleExport(item.id)}
              disabled={!editor || isBusy}
            >
              {exportingFormat === item.id ? "导出中..." : item.label}
            </button>
          ))}
        </div>
      </header>

      {error && <div className="banner banner--error">{error}</div>}
      {statusMessage && !error && (
        <div className="banner banner--success">{statusMessage}</div>
      )}
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
