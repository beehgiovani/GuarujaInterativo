"""
Config Module - Configuration for scraping system
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

# Scraping Settings
RATE_LIMIT_DELAY = 3  # seconds between requests
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
]

# Match Threshold
MIN_MATCH_SCORE = 50  # Minimum score to save (0-100) - TEMPORARILY LOWERED FOR TESTING

# Sources
SOURCES = {
    'olx': {
        'enabled': True,
        'base_url': 'https://www.olx.com.br',
        'search_url': 'https://www.olx.com.br/imoveis/venda/estado-sp/guaruja'
    },
    'zap': {
        'enabled': True,
        'base_url': 'https://www.zapimoveis.com.br',
        'search_url': 'https://www.zapimoveis.com.br/venda/imoveis/sp+guaruja/'
    },
    'vivareal': {
        'enabled': True,
        'base_url': 'https://www.vivareal.com.br',
        'search_url': 'https://www.vivareal.com.br/venda/sp/guaruja/'
    }
}

# Field Mapping (scraped field -> Supabase field)
FIELD_MAPPING = {
    'area': 'area_util',  # Try area_util first, fallback to metragem
    'bedrooms': 'quartos',
    'bathrooms': 'banheiros',
    'suites': 'suites',
    'parking': 'vagas',
    'price': 'valor_vendavel',
    'description': 'descricao_imovel',
    'images': 'imagens',  # text[] in unidades
    'features': 'caracteristicas',  # text[] in unidades
}
