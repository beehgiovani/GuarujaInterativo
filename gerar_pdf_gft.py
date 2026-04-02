# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUTPUT = r"C:\Users\bruno\AndroidStudioProjects\guaruja_geo_lab\Roteiro_Entrevista_GFT_Bruno.pdf"

# ── Cores ─────────────────────────────────────────────────────────────────────
AZUL_ESCURO  = colors.HexColor("#0D2137")
AZUL_MEDIO   = colors.HexColor("#1A4A7A")
AZUL_CLARO   = colors.HexColor("#2E86C1")
VERDE        = colors.HexColor("#1A7A4A")
LARANJA      = colors.HexColor("#E67E22")
AMARELO_BG   = colors.HexColor("#FEF9E7")
AZUL_BG      = colors.HexColor("#EBF5FB")
VERDE_BG     = colors.HexColor("#EAFAF1")
VERMELHO_BG  = colors.HexColor("#FDEDEC")
CINZA_CLARO  = colors.HexColor("#F4F6F7")
CINZA_BORDA  = colors.HexColor("#BDC3C7")
BRANCO       = colors.white
PRETO        = colors.HexColor("#1C2833")

doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    rightMargin=1.8*cm, leftMargin=1.8*cm,
    topMargin=1.5*cm, bottomMargin=1.5*cm
)

styles = getSampleStyleSheet()

def S(name, parent="Normal", **kw):
    return ParagraphStyle(name, parent=styles[parent], **kw)

# Estilos personalizados
sTitle      = S("sTitle",      fontSize=22, textColor=BRANCO,    alignment=TA_CENTER, fontName="Helvetica-Bold", leading=28, spaceAfter=4)
sSubtitle   = S("sSubtitle",   fontSize=11, textColor=BRANCO,    alignment=TA_CENTER, fontName="Helvetica",      leading=16)
sBloco      = S("sBloco",      fontSize=13, textColor=BRANCO,    fontName="Helvetica-Bold", leading=20, spaceAfter=4, spaceBefore=12)
sH2         = S("sH2",         fontSize=11, textColor=AZUL_ESCURO, fontName="Helvetica-Bold", leading=16, spaceBefore=10, spaceAfter=4)
sH3         = S("sH3",         fontSize=10, textColor=AZUL_MEDIO,  fontName="Helvetica-Bold", leading=14, spaceBefore=8, spaceAfter=2)
sBody       = S("sBody",       fontSize=9,  textColor=PRETO,     fontName="Helvetica",      leading=14, spaceAfter=4, alignment=TA_JUSTIFY)
sQuote      = S("sQuote",      fontSize=9,  textColor=AZUL_ESCURO, fontName="Helvetica-Oblique", leading=14, spaceAfter=2, leftIndent=8, rightIndent=8)
sBullet     = S("sBullet",     fontSize=9,  textColor=PRETO,     fontName="Helvetica",      leading=13, leftIndent=12, spaceAfter=2)
sCheck      = S("sCheck",      fontSize=9,  textColor=VERDE,     fontName="Helvetica",      leading=13, leftIndent=12, spaceAfter=2)
sWarning    = S("sWarning",    fontSize=9,  textColor=colors.HexColor("#7B241C"), fontName="Helvetica", leading=13, leftIndent=8)
sTip        = S("sTip",        fontSize=9,  textColor=colors.HexColor("#1A5276"), fontName="Helvetica", leading=13, leftIndent=8)
sNote       = S("sNote",       fontSize=9,  textColor=colors.HexColor("#145A32"), fontName="Helvetica", leading=13, leftIndent=8)
sCheatCode  = S("sCheatCode",  fontSize=8,  textColor=PRETO,     fontName="Helvetica",      leading=13, leftIndent=8, rightIndent=8, alignment=TA_JUSTIFY)
sFooter     = S("sFooter",     fontSize=8,  textColor=CINZA_BORDA, fontName="Helvetica-Oblique", alignment=TA_CENTER)


def header_box(text, color=AZUL_MEDIO):
    """Cria um bloco colorido de cabeçalho de seção."""
    data = [[Paragraph(text, sBloco)]]
    t = Table(data, colWidths=[17.4*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), color),
        ('ROWPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('ROUNDEDCORNERS', [6]),
    ]))
    return t


