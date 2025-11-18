import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import clsx from "clsx";
import { PlaceholderMark } from "./extensions/placeholderMark";

import "./ai-editor.css";

const contractMarkdown = `# 房屋租赁合同

# 合同主体  
出租方：{{出租方名称|text|}}  
承租方：{{承租方名称|text|}}

## 一、租赁房屋  
1.房屋地址：{{房屋地址|text|}}  
2.建筑面积：{{建筑面积|text|}}平方米  
3.房产证编号：{{房产证编号|text|}}  
4.房屋用途：居住  

## 二、租赁期限  
5.租赁期限为1年  
6.起租日：{{起租年份|text|}}年{{起租月份|text|}}月{{起租日|text|}}日  
7.到期日：{{到期年份|text|}}年{{到期月份|text|}}月{{到期日|text|}}日  

## 三、租金标准  
8.每月租金：{{月租金金额|text|}}元（含税）  
9.租金支付方式：季付  
10.首期租金支付时间：签约后3日内支付  

## 四、押金条款  
11.押金金额：1个月租金，计与月租金等额元  

## 五、费用承担  
12.出租方承担：房产税  
13.承租方承担：水电费  

## 六、房屋维护  
14.日常维修由承租方负责  
15.大修由出租方承担  

## 七、转租条款  
16.禁止转租  

## 八、续约条件  
17.租期届满前1个月提出书面申请  

## 九、违约责任  
18.逾期付款违约金：日0.05%  
19.其他违约情形：{{其他违约情形|text|}}  

## 十、合同解除  
20.无责解约权：{{无责解约权|text|}}  
21.其他解除条件：{{其他解除条件|text|}}  

## 十一、附件  
22.附件1 房屋交接清单  
23.附件2 房屋权属证明文件  

## 十二、签署条款  
24.本合同自双方签字盖章之日起生效  

# 附件1 房屋交接清单  

## 一、房屋现状确认  
1.房屋现状：{{房屋现状描述|text|}}  

## 二、设备设施清单  
2.设备设施清单：{{设备设施清单|text|}}  

## 三、钥匙交接记录  
3.钥匙交接记录：{{钥匙交接记录|text|}}  

## 四、水电表读数记录  
4.水电表读数记录：  
   - 水表读数：{{水表读数|text|}}  
   - 电表读数：{{电表读数|text|}}  

# 附件2 房屋权属证明文件  

## 一、房产证复印件  
1.房产证复印件：{{房产证复印件|text|}}  

## 二、出租方身份证明文件  
2.出租方身份证明文件：{{出租方身份证明文件|text|}}`;

