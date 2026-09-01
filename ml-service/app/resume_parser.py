"""Extracts plain text from an uploaded resume file (PDF, DOCX, or plain text)."""

import io

import docx
import pdfplumber


class UnsupportedFileTypeError(ValueError):
    pass


def extract_text(filename: str, content: bytes) -> str:
    lower = filename.lower()

    if lower.endswith(".pdf"):
        return _extract_pdf(content)
    if lower.endswith(".docx"):
        return _extract_docx(content)
    if lower.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")

    raise UnsupportedFileTypeError(
        f"Unsupported file type for '{filename}'. Upload a .pdf, .docx, or .txt file."
    )


def _extract_pdf(content: bytes) -> str:
    text_parts = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_docx(content: bytes) -> str:
    document = docx.Document(io.BytesIO(content))
    return "\n".join(paragraph.text for paragraph in document.paragraphs)
