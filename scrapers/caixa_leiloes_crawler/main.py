import asyncio
import sys
import logging
import re
import os
from bs4 import BeautifulSoup
from dotenv import load_dotenv, find_dotenv
from curl_cffi.requests import AsyncSession
from urllib.parse import urljoin

# Windows compatibility for curl_cffi / asyncio
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

load_dotenv(find_dotenv())

# SUPABASE SETTINGS
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Use service role for backend logic
SERPER_API_KEY = os.getenv("SERPER_API_KEY")

# UPDATED TARGET URL based on discovery
TARGET_URL = "https://www.leilaoimovel.com.br/leilao-de-imovel/guaruja-sp"

def get_supabase_headers():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Missing Supabase credentials in .env")
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

async def search_property_recovery(client: AsyncSession, search_query: str) -> str | None:
    """Uses Serper to find the best recovery page (Caixa or reputable auctioneer)."""
    if not SERPER_API_KEY:
        return None
        
    query = f"Guarujá leilão {search_query}"
    logging.info(f"🔍 Searching Google: {query}")
    
    try:
        url = "https://google.serper.dev/search"
        payload = {"q": query, "gl": "br", "hl": "pt", "num": 5}
        headers = {"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"}
        
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        
        results = resp.json().get('organic', [])
        
        for res in results:
            link = res.get('link', '')
            if 'venda-imoveis.caixa.gov.br' in link and 'detalhe' in link:
                logging.info(f"Found official recovery link: {link}")
                return link
                
        reputable_domains = [
            'megaleiloes.com.br', 'zukerman.com.br', 'cidadaodeleiloes.com.br', 
            'leilaovip.com.br', 'santanderimoveis.com.br', 'imoveisnordeste.com.br',
            'superbid.net', 'portalzuk.com.br', 'editalleiloes.com.br',
            'lancenofiscal.com.br', 'bcoleiloes.com.br', 'leiloesbrazil.com.br',
            'spyleiloes.com.br', '007imoveisleilao.com.br', 'imoveisemleilaocaixa.com.br',
            'legimoveisdeleilao.com.br', 'hastapublica.com.br', 'vitorialeiloes.com.br'
        ]
        for res in results:
            link = res.get('link', '')
            if any(domain in link for domain in reputable_domains):
                logging.info(f"Found reputable recovery link: {link}")
                return link
                
    except Exception as e:
        logging.error(f"Serper search failed: {e}")
        
    return None

async def scrape_universal_recovery_data(client: AsyncSession, recovery_url: str) -> tuple[str | None, str | None, str | None]:
    """Scrapes any recovery page for missing identifiers and PDF links."""
    try:
        logging.info(f"Scraping recovery page: {recovery_url}")
        resp = await client.get(recovery_url)
        resp.raise_for_status()
        
        soup = BeautifulSoup(resp.content.decode('utf-8', errors='ignore'), 'html.parser')
        text = str(soup.get_text())
        
        insc_match = re.search(r'(?:Inscri[çc][ãa]o|Contribuinte|IPTU|SQL|N[ºo]\s+do\s+contribuinte)(?:\s+Municipal)?(?:\s+n[ºo])?[:\.]?\s*([\d\.\-]+)', text, re.IGNORECASE)
        mat_match = re.search(r'Matr[íi]cula(?:\s+n[ºo])?[:\.]?\s*([\d\.\-]+)', text, re.IGNORECASE)
        
        insc_str = re.sub(r'\D', '', insc_match.group(1)) if insc_match else None
        mat_str = mat_match.group(1) if mat_match else None
        
        pdf_recovered = None
        full_html = resp.content.decode('utf-8', errors='ignore')
        
        onclick_match = re.search(r"ExibeDoc\('(.+?\.pdf)'\)", full_html, re.IGNORECASE)
        if onclick_match:
            pdf_recovered = onclick_match.group(1)
        
        if not pdf_recovered:
            pdf_anchor = soup.find('a', href=re.compile(r'\.pdf', re.IGNORECASE))
            if not pdf_anchor:
                pdf_anchor = soup.find('a', string=re.compile(r'Matr[íi]cula', re.IGNORECASE))
            if pdf_anchor and pdf_anchor.get('href'):
                pdf_recovered = pdf_anchor['href']
                
        if pdf_recovered and pdf_recovered.startswith('/'):
            pdf_recovered = urljoin(recovery_url, pdf_recovered)
            
        return (insc_str, mat_str, pdf_recovered)
    except Exception as e:
        logging.error(f"Failed to scrape recovery page {recovery_url}: {e}")
        return (None, None, None)

