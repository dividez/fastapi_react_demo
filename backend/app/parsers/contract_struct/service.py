from __future__ import annotations

from typing import Any, Dict, List

from .formatters import get_formatter
from .models import DocumentModel
from .parser_engine import parse_docx_to_ir


class ContractParserService:
    def parse_and_format(
        self,
        document_id: str,
        docx_bytes: bytes,
        output_formats: List[str],
    ) -> Dict[str, Any]:
        doc_model: DocumentModel = parse_docx_to_ir(document_id, docx_bytes)

        outputs: Dict[str, Any] = {}
        for fmt in output_formats:
            formatter = get_formatter(fmt)
            outputs[fmt] = formatter.format(doc_model)

        return outputs
