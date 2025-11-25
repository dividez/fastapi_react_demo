import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import Link from "@tiptap/extension-link";
import {TableKit} from "@tiptap/extension-table";
import clsx from "clsx";
import { BILINGUAL_MOCK_SEGMENTS } from "./mockSegments";
import { BILINGUAL_DOCUMENT_V2 } from "./mockSegmentsV2";
import { AlignmentMark, SentenceMark } from "./extensions/alignmentMark";

const editorExtensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3, 4, 5, 6],
    },
  }),
  TextStyle,
  Link.configure({
    openOnClick: false,
    validate: (href) => /^https?:\/\//i.test(href),
  }),
  TableKit.configure({
    resizable: true,
  }),
  AlignmentMark,
  SentenceMark,
];

function addAlignmentIds(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  let paragraphIndex = 0;
  let tagIndex = 0;
  
  const blockTags = ["P", "LI", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "SECTION", "ARTICLE"];
  const inlineTags = ["STRONG", "EM", "B", "I", "U", "A", "SPAN", "CODE", "MARK", "DEL", "INS", "SUB", "SUP"];
  const paragraphTags = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE"];
  const skipTags = ["SCRIPT", "STYLE", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH"];
  
  const processNode = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName;
      
      if (skipTags.includes(tagName)) {
        if (tagName === "TABLE") {
          const alignId = `para-${paragraphIndex++}`;
          node.setAttribute("data-align-id", alignId);
          node.setAttribute("data-align-type", "table");
        } else if (tagName === "OL" || tagName === "UL") {
          Array.from(node.children).forEach(processNode);
        }
        return;
      }
      
      if (paragraphTags.includes(tagName)) {
        const alignId = `para-${paragraphIndex++}`;
        node.setAttribute("data-align-id", alignId);
        node.setAttribute("data-align-type", "paragraph");
        
        if (blockTags.includes(tagName)) {
          const text = node.textContent.trim();
          if (text && !node.hasAttribute("data-tag-id")) {
            const tagId = `tag-${tagIndex++}`;
            node.setAttribute("data-tag-id", tagId);
            node.classList.add("bilingual-tag");
          }
        }
        
        const processInlineTags = (parentNode) => {
          const walker = document.createTreeWalker(
            parentNode,
            NodeFilter.SHOW_ELEMENT,
            {
              acceptNode: (n) => {
                if (skipTags.includes(n.tagName)) {
                  return NodeFilter.FILTER_REJECT;
                }
                if (inlineTags.includes(n.tagName) && !n.hasAttribute("data-tag-id")) {
                  return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
              }
            }
          );
          
          let inlineNode;
          while ((inlineNode = walker.nextNode())) {
            const text = inlineNode.textContent.trim();
            if (text) {
              const tagId = `tag-${tagIndex++}`;
              inlineNode.setAttribute("data-tag-id", tagId);
              inlineNode.classList.add("bilingual-tag");
            }
          }
        };
        
        processInlineTags(node);
      }
      
      Array.from(node.children).forEach(processNode);
    }
  };
  
  processNode(doc.body);
  return doc.body.innerHTML;
}

