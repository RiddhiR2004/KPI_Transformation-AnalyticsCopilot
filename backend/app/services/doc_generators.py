from __future__ import annotations

import io
from pathlib import Path
from typing import Any

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

from app.models import FunctionalSpecItem, BusinessContext


def set_cell_shading(cell: Any, color_hex: str) -> None:
    """Applies background color to a docx table cell."""
    shading_xml = f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>'
    cell._tc.get_or_add_tcPr().append(parse_xml(shading_xml))


def set_cell_margins(cell: Any, top: int = 100, bottom: int = 100, left: int = 150, right: int = 150) -> None:
    """Applies internal padding to a docx table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)


def generate_docx_spec(path: Path, items: list[FunctionalSpecItem], context: BusinessContext) -> None:
    """Generates a premium consulting-grade Word Document for the KPI Functional Specifications."""
    doc = Document()
    
    # Configure page margins (0.75 inch)
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # Document Styles
    styles = doc.styles
    normal_style = styles['Normal']
    normal_font = normal_style.font
    normal_font.name = 'Calibri'
    normal_font.size = Pt(11)
    normal_font.color.rgb = RGBColor(30, 30, 30)

    # --- Title Page / Cover Section ---
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(36)
    title_p.paragraph_format.space_after = Pt(6)
    title_run = title_p.add_run("EY KPI Advisory & Analytics Copilot")
    title_run.font.name = 'Calibri'
    title_run.font.size = Pt(13)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(180, 150, 0) # Muted EY Gold

    main_title_p = doc.add_paragraph()
    main_title_p.paragraph_format.space_after = Pt(24)
    main_title_run = main_title_p.add_run("KPI Functional Specification")
    main_title_run.font.name = 'Calibri'
    main_title_run.font.size = Pt(28)
    main_title_run.font.bold = True
    main_title_run.font.color.rgb = RGBColor(27, 27, 27)

    # Accent yellow bar under title
    accent_table = doc.add_table(rows=1, cols=1)
    accent_table.autofit = False
    accent_table.columns[0].width = Inches(7.0)
    accent_cell = accent_table.cell(0, 0)
    set_cell_shading(accent_cell, "FFE600") # EY Yellow
    set_cell_margins(accent_cell, top=30, bottom=30, left=0, right=0)
    
    intro_p = doc.add_paragraph()
    intro_p.paragraph_format.space_before = Pt(24)
    intro_p.paragraph_format.space_after = Pt(18)
    intro_p.add_run(
        "This deliverable acts as the governed source-of-truth for key performance indicators. "
        "It details business objectives, metric calculations, underlying source systems, operational custodians, and assumptions. "
        "These definitions form the specifications for downstream SAP Datasphere scripting and analytics engineering."
    )

    # --- Business Scope Callout Box ---
    scope_title = doc.add_paragraph()
    scope_title.paragraph_format.space_before = Pt(12)
    scope_title.paragraph_format.space_after = Pt(6)
    scope_title_run = scope_title.add_run("Strategic Transformation Scope")
    scope_title_run.font.size = Pt(14)
    scope_title_run.font.bold = True
    scope_title_run.font.color.rgb = RGBColor(27, 27, 27)

    scope_table = doc.add_table(rows=4, cols=2)
    scope_table.style = 'Table Grid'
    scope_fields = [
        ("Industry Sector", context.industry),
        ("Organizational Level", context.organization_level),
        ("Target Functional Areas", ", ".join(context.functional_areas)),
        ("Strategic KPI Count", f"{len(items)} Approved Performance Metrics")
    ]
    for i, (label, val) in enumerate(scope_fields):
        row = scope_table.rows[i]
        
        cell_lbl = row.cells[0]
        cell_lbl.text = label
        set_cell_shading(cell_lbl, "F0F0F0")
        set_cell_margins(cell_lbl, top=80, bottom=80, left=100, right=100)
        cell_lbl.paragraphs[0].runs[0].font.bold = True
        cell_lbl.paragraphs[0].runs[0].font.size = Pt(9.5)
        cell_lbl.width = Inches(2.2)

        cell_val = row.cells[1]
        cell_val.text = str(val)
        set_cell_margins(cell_val, top=80, bottom=80, left=100, right=100)
        cell_val.paragraphs[0].runs[0].font.size = Pt(9.5)
        cell_val.width = Inches(4.8)

    doc.add_page_break()

    # --- KPI Spec Entries ---
    kpi_heading = doc.add_paragraph()
    kpi_heading_run = kpi_heading.add_run("Governed Metric Specifications")
    kpi_heading_run.font.size = Pt(18)
    kpi_heading_run.font.bold = True
    kpi_heading_run.font.color.rgb = RGBColor(27, 27, 27)
    kpi_heading.paragraph_format.space_after = Pt(12)

    for index, item in enumerate(items, start=1):
        kpi_p = doc.add_paragraph()
        kpi_p.paragraph_format.space_before = Pt(18)
        kpi_p.paragraph_format.space_after = Pt(8)
        kpi_p.paragraph_format.keep_with_next = True
        
        num_run = kpi_p.add_run(f"Metric {index:02d}: ")
        num_run.font.size = Pt(13)
        num_run.font.bold = True
        num_run.font.color.rgb = RGBColor(180, 150, 0)
        
        name_run = kpi_p.add_run(item.kpi_name)
        name_run.font.size = Pt(13)
        name_run.font.bold = True
        name_run.font.color.rgb = RGBColor(27, 27, 27)

        # Specifications Table for this KPI
        spec_table = doc.add_table(rows=8, cols=2)
        spec_table.style = 'Table Grid'
        
        spec_data = [
            ("Business Purpose", item.business_purpose),
            ("Formula Logic", item.formula),
            ("Calculation / Business Logic", item.business_logic),
            ("Source System", item.source_system),
            ("Data Custodian / Owner", item.data_owner),
            ("Refresh Frequency", item.refresh_frequency),
            ("Business Assumptions", item.assumptions),
            ("Reporting Requirements", item.reporting_requirements)
        ]

        for r_idx, (label, text_val) in enumerate(spec_data):
            row = spec_table.rows[r_idx]
            
            c_lbl = row.cells[0]
            c_lbl.text = label
            set_cell_shading(c_lbl, "F9F9F9")
            set_cell_margins(c_lbl, top=70, bottom=70, left=100, right=100)
            c_lbl.paragraphs[0].runs[0].font.bold = True
            c_lbl.paragraphs[0].runs[0].font.size = Pt(9.5)
            c_lbl.width = Inches(2.2)

            c_val = row.cells[1]
            c_val.text = str(text_val or "To be detailed during workshop.")
            set_cell_margins(c_val, top=70, bottom=70, left=100, right=100)
            c_val.paragraphs[0].runs[0].font.size = Pt(9.5)
            c_val.width = Inches(4.8)

        # Space separator
        doc.add_paragraph().paragraph_format.space_after = Pt(12)

    doc.save(path)


# --- Custom PDF Canvas for ReportLab to support running headers & page numbers ---
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict[str, Any]] = []

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages: int) -> None:
        self.saveState()
        
        # Suppress headers/footers on the title page
        if self._pageNumber == 1:
            self.restoreState()
            return

        # Top border accent (EY Yellow)
        self.setFillColor(colors.HexColor("#FFE600"))
        self.rect(0, 782, 612, 10, fill=True, stroke=False)

        # Header Text
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#1B1B1B"))
        self.drawString(54, 760, "EY KPI ADVISORY & ANALYTICS COPILOT")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#666666"))
        self.drawRightString(558, 760, "KPI FUNCTIONAL SPECIFICATION")

        # Top separator line
        self.setStrokeColor(colors.HexColor("#DCDCD9"))
        self.setLineWidth(0.5)
        self.line(54, 750, 558, 750)

        # Bottom separator line & footer text
        self.line(54, 55, 558, 55)
        self.drawString(54, 40, "Confidential - Advisory Work Product")
        self.drawRightString(558, 40, f"Page {self._pageNumber} of {total_pages}")
        
        self.restoreState()


def generate_pdf_spec(path: Path, items: list[FunctionalSpecItem], context: BusinessContext) -> None:
    """Generates a premium client-ready PDF document utilizing ReportLab's flowable architecture."""
    # Letter size: 612 x 792 pt. Top/Bottom Margins: 72 pt, Left/Right: 54 pt.
    doc = SimpleDocTemplate(
        str(path),
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    ey_yellow = colors.HexColor("#FFE600")
    dark_gray = colors.HexColor("#1B1B1B")
    border_color = colors.HexColor("#DCDCD9")
    text_color = colors.HexColor("#2C2C2A")

    # Typography / Paragraph Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=dark_gray,
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=12,
        textColor=colors.HexColor("#B49600"),
        spaceAfter=10,
        textTransform='uppercase'
    )

    body_style = ParagraphStyle(
        'SpecBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=text_color
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=dark_gray,
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True
    )

    kpi_title_style = ParagraphStyle(
        'KpiTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=dark_gray,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )

    tbl_label_style = ParagraphStyle(
        'TblLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=dark_gray
    )

    tbl_value_style = ParagraphStyle(
        'TblValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=text_color
    )

    story = []

    # --- Cover Page Layout ---
    story.append(Spacer(1, 100))
    story.append(Paragraph("EY KPI Advisory & Analytics Copilot", subtitle_style))
    story.append(Paragraph("KPI Functional Specification", title_style))
    
    # Yellow colored accent bar
    bar_data = [['']]
    bar_table = Table(bar_data, colWidths=[504], rowHeights=[4])
    bar_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), ey_yellow),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(bar_table)
    story.append(Spacer(1, 24))

    intro_txt = (
        "This deliverable acts as the governed source-of-truth for key performance indicators. "
        "It details business objectives, metric calculations, underlying source systems, operational custodians, and assumptions. "
        "These definitions form the specifications for downstream SAP Datasphere scripting and analytics engineering."
    )
    story.append(Paragraph(intro_txt, body_style))
    story.append(Spacer(1, 40))

    # --- Scope Summary Card ---
    story.append(Paragraph("Strategic Transformation Scope", section_heading))
    
    scope_data = [
        [Paragraph("Industry Sector", tbl_label_style), Paragraph(context.industry, tbl_value_style)],
        [Paragraph("Organizational Level", tbl_label_style), Paragraph(context.organization_level, tbl_value_style)],
        [Paragraph("Functional Areas Covered", tbl_label_style), Paragraph(", ".join(context.functional_areas), tbl_value_style)],
        [Paragraph("Strategic Metric Count", tbl_label_style), Paragraph(f"{len(items)} Approved Performance Metrics", tbl_value_style)],
    ]
    scope_tbl = Table(scope_data, colWidths=[150, 354])
    scope_tbl.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F0F0F0")),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(scope_tbl)
    
    story.append(PageBreak())

    # --- KPI Spec Section ---
    story.append(Paragraph("Governed Metric Specifications", section_heading))
    story.append(Spacer(1, 10))

    for idx, item in enumerate(items, start=1):
        kpi_elements = []
        kpi_header_text = f"<font color='#B49600'>Metric {idx:02d}:</font> {item.kpi_name}"
        kpi_elements.append(Paragraph(kpi_header_text, kpi_title_style))

        spec_rows = [
            [Paragraph("Business Purpose", tbl_label_style), Paragraph(item.business_purpose, tbl_value_style)],
            [Paragraph("Formula Logic", tbl_label_style), Paragraph(item.formula, tbl_value_style)],
            [Paragraph("Business Logic Detail", tbl_label_style), Paragraph(item.business_logic, tbl_value_style)],
            [Paragraph("Source System Mapping", tbl_label_style), Paragraph(item.source_system, tbl_value_style)],
            [Paragraph("Data Owner / Custodian", tbl_label_style), Paragraph(item.data_owner, tbl_value_style)],
            [Paragraph("Refresh Cadence", tbl_label_style), Paragraph(item.refresh_frequency, tbl_value_style)],
            [Paragraph("Key Assumptions", tbl_label_style), Paragraph(item.assumptions, tbl_value_style)],
            [Paragraph("Reporting Requirements", tbl_label_style), Paragraph(item.reporting_requirements, tbl_value_style)],
        ]
        
        spec_tbl = Table(spec_rows, colWidths=[140, 364])
        spec_tbl.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, border_color),
            ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#F9F9F9")),
            ('PADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        
        kpi_elements.append(spec_tbl)
        kpi_elements.append(Spacer(1, 20))
        
        # Prevent page splits inside a single KPI table if possible
        story.append(KeepTogether(kpi_elements))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
