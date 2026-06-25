import os
import time
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from typing import List, Dict
from app.config import settings

def generate_verification_pdf(email: str, category: str, verification_code: str, summary_data: List[Dict[str, str]]) -> str:
    """
    Generates a PDF receipt containing the student's submission details and verification code.
    Saves it to the UPLOAD_DIR and returns the file path.
    """
    # Ensure directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Generate filename
    timestamp = int(time.time())
    safe_email = email.replace("@", "_at_").replace(".", "_")
    filename = f"receipt_{safe_email}_{timestamp}.pdf"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    # Setup document
    doc = SimpleDocTemplate(file_path, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CenterTitle', alignment=1, fontSize=16, spaceAfter=10))
    styles.add(ParagraphStyle(name='CenterSubtitle', alignment=1, fontSize=12, spaceAfter=20))
    styles.add(ParagraphStyle(name='CodeStyle', alignment=1, fontSize=18, textColor=colors.HexColor('#2b6cb0'), spaceAfter=20, fontName='Helvetica-Bold'))
    
    elements = []
    
    # Title
    elements.append(Paragraph("NORTH EASTERN MINDANAO STATE UNIVERSITY", styles['CenterTitle']))
    elements.append(Paragraph("Office of Student Welfare and Development", styles['CenterSubtitle']))
    elements.append(Spacer(1, 12))
    
    # Intro
    elements.append(Paragraph("<b>Pre-Enrollment Profiling Completed</b>", styles['Heading3']))
    elements.append(Paragraph("Your OSWD Student Profile for the current semester has been successfully submitted and verified.", styles['Normal']))
    elements.append(Paragraph("Please present this receipt and the unique verification code below to the Registrar's Office to proceed with your enrollment.", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Verification Code
    elements.append(Paragraph("Unique Verification Code", styles['CenterSubtitle']))
    elements.append(Paragraph(verification_code, styles['CodeStyle']))
    elements.append(Spacer(1, 20))
    
    # Summary Details Table
    data = [
        ["Student Email", email],
        ["Student Category", category],
    ]
    
    for item in summary_data:
        question = item.get("question", "N/A")
        answer = item.get("answer", "N/A")
        # Truncate very long answers if needed, or wrap in Paragraph.
        # Paragraph can be used inside tables.
        data.append([Paragraph(question, styles['Normal']), Paragraph(answer, styles['Normal'])])
        
    table = Table(data, colWidths=[150, 300])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 1), colors.whitesmoke),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 1, colors.lightgrey),
        ('PADDING', (0, 0), (-1, -1), 6),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 30))
    
    # Footer
    elements.append(Paragraph("Generated automatically by OSWD Student Profiling System.", styles['Italic']))
    elements.append(Paragraph(f"Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}", styles['Italic']))
    
    # Build PDF
    doc.build(elements)
    
    return file_path
