from __future__ import annotations

from .base import BaseFormatter
from ..models import DocumentModel


class TagListFormatter(BaseFormatter):
    format_name = "tag_list"

    def format(self, doc: DocumentModel) -> list[str]:
        tags: set[str] = set()

        if any(b.type == "table" for b in doc.blocks):
            tags.add("HAS_TABLE")
        if any(b.style and b.style.is_heading for b in doc.blocks):
            tags.add("HAS_HEADINGS")
        if any(b.style and b.style.is_list for b in doc.blocks):
            tags.add("HAS_LISTS")

        for block in doc.blocks:
            for tag in block.tags:
                tags.add(tag)

        return sorted(tags)
