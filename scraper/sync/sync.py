"""
Supabase Sync Module - Syncs approved properties to Supabase
"""
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY
import requests
from PIL import Image
from io import BytesIO
import os
from typing import Dict, List

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def download_image(url: str, save_path: str) -> bool:
    """Download image from URL"""
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            # Optimize image
            img = Image.open(BytesIO(response.content))
            # Resize if too large
            if img.width > 1920:
                ratio = 1920 / img.width
                new_size = (1920, int(img.height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
            
            img.save(save_path, optimize=True, quality=85)
            return True
    except Exception as e:
        print(f"Error downloading image {url}: {e}")
    return False

def upload_images_to_supabase(inscricao: str, image_urls: List[str]) -> List[str]:
    """
    Download images and upload to Supabase Storage
    Returns list of public URLs
    """
    if not image_urls:
        return []
    
    uploaded_urls = []
    os.makedirs('scraper/downloads/temp', exist_ok=True)
    
    for idx, url in enumerate(image_urls[:10]):  # Limit to 10 images
        try:
            # Download
            temp_path = f'scraper/downloads/temp/{inscricao}_{idx}.jpg'
            if not download_image(url, temp_path):
                continue
            
            # Upload to Supabase Storage
            bucket_path = f'{inscricao}/{inscricao}_{idx}.jpg'
            
            with open(temp_path, 'rb') as f:
                result = supabase.storage.from_('property_images').upload(
                    bucket_path,
                    f,
                    file_options={"content-type": "image/jpeg", "upsert": "true"}
                )
            
            # Get public URL
            public_url = supabase.storage.from_('property_images').get_public_url(bucket_path)
            uploaded_urls.append(public_url)
            
            # Cleanup
            os.remove(temp_path)
            
        except Exception as e:
            print(f"Error uploading image {idx}: {e}")
    
    return uploaded_urls

def sync_property_to_supabase(property_data: Dict) -> bool:
    """
    Sync approved property to Supabase unidades table
    Only updates NULL/empty fields
    """
    inscricao = property_data['inscricao']
    
    try:
        # 1. Get current unit data
        response = supabase.table('unidades').select('*').eq('inscricao', inscricao).maybe_single().execute()
        
        if not response.data:
            print(f"❌ Unit {inscricao} not found in Supabase")
            return False
        
        current_data = response.data
        
        # 2. Upload images if unit has no images
        supabase_image_urls = []
        if not current_data.get('imagens') or len(current_data.get('imagens', [])) == 0:
            if property_data.get('images'):
                print(f"📸 Uploading {len(property_data['images'])} images...")
                supabase_image_urls = upload_images_to_supabase(inscricao, property_data['images'])
                print(f"✅ Uploaded {len(supabase_image_urls)} images")
        
        # 3. Build update payload (only update empty fields)
        update_data = {}
        
        # Map scraped fields to Supabase fields
        field_mappings = {
            'area': ['area_util', 'metragem'],  # Try area_util first, then metragem
            'bedrooms': 'quartos',
            'bathrooms': 'banheiros',
            'suites': 'suites',
            'parking': 'vagas',
            'price': 'valor_vendavel',
            'description': 'descricao_imovel',
        }
        
        for scraped_field, supabase_fields in field_mappings.items():
            if property_data.get(scraped_field) is not None:
                # Handle area (multiple possible fields)
                if scraped_field == 'area':
                    if not current_data.get('area_util'):
                        update_data['area_util'] = property_data['area']
                    if not current_data.get('metragem'):
                        update_data['metragem'] = property_data['area']
                else:
                    # Single field mapping
                    supabase_field = supabase_fields
                    if not current_data.get(supabase_field):
                        update_data[supabase_field] = property_data[scraped_field]
        
        # Municipio
        if property_data.get('municipio'):
            update_data['municipio'] = property_data['municipio']
        
        # Images
        if supabase_image_urls:
            update_data['imagens'] = supabase_image_urls
        
        # Features (características)
        if property_data.get('features') and not current_data.get('caracteristicas'):
            update_data['caracteristicas'] = property_data['features']
        
        # 4. Update unit in Supabase
        if update_data:
            print(f"📝 Updating fields: {list(update_data.keys())}")
            supabase.table('unidades').update(update_data).eq('inscricao', inscricao).execute()
            print(f"✅ Synced to Supabase: {inscricao}")
            return True
        else:
            print(f"⚠️ No fields to update for {inscricao}")
            return True
        
    except Exception as e:
        print(f"❌ Error syncing {inscricao}: {e}")
        return False

if __name__ == '__main__':
    # Test
    test_data = {
        'inscricao': '1-0123-456-001',
        'price': 350000,
        'area': 65,
        'bedrooms': 2,
        'bathrooms': 1,
        'parking': 1,
        'description': 'Apartamento 2 dormitórios...',
        'images': [],
        'features': ['Piscina', 'Elevador']
    }
    
    sync_property_to_supabase(test_data)
