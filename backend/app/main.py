from __future__ import annotations

import html
import io
import re
from typing import Annotated, Literal

import mammoth
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from bs4 import BeautifulSoup
from bs4.element import NavigableString

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


class DiffItem(BaseModel):
    id: str
    type: Literal["insert", "delete", "replace"]
    original_text: str
    modified_text: str


class DiffResponse(BaseModel):
    original_html: str
    modified_html: str
    diff_html: str
    stats: DiffStats
    diff_items: list[DiffItem] = []
    original_notes: list[ConversionNote] = []
    modified_notes: list[ConversionNote] = []


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

        parts = re.findall(r"\s+|[^\s]+", text)
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


def _build_highlight_lookup(highlights: list[dict[str, object]]) -> dict[int, dict[str, object]]:
    lookup: dict[int, dict[str, object]] = {}
    for entry in highlights:
        start = entry["start"]
        end = entry["end"]
        for index in range(start, end):
            lookup[index] = entry
    return lookup


def _apply_highlights(
    soup: BeautifulSoup,
    node_infos: list[dict[str, object]],
    highlights: list[dict[str, object]],
) -> str:
    if not highlights:
        return str(soup)

    lookup = _build_highlight_lookup(highlights)

    for info in node_infos:
        node = info["node"]
        parent = node.parent
        if parent is None:
            continue

        tokens = info["tokens"]
        start_index = info["start"]

        current_entry: dict[str, object] | None = None
        buffer: list[str] = []
        fragments: list[object] = []

        def flush() -> None:
            nonlocal buffer, current_entry
            if not buffer:
                return
            text = "".join(buffer)
            if current_entry:
                mark = soup.new_tag("span")
                mark["class"] = [
                    "diff-marker",
                    f'diff-marker--{current_entry["type"]}',
                    f'diff-marker--{current_entry["role"]}',
                ]
                mark["data-diff-id"] = current_entry["id"]
                mark["data-diff-type"] = current_entry["type"]
                mark["data-diff-role"] = current_entry["role"]
                mark.string = text
                fragments.append(mark)
            else:
                fragments.append(text)
            buffer = []

        for offset, token in enumerate(tokens):
            absolute_index = start_index + offset
            entry = lookup.get(absolute_index)
            if entry is not current_entry:
                flush()
                current_entry = entry
            buffer.append(token)

        flush()

        for fragment in fragments:
            node.insert_before(fragment)

        node.extract()

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
            diff_id = f"diff-{diff_index}"
            diff_index += 1
            inserted_tokens += j2 - j1
            inserted_raw = "".join(modified_tokens[j1:j2])
            inserted_escaped = _escape_tokens(modified_tokens[j1:j2])
            diff_parts.append(
                f'<ins class="diff-insert" data-diff-id="{diff_id}">{inserted_escaped}</ins>'
            )
            diff_items.append(
                DiffItem(
                    id=diff_id,
                    type="insert",
                    original_text="",
                    modified_text=inserted_raw,
                )
            )
            highlight_map["modified"].append(
                {
                    "id": diff_id,
                    "type": "insert",
                    "role": "modified",
                    "start": j1,
                    "end": j2,
                }
            )
        elif tag == "delete":
            if i1 == i2:
                continue
            diff_id = f"diff-{diff_index}"
            diff_index += 1
            deleted_tokens += i2 - i1
            deleted_raw = "".join(original_tokens[i1:i2])
            deleted_escaped = _escape_tokens(original_tokens[i1:i2])
            diff_parts.append(
                f'<del class="diff-delete" data-diff-id="{diff_id}">{deleted_escaped}</del>'
            )
            diff_items.append(
                DiffItem(
                    id=diff_id,
                    type="delete",
                    original_text=deleted_raw,
                    modified_text="",
                )
            )
            highlight_map["original"].append(
                {
                    "id": diff_id,
                    "type": "delete",
                    "role": "original",
                    "start": i1,
                    "end": i2,
                }
            )
        elif tag == "replace":
            if i1 == i2 and j1 == j2:
                continue
            diff_id = f"diff-{diff_index}"
            diff_index += 1
            removed_raw = "".join(original_tokens[i1:i2])
            added_raw = "".join(modified_tokens[j1:j2])
            removed_escaped = _escape_tokens(original_tokens[i1:i2])
            added_escaped = _escape_tokens(modified_tokens[j1:j2])

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
                    }
                )

            replaced_tokens += max(i2 - i1, j2 - j1)
            diff_items.append(
                DiffItem(
                    id=diff_id,
                    type="replace",
                    original_text=removed_raw,
                    modified_text=added_raw,
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


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
