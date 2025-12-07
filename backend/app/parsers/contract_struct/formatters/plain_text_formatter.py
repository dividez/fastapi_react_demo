from __future__ import annotations

from .base import BaseFormatter
from ..models import DocumentModel


class PlainTextFormatter(BaseFormatter):
    format_name = "plain_text"

    def format(self, doc: DocumentModel) -> str:
        lines: list[str] = []

        for block in doc.blocks:
            if block.type in ("paragraph", "heading", "list_item"):
                if block.text:
                    lines.append(block.text.strip())
            elif block.type == "table" and block.rows:
                for row in block.rows:
                    cells = [c.text.strip() for c in row]
                    lines.append("\t".join(cells))

        return "\n".join(lines)
