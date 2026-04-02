"""
Document Parser Service — PDF text extraction, table parsing, metadata extraction

Features:
- Text extraction per page (preserves order and structure)
- Table detection and parsing via pdfplumber
- PDF metadata extraction
- Scanned document detection
- Fallback to OCR if enabled
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger(__name__)

# ─── Types ────────────────────────────────────────────────────────────────────


@dataclass
class TextPage:
    page_num: int
    text: str
    text_confidence: float


@dataclass
class TableData:
    page_num: int
    table_num: int
    data: List[List[str]]
    format: str = "json"


@dataclass
class PdfMetadata:
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: Optional[str] = None
    creation_date: Optional[str] = None
    modification_date: Optional[str] = None
    page_count: int = 0
    is_scanned: bool = False
    is_encrypted: bool = False


# ─── Text Extraction ──────────────────────────────────────────────────────────


def extract_text_from_pdf(pdf_path: str) -> Tuple[List[Dict[str, Any]], float]:
    """
    Extract text from all pages of a PDF using pdfplumber.

    Returns:
        (pages: List[{page_num, text, text_confidence}], avg_confidence: float)
    """
    if not pdfplumber:
        logger.warning("pdfplumber not installed, returning empty text")
        return [], 0.0

    pages = []
    text_confidences = []

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                try:
                    # Extract text
                    text = page.extract_text() or ""

                    # Estimate confidence based on text extraction success
                    # (Low confidence might indicate scanned document)
                    text_len = len(text.strip())
                    page_height = page.height
                    page_width = page.width
                    page_area = page_height * page_width
                    text_density = text_len / (page_area / 100)  # Rough heuristic
                    confidence = min(text_density, 1.0)

                    pages.append(
                        {
                            "page_num": page_num,
                            "text": text,
                            "text_confidence": confidence,
                        }
                    )
                    text_confidences.append(confidence)

                except Exception as e:
                    logger.warning(f"Failed to extract text from page {page_num}: {e}")

        avg_confidence = (
            sum(text_confidences) / len(text_confidences)
            if text_confidences
            else 0.0
        )

        return pages, avg_confidence

    except Exception as e:
        logger.error(f"Failed to extract text from PDF: {e}")
        return [], 0.0


# ─── Table Extraction ─────────────────────────────────────────────────────────


def extract_tables_from_pdf(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Extract tables from PDF using pdfplumber.

    Returns:
        List[{page_num, table_num, data: [[...]], format}]
    """
    if not pdfplumber:
        logger.warning("pdfplumber not installed, returning empty tables")
        return []

    tables = []

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                try:
                    page_tables = page.extract_tables()

                    if not page_tables:
                        continue

                    for table_num, table in enumerate(page_tables, start=1):
                        # Convert table to 2D array of strings
                        table_data = [
                            [str(cell or "") for cell in row] for row in table
                        ]

                        tables.append(
                            {
                                "page_num": page_num,
                                "table_num": table_num,
                                "data": table_data,
                                "format": "json",
                            }
                        )

                except Exception as e:
                    logger.warning(
                        f"Failed to extract tables from page {page_num}: {e}"
                    )

        logger.info(f"Extracted {len(tables)} tables from {pdf_path}")
        return tables

    except Exception as e:
        logger.error(f"Failed to extract tables from PDF: {e}")
        return []


# ─── Metadata Extraction ──────────────────────────────────────────────────────


def extract_metadata_from_pdf(pdf_path: str) -> Dict[str, Any]:
    """
    Extract metadata from PDF (title, author, creation date, etc.).

    Returns:
        {title, author, subject, keywords, creation_date, modification_date,
         page_count, is_scanned, is_encrypted}
    """
    if not PdfReader:
        logger.warning("pypdf not installed, returning minimal metadata")
        return {
            "page_count": 0,
            "is_scanned": False,
            "is_encrypted": False,
        }

    try:
        reader = PdfReader(pdf_path)

        # Basic metadata
        page_count = len(reader.pages)
        is_encrypted = reader.is_encrypted

        # Extract metadata dict
        metadata = reader.metadata or {}
        title = metadata.get("/Title") or metadata.get("Title")
        author = metadata.get("/Author") or metadata.get("Author")
        subject = metadata.get("/Subject") or metadata.get("Subject")
        keywords = metadata.get("/Keywords") or metadata.get("Keywords")
        creation_date = metadata.get("/CreationDate") or metadata.get("CreationDate")
        modification_date = metadata.get("/ModDate") or metadata.get("ModDate")

        # Detect scanned document (check if first page has no text)
        is_scanned = False
        try:
            if pdfplumber:
                with pdfplumber.open(pdf_path) as pdf:
                    first_page = pdf.pages[0]
                    text = first_page.extract_text() or ""
                    is_scanned = len(text.strip()) < 10  # Heuristic
        except Exception as e:
            logger.debug(f"Failed to detect scanned status: {e}")

        return {
            "title": title,
            "author": author,
            "subject": subject,
            "keywords": keywords,
            "creation_date": str(creation_date) if creation_date else None,
            "modification_date": str(modification_date) if modification_date else None,
            "page_count": page_count,
            "is_scanned": is_scanned,
            "is_encrypted": is_encrypted,
        }

    except Exception as e:
        logger.error(f"Failed to extract metadata from PDF: {e}")
        return {
            "page_count": 0,
            "is_scanned": False,
            "is_encrypted": False,
        }


# ─── Combined Analysis ────────────────────────────────────────────────────────


def analyze_pdf(pdf_path: str, extract_tables: bool = True) -> Dict[str, Any]:
    """
    Comprehensive PDF analysis.

    Returns:
        {
            text_per_page: [TextPage],
            tables: [TableData],
            metadata: PdfMetadata,
            full_text: str,
            avg_text_confidence: float
        }
    """
    logger.info(f"Analyzing PDF: {pdf_path}")

    # Extract text
    text_pages, avg_confidence = extract_text_from_pdf(pdf_path)
    full_text = "\n\n".join([page["text"] for page in text_pages])

    # Extract tables
    tables = extract_tables_from_pdf(pdf_path) if extract_tables else []

    # Extract metadata
    metadata = extract_metadata_from_pdf(pdf_path)

    result = {
        "text_per_page": text_pages,
        "tables": tables,
        "metadata": metadata,
        "full_text": full_text,
        "avg_text_confidence": avg_confidence,
    }

    logger.info(
        f"PDF analysis complete: {len(text_pages)} pages, "
        f"{len(tables)} tables, confidence: {avg_confidence:.2f}"
    )

    return result


# ─── Utility: Detect Scanned PDFs ─────────────────────────────────────────────


def detect_scanned_pdf(pdf_path: str) -> bool:
    """
    Detect if PDF is a scanned document (no text layer).

    Returns:
        True if likely scanned, False if likely native PDF
    """
    try:
        if pdfplumber:
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages[:3]:  # Check first 3 pages
                    text = page.extract_text() or ""
                    if len(text.strip()) > 10:  # If any page has text, not scanned
                        return False
        return True
    except Exception as e:
        logger.warning(f"Failed to detect scanned status: {e}")
        return False


# ─── Main (for testing) ────────────────────────────────────────────────────────


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python document_parser_service.py <pdf_path>")
        sys.exit(1)

    pdf_path = sys.argv[1]

    if not Path(pdf_path).exists():
        print(f"File not found: {pdf_path}")
        sys.exit(1)

    result = analyze_pdf(pdf_path)

    # Print results as JSON
    print(json.dumps(result, indent=2, default=str))
