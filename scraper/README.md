# Property Scraper System

Sistema de web scraping para enriquecimento de dados de imóveis usando endereços
específicos.

## 🎯 Objetivo

Buscar automaticamente anúncios de imóveis em sites (OLX, ZAP, VivaReal) usando
endereços exatos da tabela `unidades`, extrair informações relevantes (fotos,
descrição, preço, características) e fornecer uma interface web para revisão e
aprovação antes de sincronizar com o Supabase.

## 📋 Características

- ✅ **Busca por endereço específico** (logradouro + número + bairro)
- ✅ **Validação rigorosa** de endereços (score mínimo 80%)
- ✅ **Interface de confirmação** (localhost) para revisão manual
- ✅ **Sincronização automática** com Supabase após aprovação
- ✅ **Upload de imagens** para Supabase Storage
- ✅ **Logs e histórico** de scraping

## 🚀 Setup

### 1. Instalar dependências

```bash
cd scraper
pip install -r requirements.txt
```

### 2. Configurar credenciais

Copie `.env.example` para `.env` e preencha:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key
```

### 3. Inicializar banco de dados local

```bash
python database.py
```

## 📖 Como Usar

### Passo 1: Executar Scraper

```bash
python main.py
```

Isso vai:

1. Buscar unidades sem imagens/dados do Supabase
2. Adicionar à fila de scraping
3. Executar scrapers (OLX, ZAP, VivaReal)
4. Validar endereços (apenas score >= 80%)
5. Salvar no SQLite local

### Passo 2: Revisar Resultados

```bash
cd web
python app.py
```

Abra `http://localhost:5000` no navegador.

### Passo 3: Aprovar/Rejeitar

Na interface web:

- **Comparação lado-a-lado**: Dados atuais (Supabase) vs Dados scraped
- **Match Score**: Confiança da correspondência de endereço
- **Aprovar**: Sincroniza automaticamente com Supabase
  - Upload de imagens para Storage
  - Atualiza campos vazios em `unidades`
- **Rejeitar**: Descarta o resultado

## 📁 Estrutura

```
scraper/
├── config.py              # Configurações
├── database.py            # SQLite staging database
├── address_matcher.py     # Validação de endereços
├── main.py                # Orquestrador principal
├── sync.py                # Sincronização com Supabase
├── sources/
│   ├── olx_scraper.py     # Scraper OLX
│   ├── zap_scraper.py     # Scraper ZAP (TODO)
│   └── vivareal_scraper.py # Scraper VivaReal (TODO)
├── web/
│   ├── app.py             # Flask server
│   ├── templates/
│   │   └── index.html     # Dashboard HTML
│   └── static/
│       ├── style.css      # CSS glassmorphic
│       └── app.js         # Frontend logic
└── downloads/              # Imagens temporárias
```

## 🎨 Interface

A interface web mostra:

- **Dashboard** com estatísticas (pendentes, aprovados, sincronizados)
- **Cards de propriedades** com:
  - Dados atuais do Supabase
  - Dados scraped do anúncio
  - Match score (% de confiança)
  - Galeria de imagens
  - Botões de aprovar/rejeitar

## ⚙️ Configurações

Em `config.py`:

- `MIN_MATCH_SCORE`: Score mínimo para salvar (padrão: 80%)
- `RATE_LIMIT_DELAY`: Delay entre requests (padrão: 3s)
- `FIELD_MAPPING`: Mapeamento de campos scraped → Supabase

## 🔍 Como funciona a validação de endereços

1. **Normalização**: Remove abreviações (Av. → Avenida), espaços extras
2. **Score de Match**:
   - Logradouro: 50 pontos
   - Número: 40 pontos
   - Bairro: 10 pontos (bônus)
3. **Threshold**: Score >= 80% para ser salvo

## 🛡️ Segurança

- Rate limiting para evitar bloqueios
- User agents rotativos
- Apenas campos vazios são atualizados (não sobrescreve dados existentes)

## 📊 Banco de Dados (SQLite)

### Tabelas:

- `scraped_properties`: Propriedades scraped (pending/approved/rejected)
- `address_queue`: Fila de endereços para scraping
- `scraping_logs`: Logs de atividade

## 🐛 Troubleshooting

**Erro: No listings found**

- OLX pode ter mudado seletores HTML
- Ajuste os seletores em `olx_scraper.py`

**Erro: Supabase connection**

- Verifique credenciais em `.env`
- Confirme que o bucket `property_images` existe

**Score baixo (< 80%)**

- Endereço scraped pode estar incompleto
- Ajuste threshold em `config.py` se necessário

## 📝 TODO

- [ ] Implementar scrapers ZAP e VivaReal
- [ ] Adicionar extração de amenities (piscina, churrasqueira, etc.)
- [ ] Melhorar detecção de número de quartos/banheiros
- [ ] Adicionar retry logic para requests falhadas
- [ ] Implementar cache de resultados

## 📄 Licença

Uso interno - Bruno's Property Management System
