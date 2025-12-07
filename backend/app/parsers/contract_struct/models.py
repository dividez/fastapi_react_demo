from __future__ import annotations

from typing import List, Optional, Literal

from pydantic import BaseModel, Field


BlockType = Literal["paragraph", "table", "heading", "list_item"]


class RunModel(BaseModel):
    text: str
    bold: bool = False
    italic: bool = False
    underline: bool = False


class StyleModel(BaseModel):
    style_id: Optional[str] = None
    name: Optional[str] = None
    level: Optional[int] = None
    is_heading: bool = False
    is_list: bool = False
    list_level: Optional[int] = None
    list_number: Optional[str] = None


class LocationModel(BaseModel):
    xml_path: str
    index: int
    page_estimate: Optional[int] = None


class TableCellModel(BaseModel):
    text: str
    row: int
    col: int
    rowspan: int = 1
    colspan: int = 1


class BlockModel(BaseModel):
    block_id: str
    type: BlockType
    index: int
    style: Optional[StyleModel] = None

    text: Optional[str] = None
    runs: Optional[List[RunModel]] = None

    rows: Optional[List[List[TableCellModel]]] = None

    location: LocationModel
    tags: List[str] = Field(default_factory=list)


class DocumentMetaModel(BaseModel):
    title: Optional[str] = None
    creator: Optional[str] = None
    created_at: Optional[str] = None
    page_count_estimate: Optional[int] = None


class DocumentModel(BaseModel):
    document_id: str
    meta: DocumentMetaModel
    blocks: List[BlockModel]