export default function EnhancedBilingualEditor({ title, subtitle }) {
  const [bilingualFileName, setBilingualFileName] = useState("");
  const [sourceHtml, setSourceHtml] = useState("");
  const [translationHtml, setTranslationHtml] = useState("");
  const [isBilingualTranslating, setIsBilingualTranslating] = useState(false);
  const [activeAlignId, setActiveAlignId] = useState(null);
  const [hoveredAlignId, setHoveredAlignId] = useState(null);

  const sourceColumnRef = useRef(null);
  const targetColumnRef = useRef(null);
  const syncLockRef = useRef(false);
  const sourceEditorRef = useRef(null);
  const targetEditorRef = useRef(null);

  const sourceEditor = useEditor({
    editable: false,
    extensions: editorExtensions,
    content: sourceHtml,
    parseOptions: {
      preserveWhitespace: "full",
    },
    editorProps: {
      attributes: {
        class: "bilingual-tiptap bilingual-tiptap--source",
      },
    },
    onSelectionUpdate({ editor: instance }) {
      const { from, to } = instance.state.selection;
      if (from === to) return;
      
      const alignId = findAlignIdAtPosition(instance, from);
      if (alignId) {
        setActiveAlignId(alignId);
        highlightAlignment(targetEditorRef.current, alignId);
      }
    },
  });

  const targetEditor = useEditor({
    editable: false,
    extensions: editorExtensions,
    content: translationHtml,
    parseOptions: {
      preserveWhitespace: "full",
    },
    editorProps: {
      attributes: {
        class: "bilingual-tiptap bilingual-tiptap--target",
      },
    },
    onSelectionUpdate({ editor: instance }) {
      const { from, to } = instance.state.selection;
      if (from === to) return;
      
      const alignId = findAlignIdAtPosition(instance, from);
      if (alignId) {
        setActiveAlignId(alignId);
        highlightAlignment(sourceEditorRef.current, alignId);
      }
    },
  });

  sourceEditorRef.current = sourceEditor;
  targetEditorRef.current = targetEditor;

  function findAlignIdAtPosition(editor, pos) {
    if (!editor) return null;
    
    const dom = editor.view.domAtPos(pos);
    if (!dom || !dom.node) return null;
    
    const element = dom.node.nodeType === Node.TEXT_NODE 
      ? dom.node.parentElement 
      : dom.node;
    
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
    
    const tagId = element.getAttribute("data-tag-id") ||
      element.closest("[data-tag-id]")?.getAttribute("data-tag-id");
    
    if (tagId) {
      return tagId;
    }
    
    const alignId = element.getAttribute("data-align-id") ||
      element.closest("[data-align-id]")?.getAttribute("data-align-id");
    
    return alignId;
  }

  function highlightAlignment(editor, alignId) {
    if (!editor || !alignId) return;
    
    const { view } = editor;
    
    view.dom.querySelectorAll(".bilingual-alignment--active, .bilingual-tag--active").forEach((el) => {
      el.classList.remove("bilingual-alignment--active", "bilingual-tag--active");
    });
    
    const isTagId = alignId.startsWith("tag-");
    
    if (isTagId) {
      view.dom.querySelectorAll(`[data-tag-id="${alignId}"]`).forEach((el) => {
        el.classList.add("bilingual-tag--active");
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        
        const parentParagraph = el.closest("[data-align-id]");
        if (parentParagraph) {
          parentParagraph.classList.add("bilingual-alignment--active");
          
          const tagName = parentParagraph.tagName;
          if (tagName === "LI") {
            const parentList = parentParagraph.closest("ol, ul");
            if (parentList) {
              parentList.classList.add("bilingual-alignment--active");
            }
          }
        }
      });
    } else {
      view.dom.querySelectorAll(`[data-align-id="${alignId}"]`).forEach((el) => {
        el.classList.add("bilingual-alignment--active");
        
        const tagName = el.tagName;
        if (tagName === "LI") {
          const parentList = el.closest("ol, ul");
          if (parentList) {
            parentList.classList.add("bilingual-alignment--active");
          }
        }
        
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  useEffect(() => {
    if (!sourceEditor || !sourceHtml) return;
    
    sourceEditor.commands.setContent(sourceHtml, false, {
      preserveWhitespace: "full",
    });
    
      setTimeout(() => {
        const dom = sourceEditor.view.dom;
        const tags = dom.querySelectorAll("[data-tag-id]");
        if (tags.length === 0 && sourceHtml.includes("data-tag-id")) {
          console.warn("Tag IDs not found in DOM after Tiptap parsing");
        }
      }, 100);
  }, [sourceEditor, sourceHtml]);

  useEffect(() => {
    if (!targetEditor || !translationHtml) return;
    
    targetEditor.commands.setContent(translationHtml, false, {
      preserveWhitespace: "full",
    });
    
      setTimeout(() => {
        const dom = targetEditor.view.dom;
        const tags = dom.querySelectorAll("[data-tag-id]");
        if (tags.length === 0 && translationHtml.includes("data-tag-id")) {
          console.warn("Tag IDs not found in DOM after Tiptap parsing");
        }
      }, 100);
  }, [targetEditor, translationHtml]);

  useEffect(() => {
    if (!sourceEditor || !targetEditor) return;
    
    const sourceView = sourceEditor.view.dom;
    const targetView = targetEditor.view.dom;
    let hoverTimeout = null;
    
    const clearHighlights = () => {
      sourceView.querySelectorAll(".bilingual-alignment--active, .bilingual-tag--active").forEach((el) => {
        el.classList.remove("bilingual-alignment--active", "bilingual-tag--active");
      });
      targetView.querySelectorAll(".bilingual-alignment--active, .bilingual-tag--active").forEach((el) => {
        el.classList.remove("bilingual-alignment--active", "bilingual-tag--active");
      });
    };
    
    const handleSourceMouseMove = (e) => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      
      const target = e.target;
      const tagElement = target.closest("[data-tag-id]");
      const alignElement = target.closest("[data-align-id]");
      
      let alignId = null;
      if (tagElement) {
        alignId = tagElement.getAttribute("data-tag-id");
      } else if (alignElement) {
        alignId = alignElement.getAttribute("data-align-id");
      }
      
      if (alignId && alignId !== hoveredAlignId) {
        setHoveredAlignId(alignId);
        clearHighlights();
        highlightAlignment(targetEditor, alignId);
        highlightAlignment(sourceEditor, alignId);
      } else if (!alignId) {
        hoverTimeout = setTimeout(() => {
          clearHighlights();
          setHoveredAlignId(null);
        }, 100);
      }
    };
    
    const handleSourceMouseLeave = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      clearHighlights();
      setHoveredAlignId(null);
    };
    
    const handleTargetMouseMove = (e) => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      
      const target = e.target;
      const tagElement = target.closest("[data-tag-id]");
      const alignElement = target.closest("[data-align-id]");
      
      let alignId = null;
      if (tagElement) {
        alignId = tagElement.getAttribute("data-tag-id");
      } else if (alignElement) {
        alignId = alignElement.getAttribute("data-align-id");
      }
      
      if (alignId && alignId !== hoveredAlignId) {
        setHoveredAlignId(alignId);
        clearHighlights();
        highlightAlignment(sourceEditor, alignId);
        highlightAlignment(targetEditor, alignId);
      } else if (!alignId) {
        hoverTimeout = setTimeout(() => {
          clearHighlights();
          setHoveredAlignId(null);
        }, 100);
      }
    };
    
    const handleTargetMouseLeave = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      clearHighlights();
      setHoveredAlignId(null);
    };
    
    sourceView.addEventListener("mousemove", handleSourceMouseMove);
    sourceView.addEventListener("mouseleave", handleSourceMouseLeave);
    targetView.addEventListener("mousemove", handleTargetMouseMove);
    targetView.addEventListener("mouseleave", handleTargetMouseLeave);
    
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      sourceView.removeEventListener("mousemove", handleSourceMouseMove);
      sourceView.removeEventListener("mouseleave", handleSourceMouseLeave);
      targetView.removeEventListener("mousemove", handleTargetMouseMove);
      targetView.removeEventListener("mouseleave", handleTargetMouseLeave);
    };
  }, [sourceEditor, targetEditor, hoveredAlignId]);

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
  }, [bilingualFileName, sourceHtml, translationHtml]);

  const handleBilingualUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBilingualFileName(file.name);
    setIsBilingualTranslating(true);
    
    const processedSource = addAlignmentIds(BILINGUAL_DOCUMENT_V2.sourceHtml);
    const processedTranslation = addAlignmentIds(BILINGUAL_DOCUMENT_V2.translationHtml);

    setSourceHtml(processedSource);
    setTranslationHtml("");

    window.setTimeout(() => {
      setTranslationHtml(processedTranslation);
      setIsBilingualTranslating(false);
    }, 1600);

    event.target.value = "";
  };

  const renderBilingualPlaceholder = () => (
    <section className="module-placeholder">
      <h2>导入 Word 合同，体验增强版双栏对照</h2>
      <p>
        请选择一份 .docx 格式的合同，我们将模拟提取原文并生成译文。新版本基于 Tiptap 编辑器，
        支持更精确的段落和句子级别联动。
      </p>
      <ul>
        <li>左侧显示原文，右侧显示译文，均使用 Tiptap 渲染。</li>
        <li>段落级别：悬停段落时显示浅色背景框，表示整个段落对应关系。</li>
        <li>句子级别：悬停句子或HTML标签对时，精确高亮对应的原文/译文部分。</li>
        <li>选中文本时，自动定位并高亮对应的译文部分。</li>
        <li>双栏滚动自动同步，保持阅读位置一致。</li>
      </ul>
    </section>
  );

  const renderBilingualEditor = () => {
    if (!bilingualFileName) {
      return renderBilingualPlaceholder();
    }

    return (
      <section className="bilingual-editor bilingual-editor--enhanced">
        <header className="bilingual-editor__header">
          <div>
            <div className="bilingual-editor__filename">{bilingualFileName}</div>
            <div className="bilingual-editor__hint">
              基于 Tiptap 的双栏对照，支持段落（浅色背景框）和句子/标签对级别的精确联动。
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
              {isBilingualTranslating && (
                <div className="bilingual-translation-loading">
                  <span className="spinner" /> 正在生成译文示例…
                </div>
              )}
              {sourceEditor && <EditorContent editor={sourceEditor} />}
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
              {targetEditor && <EditorContent editor={targetEditor} />}
            </div>
          </div>
        </div>
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

