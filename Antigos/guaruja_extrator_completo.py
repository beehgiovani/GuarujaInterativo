#!/usr/bin/env python3
"""
Extrator Completo de Lotes do Guarujá
Versão aprimorada com suporte a extração de geometria via consulta espacial

Este script permite:
1. Extrair dados cadastrais (Zona, Setor, Lote, etc.)
2. Obter bounds/coordenadas dos lotes
3. Gerar mapas interativos com os polígonos dos lotes

Autor: Automação Manus
Data: 2024
"""

import requests
import json
import re
import time
import csv
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict, field
from bs4 import BeautifulSoup
import warnings
warnings.filterwarnings('ignore')


@dataclass
class LoteCompleto:
    """Classe para representar um lote com todos os dados"""
    inscricao: str
    zona: str = ""
    setor: str = ""
    lote: str = ""
    quadra: str = ""
    loteamento: str = ""
    bairro: str = ""
    cod_logradouro: str = ""
    valor_m2: str = ""
    # Bounds em UTM (zona 23S)
    minx: float = 0.0
    miny: float = 0.0
    maxx: float = 0.0
    maxy: float = 0.0
    # Coordenadas em lat/lon (WGS84)
    lat_centro: float = 0.0
    lon_centro: float = 0.0
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    def identificador_completo(self) -> str:
        """Retorna identificador no formato ZONA+SETOR+LOTE+000"""
        return f"{self.zona}{self.setor.zfill(4)}{self.lote.zfill(3)}000"


