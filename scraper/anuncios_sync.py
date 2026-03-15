"""
Anuncios Sync Module
Handles syncing approved scraped properties to the 'anuncios' table in Supabase.
This is separate from the main sync.py to keep concerns separated.
"""
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import Dict, Optional

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️ Missing Supabase credentials for anuncios sync")
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_lote_id_by_inscricao(inscricao: str) -> Optional[str]:
    """
    Busca o lote_id (UUID) correspondente à inscricao da unidade.
    Flow: 
    1. Unidade -> lote_inscricao
    2. Lote (inscricao) -> UUID
    """
    if not supabase:
        return None
        
    try:
        # 1. Get lote_inscricao from Unidade
        # First check if we have the unit stored
        unit_res = supabase.table('unidades')\
            .select('lote_inscricao')\
            .eq('inscricao', inscricao)\
            .maybe_single()\
            .execute()
        
        lote_inscricao = None
        if unit_res.data and 'lote_inscricao' in unit_res.data:
            lote_inscricao = unit_res.data['lote_inscricao']
        
        if not lote_inscricao and len(inscricao) == 11:
             # Fallback: Guarujá standard
             # Unit: 00011001055 (11 chars) -> Lote: 00011001 (8 chars)
             lote_inscricao = inscricao[:8]
             print(f"⚠️ Deriving lote_inscricao from unit: {inscricao} -> {lote_inscricao}")

        if not lote_inscricao:
            print(f"⚠️ Unit {inscricao} not found or missing lote_inscricao")
            return None

        # Return the string explicitly (it is the ID in the lotes table)
        return lote_inscricao
        
    except Exception as e:
        print(f"❌ Erro buscando lote_id: {e}")
        return None


def sync_property_to_anuncios(property_data: Dict) -> bool:
    """
    Salva anúncio aprovado na tabela 'anuncios' do Supabase.
    NÃO modifica a tabela 'unidades'.
    
    Args:
        property_data: Dict contendo dados do anúncio scraped
        
    Returns:
        bool: True se sincronizado com sucesso, False caso contrário
    """
    if not supabase:
        print("❌ Supabase client not initialized")
        return False
        
    try:
        inscricao = property_data.get('inscricao')
        if not inscricao:
            print("❌ Missing inscricao in property data")
            return False
        
        # 1. Buscar lote_id
        lote_id = get_lote_id_by_inscricao(inscricao)
        
        # 2. Preparar dados do anúncio
        anuncio = {
            'inscricao': inscricao,
            'lote_id': lote_id,
            'titulo': property_data.get('title') or property_data.get('titulo'),
            'descricao': property_data.get('description') or property_data.get('descricao'),
            'url': property_data.get('url'),
            'source': property_data.get('source', 'serper'),
            
            # Preço (try multiple field names)
            'preco': _get_numeric_value(property_data, ['valor_real', 'price', 'preco']),
            
            # Área
            'area_anunciada': _get_numeric_value(property_data, ['area_util', 'area', 'metragem']),
            
            # Quartos
            'quartos': _get_integer_value(property_data, ['quartos', 'bedrooms']),
            
            # Suítes
            'suites': _get_integer_value(property_data, ['suites', 'suites_new']),
            
            # Banheiros
            'banheiros': _get_integer_value(property_data, ['banheiros', 'bathrooms']),
            
            # Vagas
            'vagas': _get_integer_value(property_data, ['vagas', 'parking']),
            
            # Endereço scraped
            'endereco_anuncio': property_data.get('scraped_address'),
            
            # Match score
            'match_score': property_data.get('match_score', 0),
        }
        
        # 3. Validar dados obrigatórios
        if not anuncio['titulo'] or not anuncio['url']:
            print("❌ Missing required fields (titulo or url)")
            return False
        
        # 4. Upsert (insert or update by URL)
        result = supabase.table('anuncios')\
            .upsert(anuncio, on_conflict='url')\
            .execute()
        
        if not result.data:
            print("❌ Upsert returned no data")
            return False
            
        anuncio_id = result.data[0]['id']
        match_score = anuncio['match_score']
        
        print(f"✅ Anúncio salvo: {anuncio['titulo']} (Match: {match_score}%)")
        
        # 5. Se match = 100%, criar notificação
        if match_score == 100:
            _create_notification(anuncio_id, anuncio['titulo'])
        
        return True
        
    except Exception as e:
        print(f"❌ Erro sincronizando anúncio: {e}")
        import traceback
        traceback.print_exc()
        return False