def info_box(text, bg=AZUL_BG, border=AZUL_CLARO, style=sTip):
    data = [[Paragraph(text, style)]]
    t = Table(data, colWidths=[17.4*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg),
        ('BOX', (0,0), (-1,-1), 1.2, border),
        ('ROWPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    return t


def quote_box(text):
    data = [[Paragraph(text, sQuote)]]
    t = Table(data, colWidths=[17.4*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CINZA_CLARO),
        ('LEFTPADDING', (0,0), (-1,-1), 16),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LINEBEFORE', (0,0), (0,-1), 4, AZUL_CLARO),
    ]))
    return t


def bullet(text, icon="•"):
    return Paragraph(f"<b>{icon}</b>  {text}", sBullet)


def check(text):
    return Paragraph(f"<font color='#1A7A4A'>✓</font>  {text}", sCheck)


def qa_block(pergunta, resposta_paragraphs):
    """Bloco de pergunta + resposta."""
    items = []
    items.append(info_box(f"❓  <b>{pergunta}</b>", bg=AZUL_BG, border=AZUL_CLARO, style=sTip))
    items.append(Spacer(1, 4))
    items.append(quote_box(resposta_paragraphs))
    items.append(Spacer(1, 8))
    return KeepTogether(items)


story = []

# ══════════════════════════════════════════════════════════════════════════════
# CAPA
# ══════════════════════════════════════════════════════════════════════════════
cover_data = [[
    Paragraph("🎯  ROTEIRO MESTRE", sTitle),
    Paragraph("ENTREVISTA GFT", sTitle),
    Spacer(1, 6),
    Paragraph("Bruno Giovani Pereira  ·  Java / Kotlin Senior  ·  Nível L3", sSubtitle),
    Spacer(1, 4),
    Paragraph("Hoje às 18:30  ·  Microsoft Teams  ·  Fabiana — Talent GFT", sSubtitle),
]]
cover_table = Table([[cover_data[0]]], colWidths=[17.4*cm])
cover_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), AZUL_ESCURO),
    ('ROWPADDING', (0,0), (-1,-1), 22),
    ('TOPPADDING', (0,0), (-1,-1), 28),
    ('BOTTOMPADDING', (0,0), (-1,-1), 28),
    ('LEFTPADDING', (0,0), (-1,-1), 20),
    ('RIGHTPADDING', (0,0), (-1,-1), 20),
    ('ROUNDEDCORNERS', [10]),
]))
story.append(cover_table)
story.append(Spacer(1, 14))

story.append(info_box(
    "📌  <b>COMO USAR:</b> Deixe este PDF aberto em segunda tela durante a call. "
    "Cada bloco tem um emoji para achar rápido. Termos técnicos estão com pronúncia entre parênteses.",
    bg=AMARELO_BG, border=LARANJA, style=sTip
))
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════════════════════
# BLOCO 1 — AUTO-APRESENTAÇÃO
# ══════════════════════════════════════════════════════════════════════════════
story.append(header_box("🎬  BLOCO 1 — AUTO-APRESENTAÇÃO  (fale por ~2 minutos)", AZUL_MEDIO))
story.append(Spacer(1, 6))