class ExtratorCompletoGuaruja:
    """
    Extrator completo de lotes do Guarujá com suporte a geometria
    """
    
    BASE_URL = "http://mapas.scimpmgsp.geometrus.com.br:8008"
    MAP_AGENT = "/mapserver2013/mapagent/mapagent.fcgi"
    TOOLTIP_URL = "https://scimpmgsp.geometrus.com.br/mctm_inscricoes/tooltip_prefeitura/inscricao:{}"
    FEATURES_URL = "/mapserver2013/mapviewerphp/getselectedfeatures.php"
    
    
    def __init__(self, verbose: bool = True, proxies: Dict = None):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*'
        })
        
        if proxies:
            self.session.proxies.update(proxies)
            if verbose:
                print(f"Proxy Configured: {proxies}")
        
        # Configure Retries
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        
        retry_strategy = Retry(
            total=5,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS", "POST"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        self.map_session_id = None
        self.map_name = "MAPA_SITE"
        self.verbose = verbose
        
    def log(self, msg: str):
        if self.verbose:
            print(msg)
    
    def iniciar_sessao(self) -> bool:
        """
        Inicia sessão com o servidor MapGuide seguindo o protocolo correto:
        1. Obter Session ID via geoprocessamento.php
        2. Inicializar Mapa (runtime map) via mapframe.php
        3. Inicializar View (escala/centro) via GETMAPIMAGE
        """
        try:
            # 1. Obter Session ID
            url = f"{self.BASE_URL}/mapserver2013/guaruja/geo/geoprocessamento.php"
            self.log(f"Conectando a {url}...")
            response = self.session.get(url, timeout=15)
            
            if response.status_code != 200:
                self.log("[x] Falha ao acessar geoprocessamento.php")
                return False

            match = re.search(r'SESSION=([a-f0-9\-]+_[a-z]+_[A-Za-z0-9]+)', response.text)
            if match:
                self.map_session_id = match.group(1)
                self.log(f"[v] Sessão obtida: {self.map_session_id[:20]}...")
            else:
                self.log("[x] Sessão não encontrada na resposta")
                return False
            
            # 2. Inicializar Mapa via MapFrame
            # Isso cria o recurso de mapa na sessão (Runtime Map)
            url_mapframe = f"{self.BASE_URL}/mapserver2013/mapviewerphp/mapframe.php"
            map_def = "Library://GUARUJA/GEO_SITE/MAPA/MAPA_SITE.MapDefinition"
            
            params_frame = {
                'MAPDEFINITION': map_def,
                'TYPE': 'HTML',
                'SHOWLEGEND': '1',
                'SESSION': self.map_session_id
            }
            
            self.log("Inicializando mapframe...")
            resp_frame = self.session.get(url_mapframe, params=params_frame, timeout=15)
            self.log(f"  Status Frame: {resp_frame.status_code}")
            
            # Extrair mapName gerado (geralmente 'MAPA_SITE')
            # var mapName = 'MAPA_SITE';
            match_name = re.search(r"var\s+mapName\s*=\s*'([^']+)'", resp_frame.text)
            if match_name:
                self.map_name = match_name.group(1)
                self.log(f"[v] Mapa inicializado: {self.map_name}")
            else:
                self.log(f"[x] Falha ao obter nome do mapa. Resp len: {len(resp_frame.text)}")
                self.log(f"  Sem match de mapName. Usando 'MAPA_SITE'")
                self.map_name = "MAPA_SITE"

            # 3. Inicializar View via GETMAPIMAGE
            # Necessário para definir largura/altura/escala antes de consultar features
            # Usaremos um centro/escala padrão para garantir que o mapa 'exista'
            cx = 375982.0 # Centro aproximado Guarujá
            cy = 7352132.0
            scale = 5000 
            
            params_img = {
                'OPERATION': 'GETMAPIMAGE',
                'VERSION': '1.0.0',
                'SESSION': self.map_session_id,
                'MAPNAME': self.map_name,
                'FORMAT': 'PNG',
                'SETDISPLAYDPI': '96',
                'SETDISPLAYWIDTH': '1', 
                'SETDISPLAYHEIGHT': '1',
                'SETVIEWCENTERX': str(cx),
                'SETVIEWCENTERY': str(cy),
                'SETVIEWSCALE': str(scale)
            }
            
            self.log("Configurando view do mapa (1x1 px)...")
            self.session.post(f"{self.BASE_URL}{self.MAP_AGENT}", data=params_img, timeout=15)
            # self.log("[!] PULEI Configuração de View (Tentativa Direta)")
            
            return True
            
        except Exception as e:
            self.log(f"[x] Erro: {e}")
            return False
    
    def utm_para_latlon(self, easting: float, northing: float) -> Tuple[float, float]:
        """Converte UTM zona 23S para lat/lon WGS84"""
        import math
        
        # Constantes WGS84
        a = 6378137.0
        f = 1 / 298.257223563
        e2 = 2 * f - f * f
        e_prime2 = e2 / (1 - e2)
        k0 = 0.9996
        
        # Zona 23S
        lon0 = -45.0  # Meridiano central zona 23
        
        x = easting - 500000
        y = northing - 10000000  # Hemisfério Sul
        
        M = y / k0
        mu = M / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256))
        
        e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
        
        phi1 = mu + (3*e1/2 - 27*e1*e1*e1/32) * math.sin(2*mu)
        phi1 += (21*e1*e1/16 - 55*e1*e1*e1*e1/32) * math.sin(4*mu)
        phi1 += (151*e1*e1*e1/96) * math.sin(6*mu)
        
        N1 = a / math.sqrt(1 - e2 * math.sin(phi1)**2)
        T1 = math.tan(phi1)**2
        C1 = e_prime2 * math.cos(phi1)**2
        R1 = a * (1 - e2) / ((1 - e2 * math.sin(phi1)**2)**1.5)
        D = x / (N1 * k0)
        
        lat = phi1 - (N1 * math.tan(phi1) / R1) * (
            D*D/2 - (5 + 3*T1 + 10*C1 - 4*C1*C1 - 9*e_prime2) * D*D*D*D/24
            + (61 + 90*T1 + 298*C1 + 45*T1*T1 - 252*e_prime2 - 3*C1*C1) * D*D*D*D*D*D/720
        )
        
        lon = math.radians(lon0) + (D - (1 + 2*T1 + C1) * D*D*D/6
            + (5 - 2*C1 + 28*T1 - 3*C1*C1 + 8*e_prime2 + 24*T1*T1) * D*D*D*D*D/120
        ) / math.cos(phi1)
        
        return (math.degrees(lat), math.degrees(lon))
    
    def consultar_area(self, minx: float, miny: float, maxx: float, maxy: float,
                       max_features: int = 100) -> List[Dict]:
        """
        Consulta lotes em uma área e retorna lista com inscrição e bounds
        """
        if not self.map_session_id:
            if not self.iniciar_sessao():
                return []
        
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
            
            resultados = []
            if response.status_code == 200:
                # Extrair inscrições
                inscricoes = re.findall(r'inscricao:(\d+)', response.text)
                inscricoes = list(set(inscricoes))
                
                # Obter bounds
                bounds_url = f"{self.BASE_URL}{self.FEATURES_URL}"
                bounds_params = {
                    'MAPNAME': self.map_name,
                    'SESSION': self.map_session_id,
                    'LOCALE': 'en'
                }
                
                bounds_response = self.session.post(bounds_url, data=bounds_params, timeout=30)
                bounds_data = {}
                
                if bounds_response.status_code == 200:
                    try:
                        data = bounds_response.json()
                        if 'Lotes' in data and len(data['Lotes']) > 0:
                            bounds_data = data['Lotes'][0].get('zoom', {})
                    except:
                        pass
                
                for inscricao in inscricoes:
                    resultados.append({
                        'inscricao': inscricao,
                        'bounds': bounds_data
                    })
                
                self.log(f"[v] Encontrados {len(resultados)} lotes")
            
            return resultados
            
        except Exception as e:
            self.log(f"[x] Erro na consulta: {e}")
            return []
    
    def obter_dados_cadastrais(self, inscricao: str) -> Optional[Dict]:
        """Obtém dados cadastrais de um lote"""
        try:
            url = self.TOOLTIP_URL.format(inscricao)
            response = self.session.get(url, timeout=30, verify=False)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                text = soup.get_text()
                
                dados = {'inscricao': inscricao}
                
                # ZONA: X - SETOR: XXXX - LOTE: XXX
                match = re.search(r'ZONA:\s*(\d+)\s*-\s*SETOR:\s*(\d+)\s*-\s*LOTE:\s*(\d+)', text)
                if match:
                    dados['zona'] = match.group(1)
                    dados['setor'] = match.group(2)
                    dados['lote'] = match.group(3)
                
                # QUADRA e LOTEAMENTO
                match = re.search(r'QUADRA:\s*([^\-]*)\s*-\s*LOTEAMENTO:\s*(\d+)\s*-\s*([^\n]+)', text)
                if match:
                    dados['quadra'] = match.group(1).strip()
                    dados['loteamento'] = f"{match.group(2)} - {match.group(3).strip()}"
                
                # Bairro
                match = re.search(r'LOTEAMENTO:[^\n]+\n\s*([A-Z\s]+)\n', text)
                if match:
                    dados['bairro'] = match.group(1).strip()
                
                # Código Logradouro
                match = re.search(r'CÓD\.\s*LOGRAD\.?:?\s*(\d+)', text)
                if match:
                    dados['cod_logradouro'] = match.group(1)
                
                # Valor M²
                match = re.search(r'Valor\s*M[²2]\s*Terreno:\s*R\$\s*([\d,\.]+)', text)
                if match:
                    dados['valor_m2'] = match.group(1)
                
                return dados
                
        except Exception as e:
            self.log(f"[x] Erro ao obter dados de {inscricao}: {e}")
        
        return None
    
    def extrair_lote_completo(self, inscricao: str, bounds: Dict = None) -> Optional[LoteCompleto]:
        """Extrai lote com todos os dados incluindo coordenadas"""
        dados = self.obter_dados_cadastrais(inscricao)
        
        if not dados:
            return None
        
        lote = LoteCompleto(
            inscricao=dados.get('inscricao', ''),
            zona=dados.get('zona', ''),
            setor=dados.get('setor', ''),
            lote=dados.get('lote', ''),
            quadra=dados.get('quadra', ''),
            loteamento=dados.get('loteamento', ''),
            bairro=dados.get('bairro', ''),
            cod_logradouro=dados.get('cod_logradouro', ''),
            valor_m2=dados.get('valor_m2', '')
        )
        
        # Adicionar bounds se disponível
        if bounds:
            lote.minx = bounds.get('minx', 0)
            lote.miny = bounds.get('miny', 0)
            lote.maxx = bounds.get('maxx', 0)
            lote.maxy = bounds.get('maxy', 0)
            
            # Calcular centro em lat/lon
            if lote.minx and lote.maxx:
                centro_x = (lote.minx + lote.maxx) / 2
                centro_y = (lote.miny + lote.maxy) / 2
                lat, lon = self.utm_para_latlon(centro_x, centro_y)
                lote.lat_centro = lat
                lote.lon_centro = lon
        
        return lote
    
    def extrair_lotes_area(self, minx: float, miny: float, maxx: float, maxy: float,
                           max_features: int = 100, delay: float = 0.3) -> List[LoteCompleto]:
        """Extrai todos os lotes de uma área"""
        self.log(f"\n{'='*60}")
        self.log(f"Extraindo lotes da área UTM:")
        self.log(f"  SW: ({minx}, {miny})")
        self.log(f"  NE: ({maxx}, {maxy})")
        self.log(f"{'='*60}\n")
        
        # Consultar área
        resultados = self.consultar_area(minx, miny, maxx, maxy, max_features)
        
        if not resultados:
            self.log("Nenhum lote encontrado")
            return []
        
        # Extrair dados completos de cada lote
        lotes = []
        for i, item in enumerate(resultados):
            self.log(f"  [{i+1}/{len(resultados)}] Processando {item['inscricao']}...", )
            
            lote = self.extrair_lote_completo(item['inscricao'], item.get('bounds'))
            if lote:
                lotes.append(lote)
                self.log(f"    [v] Zona {lote.zona}, Setor {lote.setor}, Lote {lote.lote}")
            
            time.sleep(delay)
        
        self.log(f"\n[v] Total extraído: {len(lotes)} lotes")
        return lotes
    
    def extrair_por_inscricoes(self, inscricoes: List[str], delay: float = 0.3) -> List[LoteCompleto]:
        """Extrai lotes por lista de inscrições"""
        lotes = []
        
        for i, inscricao in enumerate(inscricoes):
            self.log(f"[{i+1}/{len(inscricoes)}] Processando {inscricao}...")
            
            lote = self.extrair_lote_completo(inscricao)
            if lote:
                lotes.append(lote)
                self.log(f"  [v] Zona {lote.zona}, Setor {lote.setor}, Lote {lote.lote}")
            else:
                self.log(f"  [x] Não encontrado")
            
            time.sleep(delay)
        
        return lotes
    
    def gerar_inscricao(self, zona: str, setor: str, lote: str) -> str:
        """Gera código de inscrição"""
        return f"{zona}{setor.zfill(4)}{lote.zfill(3)}"
    
    def salvar_json(self, lotes: List[LoteCompleto], arquivo: str):
        """Salva em JSON"""
        data = [lote.to_dict() for lote in lotes]
        with open(arquivo, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        self.log(f"[v] Salvo em {arquivo}")
    
    def salvar_csv(self, lotes: List[LoteCompleto], arquivo: str):
        """Salva em CSV"""
        if not lotes:
            return
        
        with open(arquivo, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=lotes[0].to_dict().keys())
            writer.writeheader()
            for lote in lotes:
                writer.writerow(lote.to_dict())
        
        self.log(f"[v] Salvo em {arquivo}")
    
    def obter_imagem_lote(self, minx: float, miny: float, maxx: float, maxy: float, 
                          width: int = 1024, height: int = 1024, filename: str = None,
                          hide_layers: List[str] = None,
                          show_layers: List[str] = None) -> Optional[str]:
        """
        Obtém imagem PNG de uma área específica com controle preciso de escala e visibilidade.
        """
        if not self.map_session_id:
            if not self.iniciar_sessao():
                return None
        
        # Calcular centro
        cx = (minx + maxx) / 2
        cy = (miny + maxy) / 2
        
        # Dimensões da área em metros
        extent_width_m = maxx - minx
        
        # Escala
        meters_per_pixel = extent_width_m / width
        calculated_scale = meters_per_pixel / 0.0002645833
        
        print(f"  [Image] Scale: 1:{calculated_scale:.2f}")
        
        params_img = {
            'OPERATION': 'GETMAPIMAGE',
            'VERSION': '1.0.0',
            'SESSION': self.map_session_id,
            'MAPNAME': self.map_name,
            'FORMAT': 'PNG', 
            'SETDISPLAYDPI': '96',
            'SETDISPLAYWIDTH': str(width), 
            'SETDISPLAYHEIGHT': str(height),
            'SETVIEWCENTERX': str(cx),
            'SETVIEWCENTERY': str(cy),
            'SETVIEWSCALE': str(calculated_scale)
        }
        
        if show_layers:
            # LAYERNAMES: Specifies the layers to be shown in the image.
            params_img['LAYERNAMES'] = ','.join(show_layers)
            print(f"  [Image] SHOWING ONLY Layers: {params_img['LAYERNAMES']}")
        elif hide_layers:
            params_img['HIDELAYERS'] = ','.join(hide_layers)
            print(f"  [Image] Hiding Layers: {params_img['HIDELAYERS']}")
            
        try:
            response = self.session.post(f"{self.BASE_URL}{self.MAP_AGENT}", data=params_img, timeout=60)
            
            if response.status_code == 200 and len(response.content) > 1000:
                if filename:
                    import os
                    os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
                    with open(filename, 'wb') as f:
                        f.write(response.content)
                    return filename
                return "imagem_em_memoria"
            else:
                self.log(f"[x] Falha ao obter imagem: Status {response.status_code}, Len {len(response.content)}")
                return None
                
        except Exception as e:
            self.log(f"[x] Erro ao baixar imagem: {e}")
            return None


    def salvar_geojson(self, lotes: List[LoteCompleto], arquivo: str):
        """Salva em GeoJSON para uso em mapas"""
        features = []
        
        for lote in lotes:
            if lote.minx and lote.maxx:
                # Converter bounds para lat/lon
                sw = self.utm_para_latlon(lote.minx, lote.miny)
                ne = self.utm_para_latlon(lote.maxx, lote.maxy)
                
                feature = {
                    "type": "Feature",
                    "properties": {
                        "inscricao": lote.inscricao,
                        "zona": lote.zona,
                        "setor": lote.setor,
                        "lote": lote.lote,
                        "quadra": lote.quadra,
                        "loteamento": lote.loteamento,
                        "bairro": lote.bairro,
                        "cod_logradouro": lote.cod_logradouro,
                        "valor_m2": lote.valor_m2,
                        "identificador": lote.identificador_completo()
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [sw[1], sw[0]],
                            [ne[1], sw[0]],
                            [ne[1], ne[0]],
                            [sw[1], ne[0]],
                            [sw[1], sw[0]]
                        ]]
                    }
                }
                features.append(feature)
        
        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        
        with open(arquivo, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, ensure_ascii=False, indent=2)
        
        self.log(f"[v] GeoJSON salvo em {arquivo}")


