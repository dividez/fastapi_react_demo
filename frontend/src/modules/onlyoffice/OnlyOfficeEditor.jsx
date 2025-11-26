import { useEffect, useId, useMemo, useRef, useState } from "react";
import "./onlyoffice.css";

const loadedScripts = new Map();

function loadOnlyOfficeScript(documentServerUrl) {
  const trimmed = documentServerUrl.replace(/\/$/, "");
  const scriptUrl = `${trimmed}/web-apps/apps/api/documents/api.js`;

  if (loadedScripts.get(scriptUrl) === "ready") {
    return Promise.resolve();
  }

  const existing = loadedScripts.get(scriptUrl);
  if (existing instanceof Promise) {
    return existing;
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      loadedScripts.set(scriptUrl, "ready");
      resolve();
    };
    script.onerror = () => {
      loadedScripts.delete(scriptUrl);
      reject(new Error("无法加载 OnlyOffice 前端脚本"));
    };
    document.body.appendChild(script);
  });

  loadedScripts.set(scriptUrl, promise);
  return promise;
}

function EditorPlaceholder() {
  return (
    <div className="onlyoffice-empty">
      <div className="onlyoffice-empty__title">上传 Office 文件以开始编辑</div>
      <div className="onlyoffice-empty__tips">
        <span>支持 Word / Excel / PPT，编辑界面已隐藏与业务无关的菜单。</span>
        <span>上传后会自动加载 OnlyOffice 文档服务并在下方 iframe 展示。</span>
      </div>
    </div>
  );
}

export default function OnlyOfficeEditor({ title, subtitle, apiBaseUrl }) {
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [documentServerUrl, setDocumentServerUrl] = useState("");
  const [editorConfig, setEditorConfig] = useState(null);
  const editorInstanceRef = useRef(null);
  const containerId = useId().replace(":", "-");

  const uploadAccept = useMemo(
    () =>
      [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        ".doc",
        ".docx",
        ".pptx",
        ".xlsx",
      ].join(","),
    []
  );

  useEffect(() => {
    let isCancelled = false;

    async function mountEditor() {
      if (!editorConfig || !documentServerUrl) return;

      setIsLoading(true);
      try {
        await loadOnlyOfficeScript(documentServerUrl);
        if (isCancelled) return;

        const DocsAPI = window.DocsAPI;
        if (!DocsAPI?.DocEditor) {
          throw new Error("OnlyOffice 文档脚本未准备就绪");
        }

        editorInstanceRef.current = new DocsAPI.DocEditor(containerId, {
          ...editorConfig,
          width: "100%",
          height: "100%",
        });
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "加载编辑器失败");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    mountEditor();

    return () => {
      isCancelled = true;
      if (editorInstanceRef.current?.destroyEditor) {
        editorInstanceRef.current.destroyEditor();
      }
    };
  }, [containerId, documentServerUrl, editorConfig]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiBaseUrl}/onlyoffice/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "上传失败，请稍后重试");
      }

      const payload = await response.json();
      setEditorConfig(payload.config);
      setDocumentServerUrl(payload.documentServerUrl);
      setFileName(file.name);
    } catch (err) {
      setError(err.message || "上传失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="module-card">
      <header className="page__header">
        <div>
          <h1>{title}</h1>
          <p className="page__subtitle">{subtitle}</p>
          <p className="onlyoffice-hint">
            编辑器启用精简模式：隐藏聊天、反馈、帮助等与业务无关的入口，保留核心排版与协作功能。
          </p>
        </div>
        <div className="page__actions">
          <label className="upload-button">
            {fileName ? `重新上传（当前：${fileName}）` : "上传 Office 文件"}
            <input type="file" accept={uploadAccept} onChange={handleFileChange} disabled={isLoading} />
          </label>
        </div>
      </header>

      {error && <div className="banner banner--error">{error}</div>}

      <div className="onlyoffice-grid">
        <section className="onlyoffice-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">在线协同编辑</div>
              <div className="panel-subtitle">
                文件上传后将通过 OnlyOffice Document Server 渲染，编辑结果通过回调写回后端存储。
              </div>
            </div>
            <div className="pill pill--soft">
              {isLoading
                ? "正在加载编辑器..."
                : editorConfig
                ? "可编辑"
                : "等待上传"}
            </div>
          </div>

          <div className="onlyoffice-editor-box">
            {editorConfig ? <div id={containerId} className="onlyoffice-editor" /> : <EditorPlaceholder />}
          </div>
        </section>

        <section className="onlyoffice-panel onlyoffice-panel--stacked">
          <div className="panel-header">
            <div>
              <div className="panel-title">接入说明</div>
              <div className="panel-subtitle">
                通过后端提供的配置接口生成最小化 UI 的 DocEditor 配置，Iframe 中只保留与正文相关的操作。
              </div>
            </div>
            {documentServerUrl && <div className="pill">Document Server: {documentServerUrl}</div>}
          </div>

          <ul className="onlyoffice-list">
            <li>支持 Word/Excel/PPT，上传后自动返回编辑配置与回调地址。</li>
            <li>隐藏聊天、反馈、帮助等入口，启用紧凑头部与工具栏，减少干扰。</li>
            <li>回调接口接收保存状态，当 OnlyOffice 完成保存时写回最新文件内容。</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
