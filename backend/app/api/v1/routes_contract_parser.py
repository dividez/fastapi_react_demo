from __future__ import annotations

from typing import Any, Dict, List, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.parsers.contract_struct.service import ContractParserService

router = APIRouter(prefix="/api/v1", tags=["contract_parser"])

OutputFormatLiteral = Literal[
    "structured_json",
    "plain_text",
    "tiptap_html",
    "tag_list",
]


class ParseDocumentResponse(BaseModel):
    document_id: str
    outputs: Dict[str, Any]


@router.post("/parse-document", response_model=ParseDocumentResponse)
async def parse_document(
    file: UploadFile = File(..., description="合同 Word 文件，格式为 .docx"),
    document_id: str = Form(..., description="系统中的文档 ID"),
    output_formats: List[OutputFormatLiteral] = Form(
        ..., description="需要输出的格式列表"
    ),
):
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")

    docx_bytes = await file.read()

    service = ContractParserService()
    try:
        outputs = service.parse_and_format(
            document_id=document_id,
            docx_bytes=docx_bytes,
            output_formats=list(output_formats),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal parse error") from exc

    return ParseDocumentResponse(document_id=document_id, outputs=outputs)
