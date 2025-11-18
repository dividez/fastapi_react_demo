from __future__ import annotations

from enum import Enum
from io import BytesIO

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from markdown_it import MarkdownIt
from pydantic import BaseModel

app = FastAPI(title="AI Contract Drafting Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TransformMode(str, Enum):
    rewrite = "rewrite"
    expand = "expand"
    rephrase = "rephrase"
    custom = "custom"


class TransformRequest(BaseModel):
    mode: TransformMode
    markdown: str
    user_instruction: str | None = None


class TransformResponse(BaseModel):
    markdown: str


class ExportDocxRequest(BaseModel):
    markdown: str


md = MarkdownIt("commonmark", {"html": True})


@app.post("/api/ai/transform", response_model=TransformResponse)
async def transform_text(payload: TransformRequest) -> TransformResponse:
    text = payload.markdown.strip()
    if not text:
        return TransformResponse(markdown="(空内容，无法处理)")

    if payload.mode is TransformMode.rewrite:
        result = f"[改写示例] {text}"
    elif payload.mode is TransformMode.expand:
        result = (
            f"{text}\n\n扩写示例文本：为确保条款落地，可补充责任分工、时间节点与沟通机制。"
        )
    elif payload.mode is TransformMode.rephrase:
        result = f"[重写示例] {text.capitalize()}"
    else:
        instruction = payload.user_instruction or "自定义指令"
        result = f"根据「{instruction}」调整：{text}"

    return TransformResponse(markdown=result)


@app.post("/api/export/docx")
async def export_docx(payload: ExportDocxRequest) -> StreamingResponse:
    document = create_document_from_markdown(payload.markdown)
    buffer = BytesIO()
    document.save(buffer)
    buffer.seek(0)

    headers = {
        "Content-Disposition": "attachment; filename=contract.docx",
        "Access-Control-Expose-Headers": "Content-Disposition",
    }
    return StreamingResponse(
        buffer,
        headers=headers,
        media_type=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
    )


# ------------------------
# DOCX helpers
# ------------------------


def _build_multilevel_numbering(document: Document) -> int:
    numbering_part = document.part.numbering_part.numbering_definitions._numbering
    existing = numbering_part.xpath("./w:abstractNum")
    abstract_id = len(existing)

    abstract_num = OxmlElement("w:abstractNum")
    abstract_num.set(qn("w:abstractNumId"), str(abstract_id))

    for level in range(9):
        lvl = OxmlElement("w:lvl")
        lvl.set(qn("w:ilvl"), str(level))

        start = OxmlElement("w:start")
        start.set(qn("w:val"), "1")
        lvl.append(start)

        num_fmt = OxmlElement("w:numFmt")
        num_fmt.set(qn("w:val"), "decimal")
        lvl.append(num_fmt)

        lvl_text = OxmlElement("w:lvlText")
        pattern = ".".join(f"%{i}" for i in range(1, level + 2)) + "."
        lvl_text.set(qn("w:val"), pattern)
        lvl.append(lvl_text)

        lvl_jc = OxmlElement("w:lvlJc")
        lvl_jc.set(qn("w:val"), "left")
        lvl.append(lvl_jc)

        p_pr = OxmlElement("w:pPr")
        indent = OxmlElement("w:ind")
        indent.set(qn("w:left"), str(360 + level * 240))
        indent.set(qn("w:hanging"), "360")
        p_pr.append(indent)
        outline = OxmlElement("w:outlineLvl")
        outline.set(qn("w:val"), str(level))
        p_pr.append(outline)
        lvl.append(p_pr)

        abstract_num.append(lvl)

    numbering_part.append(abstract_num)

    num = OxmlElement("w:num")
    num_id = abstract_id + 1
    num.set(qn("w:numId"), str(num_id))
    abstract_ref = OxmlElement("w:abstractNumId")
    abstract_ref.set(qn("w:val"), str(abstract_id))
    num.append(abstract_ref)
    numbering_part.append(num)

    return num_id


def _apply_numbering(paragraph, num_id: int, level: int) -> None:
    num_pr = OxmlElement("w:numPr")
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), str(level))
    num_pr.append(ilvl)
    num_el = OxmlElement("w:numId")
    num_el.set(qn("w:val"), str(num_id))
    num_pr.append(num_el)
    paragraph._p.get_or_add_pPr().append(num_pr)


def _add_heading(
    document: Document, text: str, level: int, numbering_id: int | None
) -> None:
    heading_level = max(1, min(level, 5))
    paragraph = document.add_heading(text, level=heading_level)
    paragraph.style.font.size = Pt(12)
    if numbering_id is not None:
        _apply_numbering(paragraph, numbering_id, heading_level - 1)


def _add_paragraph(document: Document, text: str) -> None:
    paragraph = document.add_paragraph(text)
    paragraph.style.font.size = Pt(11)


def _add_list_item(document: Document, text: str, level: int, ordered: bool) -> None:
    style = "List Number" if ordered else "List Bullet"
    paragraph = document.add_paragraph(text, style=style)
    if level > 0:
        paragraph.paragraph_format.left_indent = Pt(12 * level)


def create_document_from_markdown(markdown: str) -> Document:
    document = Document()
    numbering_id = _build_multilevel_numbering(document)
    tokens = md.parse(markdown)

    i = 0
    list_state: list[tuple[bool, int]] = []
    while i < len(tokens):
        token = tokens[i]
        if token.type == "heading_open":
            level = int(token.tag[1]) if token.tag.startswith("h") else 1
            text = tokens[i + 1].content if i + 1 < len(tokens) else ""
            _add_heading(document, text, level, numbering_id)
            i += 3
            continue

        if token.type == "paragraph_open":
            text = tokens[i + 1].content if i + 1 < len(tokens) else ""
            _add_paragraph(document, text)
            i += 3
            continue

        if token.type in {"ordered_list_open", "bullet_list_open"}:
            ordered = token.type.startswith("ordered")
            list_state.append((ordered, len(list_state)))
            i += 1
            continue

        if token.type in {"ordered_list_close", "bullet_list_close"}:
            if list_state:
                list_state.pop()
            i += 1
            continue

        if token.type == "list_item_open":
            content = ""
            cursor = i + 1
            while cursor < len(tokens) and tokens[cursor].type != "list_item_close":
                if tokens[cursor].type == "inline":
                    content = tokens[cursor].content
                cursor += 1
            ordered, level = list_state[-1]
            _add_list_item(document, content, level, ordered)
            i = cursor + 1
            continue

        i += 1

    return document