def _get_numeric_value(data: Dict, keys: list) -> Optional[float]:
    """
    Try to extract a numeric value from multiple possible keys.
    Returns first non-None value found.
    """
    for key in keys:
        value = data.get(key)
        if value is not None:
            try:
                return float(value)
            except (ValueError, TypeError):
                continue
    return None


def _get_integer_value(data: Dict, keys: list) -> Optional[int]:
    """
    Try to extract an integer value from multiple possible keys.
    Returns first non-None value found.
    """
    for key in keys:
        value = data.get(key)
        if value is not None:
            try:
                return int(value)
            except (ValueError, TypeError):
                continue
    return None


def _create_notification(anuncio_id: str, titulo: str) -> bool:
    """
    Cria notificação para match 100%.
    """
    if not supabase:
        return False
        
    try:
        # Check if notification already exists for this anuncio_id
        existing = supabase.table('anuncios_notifications')\
            .select('id')\
            .eq('anuncio_id', anuncio_id)\
            .execute()
            
        if existing.data and len(existing.data) > 0:
            # Notificação já existe. Vamos resetar para UNREAD (lido=False) 
            # para garantir que o usuário veja a confirmação/alerta novamente.
            notif_id = existing.data[0]['id']
            supabase.table('anuncios_notifications')\
                .update({'lido': False, 'criado_em': 'now()'})\
                .eq('id', notif_id)\
                .execute()
            print(f"ℹ️ Notificação resetada para anúncio {anuncio_id}")
            return True

        notification = {
            'anuncio_id': anuncio_id,
            'titulo': 'Oportunidade Encontrada',  # Short title for the notification header
            'tipo': '100_match',
            'mensagem': f'🔥 Match perfeito encontrado: {titulo}'
        }
        
        supabase.table('anuncios_notifications')\
            .insert(notification)\
            .execute()
        
        print(f"🔔 Notificação criada para match 100%")
        return True
        
    except Exception as e:
        print(f"⚠️ Erro criando notificação: {e}")
        return False


def mark_anuncio_inactive(url: str) -> bool:
    """
    Marca um anúncio como inativo (is_active = False).
    Útil quando um anúncio é removido do portal.
    """
    if not supabase:
        return False
        
    try:
        supabase.table('anuncios')\
            .update({'is_active': False})\
            .eq('url', url)\
            .execute()
        
        print(f"✅ Anúncio marcado como inativo: {url}")
        return True
        
    except Exception as e:
        print(f"❌ Erro marcando anúncio como inativo: {e}")
        return False


def get_anuncios_by_lote(lote_id: str, only_active: bool = True) -> list:
    """
    Busca todos os anúncios de um lote específico.
    Útil para debug/testes.
    """
    if not supabase:
        return []
        
    try:
        query = supabase.table('anuncios')\
            .select('*')\
            .eq('lote_id', lote_id)\
            .order('match_score', desc=True)
        
        if only_active:
            query = query.eq('is_active', True)
            
        result = query.execute()
        return result.data or []
        
    except Exception as e:
        print(f"❌ Erro buscando anúncios: {e}")
        return []


if __name__ == '__main__':
    # Test the module
    print("🧪 Testing anuncios_sync module...")
    
    test_data = {
        'inscricao': '1-0001-000-001',
        'title': 'Apartamento 2 quartos - Guarujá',
        'url': 'https://example.com/test-listing',
        'source': 'serper',
        'price': 450000,
        'area': 70,
        'bedrooms': 2,
        'match_score': 85
    }
    
    success = sync_property_to_anuncios(test_data)
    print(f"✅ Test {'passed' if success else 'failed'}")
