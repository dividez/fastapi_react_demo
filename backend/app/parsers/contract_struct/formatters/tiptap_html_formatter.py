from __future__ import annotations

from html import escape

from .base import BaseFormatter
from ..models import BlockModel, DocumentModel


class TiptapHtmlFormatter(BaseFormatter):
    format_name = "tiptap_html"

    def format(self, doc: DocumentModel) -> str:
        html_parts: list[str] = []

        for block in doc.blocks:
            if block.type in ("paragraph", "heading", "list_item"):
                style = block.style
                is_heading = bool(style and style.is_heading)
                level = style.level if (style and style.level) else 0
                content_html = self._runs_to_html(block)

                if is_heading and level:
                    tag = f"h{min(max(level, 1), 6)}"
                    html_parts.append(
                        f'<{tag} data-block-id="{block.block_id}">{content_html}</{tag}>'
                    )
                else:
                    html_parts.append(
                        f'<p data-block-id="{block.block_id}">{content_html}</p>'
                    )

            elif block.type == "table" and block.rows:
                table_html: list[str] = [f'<table data-block-id="{block.block_id}">']
                for row in block.rows:
                    table_html.append("<tr>")
                    for cell in row:
                        attrs = []
                        if cell.rowspan and cell.rowspan > 1:
                            attrs.append(f'rowspan="{cell.rowspan}"')
                        if cell.colspan and cell.colspan > 1:
                            attrs.append(f'colspan="{cell.colspan}"')
                        attr_str = " " + " ".join(attrs) if attrs else ""
                        table_html.append(
                            f"<td{attr_str}>{escape(cell.text or '')}</td>"
                        )
                    table_html.append("</tr>")
                table_html.append("</table>")
                html_parts.append("".join(table_html))

        return "\n".join(html_parts)

    def _runs_to_html(self, block: BlockModel) -> str:
        runs = block.runs or []
        if not runs:
            return escape(block.text or "")

        parts: list[str] = []
        for run in runs:
            text = escape(run.text or "")
            if run.bold:
                text = f"<strong>{text}</strong>"
            if run.italic:
                text = f"<em>{text}</em>"
            if run.underline:
                text = f"<u>{text}</u>"
            parts.append(text)
        return "".join(parts)
