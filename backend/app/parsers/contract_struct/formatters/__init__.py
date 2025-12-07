from __future__ import annotations

from typing import Dict

from .base import BaseFormatter
from .json_formatter import JsonFormatter
from .plain_text_formatter import PlainTextFormatter
from .tiptap_html_formatter import TiptapHtmlFormatter
from .tag_list_formatter import TagListFormatter

FORMATTERS: Dict[str, BaseFormatter] = {
    "structured_json": JsonFormatter(),
    "plain_text": PlainTextFormatter(),
    "tiptap_html": TiptapHtmlFormatter(),
    "tag_list": TagListFormatter(),
}


def get_formatter(format_name: str) -> BaseFormatter:
    if format_name not in FORMATTERS:
        raise ValueError(f"Unsupported format: {format_name}")
    return FORMATTERS[format_name]
