# Word 合同预览 Demo

该示例提供了一个基于 **FastAPI** 的后端与 **React + Tiptap** 的前端应用，用于上传 Word (.docx) 合同并在网页上以接近 Word 原稿的排版展示正文内容。

## 功能概览

- 支持 `.docx` 文件上传，使用 [mammoth](https://github.com/mwilliamson/mammoth.js) 将 Word 转换为 HTML。
- 前端通过 Tiptap 呈现内容，针对合同场景优化标题、段落、列表、表格等样式。
- 仅展示正文内容，不处理页眉、页脚、批注、修订等信息。

## 快速开始

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows 使用 .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

默认前端开发服务器运行在 `http://localhost:5173`，后端接口运行在 `http://localhost:8000`。

如需自定义后端地址，可在前端根目录创建 `.env` 文件并设置：

```
VITE_API_BASE_URL=http://your-api-host:8000
```

启动后上传 Word 合同文件即可在页面中预览正文内容，查看标题层级、段落排版、列表、多级编号及表格等常规格式。

### 使用 Docker（集成 OnlyOffice 在线编辑）

```bash
cd docker
docker compose up --build
```

- 前端：<http://localhost:5173>
- 后端 API：<http://localhost:8001>
- OnlyOffice Document Server：<http://localhost:8085>

Docker 方案会自动启动 OnlyOffice 文档服务，上传 Word/Excel/PPT 文件即可在页面中以精简 UI 模式进行在线编辑。
