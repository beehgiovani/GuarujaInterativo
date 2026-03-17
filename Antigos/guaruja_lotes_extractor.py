#!/usr/bin/env python3
"""
Automação para extração de dados de lotes do Geoprocessamento do Guarujá
e visualização em mapa gratuito (Folium/Leaflet)

Autor: Automação Manus
Data: 2024
"""

import requests
import json
import re
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from bs4 import BeautifulSoup
import warnings
warnings.filterwarnings('ignore')


@dataclass
class Lote:
    """Classe para representar um lote"""
    inscricao: str
    zona: str = ""
    setor: str = ""
    lote: str = ""
    quadra: str = ""
    loteamento: str = ""
    bairro: str = ""
    cod_logradouro: str = ""
    valor_m2: str = ""
    bounds: Optional[Dict] = None  # minx, miny, maxx, maxy
    
    def to_dict(self) -> Dict:
        return asdict(self)


class GuarujaGeoExtractor:
    """
    Classe para extrair dados de lotes do sistema de geoprocessamento do Guarujá
    """
    
    # URLs base do sistema
    BASE_URL = "http://mapas.scimpmgsp.geometrus.com.br:8008"
    MAP_AGENT = "/mapserver2013/mapagent/mapagent.fcgi"
    TOOLTIP_URL = "https://scimpmgsp.geometrus.com.br/mctm_inscricoes/tooltip_prefeitura/inscricao:{}"
    FEATURES_URL = "/mapserver2013/mapviewerphp/getselectedfeatures.php"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        })
        self.map_session_id = None
        self.map_name = "MAPA_SITE"
        
    def iniciar_sessao(self) -> bool:
        """
        Inicia uma sessão com o servidor MapGuide
        """
        try:
            # Acessar a página principal para obter sessão
            url = f"{self.BASE_URL}/mapserver2013/guaruja/geo/geoprocessamento.php"
            response = self.session.get(url, timeout=30)
            
            if response.status_code == 200:
                # Extrair SESSION ID do HTML
                match = re.search(r'SESSION=([a-f0-9\-]+_[a-z]+_[A-Za-z0-9]+)', response.text)
                if match:
                    self.map_session_id = match.group(1)
                    print(f"✓ Sessão iniciada: {self.map_session_id[:30]}...")
                    return True
                    
            print("✗ Não foi possível obter sessão do MapGuide")
            return False
            
        except Exception as e:
            print(f"✗ Erro ao iniciar sessão: {e}")
            return False
    
    def consultar_lotes_por_area(self, minx: float, miny: float, maxx: float, maxy: float, 
                                  max_features: int = 100) -> List[str]:
        """
        Consulta lotes em uma área retangular definida por coordenadas UTM
        Retorna lista de códigos de inscrição
        """
        if not self.map_session_id:
            if not self.iniciar_sessao():
                return []
        
        # Criar geometria WKT do polígono
        polygon_wkt = f"POLYGON(({minx} {miny}, {maxx} {miny}, {maxx} {maxy}, {minx} {maxy}, {minx} {miny}))"
        
        params = {
            'OPERATION': 'QUERYMAPFEATURES',
            'VERSION': '1.0.0',
            'PERSIST': '1',
            'MAPNAME': self.map_name,
            'SESSION': self.map_session_id,
            'LAYERNAMES': 'Lotes',
            'GEOMETRY': polygon_wkt,
            'SELECTIONVARIANT': 'INTERSECTS',
            'MAXFEATURES': str(max_features)
        }
        
        try:
            url = f"{self.BASE_URL}{self.MAP_AGENT}"
            response = self.session.post(url, data=params, timeout=60)
            
            inscricoes = []
            if response.status_code == 200:
                # Extrair códigos de inscrição do tooltip
                matches = re.findall(r'inscricao:(\d+)', response.text)
                inscricoes = list(set(matches))  # Remover duplicatas
                print(f"✓ Encontrados {len(inscricoes)} lotes na área")
                
            return inscricoes
            
        except Exception as e:
            print(f"✗ Erro na consulta: {e}")
            return []
    
    def obter_bounds_lotes(self) -> Dict:
        """
        Obtém os bounds (coordenadas) dos lotes selecionados
        """
        if not self.map_session_id:
            return {}
            
        try:
            url = f"{self.BASE_URL}{self.FEATURES_URL}"
            params = {
                'MAPNAME': self.map_name,
                'SESSION': self.map_session_id,
                'LOCALE': 'en'
            }
            
            response = self.session.post(url, data=params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                return data
                
        except Exception as e:
            print(f"✗ Erro ao obter bounds: {e}")
            
        return {}
    
    def obter_dados_lote(self, inscricao: str) -> Optional[Lote]:
        """
        Obtém dados detalhados de um lote pelo código de inscrição
        """
        try:
            url = self.TOOLTIP_URL.format(inscricao)
            response = self.session.get(url, timeout=30, verify=False)
            
            if response.status_code == 200:
                lote = Lote(inscricao=inscricao)
                
                # Parse do HTML
                soup = BeautifulSoup(response.text, 'html.parser')
                text = soup.get_text()
                
                # Extrair dados usando regex
                # ZONA: X - SETOR: XXXX - LOTE: XXX
                match = re.search(r'ZONA:\s*(\d+)\s*-\s*SETOR:\s*(\d+)\s*-\s*LOTE:\s*(\d+)', text)
                if match:
                    lote.zona = match.group(1)
                    lote.setor = match.group(2)
                    lote.lote = match.group(3)
                
                # QUADRA: - LOTEAMENTO: XXX - NOME
                match = re.search(r'QUADRA:\s*([^\-]*)\s*-\s*LOTEAMENTO:\s*(\d+)\s*-\s*([^\n]+)', text)
                if match:
                    lote.quadra = match.group(1).strip()
                    lote.loteamento = f"{match.group(2)} - {match.group(3).strip()}"
                
                # Bairro (linha seguinte ao loteamento)
                match = re.search(r'LOTEAMENTO:[^\n]+\n\s*([A-Z\s]+)\n', text)
                if match:
                    lote.bairro = match.group(1).strip()
                
                # CÓD. LOGRAD.: XXXXXX
                match = re.search(r'CÓD\.\s*LOGRAD\.?:?\s*(\d+)', text)
                if match:
                    lote.cod_logradouro = match.group(1)
                
                # Valor M² Terreno: R$ XX,XX
                match = re.search(r'Valor\s*M[²2]\s*Terreno:\s*R\$\s*([\d,\.]+)', text)
                if match:
                    lote.valor_m2 = match.group(1)
                
                return lote
                
        except Exception as e:
            print(f"✗ Erro ao obter dados do lote {inscricao}: {e}")
            
        return None
    
    def extrair_lotes_area(self, minx: float, miny: float, maxx: float, maxy: float,
                           max_features: int = 100, delay: float = 0.5) -> List[Lote]:
        """
        Extrai todos os lotes de uma área com seus dados completos
        """
        print(f"\n{'='*60}")
        print(f"Extraindo lotes da área:")
        print(f"  Min: ({minx}, {miny})")
        print(f"  Max: ({maxx}, {maxy})")
        print(f"{'='*60}\n")
        
        # Consultar lotes na área
        inscricoes = self.consultar_lotes_por_area(minx, miny, maxx, maxy, max_features)
        
        if not inscricoes:
            print("Nenhum lote encontrado na área")
            return []
        
        # Obter bounds dos lotes selecionados
        bounds_data = self.obter_bounds_lotes()
        
        # Obter dados detalhados de cada lote
        lotes = []
        for i, inscricao in enumerate(inscricoes):
            print(f"  [{i+1}/{len(inscricoes)}] Processando lote {inscricao}...", end=" ")
            
            lote = self.obter_dados_lote(inscricao)
            if lote:
                # Adicionar bounds se disponível
                if bounds_data and 'Lotes' in bounds_data:
                    for item in bounds_data['Lotes']:
                        if 'zoom' in item:
                            lote.bounds = item['zoom']
                            break
                
                lotes.append(lote)
                print(f"✓ Zona {lote.zona}, Setor {lote.setor}, Lote {lote.lote}")
            else:
                print("✗ Falha")
            
            time.sleep(delay)  # Delay para não sobrecarregar o servidor
        
        print(f"\n✓ Total de lotes extraídos: {len(lotes)}")
        return lotes
    
    def extrair_lote_por_inscricao(self, inscricao: str) -> Optional[Lote]:
        """
        Extrai dados de um lote específico pelo código de inscrição
        """
        print(f"Extraindo dados do lote {inscricao}...")
        return self.obter_dados_lote(inscricao)
    
    def gerar_inscricao(self, zona: str, setor: str, lote: str) -> str:
        """
        Gera código de inscrição a partir de Zona, Setor e Lote
        Formato: {ZONA}{SETOR}{LOTE}000 (com zeros no final conforme preferência)
        """
        # Formatar setor com 4 dígitos
        setor_fmt = setor.zfill(4)
        # Formatar lote com 3 dígitos
        lote_fmt = lote.zfill(3)
        
        # Concatenar: Zona + Setor + Lote + 000
        inscricao = f"{zona}{setor_fmt}{lote_fmt}"
        return inscricao
    
    def salvar_json(self, lotes: List[Lote], arquivo: str):
        """
        Salva os lotes em formato JSON
        """
        data = [lote.to_dict() for lote in lotes]
        with open(arquivo, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✓ Dados salvos em {arquivo}")
    
    def salvar_csv(self, lotes: List[Lote], arquivo: str):
        """
        Salva os lotes em formato CSV
        """
        import csv
        
        if not lotes:
            return
            
        with open(arquivo, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=lotes[0].to_dict().keys())
            writer.writeheader()
            for lote in lotes:
                writer.writerow(lote.to_dict())
        
        print(f"✓ Dados salvos em {arquivo}")


def main():
    """
    Exemplo de uso do extrator
    """
    extrator = GuarujaGeoExtractor()
    
    # Iniciar sessão
    if not extrator.iniciar_sessao():
        print("Falha ao iniciar sessão")
        return
    
    # Exemplo 1: Extrair lote específico por inscrição
    print("\n" + "="*60)
    print("EXEMPLO 1: Extrair lote por código de inscrição")
    print("="*60)
    
    lote = extrator.extrair_lote_por_inscricao("30661176")
    if lote:
        print(f"\nDados do lote:")
        print(f"  Inscrição: {lote.inscricao}")
        print(f"  Zona: {lote.zona}")
        print(f"  Setor: {lote.setor}")
        print(f"  Lote: {lote.lote}")
        print(f"  Loteamento: {lote.loteamento}")
        print(f"  Bairro: {lote.bairro}")
        print(f"  Cód. Logradouro: {lote.cod_logradouro}")
        print(f"  Valor M²: R$ {lote.valor_m2}")
    
    # Exemplo 2: Extrair lotes de uma área
    print("\n" + "="*60)
    print("EXEMPLO 2: Extrair lotes de uma área geográfica")
    print("="*60)
    
    # Área de exemplo (coordenadas UTM - zona 23S)
    lotes = extrator.extrair_lotes_area(
        minx=358998,
        miny=7336853,
        maxx=390881,
        maxy=7354973,
        max_features=10
    )
    
    if lotes:
        # Salvar resultados
        extrator.salvar_json(lotes, "lotes_extraidos.json")
        extrator.salvar_csv(lotes, "lotes_extraidos.csv")
    
    # Exemplo 3: Gerar inscrição a partir de Zona/Setor/Lote
    print("\n" + "="*60)
    print("EXEMPLO 3: Gerar código de inscrição")
    print("="*60)
    
    inscricao = extrator.gerar_inscricao(zona="3", setor="661", lote="176")
    print(f"Inscrição gerada: {inscricao}")


if __name__ == "__main__":
    main()
.gitignore