const AI_ACTIONS = [
  { id: "generate", label: "划句生成", description: "基于选中语句生成新的表述" },
  { id: "rewrite", label: "划句改写", description: "保持含义，优化措辞和语气" },
  { id: "expand", label: "划句扩写", description: "补充细节与背景说明" },
  { id: "custom", label: "自定义指令", description: "输入偏好：更正式、更偏甲方等" },
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
  const [selectedClause, setSelectedClause] = useState({ heading: "", text: "" });
  const [aiRequests, setAiRequests] = useState([]);
  const [activeRequestId, setActiveRequestId] = useState("");
  const [customInstruction, setCustomInstruction] = useState("更正式、条款编号自动衔接");
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

  const getClauseContext = (instance) => {
    const { doc, selection } = instance.state;
    const from = selection.from;
    let clauseStart = 0;
    let clauseEnd = doc.content.size;
    let currentHeading = { text: "", level: 1 };

    doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        if (pos <= from) {
          currentHeading = { text: node.textContent, level: node.attrs.level };
          clauseStart = pos;
          clauseEnd = doc.content.size;
        } else if (pos > from && node.attrs.level <= currentHeading.level && clauseEnd === doc.content.size) {
          clauseEnd = pos;
        }
      }
    });

    const clauseText = doc.textBetween(clauseStart, clauseEnd, "\n", "\n").trim();
    return { heading: currentHeading.text, text: clauseText };
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
      Markdown.configure({
        transformPastedText: true,
      }),
      PlaceholderMark,
    ],
    content: contractMarkdown,
    editorProps: {
      attributes: {
        class: "ai-editor__tiptap",
      },
    },
    onSelectionUpdate({ editor: instance }) {
      const { from, to } = instance.state.selection;
      const text = instance.state.doc.textBetween(from, to, " ");
      setSelectedText(text.trim());
      setSelectedClause(getClauseContext(instance));
    },
  });

  useEffect(() => {
    if (!editor) return undefined;

    setSelectedClause(getClauseContext(editor));

    const handleTransaction = () => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, " ");
      setSelectedText(text.trim());
      setSelectedClause(getClauseContext(editor));
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

  const triggerAi = (actionId, instructionValue) => {
    if (!editor) return;
    closeEventSource();
    const selection = editor.state.selection;
    const text = editor.state.doc.textBetween(selection.from, selection.to, " ").trim();
    const resolvedInstruction =
      typeof instructionValue === "string" && instructionValue.length
        ? instructionValue
        : customInstruction;
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
          meta: { clause: selectedClause, instruction: resolvedInstruction },
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
      meta: { clause: selectedClause, instruction: resolvedInstruction },
    };
    setAiRequests((prev) => [newRequest, ...prev]);
    setActiveRequestId(requestId);

    const params = new URLSearchParams({
      action: actionId,
      text,
      request_id: requestId,
      instruction: resolvedInstruction,
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
            meta: payload?.meta ?? item.meta,
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
            {selectedClause.text && (
              <span className="ai-editor__clause-info">
                所属条款：{selectedClause.heading || "未命名条款"}
              </span>
            )}
          </div>
        </div>

        <div className="ai-editor__workspace">
          <div className="ai-editor__canvas">
            {editor && (
              <BubbleMenu
                editor={editor}
                tippyOptions={{ duration: 100 }}
                className="ai-editor__bubble"
              >
                <div className="ai-editor__bubble-actions">
                  {AI_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="ai-editor__bubble-button"
                      onClick={() => triggerAi(action.id)}
                      disabled={
                        isAiBusy || (action.id === "custom" && !customInstruction.trim())
                      }
                    >
                      <span>{action.label}</span>
                      <small>{action.description}</small>
                    </button>
                  ))}
                </div>
                <div className="ai-editor__bubble-input">
                  <label htmlFor="bubbleInstruction">自定义指令</label>
                  <input
                    id="bubbleInstruction"
                    type="text"
                    value={customInstruction}
                    onChange={(event) => setCustomInstruction(event.target.value)}
                    placeholder="例：更正式、补充违约责任"
                  />
                  <button
                    type="button"
                    className="ai-editor__bubble-primary"
                    onClick={() => triggerAi("custom", customInstruction)}
                    disabled={!customInstruction.trim() || isAiBusy}
                  >
                    发送自定义指令
                  </button>
                </div>
              </BubbleMenu>
            )}
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
                  disabled={!editor || isAiBusy || (action.id === "custom" && !customInstruction.trim())}
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
                    {activeRequest?.meta?.clause?.text && (
                      <span className="ai-editor__assistant-clause">
                        条款范围：{activeRequest.meta.clause.heading || "未命名条款"}
                      </span>
                    )}
                    {activeRequest?.meta?.instruction && (
                      <span className="ai-editor__assistant-instruction">
                        指令：{activeRequest.meta.instruction}
                      </span>
                    )}
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
                    <div className="ai-editor__instruction">
                      <label htmlFor="instructionInput">自定义指令</label>
                      <textarea
                        id="instructionInput"
                        value={customInstruction}
                        onChange={(event) => setCustomInstruction(event.target.value)}
                        placeholder="更正式、更偏甲方视角、补充风险等"
                        rows={2}
                      />
                      <div className="ai-editor__instruction-actions">
                        <button
                          type="button"
                          className="ai-editor__assistant-button ai-editor__assistant-button--ghost"
                          onClick={() => triggerAi("custom")}
                          disabled={!editor || isAiBusy || !customInstruction.trim()}
                        >
                          发送自定义指令
                        </button>
                      </div>
                    </div>
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
