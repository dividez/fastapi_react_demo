import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import clsx from "clsx";

import "./ai-editor.css";

const initialContent = `
  <h1>智能合同写作助手</h1>
  <p>在这里体验接近 Word 的编辑体验，选中句子后即可调用 AI 进行改写、扩写或生成新内容。</p>
  <h2>功能示例</h2>
  <p>1. 选中条款后点击“改写”按钮，可生成更正式或更精简的表达。</p>
  <p>2. 使用“扩写”功能，为合同条款补充背景说明与细节。</p>
  <p>3. 通过“生成”快速创作新的条款草稿，再自行调整语气。</p>
  <h2>常用条款</h2>
  <h3>保密义务</h3>
  <p>双方应对在合作中获知的商业秘密予以严格保密，未经另一方书面许可不得向任何第三方披露。</p>
  <h3>违约责任</h3>
  <p>若一方违反本协议的关键义务，应在收到通知之日起十个工作日内采取补救措施并承担因此产生的损失。</p>
`;

const AI_ACTIONS = [
  { id: "generate", label: "划句生成", description: "基于选中语句生成新的表述" },
  { id: "rewrite", label: "划句改写", description: "保持含义，优化措辞和语气" },
  { id: "expand", label: "划句扩写", description: "补充细节与背景说明" },
];

const toolbarItems = [
  { id: "heading-1", label: "标题1", action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: (editor) => editor.isActive("heading", { level: 1 }) },
  { id: "heading-2", label: "标题2", action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: (editor) => editor.isActive("heading", { level: 2 }) },
  { id: "heading-3", label: "标题3", action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: (editor) => editor.isActive("heading", { level: 3 }) },
  { id: "bold", label: "加粗", action: (editor) => editor.chain().focus().toggleBold().run(), isActive: (editor) => editor.isActive("bold") },
  { id: "italic", label: "倾斜", action: (editor) => editor.chain().focus().toggleItalic().run(), isActive: (editor) => editor.isActive("italic") },
  { id: "underline", label: "下划线", action: (editor) => editor.chain().focus().toggleUnderline().run(), isActive: (editor) => editor.isActive("underline") },
  { id: "bullet-list", label: "项目符号", action: (editor) => editor.chain().focus().toggleBulletList().run(), isActive: (editor) => editor.isActive("bulletList") },
  { id: "ordered-list", label: "编号", action: (editor) => editor.chain().focus().toggleOrderedList().run(), isActive: (editor) => editor.isActive("orderedList") },
  { id: "blockquote", label: "引用", action: (editor) => editor.chain().focus().toggleBlockquote().run(), isActive: (editor) => editor.isActive("blockquote") },
  { id: "align-left", label: "居左", action: (editor) => editor.chain().focus().setTextAlign("left").run(), isActive: (editor) => editor.isActive({ textAlign: "left" }) },
  { id: "align-center", label: "居中", action: (editor) => editor.chain().focus().setTextAlign("center").run(), isActive: (editor) => editor.isActive({ textAlign: "center" }) },
  { id: "align-right", label: "居右", action: (editor) => editor.chain().focus().setTextAlign("right").run(), isActive: (editor) => editor.isActive({ textAlign: "right" }) },
  { id: "undo", label: "撤销", action: (editor) => editor.chain().focus().undo().run(), isActive: () => false },
  { id: "redo", label: "重做", action: (editor) => editor.chain().focus().redo().run(), isActive: () => false },
];

const parseEventData = (event) => {
  try {
    return JSON.parse(event.data ?? "{}") || {};
  } catch (error) {
    console.warn("Failed to parse SSE payload", error);
    return {};
  }
};