apresentacao = (
    '"Olá, boa tarde! Meu nome é <b>Bruno Giovani</b>, tenho 32 anos, sou de Guarujá, SP, '
    'e atuo como desenvolvedor Full-Stack há 6 anos.<br/><br/>'
    'Minha trajetória é bastante prática: comecei pelo ecossistema <b>Android com Kotlin e Java</b> — '
    'desenvolvi aplicativos nativos como o <b>NidusCare</b> <i>(Nidus-Ker)</i>, um app de saúde para cuidadores, '
    'usando arquitetura <b>MVVM</b>, <b>Hilt</b> para injeção de dependências e <b>Coroutines</b> para programação assíncrona.<br/><br/>'
    'Hoje sou Consultor Sênior na <b>Soo Tech</b>, entregando soluções escaláveis com foco em <b>SOLID</b>, '
    'código limpo e colaboração em times <b>Scrum/Kanban</b>.<br/><br/>'
    'Paralelamente, fundei dois projetos: o <b>GuaruGeo</b> <i>(Guarú-Jeo)</i>, plataforma GIS imobiliária '
    'com React e Node.js em produção, e o <b>PredictMed</b>, um SaaS de automação de compras para farmácias '
    'com inteligência preditiva.<br/><br/>'
    'Estou aqui na GFT para trabalhar em escala real, em projetos financeiros de alta criticidade, '
    'dentro de um time de referência internacional. Muito animado com essa conversa!"'
)
story.append(quote_box(apresentacao))
story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════════════════════
# BLOCO 2 — PRONUNCIA
# ══════════════════════════════════════════════════════════════════════════════
story.append(header_box("🔑  BLOCO 2 — COMO PRONUNCIAR OS TERMOS TÉCNICOS", VERDE))
story.append(Spacer(1, 6))

termos = [
    ["Kotlin", "Kót-lin"],
    ["Coroutines", "Koro-rú-tinz"],
    ["MVVM", "Emm-Vi-Vi-Emm"],
    ["Spring Boot", "Spring Bút"],
    ["Microservices", "Máicro-sér-vi-sis"],
    ["AWS Lambda", "Lâm-da"],
    ["SQS / SNS", "Ess-Kiú-Ess / Ess-Enn-Ess"],
    ["Kafka", "Káf-ka"],
    ["Docker", "Dó-ker"],
    ["Kubernetes", "Kubér-né-tis"],
    ["CI/CD", "Sí-ai / Sí-dí"],
    ["PostgreSQL", "Póst-grés-Kiú-El"],
    ["API RESTful", "Éi-Pi-Ai RÉSt-ful"],
    ["Supabase", "Súpa-beis"],
    ["TypeScript", "Táip-Skripte"],
    ["Node.js", "Nód-Jota-Ess"],
    ["Serverless", "Sér-ver-les"],
    ["JVM", "Jí-Vi-Emm"],
    ["GIS", "Jí-Ai-Ess"],
    ["PyTorch", "Pài-Tórtch"],
]

# Dividir em 2 colunas
metade = len(termos) // 2
col1 = termos[:metade + (len(termos) % 2)]
col2 = termos[metade + (len(termos) % 2):]

def make_termo_subtable(lista):
    rows = []
    for termo, pron in lista:
        rows.append([
            Paragraph(f"<b>{termo}</b>", S("tk", fontSize=8, fontName="Helvetica-Bold", leading=12, textColor=AZUL_MEDIO)),
            Paragraph(pron, S("tp", fontSize=8, fontName="Helvetica-Oblique", leading=12, textColor=PRETO)),
        ])
    t = Table(rows, colWidths=[3.8*cm, 4.4*cm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [BRANCO, CINZA_CLARO]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('GRID', (0,0), (-1,-1), 0.5, CINZA_BORDA),
    ]))
    return t

pron_table = Table(
    [[make_termo_subtable(col1), Spacer(1,1), make_termo_subtable(col2)]],
    colWidths=[8.3*cm, 0.8*cm, 8.3*cm]
)
story.append(pron_table)
story.append(Spacer(1, 10))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════════════
# BLOCO 3 — PERGUNTAS E RESPOSTAS
# ══════════════════════════════════════════════════════════════════════════════
story.append(header_box("💡  BLOCO 3 — PERGUNTAS PROVÁVEIS + SUAS RESPOSTAS", AZUL_MEDIO))
story.append(Spacer(1, 8))

