from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from fpdf import FPDF
import os
import unicodedata

# --- DADOS DO CURRÍCULO ---
NAME = "Bruno Giovani Pereira"
LOCATION = "Guarujá, SP"
CONTACTS = "brunogp.corretor@gmail.com | (13) 99124-8146"
LINKEDIN = "https://www.linkedin.com/in/beehgiovani/"
GITHUB = "https://github.com/beehgiovani/"

PRIMARY_COLOR_RGB = (0, 74, 153)
PRIMARY_COLOR_HEX = RGBColor(0, 74, 153)

SUMMARY = (
    "Software Engineer Full-Stack com especialização em Geotecnologia (GIS), Automação Avançada (OSINT/LegalTech) "
    "e Desenvolvimento Mobile Native. Expertise em arquiteturas de alto impacto: plataformas GIS de inteligência imobiliária, "
    "sistemas de extração de Big Data com modelos OCR customizados (PyTorch) e PWAs de escala industrial. "
    "Certificações recentes em Angular, Power BI e Storytelling pela University of Chicago. Criador do GuaruGeo e Cimed Experience."
)

EXPERIENCES = [
    {
        "title": "Senior Consultant (Kotlin) | Soo Tech",
        "period": "Jan. 2024 - Presente",
        "description": "Prestação de serviços de alto valor em Kotlin para cliente Agilidade via Soo Tech.",
        "bullets": [
            "Otimização de módulos críticos de performance em Kotlin, reduzindo a latência de processamento em 30%.",
            "Implementação de novas funcionalidades seguindo metodologias ágeis (Scrum/Kanban).",
            "Aplicação de padrões avançados de design (SOLID) para escalabilidade e manutenibilidade.",
            "Colaboração direta com equipes de produto para traduzir requisitos de negócio em soluções técnicas robustas."
        ]
    },
    {
        "title": "Founder & Lead Developer | GuaruGeo (Guarujá Geo Lab)",
        "period": "2023 - Presente",
        "description": "Plataforma GIS de inteligência imobiliária proprietária para o litoral paulista.",
        "bullets": [
            "Arquitetura Full-Stack: React 19, Node.js, Supabase (PostgreSQL + Realtime) e Firebase Hosting.",
            "Visualização GeoJSON avançada com Google Maps API e Overpass API; índice espacial RBush para performance extrema.",
            "Motor OSINT para identificação de titularidade, situação jurídica e enriquecimento de dados proprietários via API.",
            "Admin Dashboard com analytics em tempo real, CRM integrado e sistema automatizado de emissão de certidões.",
            "Projeto ao vivo: https://guarujainterativo.web.app/"
        ]
    },
    {
        "title": "Lead Developer | Cimed Experience",
        "period": "2024 - Março 2026",
        "description": "PWA de marketing e engajamento de escala industrial para a Cimed (Líder Nacional Farmacêutica).",
        "bullets": [
            "Stack: React 19, TypeScript, Vite, Framer Motion, Zustand e Supabase.",
            "Social Hub com rankings em tempo real, feed gamificado e missões de Drive-to-Store.",
            "Integração da IA 'Claud.ia' como assistente de saúde e produto; vídeo scraping e PWA nativo.",
            "Projeto ao vivo: https://cimedexperience.web.app/"
        ]
    },
    {
        "title": "Especialista em Automação & Data Engineering",
        "period": "2021 - Presente",
        "description": "Esteiras de extração de dados complexos e automação de processos críticos (LegalTech/GovTech).",
        "bullets": [
            "Scraper Imobiliário (2 estágios): HTTP + Playwright com Tor multi-porta e OCR customizado (PyTorch/CRNN).",
            "Certibot (LegalTech): Bot de emissão automática de certidões em 6+ portais (TRF3, TJSP, TST, Receita Federal).",
            "GIS Data Mining: Extração e normalização de polígonos de zoneamento a partir de documentos PDF/CAD.",
            "Automação de Certidões: Sistema Full-Stack com Supabase Edge Functions e InfoSimples API."
        ]
    }
]

SKILLS = {
    "Linguagens": "Javascript (React/Node), TypeScript, Angular, Python (Scraping/AI), Kotlin (Jetpack Compose), SQL.",
    "Cloud & Infra": "Supabase, Firebase, Docker, PostgreSQL, Linux Server, Git/GitHub, CI/CD.",
    "Data & Analytics": "Power BI, Geoprocessamento (GIS), Big Data, Web Scraping Anti-Bot.",
    "AI & Automation": "PyTorch (CRNN OCR), Playwright, ddddocr, Gemini API, Vertex AI, Computer Vision.",
    "Soft Skills": "Storytelling para Marketing Digital, Business English (Advanced), Gestão de Projetos Ágeis."
}

CERTIFICATIONS = [
    {"nome": "Angular", "org": "Loiane Training (28h)", "date": "Março 2026"},
    {"nome": "Storytelling para Marketing Digital", "org": "Santander / University of Chicago", "date": "10 de Março 2026"},
    {"nome": "Business English, Part 1", "org": "Santander Open Academy", "date": "Fevereiro 2026"},
    {"nome": "Power BI", "org": "Santander Open Academy", "date": "Janeiro 2026"}
]

EDUCATION = [
    "Bacharelado em Farmácia (Cursando) - Base para soluções HealthTech e Analytics Farmacêutico.",
    "Desenvolvimento de Sistemas - Especialização autônoma em Full-Stack e Engenharia de Dados de Alta Performance."
]

