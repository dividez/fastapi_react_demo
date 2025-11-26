import { useMemo, useState } from "react";
import clsx from "clsx";
import "./contract-desensitize.css";

const defaultPreview = "上传合同后，系统会扫描合同编号、主体身份、联系方式、地址、银行与税务信息等敏感字段。";

function downloadDocx(base64Content, filename) {
  const byteCharacters = atob(base64Content);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "合同脱敏.docx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildGroup(hits) {
  const grouped = new Map();
  hits.forEach((hit) => {
    const list = grouped.get(hit.category) ?? [];
    list.push(hit);
    grouped.set(hit.category, list);
  });
  return grouped;
}

export default function ContractDesensitize({ title, subtitle, apiBaseUrl }) {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(defaultPreview);

  const groupedHits = useMemo(() => buildGroup(result?.hits ?? []), [result]);

  const handleUpload = (event) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    setFile(nextFile);
    setResult(null);
    setPreview(`已选择 ${nextFile.name}，点击开始脱敏即可查看识别结果。`);
    setError("");
    event.target.value = "";
  };

  const handleSubmit = async () => {
    if (!file) {
      setError("请先选择要脱敏的 Word 文件（.doc 或 .docx）。");
      return;
    }

    setError("");
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiBaseUrl}/api/contract/desensitize`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ detail: "脱敏失败，请稍后再试" }));
        throw new Error(payload.detail || "脱敏失败");
      }

      const payload = await response.json();
      setResult(payload);
      setPreview(payload.sanitized_preview || defaultPreview);
    } catch (err) {
      setError(err.message || "脱敏失败，请稍后再试");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result?.sanitized_docx) return;
    downloadDocx(result.sanitized_docx, result.filename || "合同脱敏.docx");
  };

  return (
    <div className="module-card">
      <header className="page__header">
        <div>
          <h1>{title}</h1>
          <p className="page__subtitle">{subtitle}</p>
        </div>
        <div className="page__actions">
          <label className="upload-button">
            {file ? `已选择：${file.name}` : "上传合同（.doc/.docx）"}
            <input
              type="file"
              accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleUpload}
              disabled={isProcessing}
            />
          </label>
          <button
            type="button"
            className="export-button"
            onClick={handleSubmit}
            disabled={!file || isProcessing}
          >
            {isProcessing ? "正在脱敏..." : "开始脱敏"}
          </button>
          <button
            type="button"
            className="export-button"
            onClick={handleDownload}
            disabled={!result?.sanitized_docx}
          >
            下载脱敏合同
          </button>
        </div>
      </header>

      {error && <div className="banner banner--error">{error}</div>}

      <div className="desensitize-grid">
        <section className="desensitize-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">敏感信息识别</div>
              <div className="panel-subtitle">
                系统预置企业身份、联系方式、注册信息、项目标识等规则，自动提取可能泄露隐私的字段。
              </div>
            </div>
            <div className="pill">{result?.total_hits ?? 0} 处命中</div>
          </div>

          <div className="hit-list">
            {groupedHits.size === 0 && (
              <div className="empty">上传合同后将在此处展示识别到的敏感信息。</div>
            )}

            {[...groupedHits.entries()].map(([category, items]) => (
              <div key={category} className="hit-group">
                <div className="hit-group__title">{category}</div>
                <div className="hit-group__items">
                  {items.map((item) => (
                    <div key={`${item.field}-${item.value}`} className="hit-chip">
                      <div className="hit-chip__field">{item.field}</div>
                      <div className="hit-chip__value" title={item.value}>
                        {item.value}
                      </div>
                      <span className={clsx("hit-chip__count", { "hit-chip__count--warn": item.count > 1 })}>
                        ×{item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="desensitize-panel">
          <div className="panel-header">
            <div>
              <div className="panel-title">脱敏预览</div>
              <div className="panel-subtitle">
                下载的 .docx 文件基于 XML 逐项替换，尽可能保持原有排版与样式。
              </div>
            </div>
            <div className="pill pill--soft">{result ? "脱敏完成" : "等待上传"}</div>
          </div>

          <div className="preview-box">
            <div className="preview-text">{preview}</div>
            {result?.sanitized_docx && (
              <div className="preview-meta">
                <span>输出文件：{result.filename}</span>
                <span>识别字段：{result.total_hits}</span>
              </div>
            )}
          </div>

          <div className="tips-list">
            <div className="tip-item">
              <strong>覆盖字段：</strong>
              企业名称、法定代表人、统一社会信用代码、联系方式、地址、合同编号、项目名称、日期等。
            </div>
            <div className="tip-item">
              <strong>脱敏方式：</strong>
              依据 XML 文本替换并保持长度，便于后续人工核查和格式复原。
            </div>
            <div className="tip-item">
              <strong>使用建议：</strong>
              下载后再次人工复核，必要时补充自定义关键字或正则规则。
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
