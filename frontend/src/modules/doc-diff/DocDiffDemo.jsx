import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import clsx from "clsx";

import DiffMarker from "./extensions/DiffMarker";

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
  DiffMarker,
];

const emptyPlaceholder =
  "请上传两份 .docx 文件，我们会将其转换为可阅读的格式并展示差异。";

const DIFF_TYPE_LABEL = {
  insert: "新增",
  delete: "删除",
  replace: "修改",
};

const DIFF_FILTERS = [
  { key: "all", label: "全部" },
  { key: "insert", label: "新增" },
  { key: "replace", label: "修改" },
  { key: "delete", label: "删除" },
];

const MAX_PREVIEW_LENGTH = 60;

function createPreviewSegments(value) {
  if (!value) return [];

  const units = Array.from(value);
  const truncated =
    units.length > MAX_PREVIEW_LENGTH
      ? [...units.slice(0, MAX_PREVIEW_LENGTH - 1), "…"]
      : units;

  return truncated.map((char) => {
    if (char === " ") {
      return { text: "␠", title: "空格" };
    }
    if (char === "\n") {
      return { text: "⏎", title: "换行符" };
    }
    if (char === "\t") {
      return { text: "⇥", title: "制表符" };
    }
    if (char === "…") {
      return { text: "…", title: "内容已截断" };
    }
    return { text: char };
  });
}

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
  const [diffItems, setDiffItems] = useState([]);
  const [diffFilter, setDiffFilter] = useState("all");
  const [selectedDiffId, setSelectedDiffId] = useState("");
  const [stats, setStats] = useState(null);
  const [originalNotes, setOriginalNotes] = useState([]);
  const [modifiedNotes, setModifiedNotes] = useState([]);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState("");

  const originalEditor = useReadonlyEditor(originalHtml);
  const modifiedEditor = useReadonlyEditor(modifiedHtml);

  useEffect(() => {
    if (!originalFile || !modifiedFile) {
      setDiffItems([]);
      setSelectedDiffId("");
      setDiffFilter("all");
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
    setDiffItems([]);
    setSelectedDiffId("");
    setDiffFilter("all");
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
    setDiffItems([]);
    setSelectedDiffId("");
    setDiffFilter("all");
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
      setDiffItems(payload.diff_items ?? []);
      setDiffFilter("all");
      setSelectedDiffId("");
      setStats(payload.stats ?? null);
      setOriginalNotes(payload.original_notes ?? []);
      setModifiedNotes(payload.modified_notes ?? []);
    } catch (err) {
      setError(err.message || "对比失败，请稍后重试。");
      setDiffItems([]);
      setSelectedDiffId("");
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

  const diffCounts = useMemo(() => {
    const counts = {
      all: diffItems.length,
      insert: 0,
      replace: 0,
      delete: 0,
    };
    diffItems.forEach((item) => {
      counts[item.type] += 1;
    });
    return counts;
  }, [diffItems]);

  const filteredDiffItems = useMemo(() => {
    if (diffFilter === "all") return diffItems;
    return diffItems.filter((item) => item.type === diffFilter);
  }, [diffItems, diffFilter]);

  const scrollToEditorMarker = useCallback((editor, diffId) => {
    const viewDom = editor?.view?.dom;
    if (!viewDom) return false;
    const target = viewDom.querySelector(`[data-diff-id="${diffId}"]`);
    if (!target) return false;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }, []);

  const handleDiffItemClick = useCallback(
    (item) => {
      setSelectedDiffId(item.id);
      const scrollers = [];
      if (item.type !== "insert") {
        scrollers.push(() => scrollToEditorMarker(originalEditor, item.id));
      }
      if (item.type !== "delete") {
        scrollers.push(() => scrollToEditorMarker(modifiedEditor, item.id));
      }
      scrollers.some((fn) => fn());
    },
    [modifiedEditor, originalEditor, scrollToEditorMarker]
  );

  const handleDiffItemKeyDown = useCallback(
    (event, item) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleDiffItemClick(item);
      }
    },
    [handleDiffItemClick]
  );

  const handleJump = useCallback(
    (event, item, target) => {
      event.stopPropagation();
      setSelectedDiffId(item.id);
      if (target === "original") {
        scrollToEditorMarker(originalEditor, item.id);
      } else {
        scrollToEditorMarker(modifiedEditor, item.id);
      }
    },
    [modifiedEditor, originalEditor, scrollToEditorMarker]
  );

  useEffect(() => {
    const toggleActive = (root) => {
      if (!root) return;
      const markers = root.querySelectorAll("[data-diff-id]");
      markers.forEach((marker) => {
        if (marker.dataset.diffId === selectedDiffId) {
          marker.classList.add("diff-marker--active");
        } else {
          marker.classList.remove("diff-marker--active");
        }
      });
    };

    toggleActive(originalEditor?.view?.dom);
    toggleActive(modifiedEditor?.view?.dom);
  }, [selectedDiffId, originalEditor, modifiedEditor]);

  const renderDiffText = useCallback((value) => {
    const segments = createPreviewSegments(value);
    if (!segments.length) {
      return (
        <span className="doc-diff__diff-text doc-diff__diff-text--empty">
          （空）
        </span>
      );
    }
    return (
      <span className="doc-diff__diff-text" title={value}>
        {segments.map((segment, index) => (
          <span
            key={`${segment.text}-${index}`}
            className={clsx("doc-diff__diff-char", {
              "doc-diff__diff-char--symbol": Boolean(segment.title),
            })}
            title={segment.title || undefined}
          >
            {segment.text}
          </span>
        ))}
      </span>
    );
  }, []);

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
        <div className="doc-diff__layout">
          <div className="doc-diff__main">
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

          </div>

          <aside className="doc-diff__sidebar">
            <header className="doc-diff__sidebar-header">
              <span>差异列表</span>
              <span className="doc-diff__sidebar-count">{diffItems.length}</span>
            </header>
            <div className="doc-diff__filters">
              {DIFF_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={clsx("doc-diff__filter", {
                    "doc-diff__filter--active": diffFilter === filter.key,
                  })}
                  onClick={() => setDiffFilter(filter.key)}
                  disabled={!diffCounts[filter.key]}
                >
                  {filter.label}
                  <span className="doc-diff__filter-count">
                    {diffCounts[filter.key] ?? 0}
                  </span>
                </button>
              ))}
            </div>
            <div className="doc-diff__diff-list-wrapper">
              {filteredDiffItems.length ? (
                <ul className="doc-diff__diff-list">
                  {filteredDiffItems.map((item, index) => (
                    <li
                      key={item.id}
                      className={clsx("doc-diff__diff-item", {
                        "doc-diff__diff-item--active": selectedDiffId === item.id,
                      })}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="doc-diff__diff-item-main"
                        onClick={() => handleDiffItemClick(item)}
                        onKeyDown={(event) => handleDiffItemKeyDown(event, item)}
                        aria-pressed={selectedDiffId === item.id}
                      >
                        <div className="doc-diff__diff-item-header">
                          <span
                            className={clsx(
                              "doc-diff__diff-item-type",
                              `doc-diff__diff-item-type--${item.type}`
                            )}
                          >
                            {DIFF_TYPE_LABEL[item.type]}
                          </span>
                          <span className="doc-diff__diff-item-index">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="doc-diff__diff-item-body">
                          {item.type === "replace" ? (
                            <div className="doc-diff__diff-item-text-group">
                              <div className="doc-diff__diff-item-line" aria-label="原文">
                                <span className="doc-diff__diff-item-badge">原</span>
                                {renderDiffText(item.original_text)}
                              </div>
                              <div
                                className="doc-diff__diff-item-line doc-diff__diff-item-line--new"
                                aria-label="对比稿"
                              >
                                <span className="doc-diff__diff-item-badge doc-diff__diff-item-badge--new">
                                  新
                                </span>
                                {renderDiffText(item.modified_text)}
                              </div>
                            </div>
                          ) : (
                            <div className="doc-diff__diff-item-text-single">
                              {renderDiffText(
                                item.type === "insert"
                                  ? item.modified_text
                                  : item.original_text
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="doc-diff__diff-item-actions">
                        {item.type !== "insert" && (
                          <button
                            type="button"
                            className="doc-diff__diff-item-action"
                            onClick={(event) => handleJump(event, item, "original")}
                          >
                            原稿
                          </button>
                        )}
                        {item.type !== "delete" && (
                          <button
                            type="button"
                            className="doc-diff__diff-item-action"
                            onClick={(event) => handleJump(event, item, "modified")}
                          >
                            对比稿
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="doc-diff__empty-diff-list">
                  {diffItems.length
                    ? "当前分类下暂无差异。"
                    : "生成对比后，差异会以列表形式展示在这里。"}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