export default function AiEditor({ title, subtitle, apiBaseUrl }) {
  const [selectedText, setSelectedText] = useState("");
  const [aiRequests, setAiRequests] = useState([]);
  const [activeRequestId, setActiveRequestId] = useState("");
  const eventSourceRef = useRef({ source: null, requestId: null });

  const endpointBase = useMemo(() => {
    if (!apiBaseUrl) return "";
    return apiBaseUrl.replace(/\/$/, "");
  }, [apiBaseUrl]);

  const closeEventSource = () => {
    if (eventSourceRef.current?.source) {
      eventSourceRef.current.source.onerror = null;
      eventSourceRef.current.source.close();
    }
    eventSourceRef.current = { source: null, requestId: null };
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        history: { depth: 100 },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder: "像在 Word 里一样输入内容，或选中句子尝试 AI 功能…",
      }),
    ],
    content: initialContent,
    onSelectionUpdate({ editor: instance }) {
      const { from, to } = instance.state.selection;
      const text = instance.state.doc.textBetween(from, to, " ");
      setSelectedText(text.trim());
    },
  });

  useEffect(() => {
    if (!editor) return undefined;

    const handleTransaction = () => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, " ");
      setSelectedText(text.trim());
    };

    editor.on("update", handleTransaction);

    return () => {
      editor.off("update", handleTransaction);
    };
  }, [editor]);

  useEffect(
    () => () => {
      closeEventSource();
    },
    []
  );

  const isAiBusy = useMemo(
    () =>
      aiRequests.some((item) =>
        ["loading", "streaming"].includes(item.status)
      ),
    [aiRequests]
  );

  const triggerAi = (actionId) => {
    if (!editor) return;
    closeEventSource();
    const selection = editor.state.selection;
    const text = editor.state.doc.textBetween(selection.from, selection.to, " ").trim();
    if (!text) {
      setAiRequests((prev) => [
        {
          id: `${Date.now()}-${actionId}`,
          action: actionId,
          input: "",
          status: "idle",
          result: "请选择一段文本后再试。",
          range: { from: selection.from, to: selection.to },
          error: null,
          meta: null,
        },
        ...prev,
      ]);
      return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newRequest = {
      id: requestId,
      action: actionId,
      input: text,
      status: "loading",
      result: "",
      range: { from: selection.from, to: selection.to },
      error: null,
      meta: null,
    };
    setAiRequests((prev) => [newRequest, ...prev]);
    setActiveRequestId(requestId);

    const params = new URLSearchParams({
      action: actionId,
      text,
      request_id: requestId,
    });
    const endpoint = endpointBase
      ? `${endpointBase}/ai/editor/stream`
      : "/ai/editor/stream";
    const url = `${endpoint}?${params.toString()}`;

    if (typeof window === "undefined" || typeof window.EventSource === "undefined") {
      setAiRequests((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: "error",
                error: "当前环境不支持实时生成。",
                result: "当前环境不支持实时生成。",
              }
            : item
        )
      );
      return;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = { source: eventSource, requestId };

    eventSource.addEventListener("start", (event) => {
      const payload = parseEventData(event);
      setAiRequests((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: "streaming",
                meta: payload,
                result: "",
                error: null,
              }
            : item
        )
      );
    });

    eventSource.addEventListener("chunk", (event) => {
      const payload = parseEventData(event);
      if (!payload?.content) return;
      setAiRequests((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: "streaming",
                result: `${item.result ?? ""}${payload.content}`,
                error: null,
              }
            : item
        )
      );
    });

    const handleDone = (event) => {
      const payload = parseEventData(event);
      setAiRequests((prev) =>
        prev.map((item) => {
          if (item.id !== requestId) {
            return item;
          }
          if (payload?.status === "empty") {
            return {
              ...item,
              status: "idle",
              result: payload?.message ?? "请选择一段文本后再试。",
              error: null,
            };
          }
          if (payload?.error) {
            return {
              ...item,
              status: "error",
              result: payload.error,
              error: payload.error,
            };
          }
          return {
            ...item,
            status: "done",
            result: payload?.result ?? item.result,
            error: null,
          };
        })
      );
      closeEventSource();
    };

    eventSource.addEventListener("done", handleDone);

    const handleError = () => {
      if (eventSourceRef.current?.requestId !== requestId) {
        return;
      }
      setAiRequests((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: "error",
                error: "AI 连接中断，请重试。",
                result: item.result || "AI 连接中断，请重试。",
              }
            : item
        )
      );
      closeEventSource();
    };

    eventSource.addEventListener("error", handleError);
    eventSource.onerror = handleError;
  };

  const applySuggestion = (request) => {
    if (!editor || !request || !request.result) return;
    editor
      .chain()
      .focus()
      .insertContentAt(request.range, request.result)
      .run();
  };

  const activeRequest = useMemo(
    () => aiRequests.find((item) => item.id === activeRequestId) ?? aiRequests[0] ?? null,
    [aiRequests, activeRequestId]
  );

  return (
    <>
      <header className="page__header">
        <div>
          <h1>{title}</h1>
          <p className="page__subtitle">{subtitle}</p>
        </div>
      </header>

      <div className="ai-editor">
        <div className="ai-editor__ribbon">
          <div className="ai-editor__toolbar">
            {toolbarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={clsx("ai-editor__toolbar-button", {
                  "ai-editor__toolbar-button--active": editor && item.isActive(editor),
                })}
                onClick={() => item.action(editor)}
                disabled={!editor}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="ai-editor__selection-info">
            <span>
              当前选中：
              {selectedText ? `「${selectedText}」` : "请选择句子以调用 AI"}
            </span>
          </div>
        </div>

        <div className="ai-editor__workspace">
          <div className="ai-editor__canvas">
            <EditorContent editor={editor} className="ai-editor__content" />
          </div>
          <aside className="ai-editor__assistant">
            <div className="ai-editor__assistant-header">
              <h3>AI 智能助手</h3>
              <p>仿 Word 侧边任务窗，针对选中文本给出建议。</p>
            </div>
            <div className="ai-editor__assistant-actions">
              {AI_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="ai-editor__assistant-button"
                  onClick={() => triggerAi(action.id)}
                  disabled={!editor || isAiBusy}
                >
                  <span className="ai-editor__assistant-button-title">{action.label}</span>
                  <span className="ai-editor__assistant-button-desc">{action.description}</span>
                </button>
              ))}
            </div>

            <div className="ai-editor__assistant-result">
              {activeRequest ? (
                <>
                  <div className="ai-editor__assistant-meta">
                    <span className="ai-editor__assistant-tag">
                      {AI_ACTIONS.find((item) => item.id === activeRequest.action)?.label || "AI"}
                    </span>
                    <span className="ai-editor__assistant-input">
                      {activeRequest.input ? `基于「${activeRequest.input}」的建议` : "请选择文本"}
                    </span>
                  </div>
                  <div className="ai-editor__assistant-output">
                    {activeRequest.status === "error" ? (
                      <span className="ai-editor__assistant-error">
                        {activeRequest.result || "AI 生成失败，请重试。"}
                      </span>
                    ) : ["loading", "streaming"].includes(activeRequest.status) && !activeRequest.result ? (
                      <span className="ai-editor__assistant-loading">正在生成建议…</span>
                    ) : (
                      <p
                        className={clsx({
                          "ai-editor__assistant-streaming": activeRequest.status === "streaming",
                        })}
                      >
                        {activeRequest.result || "等待生成结果…"}
                      </p>
                    )}
                  </div>
                  <div className="ai-editor__assistant-footer">
                    <button
                      type="button"
                      className="ai-editor__apply"
                      disabled={activeRequest.status !== "done"}
                      onClick={() => applySuggestion(activeRequest)}
                    >
                      应用到文档
                    </button>
                  </div>
                </>
              ) : (
                <p className="ai-editor__assistant-placeholder">
                  选择段落后点击上方按钮即可生成 AI 建议。
                </p>
              )}
            </div>

            {aiRequests.length > 1 && (
              <div className="ai-editor__history">
                <h4>历史建议</h4>
                <ul>
                  {aiRequests.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setActiveRequestId(item.id)}
                        className={clsx("ai-editor__history-item", {
                          "ai-editor__history-item--active": activeRequest && activeRequest.id === item.id,
                        })}
                      >
                        <span>{AI_ACTIONS.find((action) => action.id === item.action)?.label ?? "AI"}</span>
                        <span className="ai-editor__history-text">
                          {item.input ? item.input.slice(0, 24) : "未选择文本"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