qas = [
    (
        "Me conte sobre sua experiência com Java e Kotlin",
        'Trabalho com Java desde 2020. A evolução natural foi para Kotlin — interoperáveis na <b>JVM</b> <i>(Jí-Vi-Emm)</i>.<br/><br/>'
        'No <b>NidusCare</b>, desenvolvi a camada de negócio em Kotlin com MVVM limpo, usando <b>Hilt</b> para injeção de dependências, '
        '<b>Coroutines</b> para operações assíncronas e <b>Gemini Vision</b> para análise de prescrições com IA.<br/><br/>'
        'Na <b>Soo Tech</b>, atuo em módulos críticos de performance sempre seguindo os princípios <b>SOLID</b> '
        'e colaboração próxima com produto.'
    ),
    (
        "Qual é sua experiência com arquitetura de microsserviços?",
        'No <b>PredictMed</b>, implementei <b>Supabase Edge Functions</b> — funções serverless equivalentes a <b>AWS Lambda</b>. '
        'Cada função tem responsabilidade única: cotação, análise preditiva, detecção de ruptura — comunicando via <b>API RESTful</b>.<br/><br/>'
        'No <b>GuaruGeo</b>, tenho agentes Python isolados comunicando-se de forma assíncrona — o mesmo conceito de serviços desacoplados.<br/><br/>'
        'Sobre mensageria como <b>Kafka</b> <i>(Káf-ka)</i> ou <b>SQS</b>: tenho domínio do conceito pub/sub e estou expandindo isso na prática.'
    ),
    (
        "Como você trabalha com AWS?",
        '3 anos de AWS com foco em serviços práticos:<br/>'
        '• <b>EC2</b> — hospedagem de scrapers Python de longa duração<br/>'
        '• <b>S3</b> — armazenamento de documentos e assets<br/>'
        '• <b>Lambda</b> — funções serverless stateless <i>(steit-les)</i><br/>'
        '• <b>API Gateway</b> e <b>RDS</b>/PostgreSQL gerenciado<br/><br/>'
        'A GFT tem forte atuação AWS em sistemas financeiros de alta criticidade — quero aprofundar em <b>ECS</b>, <b>SQS</b>, <b>CloudWatch</b> <i>(Kláud-Wótch)</i>.'
    ),
    (
        "O que você sabe sobre Spring Boot?",
        'Conheço o ecossistema Spring — <b>Spring Boot</b> para aplicações standalone, <b>Spring Data</b> para persistência, '
        'e annotations como <b>@RestController</b>, <b>@Service</b>, <b>@Repository</b>.<br/><br/>'
        'Minha prática de backend foi com <b>Node.js</b> e <b>TypeScript</b> — os conceitos são análogos: inversão de dependência, '
        'camadas de serviço, ORM. Estou estudando Spring Boot ativamente para consolidar isso na JVM.'
    ),
    (
        "Você trabalhou em times ágeis?",
        'Sim. Na Soo Tech trabalho em ciclos <b>Scrum</b> com sprints de duas semanas — plannings, dailies e retrospectivas.<br/><br/>'
        'Nos projetos pessoais uso <b>Kanban</b> para gestão visual e entrega contínua.<br/><br/>'
        'Valorizo muito o <b>code review</b> <i>(Kód Rivú)</i> — revisar e ter o código revisado é a forma mais rápida de crescer tecnicamente.'
    ),
    (
        "Me fale de um desafio técnico difícil que você resolveu",
        'No <b>Certibot</b> <i>(Sér-ti-bot)</i>, meu bot jurídico, precisei resolver <b>CAPTCHAs</b> <i>(Kép-tchas)</i> avançados em portais governamentais.<br/><br/>'
        'Solução: treinei um modelo <b>CRNN</b> de <b>OCR</b> customizado com <b>PyTorch</b> <i>(Pài-Tórtch)</i> para aquele padrão específico, '
        'e implementei rotação de proxies com <b>Tor</b> em múltiplas portas — transformando um processo de dias em segundos.<br/><br/>'
        'Essa capacidade de resolver problemas complexos de forma autônoma é algo que carrego para qualquer time.'
    ),
    (
        "Por que a GFT?",
        'A GFT tem reputação no mercado financeiro global — sistemas de pagamento de alta disponibilidade e baixa latência. '
        'São exatamente os desafios técnicos que me atraem: sistemas que não podem falhar, que processam transações em milissegundos.<br/><br/>'
        'Além disso, a cultura de aprendizado — auxílio para certificações, bolsa de estudos — está alinhada com minha postura: '
        'sou um dev que estuda constantemente e quer crescer dentro de uma estrutura internacional.'
    ),
    (
        "Onde você se vê em 2 anos?",
        'Em dois anos, quero ser referência técnica dentro do time da GFT — alguém que guia decisões de arquitetura, '
        'faz mentoria de devs júniores, e tem certificação AWS consolidada.<br/><br/>'
        'Quero crescer dentro da própria GFT, contribuindo em projetos financeiros cada vez mais complexos.'
    ),
]

