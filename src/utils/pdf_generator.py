from pathlib import Path
from textwrap import wrap

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

PDF_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "generated_pdfs"


def generate_pdf_and_get_url(
    *,
    report_id: int,
    title: str,
    content: str,
    base_url: str,
) -> str:
    PDF_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    file_name = f"report_{report_id}.pdf"
    file_path = PDF_OUTPUT_DIR / file_name

    pdf = canvas.Canvas(str(file_path), pagesize=letter)
    width, height = letter
    y = height - 50

    pdf.setTitle(title)
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(50, y, f"Report #{report_id}")
    y -= 24

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(50, y, f"Title: {title}")
    y -= 24

    pdf.setFont("Helvetica", 10)
    max_chars_per_line = 100
    for paragraph in content.splitlines() or [""]:
        wrapped_lines = wrap(paragraph, width=max_chars_per_line) or [""]
        for line in wrapped_lines:
            if y < 50:
                pdf.showPage()
                y = height - 50
                pdf.setFont("Helvetica", 10)
            pdf.drawString(50, y, line)
            y -= 14
        y -= 4

    pdf.save()

    return f"{base_url.rstrip('/')}/generated-pdfs/{file_name}"