def remove_accents(input_str):
    if not isinstance(input_str, str): return input_str
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def create_docx_final(path):
    doc = Document()
    title = doc.add_heading(NAME, 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in title.runs: run.font.color.rgb = PRIMARY_COLOR_HEX
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(f"{LOCATION} | {CONTACTS}\n").font.size = Pt(10)
    p.add_run(f"LinkedIn: {LINKEDIN} | GitHub: {GITHUB}").font.size = Pt(10)
    
    sections = [
        ('Resumo Profissional', SUMMARY),
        ('Experiência Profissional e Projetos de Destaque', EXPERIENCES),
        ('Expertise Técnica (Hard Skills)', SKILLS),
        ('Certificações Recentes', CERTIFICATIONS),
        ('Formação Acadêmica', EDUCATION)
    ]
    for text, content in sections:
        h = doc.add_heading(text, level=1)
        for run in h.runs: run.font.color.rgb = PRIMARY_COLOR_HEX
        if text == 'Resumo Profissional': doc.add_paragraph(content)
        elif text == 'Experiência Profissional e Projetos de Destaque':
            for exp in content:
                p = doc.add_paragraph()
                run = p.add_run(exp['title'])
                run.bold, run.font.size, run.font.color.rgb = True, Pt(12), PRIMARY_COLOR_HEX
                p.add_run(f"  |  {exp['period']}")
                doc.add_paragraph(exp['description']).italic = True
                for bullet in exp['bullets']: doc.add_paragraph(bullet, style='List Bullet')
        elif text == 'Expertise Técnica (Hard Skills)':
            for k, v in content.items():
                p = doc.add_paragraph(); p.add_run(f"{k}: ").bold = True; p.add_run(v)
        elif text == 'Certificações Recentes':
            for cert in content: doc.add_paragraph(f"{cert['nome']} | {cert['org']} - {cert['date']}", style='List Bullet')
        elif text == 'Formação Acadêmica':
            for edu in content: doc.add_paragraph(edu, style='List Bullet')
    doc.save(path)

class PDF(FPDF):
    def header(self): pass
    def add_top_header(self):
        self.set_font('helvetica', 'B', 22)
        self.set_text_color(*PRIMARY_COLOR_RGB)
        self.cell(self.epw, 15, remove_accents(NAME), 0, 1, 'C')
        self.set_font('helvetica', '', 10)
        self.set_text_color(100, 100, 100)
        self.cell(self.epw, 7, f"{remove_accents(LOCATION)} | {remove_accents(CONTACTS)}", 0, 1, 'C')
        self.cell(self.epw, 7, f"LinkedIn: {LINKEDIN} | GitHub: {GITHUB}", 0, 1, 'C')
        self.ln(10)
    def section_title(self, title):
        self.set_font('helvetica', 'B', 12)
        self.set_fill_color(245, 248, 255) 
        self.set_text_color(*PRIMARY_COLOR_RGB)
        self.cell(self.epw, 10, f"  {remove_accents(title)}", 0, 1, 'L', 1)
        self.ln(2)
    def body_text(self, text, bullet=False, bold_prefix=""):
        self.set_font('helvetica', '', 10)
        self.set_text_color(50, 50, 50)
        prefix = "- " if bullet else ""
        clean_text = remove_accents(text)
        if bold_prefix:
            self.set_font('helvetica', 'B', 10)
            self.write(6, f"{prefix}{remove_accents(bold_prefix)}: ")
            self.set_font('helvetica', '', 10)
            self.multi_cell(self.epw, 6, clean_text)
        else:
            self.multi_cell(self.epw, 6, f"{prefix}{clean_text}")
        self.ln(1)

def create_pdf_final(path):
    pdf = PDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.add_top_header()
    
    sections = [
        ('RESUMO PROFISSIONAL', SUMMARY),
        ('EXPERIENCIA PROFISSIONAL E PROJETOS', EXPERIENCES),
        ('EXPERTISE TECNICA (HARD SKILLS)', SKILLS),
        ('CERTIFICACOES RECENTES', CERTIFICATIONS),
        ('FORMACAO ACADEMICA', EDUCATION)
    ]
    for title, content in sections:
        pdf.section_title(title)
        if title == 'RESUMO PROFISSIONAL': pdf.body_text(content)
        elif title == 'EXPERIENCIA PROFISSIONAL E PROJETOS':
            for exp in content:
                pdf.set_font('helvetica', 'B', 10); pdf.set_text_color(*PRIMARY_COLOR_RGB)
                pdf.cell(pdf.epw, 8, f"{remove_accents(exp['title'])}  |  {remove_accents(exp['period'])}", 0, 1)
                pdf.set_font('helvetica', 'I', 9); pdf.set_text_color(80, 80, 80)
                pdf.multi_cell(pdf.epw, 5, remove_accents(exp['description']))
                for b in exp['bullets']: pdf.body_text(b, bullet=True)
                pdf.ln(2)
        elif title == 'EXPERTISE TECNICA (HARD SKILLS)':
            for k, v in content.items(): pdf.body_text(v, bold_prefix=k)
        elif title == 'CERTIFICACOES RECENTES':
            for c in content: pdf.body_text(f"{c['nome']} | {c['org']} - {c['date']}", bullet=True)
        elif title == 'FORMACAO ACADEMICA':
            for e in content: pdf.body_text(e, bullet=True)

    pdf.output(path)

if __name__ == "__main__":
    downloads_path = r"C:\Users\bruno\Downloads"
    out_docx = os.path.join(downloads_path, "Curriculo_Premium_Bruno_Pereira.docx")
    out_pdf = os.path.join(downloads_path, "Curriculo_Premium_Bruno_Pereira.pdf")
    create_docx_final(out_docx)
    create_pdf_final(out_pdf)
    print(f"Gerado: {out_docx}\nGerado: {out_pdf}")