for pergunta, resposta in qas:
    story.append(qa_block(pergunta, resposta))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════════════
# BLOCO 4 — MAPA DE COMPETÊNCIAS
# ══════════════════════════════════════════════════════════════════════════════
story.append(header_box("🛠️  BLOCO 4 — MAPA DE COMPETÊNCIAS TÉCNICAS", VERDE))
story.append(Spacer(1, 8))

competencias = [
    ("☕  KOTLIN / JAVA", AZUL_BG, AZUL_CLARO, [
        "MVVM, Clean Architecture, Hilt (DI), Coroutines + Flow",
        "Jetpack Compose (conhecimento), Interop Java/Kotlin",
        "6 anos Java (JVM), SOLID, Design Patterns",
        "Spring Boot (annotations, conceitual — em evolução)",
    ]),
    ("☁️  AWS", AZUL_BG, AZUL_CLARO, [
        "EC2, S3, Lambda, API Gateway, RDS",
        "Conceito de VPC, IAM, CloudWatch",
        "Serverless via Supabase Edge Functions (= AWS Lambda)",
    ]),
    ("🗄️  BANCO DE DADOS", VERDE_BG, VERDE, [
        "PostgreSQL — 5 anos de prática direta",
        "Supabase (PostgreSQL gerenciado + Edge Functions)",
        "Firebase Realtime DB + Firestore (NoSQL)",
    ]),
    ("⚛️  FRONTEND", CINZA_CLARO, CINZA_BORDA, [
        "React 19, TypeScript, Vite, Zustand, Framer Motion",
        "PWA (Progressive Web App), CSS avançado",
        "5 anos JavaScript/TypeScript",
    ]),
    ("🤖  IA / DADOS / AUTOMAÇÃO", AMARELO_BG, LARANJA, [
        "PyTorch — treinamento de modelo OCR customizado (CRNN)",
        "Vertex AI / Gemini Vision — integração em app Android",
        "Python — scraping avançado, Playwright, Tor multi-proxy",
        "Node.js — 4 anos, APIs RESTful completas",
    ]),
    ("🔧  DEVOPS / TOOLING", VERMELHO_BG, colors.HexColor("#E74C3C"), [
        "Docker (containerização básica)",
        "Git / GitHub — avançado, histórico público",
        "Firebase Hosting, CI/CD básico",
        "Scrum / Kanban — experiência corporativa",
    ]),
]

for titulo, bg, border, items in competencias:
    rows = [[Paragraph(f"<b>{titulo}</b>", S("ch", fontSize=9, fontName="Helvetica-Bold", leading=13, textColor=PRETO))]]
    for item in items:
        rows.append([Paragraph(f"  ▸  {item}", S("ci", fontSize=8, fontName="Helvetica", leading=12, textColor=PRETO))])
    t = Table(rows, colWidths=[17.4*cm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), border),
        ('BACKGROUND', (0,1), (-1,-1), bg),
        ('BOX', (0,0), (-1,-1), 1, border),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(KeepTogether([t, Spacer(1, 6)]))

story.append(Spacer(1, 4))

# ══════════════════════════════════════════════════════════════════════════════
# BLOCO 5 — PROJETOS RÁPIDOS
# ══════════════════════════════════════════════════════════════════════════════
story.append(header_box("📂  BLOCO 5 — PROJETOS: REFERÊNCIA RÁPIDA", AZUL_MEDIO))
story.append(Spacer(1, 6))

