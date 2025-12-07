from __future__ import annotations

import io
import re
import zipfile
from typing import Dict, List, Optional

from lxml import etree

from .models import (
    BlockModel,
    DocumentMetaModel,
    DocumentModel,
    LocationModel,
    RunModel,
    StyleModel,
    TableCellModel,
)


NAMESPACES = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    "dc": "http://purl.org/dc/elements/1.1/",
    "dcterms": "http://purl.org/dc/terms/",
}


class StyleCatalog:
    """Helper for resolving style metadata from styles.xml."""

    def __init__(self, styles_tree: Optional[etree._ElementTree]):
        self.styles: Dict[str, StyleModel] = {}
        if styles_tree is not None:
            self._parse_styles(styles_tree)

    def _parse_styles(self, tree: etree._ElementTree) -> None:
        for style in tree.findall("//w:style", namespaces=NAMESPACES):
            style_id = style.get(f"{{{NAMESPACES['w']}}}styleId")
            if not style_id:
                continue

            name_el = style.find("w:name", namespaces=NAMESPACES)
            name = name_el.get(f"{{{NAMESPACES['w']}}}val") if name_el is not None else None

            level = self._extract_level(style)
            is_heading = level is not None

            self.styles[style_id] = StyleModel(
                style_id=style_id,
                name=name,
                level=level,
                is_heading=is_heading,
            )

    @staticmethod
    def _extract_level(style_el: etree._Element) -> Optional[int]:
        outline = style_el.find(".//w:outlineLvl", namespaces=NAMESPACES)
        if outline is not None:
            level_val = outline.get(f"{{{NAMESPACES['w']}}}val")
            if level_val is not None and level_val.isdigit():
                return int(level_val) + 1

        style_id = style_el.get(f"{{{NAMESPACES['w']}}}styleId", "")
        match = re.search(r"heading\s*(\d+)|heading(\d+)|Heading(\d+)", style_id, re.IGNORECASE)
        if match:
            for group in match.groups():
                if group and group.isdigit():
                    return int(group)
        return None

    def get_style(self, style_id: Optional[str]) -> Optional[StyleModel]:
        if style_id is None:
            return None
        return self.styles.get(style_id)


class NumberingCatalog:
    """Helper for resolving list info from numbering.xml."""

    def __init__(self, numbering_tree: Optional[etree._ElementTree]):
        self.num_to_abstract: Dict[str, str] = {}
        self.abstract_levels: Dict[str, Dict[str, str]] = {}
        if numbering_tree is not None:
            self._parse_numbering(numbering_tree)

    def _parse_numbering(self, tree: etree._ElementTree) -> None:
        for num in tree.findall("//w:num", namespaces=NAMESPACES):
            num_id = num.get(f"{{{NAMESPACES['w']}}}numId")
            abstract = num.find("w:abstractNumId", namespaces=NAMESPACES)
            if num_id and abstract is not None:
                abstract_id = abstract.get(f"{{{NAMESPACES['w']}}}val")
                if abstract_id:
                    self.num_to_abstract[num_id] = abstract_id

        for abstract in tree.findall("//w:abstractNum", namespaces=NAMESPACES):
            abstract_id = abstract.get(f"{{{NAMESPACES['w']}}}abstractNumId")
            if not abstract_id:
                continue
            levels: Dict[str, str] = {}
            for lvl in abstract.findall("w:lvl", namespaces=NAMESPACES):
                ilvl = lvl.get(f"{{{NAMESPACES['w']}}}ilvl")
                num_text_el = lvl.find("w:lvlText", namespaces=NAMESPACES)
                if ilvl and num_text_el is not None:
                    num_text = num_text_el.get(f"{{{NAMESPACES['w']}}}val")
                    if num_text:
                        levels[ilvl] = num_text
            if levels:
                self.abstract_levels[abstract_id] = levels

    def resolve_list_info(self, p_el: etree._Element) -> StyleModel:
        style = StyleModel(is_list=False)
        num_pr = p_el.find("w:pPr/w:numPr", namespaces=NAMESPACES)
        if num_pr is None:
            return style

        num_id_el = num_pr.find("w:numId", namespaces=NAMESPACES)
        ilvl_el = num_pr.find("w:ilvl", namespaces=NAMESPACES)
        if num_id_el is None:
            return style

        num_id = num_id_el.get(f"{{{NAMESPACES['w']}}}val")
        ilvl = ilvl_el.get(f"{{{NAMESPACES['w']}}}val") if ilvl_el is not None else None

        style.is_list = True
        style.list_level = int(ilvl) if ilvl and ilvl.isdigit() else None

        if num_id and ilvl:
            abstract_id = self.num_to_abstract.get(num_id)
            if abstract_id:
                list_number = self.abstract_levels.get(abstract_id, {}).get(ilvl)
                style.list_number = list_number
        return style


