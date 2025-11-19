const buildUrl = (base, path) => {
  const trimmedBase = (base || "").replace(/\/$/, "");
  return trimmedBase ? `${trimmedBase}${path}` : path;
};

export async function fetchMockDocument(apiBaseUrl) {
  const response = await fetch(buildUrl(apiBaseUrl, "/ai/editor/mock_document"));
  if (!response.ok) {
    throw new Error(`获取 Mock 合同失败：${response.status}`);
  }
  return response.json();
}

export async function saveMockDocument(apiBaseUrl, payload) {
  const response = await fetch(buildUrl(apiBaseUrl, "/ai/editor/mock_document"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`保存 Mock 合同失败：${response.status}`);
  }

  return response.json();
}

export async function exportMockDocument(apiBaseUrl, payload) {
  const response = await fetch(buildUrl(apiBaseUrl, "/ai/editor/export"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`导出失败：${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const filename = decodeURIComponent(match?.[1] || match?.[2] || payload.filename || "ai-contract.html");

  return { blob, filename };
}