proj_header = [
    Paragraph("<b>Projeto</b>", S("ph", fontSize=8, fontName="Helvetica-Bold", leading=11, textColor=BRANCO)),
    Paragraph("<b>Stack Principal</b>", S("ph", fontSize=8, fontName="Helvetica-Bold", leading=11, textColor=BRANCO)),
    Paragraph("<b>Impacto</b>", S("ph", fontSize=8, fontName="Helvetica-Bold", leading=11, textColor=BRANCO)),
]
proj_rows = [proj_header] + [
    [
        Paragraph(p, S("pc", fontSize=8, fontName="Helvetica-Bold", leading=11, textColor=AZUL_ESCURO)),
        Paragraph(s, S("ps", fontSize=8, fontName="Helvetica", leading=11, textColor=PRETO)),
        Paragraph(i, S("pi", fontSize=8, fontName="Helvetica-Oblique", leading=11, textColor=PRETO)),
    ]
    for p, s, i in [
        ("NidusCare", "Kotlin, MVVM, Hilt, Coroutines, Gemini Vision", "App nativo Android p/ saúde — produção"),
        ("GuaruGeo", "React, Node.js, Supabase, Python OSINT", "GIS imobiliário — em produção com usuários reais"),
        ("PredictMed", "TypeScript, Supabase Edge Functions, IA", "SaaS farmácias — automação de compras em produção"),
        ("Certibot", "Python, Playwright, PyTorch OCR, Tor", "Bot jurídico anti-bot — processa documentos reais"),
        ("MarketPoster", "Kotlin, ML Kit, Firebase", "App Android varejo com ML offline + sincronização"),
        ("PharmaFlow", "Kotlin + React, Firebase", "Delivery farmácias Full-Stack — Android + Web"),
    ]
]

proj_table = Table(proj_rows, colWidths=[3.4*cm, 6.5*cm, 7.5*cm])
proj_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), AZUL_ESCURO),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [BRANCO, CINZA_CLARO]),
    ('GRID', (0,0), (-1,-1), 0.5, CINZA_BORDA),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 7),
    ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(proj_table)
story.append(Spacer(1, 10))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════════════════════
# BLOCO 6 — POSTURA EM VIDEO
# ══════════════════════════════════════════════════════════════════════════════
story.append(header_box("🎭  BLOCO 6 — POSTURA EM VÍDEO (EMPRESA MULTINACIONAL)", LARANJA))
story.append(Spacer(1, 8))

story.append(info_box("📋  <b>CHECKLIST PRÉ-CALL (30 min antes das 18:30)</b>", bg=AMARELO_BG, border=LARANJA, style=sTip))
story.append(Spacer(1, 4))

checks_pre = [
    "Testar câmera, microfone e internet",
    "Abrir este PDF em segunda tela ou aba",
    "Beber água — voz firme depende de hidratação",
    "Luz frontal (na sua frente, não atrás) e fundo limpo",
    "Fechar notificações do celular e computador",
    "Vestir camisa — GFT é multinacional, semiformal está ótimo",
    "Microsoft Teams aberto e testado antes",
]
for c in checks_pre:
    story.append(check(c))

story.append(Spacer(1, 10))

story.append(info_box("✅  <b>DURANTE A CALL — FAÇA</b>", bg=VERDE_BG, border=VERDE, style=sNote))
story.append(Spacer(1, 4))
dos = [
    "Olhe para a câmera, não para a tela — parece que você olha nos olhos",
    "Pause 1 segundo antes de responder — calma transmite confiança",
    "Use projetos reais como exemplos concretos — seja específico",
    'Se não souber algo: <i>"Tenho familiaridade com o conceito, minha prática foi por outro caminho — estou evoluindo nisso"</i>',
    'Pergunte ao final: <i>"Qual seria o principal desafio técnico do time hoje?"</i>',
    'Pergunte: <i>"Como funciona o onboarding para o alinhamento de stack?"</i>',
]
for d in dos:
    story.append(bullet(d, "✓"))

story.append(Spacer(1, 8))
story.append(info_box("❌  <b>DURANTE A CALL — NÃO FAÇA</b>", bg=VERMELHO_BG, border=colors.HexColor("#E74C3C"), style=sWarning))
story.append(Spacer(1, 4))
donts = [
    "Mentir sobre frameworks que não domina",
    "Ficar em silêncio por mais de 5 segundos — pense em voz alta",
    "Falar em velocidade alta — ritmo pausado = autoridade",
]
for d in donts:
    story.append(bullet(d, "✗"))

