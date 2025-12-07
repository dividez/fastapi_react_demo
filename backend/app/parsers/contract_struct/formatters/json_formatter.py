from __future__ import annotations

from typing import Any

from .base import BaseFormatter
from ..models import DocumentModel


class JsonFormatter(BaseFormatter):
    format_name = "structured_json"

    def format(self, doc: DocumentModel) -> Any:
        return doc.model_dump()