def parse_docx_to_ir(document_id: str, docx_bytes: bytes) -> DocumentModel:
    try:
        with zipfile.ZipFile(io.BytesIO(docx_bytes)) as zf:
            document_xml = _read_xml(zf, "word/document.xml")
            styles_xml = _read_xml(zf, "word/styles.xml")
            numbering_xml = _read_xml(zf, "word/numbering.xml")
            core_xml = _read_xml(zf, "docProps/core.xml")
    except zipfile.BadZipFile as exc:
        raise ValueError("Invalid docx archive") from exc

    if document_xml is None:
        raise ValueError("Invalid document: missing document.xml")

    style_catalog = StyleCatalog(styles_xml)
    numbering_catalog = NumberingCatalog(numbering_xml)
    meta = _parse_core_properties(core_xml)

    body = document_xml.find("w:body", namespaces=NAMESPACES)
    if body is None:
        raise ValueError("Invalid document: missing body")

    blocks: List[BlockModel] = []
    paragraph_counter = 0
    table_counter = 0
    global_index = 0

    for child in body:
        localname = etree.QName(child.tag).localname
        if localname == "p":
            paragraph_counter += 1
            block = _parse_paragraph(
                child,
                style_catalog,
                numbering_catalog,
                block_index=global_index,
                p_counter=paragraph_counter,
            )
            blocks.append(block)
            global_index += 1
        elif localname == "tbl":
            table_counter += 1
            block = _parse_table(
                child,
                block_index=global_index,
                tbl_counter=table_counter,
            )
            blocks.append(block)
            global_index += 1

    return DocumentModel(document_id=document_id, meta=meta, blocks=blocks)


def _read_xml(zf: zipfile.ZipFile, path: str) -> Optional[etree._ElementTree]:
    try:
        with zf.open(path) as f:
            return etree.parse(f)
    except KeyError:
        return None


def _parse_core_properties(tree: Optional[etree._ElementTree]) -> DocumentMetaModel:
    if tree is None:
        return DocumentMetaModel()

    title_el = tree.find("dc:title", namespaces=NAMESPACES)
    creator_el = tree.find("dc:creator", namespaces=NAMESPACES)
    created_el = tree.find("dcterms:created", namespaces=NAMESPACES)

    return DocumentMetaModel(
        title=title_el.text if title_el is not None else None,
        creator=creator_el.text if creator_el is not None else None,
        created_at=created_el.text if created_el is not None else None,
    )


def _parse_paragraph(
    p_el: etree._Element,
    styles: StyleCatalog,
    numbering: NumberingCatalog,
    block_index: int,
    p_counter: int,
) -> BlockModel:
    style_id = _get_style_id(p_el)
    style_model = styles.get_style(style_id) or StyleModel(style_id=style_id)

    list_style = numbering.resolve_list_info(p_el)
    if list_style.is_list:
        style_model.is_list = True
        style_model.list_level = list_style.list_level
        style_model.list_number = list_style.list_number

    runs = _extract_runs(p_el)
    text_content = "".join(r.text for r in runs)

    block_type: str = "paragraph"
    if style_model.is_heading:
        block_type = "heading"
    elif style_model.is_list:
        block_type = "list_item"

    tags: List[str] = []
    if style_model.is_heading and style_model.level is not None:
        tags.append(f"HEADING_LEVEL_{style_model.level}")

    location = LocationModel(
        xml_path=f"/w:document/w:body/w:p[{p_counter}]",
        index=block_index,
    )

    block_id = f"p_{block_index:04d}"

    return BlockModel(
        block_id=block_id,
        type=block_type,  # type: ignore[arg-type]
        index=block_index,
        style=style_model,
        text=text_content,
        runs=runs or None,
        location=location,
        tags=tags,
    )


def _get_style_id(p_el: etree._Element) -> Optional[str]:
    p_pr = p_el.find("w:pPr", namespaces=NAMESPACES)
    if p_pr is None:
        return None
    style = p_pr.find("w:pStyle", namespaces=NAMESPACES)
    if style is None:
        return None
    return style.get(f"{{{NAMESPACES['w']}}}val")


def _extract_runs(p_el: etree._Element) -> List[RunModel]:
    runs: List[RunModel] = []
    for r_el in p_el.findall("w:r", namespaces=NAMESPACES):
        text_parts = [t_el.text or "" for t_el in r_el.findall("w:t", namespaces=NAMESPACES)]
        text = "".join(text_parts)
        if text == "":
            continue
        r_pr = r_el.find("w:rPr", namespaces=NAMESPACES)
        bold = _is_true(r_pr, "w:b") if r_pr is not None else False
        italic = _is_true(r_pr, "w:i") if r_pr is not None else False
        underline = _is_true(r_pr, "w:u") if r_pr is not None else False
        runs.append(RunModel(text=text, bold=bold, italic=italic, underline=underline))
    return runs


def _is_true(r_pr: etree._Element, tag: str) -> bool:
    el = r_pr.find(tag, namespaces=NAMESPACES)
    if el is None:
        return False
    val = el.get(f"{{{NAMESPACES['w']}}}val")
    return val in (None, "1", "true", "on")


def _parse_table(tbl_el: etree._Element, block_index: int, tbl_counter: int) -> BlockModel:
    rows: List[List[TableCellModel]] = []
    for row_idx, tr in enumerate(tbl_el.findall("w:tr", namespaces=NAMESPACES)):
        row_cells: List[TableCellModel] = []
        for col_idx, tc in enumerate(tr.findall("w:tc", namespaces=NAMESPACES)):
            text = _extract_text_from_cell(tc)
            row_cells.append(
                TableCellModel(
                    text=text,
                    row=row_idx,
                    col=col_idx,
                    rowspan=1,
                    colspan=1,
                )
            )
        rows.append(row_cells)

    location = LocationModel(
        xml_path=f"/w:document/w:body/w:tbl[{tbl_counter}]",
        index=block_index,
    )

    block_id = f"tbl_{block_index:04d}"

    return BlockModel(
        block_id=block_id,
        type="table",  # type: ignore[arg-type]
        index=block_index,
        rows=rows,
        location=location,
    )


def _extract_text_from_cell(tc_el: etree._Element) -> str:
    texts: List[str] = []
    for p in tc_el.findall("w:p", namespaces=NAMESPACES):
        runs = _extract_runs(p)
        line = "".join(r.text for r in runs)
        if line:
            texts.append(line)
    return "\n".join(texts)
