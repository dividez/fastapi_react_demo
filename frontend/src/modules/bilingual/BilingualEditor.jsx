import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { BILINGUAL_MOCK_SEGMENTS } from "./mockSegments";

export default function BilingualEditor({ title, subtitle }) {
  const [bilingualFileName, setBilingualFileName] = useState("");
  const [bilingualSegments, setBilingualSegments] = useState([]);
  const [bilingualTranslations, setBilingualTranslations] = useState([]);
  const [bilingualOperations, setBilingualOperations] = useState([]);
  const [bilingualHoverId, setBilingualHoverId] = useState(null);
  const [isBilingualTranslating, setIsBilingualTranslating] = useState(false);

  const sourceColumnRef = useRef(null);
  const targetColumnRef = useRef(null);
  const syncLockRef = useRef(false);

  const bilingualStatusMap = useMemo(() => {
    const statusMap = new Map();
    bilingualSegments.forEach((segment) => {
      if (!statusMap.has(segment.alignId)) {
        statusMap.set(segment.alignId, {
          replaced: false,
          insertedCount: 0,
        });
      }
      const current = statusMap.get(segment.alignId);
      if (segment.status === "replaced") {
        current.replaced = true;
      }
      if (segment.status === "inserted") {
        current.insertedCount += 1;
      }
    });
    return statusMap;
  }, [bilingualSegments]);

  useEffect(() => {
    if (!bilingualFileName) return;
    const left = sourceColumnRef.current;
    const right = targetColumnRef.current;
    if (!left || !right) return;

    const handleSync = (source, target) => {
      if (syncLockRef.current) {
        syncLockRef.current = false;
        return;
      }
      syncLockRef.current = true;
      const ratio =
        source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight);
      const nextTop = ratio * (target.scrollHeight - target.clientHeight);
      requestAnimationFrame(() => {
        target.scrollTop = nextTop;
      });
    };

    const handleLeftScroll = () => handleSync(left, right);
    const handleRightScroll = () => handleSync(right, left);

    left.addEventListener("scroll", handleLeftScroll);
    right.addEventListener("scroll", handleRightScroll);

    return () => {
      left.removeEventListener("scroll", handleLeftScroll);
      right.removeEventListener("scroll", handleRightScroll);
    };
  }, [bilingualFileName, bilingualSegments.length]);

  const handleBilingualUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBilingualFileName(file.name);
    setIsBilingualTranslating(true);
    setBilingualOperations([]);
    setBilingualTranslations([]);
    const mappedSegments = BILINGUAL_MOCK_SEGMENTS.map((segment) => ({
      ...segment,
      alignId: segment.id,
      currentHtml: segment.sourceHtml,
      status: "original",
    }));
    setBilingualSegments(mappedSegments);
    setBilingualHoverId(null);

    window.setTimeout(() => {
      setBilingualTranslations(BILINGUAL_MOCK_SEGMENTS);
      setIsBilingualTranslating(false);
    }, 1600);

    event.target.value = "";
  };

  const formatOperationLabel = (operation) => {
    const base = BILINGUAL_MOCK_SEGMENTS.find(
      (item) => item.id === operation.alignId
    );
    const titleText = base
      ? base.sourceHtml.replace(/<[^>]+>/g, "").slice(0, 24)
      : operation.alignId;
    if (operation.type === "replace") {
      return `已将段落替换为译文｜${titleText}`;
    }
    return `已在下方插入译文｜${titleText}`;
  };

  const handleApplyTranslation = (alignId, action) => {
    const translationSegment = BILINGUAL_MOCK_SEGMENTS.find(
      (segment) => segment.id === alignId
    );
    if (!translationSegment) return;

    if (action === "replace") {
      setBilingualSegments((prev) =>
        prev.map((segment) => {
          if (segment.alignId !== alignId || segment.status === "inserted") {
            return segment;
          }
          return {
            ...segment,
            currentHtml: translationSegment.translationHtml,
            status: "replaced",
          };
        })
      );
    }

    if (action === "insert") {
      setBilingualSegments((prev) => {
        const next = [...prev];
        let insertionIndex = -1;
        next.forEach((segment, index) => {
          if (segment.alignId === alignId) {
            insertionIndex = index;
          }
        });
        if (insertionIndex === -1) {
          insertionIndex = next.length - 1;
        }
        const insertedSegment = {
          id: `${alignId}-inserted-${Date.now()}`,
          alignId,
          currentHtml: translationSegment.translationHtml,
          status: "inserted",
        };
        next.splice(insertionIndex + 1, 0, insertedSegment);
        return next;
      });
    }

    setBilingualOperations((prev) => [
      {
        id: `${alignId}-${action}-${Date.now()}`,
        alignId,
        type: action,
        timestamp: new Date(),
      },
      ...prev,
    ]);
  };

  const renderBilingualPlaceholder = () => (
    <section className="module-placeholder">
      <h2>导入 Word 合同，体验双栏对照</h2>
      <p>
        请选择一份 .docx 格式的合同，我们将模拟提取原文并生成译文。示例数据涵盖多级标题、
        自增编号、表格、加粗/斜体等典型格式。
      </p>
      <ul>
        <li>左侧保持接近 Word 的排版；右侧展示翻译进度与结果。</li>
        <li>鼠标悬停任一段落时，自动联动高亮对应译文。</li>
        <li>点击“替换原文”或“插入译文”即可模拟生成中英双语稿。</li>
      </ul>
    </section>
  );

  const renderBilingualEditor = () => {
    if (!bilingualFileName) {
      return renderBilingualPlaceholder();
    }

    return (
      <section className="bilingual-editor">
        <header className="bilingual-editor__header">
          <div>
            <div className="bilingual-editor__filename">{bilingualFileName}</div>
            <div className="bilingual-editor__hint">
              双栏滚动联动，可在译文栏应用替换或插入操作。
            </div>
          </div>
          <div
            className={clsx("bilingual-editor__status", {
              "bilingual-editor__status--processing": isBilingualTranslating,
              "bilingual-editor__status--ready": !isBilingualTranslating,
            })}
          >
            {isBilingualTranslating ? "AI 正在翻译合同内容…" : "译文已生成，可继续审阅。"}
          </div>
        </header>

        <div className="bilingual-editor__columns">
          <div className="bilingual-column">
            <div className="bilingual-column__title">原文预览</div>
            <div className="bilingual-column__body" ref={sourceColumnRef}>
              {bilingualSegments.map((segment) => (
                <article
                  key={segment.id}
                  className={clsx("bilingual-segment", {
                    "bilingual-segment--active":
                      bilingualHoverId === segment.alignId,
                    "bilingual-segment--inserted": segment.status === "inserted",
                    "bilingual-segment--replaced": segment.status === "replaced",
                  })}
                  onMouseEnter={() => setBilingualHoverId(segment.alignId)}
                  onMouseLeave={() => setBilingualHoverId(null)}
                >
                  {segment.status !== "original" && (
                    <span
                      className={clsx("bilingual-segment__badge", {
                        "bilingual-segment__badge--inserted":
                          segment.status === "inserted",
                        "bilingual-segment__badge--replaced":
                          segment.status === "replaced",
                      })}
                    >
                      {segment.status === "inserted" ? "已插入译文" : "已替换译文"}
                    </span>
                  )}
                  <div
                    className="bilingual-richtext"
                    dangerouslySetInnerHTML={{ __html: segment.currentHtml }}
                  />
                </article>
              ))}
            </div>
          </div>

          <div className="bilingual-column bilingual-column--right">
            <div className="bilingual-column__title">AI 译文建议</div>
            <div className="bilingual-column__body" ref={targetColumnRef}>
              {isBilingualTranslating && (
                <div className="bilingual-translation-loading">
                  <span className="spinner" /> 正在生成译文示例…
                </div>
              )}
              {!isBilingualTranslating &&
                bilingualTranslations.map((segment) => {
                  const status = bilingualStatusMap.get(segment.id) || {
                    replaced: false,
                    insertedCount: 0,
                  };
                  const disabledReplace = status.replaced;
                  const disabledInsert = status.insertedCount >= 2;

                  return (
                    <article
                      key={segment.id}
                      className={clsx("bilingual-card", {
                        "bilingual-card--active":
                          bilingualHoverId === segment.id,
                        "bilingual-card--replaced": status.replaced,
                      })}
                      onMouseEnter={() => setBilingualHoverId(segment.id)}
                      onMouseLeave={() => setBilingualHoverId(null)}
                    >
                      <div className="bilingual-card__header">
                        <span>对齐段落</span>
                        <span className="bilingual-card__status">
                          {status.replaced
                            ? "已替换"
                            : status.insertedCount > 0
                            ? `已插入 ${status.insertedCount} 次`
                            : "待处理"}
                        </span>
                      </div>
                      <div
                        className="bilingual-richtext"
                        dangerouslySetInnerHTML={{
                          __html: segment.translationHtml,
                        }}
                      />
                      <div className="bilingual-card__actions">
                        <button
                          type="button"
                          onClick={() => handleApplyTranslation(segment.id, "replace")}
                          disabled={disabledReplace}
                        >
                          替换原文
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApplyTranslation(segment.id, "insert")}
                          disabled={disabledInsert}
                        >
                          插入译文
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
          </div>
        </div>

        {bilingualOperations.length > 0 && (
          <aside className="bilingual-operations">
            <div className="bilingual-operations__title">最新操作记录</div>
            <ul>
              {bilingualOperations.map((operation) => (
                <li key={operation.id}>
                  <span>{formatOperationLabel(operation)}</span>
                  <time>
                    {operation.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </section>
    );
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
            onChange={handleBilingualUpload}
            disabled={isBilingualTranslating}
          />
          {isBilingualTranslating ? "处理中..." : "导入合同"}
        </label>
      </header>

      <main className="page__content">{renderBilingualEditor()}</main>
    </>
  );
}