def extract_numeric(value_str: str | None) -> float | None:
    if not value_str: return None
    clean_str = re.sub(r'[^\d.]', '', value_str.replace('.', '').replace(',', '.'))
    try: return float(clean_str)
    except: return None

async def download_and_upload_pdf(scrap_client: AsyncSession, db_client: AsyncSession, pdf_url: str | None, codigo_imovel: str | None) -> str | None:
    if not pdf_url or not codigo_imovel: return None
    try:
        resp = await scrap_client.get(pdf_url)
        resp.raise_for_status()
        file_data = resp.content
        storage_path = f"staging_leiloes/{codigo_imovel}_matricula.pdf"
        upload_url = f"{SUPABASE_URL}/storage/v1/object/unit_documents/{storage_path}"
        headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/pdf",
            "x-upsert": "true"
        }
        up_res = await db_client.post(upload_url, headers=headers, data=file_data)
        up_res.raise_for_status()
        logging.info(f"Successfully staged PDF: {storage_path}")
        return storage_path
    except Exception as e:
        logging.error(f"Failed to process PDF for {codigo_imovel}: {e}")
        return None

async def check_unit_exists(db_client: AsyncSession, inscricao: str) -> bool:
    try:
        query_url = f"{SUPABASE_URL}/rest/v1/unidades?inscricao=eq.{inscricao}&select=inscricao&limit=1"
        res = await db_client.get(query_url, headers=get_supabase_headers())
        if res.status_code != 200:
            logging.error(f"DB Error checking unit {inscricao} ({res.status_code}): {res.text}")
            return False
        data = res.json()
        return isinstance(data, list) and len(data) > 0
    except Exception as e:
        logging.error(f"Error checking unit existence for {inscricao}: {e}")
        return False

async def check_staged_exists(db_client: AsyncSession, codigo: str) -> bool:
    try:
        query_url = f"{SUPABASE_URL}/rest/v1/caixa_leiloes_staging?codigo_imovel_caixa=eq.{codigo}&select=codigo_imovel_caixa&limit=1"
        res = await db_client.get(query_url, headers=get_supabase_headers())
        if res.status_code != 200:
            logging.error(f"DB Error checking staged {codigo} ({res.status_code}): {res.text}")
            return False
        data = res.json()
        return isinstance(data, list) and len(data) > 0
    except Exception as e:
        logging.error(f"Error checking if staged {codigo}: {e}")
        return False

