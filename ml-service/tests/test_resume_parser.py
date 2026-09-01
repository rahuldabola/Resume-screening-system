import io
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.resume_parser import UnsupportedFileTypeError, extract_text  # noqa: E402


def test_extract_text_from_txt():
    content = "Backend engineer experienced with Node.js.".encode("utf-8")
    assert extract_text("resume.txt", content) == "Backend engineer experienced with Node.js."


def test_extract_text_from_txt_is_case_insensitive_on_extension():
    content = "Some resume text.".encode("utf-8")
    assert extract_text("RESUME.TXT", content) == "Some resume text."


def test_extract_text_rejects_unsupported_extension():
    with pytest.raises(UnsupportedFileTypeError):
        extract_text("resume.exe", b"binary junk")


def test_extract_text_rejects_missing_extension():
    with pytest.raises(UnsupportedFileTypeError):
        extract_text("resume", b"some content")


def test_extract_text_from_docx():
    docx = pytest.importorskip("docx")
    buffer = io.BytesIO()
    document = docx.Document()
    document.add_paragraph("Data scientist skilled in Python and scikit-learn.")
    document.add_paragraph("Second paragraph of the resume.")
    document.save(buffer)

    text = extract_text("resume.docx", buffer.getvalue())
    assert "Data scientist skilled in Python and scikit-learn." in text
    assert "Second paragraph of the resume." in text


def test_extract_text_from_pdf():
    reportlab_pdfgen = pytest.importorskip("reportlab.pdfgen.canvas")
    buffer = io.BytesIO()
    c = reportlab_pdfgen.Canvas(buffer)
    c.drawString(100, 750, "Backend engineer with Docker and AWS experience.")
    c.save()

    text = extract_text("resume.pdf", buffer.getvalue())
    assert "Docker" in text
    assert "AWS" in text
