from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "output" / "pdf" / "Iris_Wei_Resume_One_Page.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

BLUE = colors.HexColor("#2F73B9")
INK = colors.HexColor("#161616")
MUTED = colors.HexColor("#4D4D4D")
LIGHT = colors.HexColor("#D7E4F2")

styles = getSampleStyleSheet()
name_style = ParagraphStyle(
    "Name", parent=styles["Normal"], fontName="Helvetica", fontSize=27,
    leading=29, textColor=INK, spaceAfter=0,
)
contact_style = ParagraphStyle(
    "Contact", parent=styles["Normal"], fontName="Helvetica", fontSize=8.9,
    leading=11, textColor=MUTED, alignment=TA_RIGHT,
)
section_style = ParagraphStyle(
    "Section", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=11.5,
    leading=13, textColor=BLUE, spaceBefore=7.2, spaceAfter=3.6,
)
body_style = ParagraphStyle(
    "Body", parent=styles["Normal"], fontName="Helvetica", fontSize=9.8,
    leading=12.25, textColor=INK, spaceAfter=0,
)
skill_label_style = ParagraphStyle(
    "SkillLabel", parent=body_style, fontName="Helvetica-Bold", textColor=INK,
)
job_style = ParagraphStyle(
    "Job", parent=body_style, fontName="Helvetica-Bold", fontSize=10.35, leading=12.5,
)
date_style = ParagraphStyle(
    "Date", parent=body_style, fontSize=9.05, leading=11.1, textColor=MUTED, alignment=TA_RIGHT,
)
bullet_style = ParagraphStyle(
    "Bullet", parent=body_style, leftIndent=9, firstLineIndent=-6.5,
    bulletIndent=0, spaceBefore=1, spaceAfter=0.8,
)
edu_style = ParagraphStyle(
    "Education", parent=body_style, fontSize=9.5, leading=11.6,
)


def section(title):
    return KeepTogether([
        Spacer(1, 1.5),
        Table(
            [[Paragraph(title.upper(), section_style), ""]],
            colWidths=[2.05 * inch, 5.22 * inch],
            style=TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("LINEBELOW", (1, 0), (1, 0), 0.7, LIGHT),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ]),
        ),
    ])


def job_header(title, company, location, dates):
    left = Paragraph(f"{title} | <font name='Helvetica'>{company}, {location}</font>", job_style)
    right = Paragraph(dates, date_style)
    return Table(
        [[left, right]],
        colWidths=[5.82 * inch, 1.45 * inch],
        style=TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0.4),
        ]),
    )


def bullet(text):
    return Paragraph(f"- {text}", bullet_style)


doc = SimpleDocTemplate(
    str(OUTPUT), pagesize=LETTER,
    rightMargin=0.5 * inch, leftMargin=0.5 * inch,
    topMargin=0.34 * inch, bottomMargin=0.32 * inch,
    title="Iris Wei - Resume", author="Iris Wei",
)

story = []
story.append(Table(
    [[
        Paragraph("Iris Wei", name_style),
        Paragraph("Seattle, WA 98121<br/>206-883-1009 &nbsp;|&nbsp; iris333wei@gmail.com", contact_style),
    ]],
    colWidths=[3.7 * inch, 3.57 * inch],
    style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]),
))
story.append(HRFlowable(width="100%", thickness=1.2, color=BLUE, spaceBefore=0, spaceAfter=2))

story.append(section("Summary"))
story.append(Paragraph(
    "Senior Software Engineer and startup Co-Founder with 8+ years of experience building AI-powered products "
    "and large-scale backend and full-stack platforms. Co-founded SproutCue and lead product engineering across "
    "web, iOS, and Android. Previously delivered high-impact systems at Google and Snap that improved automation, "
    "reliability, development speed, and operating cost.",
    body_style,
))

story.append(section("Skills"))
skills = [
    ("Languages", "Java, Kotlin, Python, Scala, SQL, JavaScript/TypeScript, HTML/CSS"),
    ("AI Engineering", "OpenAI Responses API, GPT Image API, multimodal AI, prompt engineering, structured outputs, AI safety workflows"),
    ("Platforms", "React, Expo/React Native, Supabase/PostgreSQL, Spanner, DynamoDB, Spark, Hadoop, Docker, Kubernetes, AWS, Git"),
]
story.append(Table(
    [[Paragraph(label, skill_label_style), Paragraph(value, body_style)] for label, value in skills],
    colWidths=[0.93 * inch, 6.34 * inch],
    style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0.4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.4),
    ]),
))

story.append(section("Professional Experience"))

story.append(job_header("Co-Founder", "SproutCue Inc.", "Seattle, WA", "Apr 2026 - Present"))
story.append(bullet(
    "Built a cross-platform family companion for web, iOS, and Android that helps parents discover local activities, "
    "organize playdates, and create personalized developmental content for young children."
))
story.append(bullet(
    "Developed an AI Play Studio for personalized picture books, practice stories, and toy-based play ideas; early "
    "testing produced 24 personalized AI creations and 59 completed picture-book pages."
))
story.append(bullet(
    "Designed secure, production-oriented infrastructure with Supabase Auth, row-level security, private photo storage, "
    "asynchronous AI jobs, push notifications, 37 API route modules, and 233 passing automated tests."
))

story.append(job_header("Senior Software Engineer", "Google LLC", "Seattle, WA", "Feb 2020 - Oct 2025"))
story.append(bullet(
    "Founding member of Unified Support Service; built an AI-powered User Journey Service using domain classification "
    "and intent detection, achieving an 87% user deflection rate."
))
story.append(bullet(
    "Designed semantic search that increased long click-through rate by 3.75% and successful support-query resolution by 2.3%."
))
story.append(bullet(
    "Pioneered Flow Maker, modernizing legacy workflow development and reducing development time by 40%, saving $1.6M annually."
))
story.append(bullet(
    "Led migration of 3 event-driven components and 49 local events to platform models, increasing team velocity by 55%; "
    "re-architected compatibility tests to cut runtime from 20 minutes to 5 minutes."
))

story.append(job_header("Software Engineer", "Snap Inc.", "Seattle, WA", "Mar 2018 - Feb 2020"))
story.append(bullet(
    "Built core APIs and a React/DynamoDB console for BOLT, Snapchat's media storage and delivery platform, reducing storage "
    "and bandwidth costs by $350K annually."
))
story.append(bullet(
    "Migrated 90% of on-demand bandwidth - approximately 600 TB per week - to BOLT and released an upload tool used by 10+ teams."
))

story.append(job_header("R&D Engineer Intern", "Tupl Inc.", "Bellevue, WA", "Jun 2017 - Dec 2017"))
story.append(bullet(
    "Developed APIs and Spark/Scala/HBase data utilities for telecom KPI preprocessing and station analysis."
))

story.append(section("Education"))
story.append(Table(
    [[
        Paragraph("<b>University of Washington</b> - B.S., Electrical Engineering", edu_style),
        Paragraph("2013 - 2017", date_style),
    ], [
        Paragraph("Dean's List (10 quarters) &nbsp;|&nbsp; CoMotion Mary Gates Scholarship (2016)", edu_style),
        "",
    ]],
    colWidths=[5.82 * inch, 1.45 * inch],
    style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("SPAN", (0, 1), (1, 1)),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]),
))

doc.build(story)
print(OUTPUT)
