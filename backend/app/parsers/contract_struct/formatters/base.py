from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from ..models import DocumentModel


class BaseFormatter(ABC):
    format_name: str

    @abstractmethod
    def format(self, doc: DocumentModel) -> Any:
        ...
