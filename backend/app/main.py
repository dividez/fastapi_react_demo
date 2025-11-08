from __future__ import annotations

import io
from typing import Annotated

import mammoth
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

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


@app.post("/convert")
async def convert_word(
    file: Annotated[UploadFile, File(description=".docx file to convert")]
) -> dict[str, str]:
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    if file.content_type not in SUPPORTED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        with io.BytesIO(raw_bytes) as buffer:
            result = mammoth.convert_to_html(buffer, style_map=STYLE_MAP)
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail="Failed to process document") from exc

    html_content = result.value.strip()

    notes = []
    if result.messages:
        notes = [message.__dict__ for message in result.messages]

    return {"html": html_content, "notes": notes}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
