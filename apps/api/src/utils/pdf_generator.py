from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

PDF_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "generated_pdfs"


def _find_first_existing_path(paths: Iterable[str]) -> str | None:
    for path in paths:
        if Path(path).exists():
            return path
    return None


def _register_fonts() -> tuple[str, str]:
    regular_candidates = [
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    bold_candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]

    regular_path = _find_first_existing_path(regular_candidates)
    bold_path = _find_first_existing_path(bold_candidates)

    if regular_path:
        if "ChemReportBody" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("ChemReportBody", regular_path))
        if bold_path:
            if "ChemReportBold" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont("ChemReportBold", bold_path))
            return "ChemReportBody", "ChemReportBold"
        return "ChemReportBody", "ChemReportBody"

    return "Helvetica", "Helvetica-Bold"


def _draw_logo(canvas, x: float, y: float, size: float) -> None:
    # Keep same visual language as the web/admin logo.
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#0369A1"))
    canvas.roundRect(x, y, size, size, radius=size * 0.2, stroke=0, fill=1)

    canvas.setFillColor(colors.white)
    canvas.rect(x + size * 0.25, y + size * 0.70, size * 0.5, size * 0.09, stroke=0, fill=1)

    path = canvas.beginPath()
    path.moveTo(x + size * 0.36, y + size * 0.70)
    path.lineTo(x + size * 0.36, y + size * 0.50)
    path.lineTo(x + size * 0.27, y + size * 0.24)
    path.lineTo(x + size * 0.73, y + size * 0.24)
    path.lineTo(x + size * 0.64, y + size * 0.50)
    path.lineTo(x + size * 0.64, y + size * 0.70)
    path.close()
    canvas.drawPath(path, stroke=0, fill=1)

    canvas.setStrokeColor(colors.HexColor("#0369A1"))
    canvas.setLineWidth(1.8)
    canvas.line(x + size * 0.31, y + size * 0.41, x + size * 0.69, y + size * 0.41)
    canvas.circle(x + size * 0.38, y + size * 0.49, size * 0.03, stroke=0, fill=1)
    canvas.circle(x + size * 0.55, y + size * 0.53, size * 0.03, stroke=0, fill=1)
    canvas.circle(x + size * 0.63, y + size * 0.45, size * 0.025, stroke=0, fill=1)
    canvas.restoreState()


def _build_styles(font_body: str, font_bold: str) -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName=font_bold,
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0B4D76"),
            spaceAfter=10,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=base["Heading2"],
            fontName=font_bold,
            fontSize=12.5,
            leading=16,
            textColor=colors.HexColor("#0B4D76"),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName=font_body,
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor("#1F2937"),
            spaceAfter=5,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName=font_body,
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor("#1F2937"),
            leftIndent=14,
            bulletIndent=6,
            spaceAfter=3,
        ),
    }


def _draw_header_footer(canvas, doc, title: str) -> None:
    canvas.saveState()
    width, height = letter

    logo_y = height - 0.72 * inch
    _draw_logo(canvas, x=doc.leftMargin, y=logo_y, size=22)

    canvas.setFont("Helvetica-Bold", 10)
    canvas.setFillColor(colors.HexColor("#0B4D76"))
    canvas.drawString(doc.leftMargin + 1, logo_y - 10, "ChemReport Studio")

    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(colors.HexColor("#475569"))
    canvas.drawString(doc.leftMargin + 1, logo_y - 20, title[:95])

    canvas.setStrokeColor(colors.HexColor("#D9E3EF"))
    canvas.setLineWidth(0.8)
    canvas.line(doc.leftMargin, logo_y - 27, width - doc.rightMargin, logo_y - 27)

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    page_number = canvas.getPageNumber()
    footer = f"Page {page_number}"
    canvas.drawRightString(width - doc.rightMargin, 0.45 * inch, footer)
    canvas.restoreState()


def _markdown_inline_to_richtext(text: str) -> str:
    escaped = escape(text)

    escaped = re.sub(
        r"\[([^\]]+)\]\((https?://[^)\s]+)\)",
        r'<a href="\2" color="#0B4D76">\1</a>',
        escaped,
    )
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"<i>\1</i>", escaped)
    escaped = re.sub(r"`([^`]+?)`", r'<font name="Courier">\1</font>', escaped)
    return escaped


def _append_content_paragraphs(story: list, content: str, styles: dict[str, ParagraphStyle]) -> None:
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            story.append(Spacer(1, 4))
            continue

        if line.startswith("### "):
            story.append(Paragraph(_markdown_inline_to_richtext(line[4:]), styles["section"]))
            continue
        if line.startswith("## "):
            story.append(Paragraph(_markdown_inline_to_richtext(line[3:]), styles["section"]))
            continue
        if line.startswith("# "):
            story.append(Paragraph(_markdown_inline_to_richtext(line[2:]), styles["section"]))
            continue

        if line.startswith("- ") or line.startswith("* "):
            story.append(
                Paragraph(
                    _markdown_inline_to_richtext(line[2:]),
                    styles["bullet"],
                    bulletText="•",
                )
            )
            continue

        story.append(Paragraph(_markdown_inline_to_richtext(line), styles["body"]))


def generate_pdf_and_get_url(
    *,
    report_id: int,
    title: str,
    content: str,
    base_url: str,
    chemical_compound: str | None = None,
    prompt: str | None = None,
    tokens_used: int | None = None,
) -> str:
    PDF_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    file_name = f"report_{report_id}.pdf"
    file_path = PDF_OUTPUT_DIR / file_name

    font_body, font_bold = _register_fonts()
    styles = _build_styles(font_body=font_body, font_bold=font_bold)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    doc = SimpleDocTemplate(
        str(file_path),
        pagesize=letter,
        leftMargin=0.72 * inch,
        rightMargin=0.72 * inch,
        topMargin=1.2 * inch,
        bottomMargin=0.72 * inch,
        title=title,
        author="ChemReport Studio",
    )

    story: list = []
    story.append(Paragraph(title, styles["title"]))
    story.append(Paragraph(f"Report #{report_id}", styles["body"]))
    story.append(Spacer(1, 8))

    metadata_rows = [
        ["Generated At", generated_at],
        ["Chemical Compound", chemical_compound or "N/A"],
        ["Tokens Used", str(tokens_used if tokens_used is not None else "N/A")],
    ]
    metadata_table = Table(metadata_rows, colWidths=[1.75 * inch, 4.7 * inch])
    metadata_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#E6F2FB")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1F2937")),
                ("FONTNAME", (0, 0), (0, -1), font_bold),
                ("FONTNAME", (1, 0), (1, -1), font_body),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#C5D7E8")),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#C5D7E8")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(metadata_table)

    if prompt:
        story.append(Spacer(1, 10))
        story.append(Paragraph("Prompt", styles["section"]))
        story.append(Paragraph(_markdown_inline_to_richtext(prompt).replace("\n", "<br/>"), styles["body"]))

    story.append(Spacer(1, 10))
    story.append(Paragraph("Report Content", styles["section"]))
    _append_content_paragraphs(story=story, content=content, styles=styles)

    doc.build(
        story,
        onFirstPage=lambda canv, d: _draw_header_footer(canv, d, title),
        onLaterPages=lambda canv, d: _draw_header_footer(canv, d, title),
    )

    return f"{base_url.rstrip('/')}/generated-pdfs/{file_name}"