story.append(Spacer(1, 10))

# ══════════════════════════════════════════════════════════════════════════════
# BLOCO 7 — CHEAT CODES
# ══════════════════════════════════════════════════════════════════════════════
story.append(header_box("⚡  BLOCO 7 — CHEAT CODES (respostas de 30 segundos)", AZUL_ESCURO))
story.append(Spacer(1, 8))

cheat_codes = [
    ("SOLID", 
     '"<b>S</b>ingle Responsibility, <b>O</b>pen/Closed, <b>L</b>iskov Substitution, <b>I</b>nterface Segregation, <b>D</b>ependency Inversion. '
     'Aplico principalmente o S e o D: cada classe tem uma razão para mudar, e dependo de abstrações, não de implementações concretas."'),
    ("Coroutines",
     '"São a solução do Kotlin para programação assíncrona. Em vez de callbacks, uso suspend functions dentro de um CoroutineScope. '
     'O viewModelScope no Android garante cancelamento automático quando o ViewModel é destruído."'),
    ("Docker",
     '"Empacota aplicações em containers isolados — garante que o ambiente de dev é idêntico ao de produção. '
     'Conheço Dockerfile, docker-compose, volumes e networks básicos."'),
    ("Kafka",
     '"Plataforma de streaming distribuído para mensageria entre microsserviços. Publishers produzem mensagens em tópicos, '
     'consumers lêem em grupos independentes — garante desacoplamento e tolerância a falhas."'),
    ("Clean Architecture",
     '"Separação em camadas: Domain (regras de negócio), Data (repositórios e fontes), Presentation (UI). '
     'Cada camada depende apenas da interna — facilita testes unitários e substituição de frameworks."'),
]

for titulo, texto in cheat_codes:
    items = [
        Paragraph(f"<b>❓ {titulo}</b>", S("ct", fontSize=9, fontName="Helvetica-Bold", leading=13, textColor=AZUL_ESCURO)),
        Spacer(1, 2),
        quote_box(texto),
        Spacer(1, 8),
    ]
    story.append(KeepTogether(items))

# ══════════════════════════════════════════════════════════════════════════════
# ANCORAGEM FINAL
# ══════════════════════════════════════════════════════════════════════════════
story.append(header_box("🏆  ANCORAGEM FINAL — use quando perguntarem 'algo mais a acrescentar?'", VERDE))
story.append(Spacer(1, 6))

ancoragem = (
    '"Quero reforçar meu diferencial: não é só dominar ferramentas — é a capacidade de <b>construir coisas do zero até a produção</b>.<br/><br/>'
    'O GuaruGeo está em produção com usuários reais. O PredictMed automatizou compras de uma farmácia real. '
    'O Certibot processa documentos jurídicos reais.<br/><br/>'
    'Eu sei o que é responsabilidade de produção, e quero aplicar isso dentro de um time profissional de nível GFT.<br/><br/>'
    'Fico muito animado com essa oportunidade!"'
)
story.append(quote_box(ancoragem))
story.append(Spacer(1, 12))

# Rodapé final
final_data = [[Paragraph(
    "🍀  <b>BOA SORTE, BRUNO! VOCÊ TEM TUDO QUE PRECISA. A GFT PRECISA DE ALGUÉM COMO VOCÊ.</b>",
    S("sf", fontSize=11, fontName="Helvetica-Bold", textColor=BRANCO, alignment=TA_CENTER, leading=18)
)]]
final_table = Table(final_data, colWidths=[17.4*cm])
final_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), VERDE),
    ('TOPPADDING', (0,0), (-1,-1), 14),
    ('BOTTOMPADDING', (0,0), (-1,-1), 14),
    ('LEFTPADDING', (0,0), (-1,-1), 12),
    ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ('ROUNDEDCORNERS', [8]),
]))
story.append(final_table)

# Gerar
doc.build(story)
print(f"✅ PDF gerado com sucesso em:\n{OUTPUT}")