def main():
    """Demonstração do extrator completo"""
    print("="*60)
    print("EXTRATOR COMPLETO DE LOTES DO GUARUJÁ")
    print("="*60)
    
    import os
    
    # Load Proxy Config
    proxies = None
    if os.path.exists("config_proxy.json"):
        try:
            with open("config_proxy.json", "r") as f:
                proxies = json.load(f)
            print("loaded proxy configuration.")
        except Exception as e:
            print(f"Error loading proxy config: {e}")

    extrator = ExtratorCompletoGuaruja(proxies=proxies)
    
    # Exemplo 1: Extrair por inscrição
    print("\n--- Exemplo 1: Extrair por inscrição ---")
    lotes = extrator.extrair_por_inscricoes(["30661176"])
    
    if lotes:
        lote = lotes[0]
        print(f"\nDados extraídos:")
        print(f"  Inscrição: {lote.inscricao}")
        print(f"  Zona: {lote.zona}")
        print(f"  Setor: {lote.setor}")
        print(f"  Lote: {lote.lote}")
        print(f"  Identificador completo: {lote.identificador_completo()}")
        print(f"  Bairro: {lote.bairro}")
        print(f"  Valor M²: R$ {lote.valor_m2}")
        
        # Salvar em diferentes formatos
        extrator.salvar_json(lotes, "lote_exemplo.json")
        extrator.salvar_csv(lotes, "lote_exemplo.csv")
    
    print("\n" + "="*60)
    print("[v] Demonstração concluída!")
    print("="*60)


if __name__ == "__main__":
    main()
.gitignore