async def process_property_page(scrap_client: AsyncSession, db_client: AsyncSession, property_url: str):
    """Deep-scrapes a property page and stages it if verified."""
    try:
        logging.info(f"Scraping detail page: {property_url}")
        resp = await scrap_client.get(property_url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content.decode('utf-8', errors='ignore'), 'html.parser')
        data_block = soup.get_text()
        insc_match = re.search(r'(?:Inscri[çc][ãa]o|Inscri[çc][ãa]o imobili[áa]ria|Inscri[çc][ãa]o Mun\.|IPTU|Contribuinte)[:\.]?\s*([\d\.\-]+)', data_block, re.IGNORECASE)
        if not insc_match: insc_match = re.search(r'\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b', data_block)
        mat_match = re.search(r'Matr[íi]cula(?:\s+n[ºo])?[:\.]?\s*([a-zA-Z0-9\-\.]+)', data_block, re.IGNORECASE)
        cod_match = re.search(r'(?:C[óo]digo Im[óo]vel|ID|REF|Lote|Im[óo]vel):\s*([\d]+)', data_block, re.IGNORECASE)
        if not cod_match or len(cod_match.group(1)) < 5:
            url_code_match = re.search(r'(\d{7,15})', property_url)
            codigo = url_code_match.group(1) if url_code_match else None
        else: codigo = cod_match.group(1)
        val_match = re.search(r'Valor de Avalia[çc][ãa]o:\s*R\$\s*([\d\.,]+)', data_block, re.IGNORECASE)
        desc_match = re.search(r'Descri[çc][ãa]o:\s*(.+)', data_block, re.IGNORECASE)
        pdf_link = None
        pdf_anchor = soup.find('a', string=re.compile(r'Matr[íi]cula', re.IGNORECASE))
        if pdf_anchor and 'href' in pdf_anchor.attrs: pdf_link = pdf_anchor['href']
        if not pdf_link:
            for a in soup.find_all('a', href=True):
                if '.pdf' in a['href'].lower() and ('matricula' in a['href'].lower() or 'edital' in a['href'].lower()):
                    pdf_link = a['href']
                    break
        inscricao = insc_match.group(1) if insc_match else None
        matricula = mat_match.group(1) if mat_match else None
        valor_str = val_match.group(1) if val_match else None
        descricao = desc_match.group(1).strip() if desc_match else (soup.find('h1').text.strip() if soup.find('h1') else "Apartamento Caixa em Guarujá")
        if not inscricao or len(re.sub(r'\D', '', str(inscricao))) != 11 or not codigo:
            logging.info(f"Missing identifiers for {property_url}. Starting fallback search...")
            search_query = re.sub(r'\D', '', str(inscricao)) if (inscricao and len(re.sub(r'\D', '', str(inscricao))) == 11) else (f"{descricao} {codigo}" if codigo else descricao)
            recovery_url = await search_property_recovery(scrap_client, search_query)
            if recovery_url:
                c_insc, c_mat, c_pdf = await scrape_universal_recovery_data(scrap_client, recovery_url)
                if c_insc: inscricao = str(c_insc)
                if c_mat: matricula = str(c_mat)
                if c_pdf and not pdf_link: pdf_link = str(c_pdf)
            if not inscricao or len(re.sub(r'\D', '', str(inscricao))) != 11 or not codigo:
                logging.warning(f"Fallback falhou para {property_url}. Identificadores insuficientes.")
                return
        inscription_clean = re.sub(r'\D', '', str(inscricao))
        if inscription_clean and await check_unit_exists(db_client, inscription_clean):
            logging.info(f"Verified match: Inscrição {inscription_clean} (Code: {codigo})")
            if codigo and await check_staged_exists(db_client, str(codigo)):
                logging.info(f"Property {codigo} already staged. Skipping.")
                return
            logging.info(f"Unit {inscription_clean} verified in database. Staging data...")
            pdf_storage_path = None
            if pdf_link:
                if pdf_link.startswith('/'): pdf_link = urljoin(property_url, pdf_link)
                pdf_storage_path = await download_and_upload_pdf(scrap_client, db_client, pdf_link, str(codigo))
            payload = {
                "codigo_imovel_caixa": str(codigo), "inscricao_imobiliaria": inscription_clean,
                "matricula_encontrada": str(matricula) if matricula else None,
                "valor_avaliacao": extract_numeric(valor_str), "descricao_anuncio": descricao,
                "storage_path_temporario": pdf_storage_path, "url_origem": property_url, "status_aprovacao": "pendente"
            }
            try:
                upsert_url = f"{SUPABASE_URL}/rest/v1/caixa_leiloes_staging"
                post_headers = get_supabase_headers()
                post_headers["Prefer"] = "return=minimal,resolution=merge-duplicates"
                up_db = await db_client.post(upsert_url, headers=post_headers, json=payload)
                up_db.raise_for_status()
                logging.info(f"✅ Successfully staged {codigo}.")
            except Exception as e: logging.error(f"Failed to insert DB record for {codigo}: {e}")
        else: logging.info(f"Unit {inscription_clean} not found in local database. Ignoring.")
    except Exception as e: logging.error(f"Error processing {property_url}: {e}")

async def main():
    logging.info("Starting Universal Property Scraper (v2.3 - Global Recovery)...")
    async with AsyncSession(impersonate="chrome110", timeout=30.0) as scrap_client, AsyncSession(timeout=30.0) as db_client:
        page = 1
        while True:
            page_url = f"{TARGET_URL}?pag={page}" if page > 1 else TARGET_URL
            logging.info(f"Scanning page {page}: {page_url}")
            try:
                resp = await scrap_client.get(page_url)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.content.decode('utf-8', errors='ignore'), 'html.parser')
                property_links = []
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    if '/imovel/' in href:
                        slug = href.split('/')[-1]
                        if slug and slug not in ['guaruja', 'sp']:
                            full_url = urljoin("https://www.leilaoimovel.com.br", href)
                            if full_url not in property_links: property_links.append(full_url)
                if not property_links:
                    logging.info(f"No more properties found on page {page}.")
                    break
                logging.info(f"Found {len(property_links)} listings on page {page}.")
                for p_url in property_links:
                    await process_property_page(scrap_client, db_client, p_url)
                    await asyncio.sleep(2)
                page += 1
                if page > 50: break
                await asyncio.sleep(3)
            except Exception as e:
                logging.error(f"Crawler error at page {page}: {e}")
                break
    logging.info("Crawl finished.")

if __name__ == "__main__":
    asyncio.run(main())
