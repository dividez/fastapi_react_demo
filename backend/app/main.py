from __future__ import annotations

import asyncio
import html
import io
import json
import re
import unicodedata
import uuid
from datetime import datetime
from collections import defaultdict
from enum import Enum
from typing import Annotated, AsyncGenerator, Literal
from urllib.parse import quote

import mammoth
from bs4 import BeautifulSoup
from bs4.element import NavigableString, Tag
from docx import Document
from docx.shared import Pt
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

app = FastAPI(title="Word to Tiptap Converter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STYLE_MAP = """
paragraph[style-name='Title'] => h1:fresh
paragraph[style-name='Heading 1'] => h1:fresh
paragraph[style-name='Heading 2'] => h2:fresh
paragraph[style-name='Heading 3'] => h3:fresh
paragraph[style-name='Heading 4'] => h4:fresh
paragraph[style-name='Heading 5'] => h5:fresh
paragraph[style-name='Heading 6'] => h6:fresh
r[style-name='Strong'] => strong
r[style-name='Emphasis'] => em
"""

SUPPORTED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",  # some browsers fallback
}


class ConversionNote(BaseModel):
    type: str
    message: str


class ConversionResponse(BaseModel):
    html: str
    notes: list[ConversionNote] = []


class DiffStats(BaseModel):
    inserted_tokens: int
    deleted_tokens: int
    replaced_tokens: int


class DiffLocation(BaseModel):
    section_title: str | None = None
    block_summary: str | None = None


class DiffItem(BaseModel):
    id: str
    type: Literal["insert", "delete", "replace"]
    original_text: str
    modified_text: str
    original_location: DiffLocation | None = None
    modified_location: DiffLocation | None = None


class DiffResponse(BaseModel):
    original_html: str
    modified_html: str
    diff_html: str
    stats: DiffStats
    diff_items: list[DiffItem] = []
    original_notes: list[ConversionNote] = []
    modified_notes: list[ConversionNote] = []


class ExportRequest(BaseModel):
    content: str
    format: Literal["docx", "pdf", "json"]
    filename: str | None = None


class AiEditorDocument(BaseModel):
    id: str
    title: str
    markdown: str
    updated_at: str


class AiEditorDocumentPayload(BaseModel):
    title: str
    markdown: str


class AiEditorExportRequest(BaseModel):
    html: str
    format: Literal["html", "docx", "pdf", "json"] = "html"
    filename: str | None = None


DIFF_TYPE_LABELS: dict[str, str] = {
    "insert": "新增",
    "delete": "删除",
    "replace": "修改",
}


class AiAction(str, Enum):
    GENERATE = "generate"
    REWRITE = "rewrite"
    EXPAND = "expand"
    CUSTOM = "custom"


AI_EDITOR_MARKDOWN_TEMPLATE = """# 房屋租赁合同

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
2.出租方身份证明文件：{{出租方身份证明文件|text|}}"""


MOCK_AI_DOCUMENT = AiEditorDocument(
    id="demo-ai-contract",
    title="房屋租赁合同（Mock）",
    markdown=AI_EDITOR_MARKDOWN_TEMPLATE,
    updated_at=f"{datetime.utcnow().isoformat()}Z",
)


@app.get("/ai/editor/mock_document", response_model=AiEditorDocument)
async def get_mock_ai_document() -> AiEditorDocument:
    """Return a mock AI editor document for front-end bootstrap."""

    return MOCK_AI_DOCUMENT


@app.post("/ai/editor/mock_document", response_model=AiEditorDocument)
async def save_mock_ai_document(
    payload: AiEditorDocumentPayload,
) -> AiEditorDocument:
    """Persist the incoming markdown into the in-memory mock store."""

    global MOCK_AI_DOCUMENT
    now = f"{datetime.utcnow().isoformat()}Z"
    updated = AiEditorDocument(
        id=MOCK_AI_DOCUMENT.id or uuid.uuid4().hex,
        title=payload.title.strip() or MOCK_AI_DOCUMENT.title,
        markdown=payload.markdown,
        updated_at=now,
    )
    MOCK_AI_DOCUMENT = updated
    return updated


@app.post("/ai/editor/export")
async def export_ai_editor_document(
    request: AiEditorExportRequest,
) -> StreamingResponse:
    """Export AI 编辑器内容，支持 HTML 直传或复用统一导出能力。"""

    filename = _sanitize_filename(request.filename or MOCK_AI_DOCUMENT.title)

    if request.format == "html":
        html_bytes = request.html.encode("utf-8")
        return _build_file_response(html_bytes, "text/html", f"{filename}.html")

    return await export_document(
        ExportRequest(
            content=request.html,
            format=request.format,  # type: ignore[arg-type]
            filename=filename,
        )
    )


def _format_sse(*, data: str, event: str | None = None, event_id: str | None = None) -> str:
    """Format payload in SSE wire format."""

    lines: list[str] = []
    if event_id:
        lines.append(f"id: {event_id}")
    if event:
        lines.append(f"event: {event}")
    payload_lines = data.splitlines() or [""]
    lines.extend(f"data: {line}" for line in payload_lines)
    lines.append("")
    return "\n".join(lines)


def _chunk_text(text: str, chunk_size: int = 48) -> list[str]:
    """Split text into balanced chunks for streaming."""

    if chunk_size <= 0:
        return [text]
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)] or [""]


def _simulate_ai_response(action: AiAction, text: str, instruction: str = "") -> str:
    clean_text = text.strip()
    if not clean_text:
        return "请选择一段文本后再试。"

    if action is AiAction.GENERATE:
        return (
            f"基于「{clean_text}」生成的新句子：为确保条款清晰，"
            "双方应在签署后十个工作日内完成约定事项。"
        )

    if action is AiAction.REWRITE:
        rewritten = (
            clean_text.replace("应当", "应")
            .replace("不得", "严禁")
            .replace("立即", "立刻")
            .replace("双方", "双方各方")
            .replace("保证", "确保")
        )
        if rewritten == clean_text:
            return f"经优化表述：{clean_text}"
        return rewritten

    if action is AiAction.EXPAND:
        return (
            f"{clean_text}。为提升条款的可执行性，建议补充具体时间节点、责任划分"
            "以及必要的沟通机制，确保各项义务能够有效落实。"
        )

    if action is AiAction.CUSTOM:
        safe_instruction = instruction.strip() or "自定义指令"
        return (
            f"根据「{safe_instruction}」调整后的内容：{clean_text}，"
            "在保持原意的基础上补充格式和细节，确保条款表述清晰可执行。"
        )

    return clean_text


@app.get("/ai/editor/stream")
async def stream_ai_editor(
    action: AiAction,
    text: str = "",
    instruction: str = "",
    request_id: str | None = None,
) -> StreamingResponse:
    """Stream AI results for the editor via SSE."""

    clean_text = text.strip()
    resolved_request_id = request_id or uuid.uuid4().hex

    async def event_publisher() -> AsyncGenerator[str, None]:
        yield "retry: 3000\n\n"
        start_payload = {
            "requestId": resolved_request_id,
            "action": action.value,
            "receivedText": clean_text,
            "instruction": instruction,
        }
        yield _format_sse(
            data=json.dumps(start_payload, ensure_ascii=False),
            event="start",
            event_id=f"{resolved_request_id}:0",
        )

        if not clean_text:
            done_payload = {
                "requestId": resolved_request_id,
                "status": "empty",
                "message": "请选择一段文本后再试。",
            }
            yield _format_sse(
                data=json.dumps(done_payload, ensure_ascii=False),
                event="done",
                event_id=f"{resolved_request_id}:1",
            )
            return

        ai_result = _simulate_ai_response(action, clean_text, instruction)
        chunks = _chunk_text(ai_result)

        for index, chunk in enumerate(chunks, start=1):
            chunk_payload = {
                "requestId": resolved_request_id,
                "content": chunk,
                "index": index,
                "total": len(chunks),
            }
            yield _format_sse(
                data=json.dumps(chunk_payload, ensure_ascii=False),
                event="chunk",
                event_id=f"{resolved_request_id}:{index}",
            )
            await asyncio.sleep(0.18)

        done_payload = {
            "requestId": resolved_request_id,
            "status": "completed",
            "result": ai_result,
            "totalChunks": len(chunks),
            "meta": {"instruction": instruction},
        }
        yield _format_sse(
            data=json.dumps(done_payload, ensure_ascii=False),
            event="done",
            event_id=f"{resolved_request_id}:{len(chunks) + 1}",
        )

    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_publisher(), media_type="text/event-stream", headers=headers)


def _ensure_docx(file: UploadFile) -> None:
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    if file.content_type not in SUPPORTED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")


async def _convert_to_html(file: UploadFile) -> tuple[str, list[ConversionNote]]:
    _ensure_docx(file)

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        with io.BytesIO(raw_bytes) as buffer:
            result = mammoth.convert_to_html(buffer, style_map=STYLE_MAP)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail="Failed to process document") from exc

    html_content = result.value.strip()

    notes: list[ConversionNote] = []
    if result.messages:
        notes = [
            ConversionNote(type=message.type, message=message.message)
            for message in result.messages
        ]

    return html_content, notes


def _is_cjk_char(char: str) -> bool:
    if not char:
        return False
    codepoint = ord(char)
    return (
        0x4E00 <= codepoint <= 0x9FFF  # CJK Unified Ideographs
        or 0x3400 <= codepoint <= 0x4DBF  # CJK Unified Ideographs Extension A
        or 0x20000 <= codepoint <= 0x2A6DF  # CJK Unified Ideographs Extension B
        or 0x2A700 <= codepoint <= 0x2B73F  # CJK Unified Ideographs Extension C
        or 0x2B740 <= codepoint <= 0x2B81F  # CJK Unified Ideographs Extension D
        or 0x2B820 <= codepoint <= 0x2CEAF  # CJK Unified Ideographs Extension E
        or 0xF900 <= codepoint <= 0xFAFF  # CJK Compatibility Ideographs
    )


def _is_punctuation(char: str) -> bool:
    return unicodedata.category(char).startswith("P")


def _tokenize_text(text: str) -> list[str]:
    tokens: list[str] = []
    buffer: list[str] = []

    def flush_buffer() -> None:
        if buffer:
            tokens.append("".join(buffer))
            buffer.clear()

    for char in text:
        if char.isspace():
            flush_buffer()
            tokens.append(char)
            continue

        if _is_cjk_char(char) or _is_punctuation(char):
            flush_buffer()
            tokens.append(char)
            continue

        buffer.append(char)

    flush_buffer()

    return tokens


def _prepare_html_tokens(html_content: str) -> tuple[BeautifulSoup, list[str], list[dict[str, object]]]:
    soup = BeautifulSoup(html_content or "", "html.parser")
    tokens: list[str] = []
    node_infos: list[dict[str, object]] = []

    for node in soup.descendants:
        if not isinstance(node, NavigableString):
            continue

        text = str(node)
        if text == "":
            continue

        parts = _tokenize_text(text)
        if not parts:
            continue

        start_index = len(tokens)
        tokens.extend(parts)
        node_infos.append(
            {
                "node": node,
                "tokens": parts,
                "start": start_index,
                "end": len(tokens),
            }
        )

    return soup, tokens, node_infos


def _escape_tokens(tokens: list[str]) -> str:
    return "".join(html.escape(token) for token in tokens)


def _truncate_text(value: str, limit: int = 80) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 1] + "…"


EXPORT_BLOCK_TAGS: tuple[str, ...] = (
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "li",
    "blockquote",
    "pre",
    "code",
    "table",
)


def _sanitize_filename(value: str | None) -> str:
    if not value:
        return "合同导入编辑"
    sanitized = re.sub(r"[\\/:*?\"<>|]", "_", value)
    sanitized = re.sub(r"\s+", " ", sanitized).strip()
    return sanitized or "合同导入编辑"


def _html_to_plaintext_lines(html_content: str) -> list[str]:
    soup = BeautifulSoup(html_content or "", "html.parser")
    body = soup.body or soup
    lines: list[str] = []

    for block in body.find_all(EXPORT_BLOCK_TAGS):
        separator = "\n" if block.name in {"pre", "code"} else " "
        text = block.get_text(separator, strip=True)
        if text == "":
            lines.append("")
            continue
        parts = text.splitlines() or [""]
        lines.extend(parts)

    if not lines:
        fallback = (body.get_text("\n", strip=True) or "").splitlines()
        if fallback:
            lines.extend(fallback)
        else:
            lines.append("")

    return [line.rstrip("\r") for line in lines]


def _render_docx_document(html_content: str) -> io.BytesIO:
    document = Document()
    soup = BeautifulSoup(html_content or "", "html.parser")
    body = soup.body or soup
    blocks = body.find_all(EXPORT_BLOCK_TAGS)

    if not blocks:
        document.add_paragraph("")

    for block in blocks:
        separator = "\n" if block.name in {"pre", "code"} else " "
        text = block.get_text(separator, strip=True)

        if block.name.startswith("h") and len(block.name) == 2 and block.name[1].isdigit():
            level = max(0, min(int(block.name[1]) - 1, 4))
            document.add_heading(text or "", level=level)
            continue

        if block.name == "li":
            parent = block.parent if isinstance(block.parent, Tag) else None
            style = "List Number" if parent and parent.name == "ol" else "List Bullet"
            document.add_paragraph(text or "", style=style)
            continue

        if block.name in {"pre", "code"}:
            paragraph = document.add_paragraph()
            content = text.splitlines() or [""]
            for index, line in enumerate(content):
                run = paragraph.add_run(line)
                run.font.name = "Courier New"
                run.font.size = Pt(10)
                if index < len(content) - 1:
                    run.add_break()
            if not content:
                paragraph.add_run("")
            continue

        if block.name == "blockquote":
            paragraph = document.add_paragraph(text or "")
            if "Intense Quote" in document.styles:
                paragraph.style = "Intense Quote"
            continue

        if block.name == "table":
            rows = block.find_all("tr")
            if not rows:
                continue
            max_cols = max((len(row.find_all(["th", "td"])) for row in rows), default=0)
            if max_cols == 0:
                continue
            table = document.add_table(rows=len(rows), cols=max_cols)
            for row_index, row in enumerate(rows):
                cells = row.find_all(["th", "td"])
                for col_index, cell in enumerate(cells):
                    if col_index >= max_cols:
                        break
                    table.cell(row_index, col_index).text = cell.get_text(" ", strip=True)
            document.add_paragraph("")
            continue

        document.add_paragraph(text or "")

    buffer = io.BytesIO()
    document.save(buffer)
    buffer.seek(0)
    return buffer


def _render_pdf_document(html_content: str) -> io.BytesIO:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    _, height = A4
    margin = 25 * mm
    text_object = pdf.beginText(margin, height - margin)
    text_object.setFont("Helvetica", 12)

    for line in _html_to_plaintext_lines(html_content):
        if text_object.getY() <= margin:
            pdf.drawText(text_object)
            pdf.showPage()
            text_object = pdf.beginText(margin, height - margin)
            text_object.setFont("Helvetica", 12)
        text_object.textLine(line)

    pdf.drawText(text_object)
    pdf.save()
    buffer.seek(0)
    return buffer


def _render_json_document(html_content: str) -> io.BytesIO:
    lines = _html_to_plaintext_lines(html_content)
    plain_text = "\n".join(lines)
    payload = {
        "html": html_content or "",
        "plain_text": plain_text,
        "character_count": len(plain_text.replace("\n", "")),
        "line_count": len(lines),
    }
    buffer = io.BytesIO(json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"))
    buffer.seek(0)
    return buffer


def _build_file_response(data: bytes, media_type: str, filename: str) -> StreamingResponse:
    response = StreamingResponse(iter([data]), media_type=media_type)
    response.headers["Content-Length"] = str(len(data))
    utf8_filename = quote(filename)
    response.headers[
        "Content-Disposition"
    ] = f"attachment; filename=\"{filename}\"; filename*=UTF-8''{utf8_filename}"
    return response


def _find_block_node(node: NavigableString) -> Tag | None:
    current = node.parent
    while current is not None:
        if isinstance(current, Tag) and current.name in {
            "p",
            "li",
            "td",
            "th",
            "caption",
            "blockquote",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "pre",
            "code",
            "div",
        }:
            return current
        current = current.parent
    return None


def _summarize_location(
    soup: BeautifulSoup,
    node_infos: list[dict[str, object]],
    start_index: int,
) -> DiffLocation | None:
    if not node_infos:
        return None

    target_info: dict[str, object] | None = None
    for info in node_infos:
        if info["start"] <= start_index < info["end"]:
            target_info = info
            break

    if target_info is None and start_index > 0:
        backtrack_index = start_index - 1
        for info in node_infos:
            if info["start"] <= backtrack_index < info["end"]:
                target_info = info
                break

    if target_info is None:
        for info in reversed(node_infos):
            if info["start"] <= start_index:
                target_info = info
                break

    if target_info is None:
        return None

    node = target_info["node"]
    if not isinstance(node, NavigableString):
        return None

    block = _find_block_node(node)
    block_summary: str | None = None
    if block is not None:
        text = block.get_text(" ", strip=True)
        if text:
            block_summary = _truncate_text(text)

    heading: Tag | None = None
    search_anchor: Tag | None = block if block is not None else node.parent
    heading_tags = ["h1", "h2", "h3", "h4", "h5", "h6"]
    if search_anchor is not None:
        heading = search_anchor if isinstance(search_anchor, Tag) and search_anchor.name in heading_tags else search_anchor.find_previous(heading_tags)
    else:
        heading = soup.find(heading_tags)

    section_title: str | None = None
    if heading is not None:
        section_text = heading.get_text(" ", strip=True)
        if section_text:
            section_title = _truncate_text(section_text, 60)

    if section_title is None and block_summary is None:
        return None

    return DiffLocation(section_title=section_title, block_summary=block_summary)


def _build_highlight_lookup(highlights: list[dict[str, object]]) -> dict[int, dict[str, object]]:
    lookup: dict[int, dict[str, object]] = {}
    for entry in highlights:
        start = entry["start"]
        end = entry["end"]
        for index in range(start, end):
            lookup[index] = entry
    return lookup


def _create_marker_tag(
    soup: BeautifulSoup, entry: dict[str, object], text: str
) -> Tag:
    mark = soup.new_tag("span")
    classes = [
        "diff-marker",
        f'diff-marker--{entry["type"]}',
        f'diff-marker--{entry["role"]}',
    ]
    if entry.get("placeholder"):
        classes.append("diff-marker--placeholder")
    else:
        classes.append("diff-marker--with-pill")
    mark["class"] = classes
    mark["data-diff-id"] = entry["id"]
    mark["data-diff-type"] = entry["type"]
    mark["data-diff-role"] = entry["role"]

    label = entry.get("label")
    number = entry.get("number")
    if label:
        mark["data-diff-type-label"] = label
    if number is not None:
        mark["data-diff-number"] = str(number)
    if label and number is not None:
        mark["title"] = f"{label} #{number}"
    if entry.get("placeholder"):
        mark["data-diff-placeholder"] = "true"

    mark.string = text
    return mark


def _apply_highlights(
    soup: BeautifulSoup,
    node_infos: list[dict[str, object]],
    highlights: list[dict[str, object]],
) -> str:
    if not highlights:
        return str(soup)

    span_highlights: list[dict[str, object]] = []
    boundary_highlights: dict[int, list[dict[str, object]]] = defaultdict(list)

    for entry in highlights:
        start = int(entry.get("start", 0))
        end = int(entry.get("end", start))
        if end > start:
            span_highlights.append(entry)
        else:
            boundary_highlights[start].append(entry)

    lookup = _build_highlight_lookup(span_highlights)

    for info in node_infos:
        node = info["node"]
        parent = node.parent
        if parent is None:
            continue

        tokens = info["tokens"]
        start_index = info["start"]
        end_index = info["end"]

        current_entry: dict[str, object] | None = None
        buffer: list[str] = []
        fragments: list[object] = []

        def emit_boundary(boundary_index: int) -> None:
            entries = boundary_highlights.pop(boundary_index, None)
            if not entries:
                return
            flush()
            for boundary_entry in entries:
                fragments.append(
                    _create_marker_tag(soup, boundary_entry, "\u00a0")
                )

        def flush() -> None:
            nonlocal buffer, current_entry
            if not buffer:
                return
            text = "".join(buffer)
            if current_entry:
                fragments.append(_create_marker_tag(soup, current_entry, text))
            else:
                fragments.append(text)
            buffer = []

        emit_boundary(start_index)
        for offset, token in enumerate(tokens):
            absolute_index = start_index + offset
            entry = lookup.get(absolute_index)
            if entry is not current_entry:
                flush()
                current_entry = entry
            buffer.append(token)
            emit_boundary(absolute_index + 1)

        flush()
        emit_boundary(end_index)

        for fragment in fragments:
            node.insert_before(fragment)

        node.extract()

    if boundary_highlights:
        fallback_parent: Tag | None = None
        if node_infos:
            fallback_parent = node_infos[-1]["node"].parent
        if fallback_parent is None:
            fallback_parent = soup.body or soup

        for boundary_index in sorted(boundary_highlights.keys()):
            entries = boundary_highlights[boundary_index]
            for entry in entries:
                fallback_parent.append(
                    _create_marker_tag(soup, entry, "\u00a0")
                )

    return str(soup)


def _build_diff(
    original_html: str, modified_html: str
) -> tuple[str, DiffStats, list[DiffItem], str, str]:
    from difflib import SequenceMatcher

    (
        original_soup,
        original_tokens,
        original_node_infos,
    ) = _prepare_html_tokens(original_html)
    (
        modified_soup,
        modified_tokens,
        modified_node_infos,
    ) = _prepare_html_tokens(modified_html)

    matcher = SequenceMatcher(None, original_tokens, modified_tokens)

    diff_parts: list[str] = []
    inserted_tokens = deleted_tokens = replaced_tokens = 0
    diff_items: list[DiffItem] = []
    highlight_map = {"original": [], "modified": []}
    diff_index = 1

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            diff_parts.append(_escape_tokens(original_tokens[i1:i2]))
        elif tag == "insert":
            if j1 == j2:
                continue
            diff_number = diff_index
            diff_id = f"diff-{diff_number}"
            diff_index += 1
            inserted_tokens += j2 - j1
            inserted_raw = "".join(modified_tokens[j1:j2])
            inserted_escaped = _escape_tokens(modified_tokens[j1:j2])
            modified_location = _summarize_location(
                modified_soup, modified_node_infos, j1
            )
            diff_parts.append(
                f'<ins class="diff-insert" data-diff-id="{diff_id}">{inserted_escaped}</ins>'
            )
            diff_items.append(
                DiffItem(
                    id=diff_id,
                    type="insert",
                    original_text="",
                    modified_text=inserted_raw,
                    modified_location=modified_location,
                )
            )
            highlight_map["original"].append(
                {
                    "id": diff_id,
                    "type": "insert",
                    "role": "original",
                    "start": i1,
                    "end": i1,
                    "label": DIFF_TYPE_LABELS["insert"],
                    "number": diff_number,
                    "placeholder": True,
                }
            )
            highlight_map["modified"].append(
                {
                    "id": diff_id,
                    "type": "insert",
                    "role": "modified",
                    "start": j1,
                    "end": j2,
                    "label": DIFF_TYPE_LABELS["insert"],
                    "number": diff_number,
                }
            )
        elif tag == "delete":
            if i1 == i2:
                continue
            diff_number = diff_index
            diff_id = f"diff-{diff_number}"
            diff_index += 1
            deleted_tokens += i2 - i1
            deleted_raw = "".join(original_tokens[i1:i2])
            deleted_escaped = _escape_tokens(original_tokens[i1:i2])
            original_location = _summarize_location(
                original_soup, original_node_infos, i1
            )
            # 在 modified 中找到对应的位置（删除后应该插入占位符的位置）
            # 由于是删除，modified 中对应的位置是 j1（等于 i1 在原始序列中的位置）
            # 但我们需要在 modified 的对应位置插入占位符
            modified_location = _summarize_location(
                modified_soup, modified_node_infos, j1 if j1 < len(modified_tokens) else max(0, len(modified_tokens) - 1)
            )
            diff_parts.append(
                f'<del class="diff-delete" data-diff-id="{diff_id}">{deleted_escaped}</del>'
            )
            diff_items.append(
                DiffItem(
                    id=diff_id,
                    type="delete",
                    original_text=deleted_raw,
                    modified_text="",
                    original_location=original_location,
                    modified_location=modified_location,
                )
            )
            highlight_map["original"].append(
                {
                    "id": diff_id,
                    "type": "delete",
                    "role": "original",
                    "start": i1,
                    "end": i2,
                    "label": DIFF_TYPE_LABELS["delete"],
                    "number": diff_number,
                }
            )
            # 在 modified 中添加占位符标记
            highlight_map["modified"].append(
                {
                    "id": diff_id,
                    "type": "delete",
                    "role": "modified",
                    "start": j1,
                    "end": j1,
                    "label": DIFF_TYPE_LABELS["delete"],
                    "number": diff_number,
                    "placeholder": True,
                }
            )
        elif tag == "replace":
            if i1 == i2 and j1 == j2:
                continue
            diff_number = diff_index
            diff_id = f"diff-{diff_number}"
            diff_index += 1
            removed_raw = "".join(original_tokens[i1:i2])
            added_raw = "".join(modified_tokens[j1:j2])
            removed_escaped = _escape_tokens(original_tokens[i1:i2])
            added_escaped = _escape_tokens(modified_tokens[j1:j2])
            original_location = _summarize_location(
                original_soup, original_node_infos, i1
            )
            modified_location = _summarize_location(
                modified_soup, modified_node_infos, j1
            )

            if i1 != i2:
                diff_parts.append(
                    f'<del class="diff-delete" data-diff-id="{diff_id}">{removed_escaped}</del>'
                )
                highlight_map["original"].append(
                    {
                        "id": diff_id,
                        "type": "replace",
                        "role": "original",
                        "start": i1,
                        "end": i2,
                        "label": DIFF_TYPE_LABELS["replace"],
                        "number": diff_number,
                    }
                )
            if j1 != j2:
                diff_parts.append(
                    f'<ins class="diff-insert" data-diff-id="{diff_id}">{added_escaped}</ins>'
                )
                highlight_map["modified"].append(
                    {
                        "id": diff_id,
                        "type": "replace",
                        "role": "modified",
                        "start": j1,
                        "end": j2,
                        "label": DIFF_TYPE_LABELS["replace"],
                        "number": diff_number,
                    }
                )

            replaced_tokens += max(i2 - i1, j2 - j1)
            diff_items.append(
                DiffItem(
                    id=diff_id,
                    type="replace",
                    original_text=removed_raw,
                    modified_text=added_raw,
                    original_location=original_location,
                    modified_location=modified_location,
                )
            )

    diff_html = "".join(diff_parts)
    stats = DiffStats(
        inserted_tokens=inserted_tokens,
        deleted_tokens=deleted_tokens,
        replaced_tokens=replaced_tokens,
    )
    highlighted_original = _apply_highlights(
        original_soup, original_node_infos, highlight_map["original"]
    )
    highlighted_modified = _apply_highlights(
        modified_soup, modified_node_infos, highlight_map["modified"]
    )

    return diff_html, stats, diff_items, highlighted_original, highlighted_modified


@app.post("/convert", response_model=ConversionResponse)
async def convert_word(
    file: Annotated[UploadFile, File(description=".docx file to convert")]
) -> ConversionResponse:
    html, notes = await _convert_to_html(file)
    return ConversionResponse(html=html, notes=notes)


@app.post("/diff", response_model=DiffResponse)
async def diff_word_documents(
    original_file: Annotated[
        UploadFile,
        File(description="Original .docx file", alias="original"),
    ],
    modified_file: Annotated[
        UploadFile,
        File(description="Modified .docx file", alias="modified"),
    ],
) -> DiffResponse:
    original_html, original_notes = await _convert_to_html(original_file)
    modified_html, modified_notes = await _convert_to_html(modified_file)

    diff_html, stats, diff_items, highlighted_original, highlighted_modified = _build_diff(
        original_html, modified_html
    )

    return DiffResponse(
        original_html=highlighted_original or "<p>未检测到正文内容。</p>",
        modified_html=highlighted_modified or "<p>未检测到正文内容。</p>",
        diff_html=diff_html or "<p>未检测到差异。</p>",
        stats=stats,
        diff_items=diff_items,
        original_notes=original_notes,
        modified_notes=modified_notes,
    )


@app.post("/export")
async def export_document(request: ExportRequest) -> StreamingResponse:
    format_name = request.format.lower()
    filename = _sanitize_filename(request.filename)
    html_content = request.content or ""

    if format_name == "docx":
        buffer = _render_docx_document(html_content)
        media_type = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        extension = "docx"
    elif format_name == "pdf":
        buffer = _render_pdf_document(html_content)
        media_type = "application/pdf"
        extension = "pdf"
    elif format_name == "json":
        buffer = _render_json_document(html_content)
        media_type = "application/json"
        extension = "json"
    else:  # pragma: no cover - guarded by pydantic validation
        raise HTTPException(status_code=400, detail="Unsupported export format")

    download_name = f"{filename}.{extension}"
    data = buffer.getvalue()
    return _build_file_response(data, media_type, download_name)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
