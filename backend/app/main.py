from __future__ import annotations

import html
import io
import re
from typing import Annotated

import mammoth
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


class DiffResponse(BaseModel):
    original_html: str
    modified_html: str
    diff_html: str
    stats: DiffStats
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


def _tokenize_text(html_content: str) -> list[str]:
    text = re.sub(r"<[^>]+>", "", html_content)
    # Preserve whitespace while escaping HTML-sensitive characters for safe rendering.
    tokens = re.findall(r"\s+|[^\s]+", text)
    return [html.escape(token) for token in tokens]


def _build_diff(
    original_html: str, modified_html: str
) -> tuple[str, DiffStats]:
    from difflib import SequenceMatcher

    original_tokens = _tokenize_text(original_html)
    modified_tokens = _tokenize_text(modified_html)

    matcher = SequenceMatcher(None, original_tokens, modified_tokens)

    diff_parts: list[str] = []
    inserted_tokens = deleted_tokens = replaced_tokens = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            diff_parts.extend(original_tokens[i1:i2])
        elif tag == "insert":
            inserted = "".join(modified_tokens[j1:j2])
            if inserted.strip():
                inserted_tokens += j2 - j1
                diff_parts.append(
                    f'<ins class="diff-insert">{inserted}</ins>'
                )
            else:
                diff_parts.extend(modified_tokens[j1:j2])
        elif tag == "delete":
            deleted = "".join(original_tokens[i1:i2])
            if deleted.strip():
                deleted_tokens += i2 - i1
                diff_parts.append(
                    f'<del class="diff-delete">{deleted}</del>'
                )
            else:
                diff_parts.extend(original_tokens[i1:i2])
        elif tag == "replace":
            removed = "".join(original_tokens[i1:i2])
            added = "".join(modified_tokens[j1:j2])
            replaced_delta = 0
            if removed.strip():
                replaced_delta = max(replaced_delta, i2 - i1)
                diff_parts.append(
                    f'<del class="diff-delete">{removed}</del>'
                )
            if added.strip():
                replaced_delta = max(replaced_delta, j2 - j1)
                diff_parts.append(
                    f'<ins class="diff-insert">{added}</ins>'
                )
            replaced_tokens += replaced_delta

    diff_html = "".join(diff_parts)
    stats = DiffStats(
        inserted_tokens=inserted_tokens,
        deleted_tokens=deleted_tokens,
        replaced_tokens=replaced_tokens,
    )
    return diff_html, stats


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

    diff_html, stats = _build_diff(original_html, modified_html)

    return DiffResponse(
        original_html=original_html or "<p>未检测到正文内容。</p>",
        modified_html=modified_html or "<p>未检测到正文内容。</p>",
        diff_html=diff_html or "<p>未检测到差异。</p>",
        stats=stats,
        original_notes=original_notes,
        modified_notes=modified_notes,
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
