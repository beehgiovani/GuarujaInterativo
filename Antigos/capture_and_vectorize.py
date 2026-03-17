import os
import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict
from guaruja_extrator_completo import ExtratorCompletoGuaruja
from guaruja_mapa_visualizador import criar_mapa_lotes

# GLOBAL SETTINGS
TILE_SIZE = 500
GLOBAL_MINX = 364757
GLOBAL_MAXX = 385726
GLOBAL_MINY = 7339109
GLOBAL_MAXY = 7361479
WORKER_BATCH_SIZE = 10

# LOCKS & SEMAPHORES
file_lock = threading.Lock()
print_lock = threading.Lock()
request_semaphore = threading.BoundedSemaphore(24)  # Scaled for Turbo Mode

def safe_print(msg):
    with print_lock:
        print(msg)
        try:
            with open("extraction_log.txt", "a") as f:
                f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\n")
        except: pass

class ExtractionState:
    def __init__(self, filename="extraction_state.json"):
        self.filename = filename
        self.forward_x = GLOBAL_MINX
        self.backward_x = GLOBAL_MAXX
        self.top_down_y = GLOBAL_MAXY
        self.left_right_x = GLOBAL_MINX
        self.right_left_x = GLOBAL_MAXX
        self.bottom_up_y = GLOBAL_MINY
        # Granular State (Minor Axis)
        self.bot_north_last_x = -1
        self.bot_south_last_x = -1
        self.bot_west_last_y = -1
        self.bot_east_last_y = -1
        self.bot_center_west_last_y = -1
        self.bot_center_east_last_y = -1
        self.bot_center_north_last_x = -1
        self.bot_center_south_last_x = -1
        self.bot_q1_west_last_y = -1
        self.bot_q3_east_last_y = -1
        self.load()

    def load(self):
        if os.path.exists(self.filename):
            try:
                with open(self.filename, 'r') as f:
                    data = json.load(f)
                    self.forward_x = data.get('forward_x', GLOBAL_MINX)
                    self.backward_x = data.get('backward_x', GLOBAL_MAXX)
                    self.top_down_y = data.get('top_down_y', GLOBAL_MAXY)
                    self.bottom_up_y = data.get('bottom_up_y', GLOBAL_MINY)
                    self.left_right_x = data.get('left_right_x', GLOBAL_MINX)
                    self.right_left_x = data.get('right_left_x', GLOBAL_MAXX)
                    self.bot_north_last_x = data.get('bot_north_last_x', -1)
                    self.bot_south_last_x = data.get('bot_south_last_x', -1)
                    self.bot_west_last_y = data.get('bot_west_last_y', -1)
                    self.bot_east_last_y = data.get('bot_east_last_y', -1)
                    self.center_left_x = data.get('center_left_x', (GLOBAL_MINX + GLOBAL_MAXX) // 2)
                    self.center_right_x = data.get('center_right_x', (GLOBAL_MINX + GLOBAL_MAXX) // 2)
                    self.bot_center_west_last_y = data.get('bot_center_west_last_y', -1)
                    self.bot_center_east_last_y = data.get('bot_center_east_last_y', -1)
                    self.bot_center_north_last_x = data.get('bot_center_north_last_x', -1)
                    self.bot_center_south_last_x = data.get('bot_center_south_last_x', -1)
                    self.bot_q1_west_last_y = data.get('bot_q1_west_last_y', -1)
                    self.bot_q3_east_last_y = data.get('bot_q3_east_last_y', -1)
                    self.q1_x = data.get('q1_x', GLOBAL_MINX + (GLOBAL_MAXX - GLOBAL_MINX) // 4)
                    self.q3_x = data.get('q3_x', GLOBAL_MINX + 3 * (GLOBAL_MAXX - GLOBAL_MINX) // 4)
                    self.center_y = data.get('center_y', (GLOBAL_MINY + GLOBAL_MAXY) // 2)
                    self.center_up_curr_y = data.get('center_up_curr_y', (GLOBAL_MINY + GLOBAL_MAXY) // 2)
                    self.center_down_curr_y = data.get('center_down_curr_y', (GLOBAL_MINY + GLOBAL_MAXY) // 2)
                    self.q1_curr_x = data.get('q1_curr_x', GLOBAL_MINX + (GLOBAL_MAXX - GLOBAL_MINX) // 4)
                    self.q3_curr_x = data.get('q3_curr_x', GLOBAL_MINX + 3 * (GLOBAL_MAXX - GLOBAL_MINX) // 4)
            except: pass

    def save(self):
        try:
            with open(self.filename, 'w') as f:
                json.dump(self.__dict__, f)
        except: pass

def get_proxy_for_worker(worker_idx):
    if not os.path.exists("config_proxy.json"): return None
    try:
        with open("config_proxy.json") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data[worker_idx % len(data)] if data else None
            return data
    except: return None

def flush_worker_data(tag, local_buffer, output_file, existing_inscriptions):
    if not local_buffer: return
    with file_lock:
        current_data = []
        if os.path.exists(output_file):
            try:
                with open(output_file, 'r') as f: current_data = json.load(f)
            except: pass
        
        disk_inscriptions = {x.get('inscricao') for x in current_data if 'inscricao' in x}
        to_add = [item for item in local_buffer if item['inscricao'] not in disk_inscriptions]
        
        if to_add:
            current_data.extend(to_add)
            with open(output_file, 'w') as f: json.dump(current_data, f, indent=2)
            safe_print(f"[{tag}] SAVED {len(to_add)} lots. Total: {len(current_data)}")
            try: criar_mapa_lotes(current_data)
            except: pass
    local_buffer.clear()

def process_tile_content(extrator, t_minx, t_miny, t_maxx, t_maxy, existing_inscriptions, tag="BOT") -> List[Dict]:
    """Scans tile and returns NEW lots"""
    polygon_wkt = f"POLYGON(({t_minx} {t_miny}, {t_maxx} {t_miny}, {t_maxx} {t_maxy}, {t_minx} {t_maxy}, {t_minx} {t_miny}))"
    
    params = {
        'OPERATION': 'QUERYMAPFEATURES', 'VERSION': '1.0.0', 'PERSIST': '1',
        'MAPNAME': extrator.map_name, 'SESSION': extrator.map_session_id,
        'LAYERNAMES': 'Lotes', 'GEOMETRY': polygon_wkt, 'SELECTIONVARIANT': 'INTERSECTS', 'MAXFEATURES': '2500'
    }

    # Select with retry
    for attempt in range(3):
        try:
            with request_semaphore:
                extrator.session.post(f"{extrator.BASE_URL}{extrator.MAP_AGENT}", data=params, timeout=30)
            break
        except:
            if attempt < 2:
                time.sleep(3 * (attempt + 1))
            else:
                return []

    # Get bounds
    try:
        with request_semaphore:
            resp = extrator.session.post(
                f"{extrator.BASE_URL}{extrator.FEATURES_URL}",
                data={'MAPNAME': extrator.map_name, 'SESSION': extrator.map_session_id, 'LOCALE': 'en'},
                timeout=30
            )
        if resp.status_code != 200: return []
        raw_lotes = resp.json().get('Lotes', [])
    except:
        return []

    if not raw_lotes: return []
    safe_print(f"[{tag}] Found {len(raw_lotes)} polygons")

    new_lots = []
    def fetch_detail(item):
        import random
        time.sleep(random.uniform(1.0, 3.0))  # Meticulous Mode (1.0-3.0s)
        try:
            b = item.get('zoom')
            if not b: return None
            lote_minx, lote_miny = float(b['minx']), float(b['miny'])
            lote_maxx, lote_maxy = float(b['maxx']), float(b['maxy'])
            
            cx, cy = (lote_minx + lote_maxx)/2, (lote_miny + lote_maxy)/2
            # Increased validation box to 6x6m to catch centroids of large/irregular lots
            q_poly = f"POLYGON(({cx-3} {cy-3}, {cx+3} {cy-3}, {cx+3} {cy+3}, {cx-3} {cy+3}, {cx-3} {cy-3}))"
            
            with request_semaphore:
                r = extrator.session.post(f"{extrator.BASE_URL}{extrator.MAP_AGENT}", data={
                    'OPERATION': 'QUERYMAPFEATURES', 'VERSION': '1.0.0', 'PERSIST': '0',
                    'MAPNAME': extrator.map_name, 'SESSION': extrator.map_session_id, 'LAYERNAMES': 'Lotes',
                    'GEOMETRY': q_poly, 'SELECTIONVARIANT': 'INTERSECTS', 'MAXFEATURES': '1'
                }, timeout=30)
            
            import re
            match = re.search(r'inscricao:(\d+)', r.text)
            if match:
                insc = match.group(1)
                if insc in existing_inscriptions: return {'duplicate': True, 'inscricao': insc}
                meta = extrator.obter_dados_cadastrais(insc)
                return {
                    "inscricao": insc, "metadata": meta,
                    "bounds_utm": {"minx": lote_minx, "miny": lote_miny, "maxx": lote_maxx, "maxy": lote_maxy}
                }
        except: pass
        return None

    total = len(raw_lotes)
    processed = 0
    duplicates = 0
    with ThreadPoolExecutor(max_workers=4) as executor:  # 4 worker per bot (Total 24 threads)
        futures = [executor.submit(fetch_detail, item) for item in raw_lotes]
        for f in as_completed(futures):
            processed += 1
            if processed % 10 == 0:
                safe_print(f"[{tag}] Processed {processed}/{total} in tile...")
            res = f.result()
            if res:
                if res.get('duplicate'):
                    duplicates += 1
                elif res['inscricao'] not in existing_inscriptions:
                    new_lots.append(res)
    
    if duplicates > 0:
        safe_print(f"[{tag}] Ignored {duplicates} existing lots in this tile.")
        
    return new_lots

def worker_vertical(tag, worker_idx, start_y_ref, step, stop_event, output_file, existing_inscriptions, state):
    # Random startup (looks less bot-like)
    import random
    startup_delay = random.randint(3, 15)
    safe_print(f"[{tag}] Waiting {startup_delay}s...")
    time.sleep(startup_delay)
    
    p = get_proxy_for_worker(worker_idx)
    safe_print(f"[{tag}] Using Proxy: {p['http'] if p else 'Direct'}")
    
    ex = ExtratorCompletoGuaruja(proxies=p, verbose=True)
    
    # Robust Session Initialization with Retry
    while not stop_event.is_set():
        try:
            if ex.iniciar_sessao():
                break
        except Exception as e:
            safe_print(f"[{tag}] Session init failed: {str(e)}. Retrying in 10s...")
        time.sleep(10)
    
    if stop_event.is_set(): return

    local_buffer = []

    while not stop_event.is_set():
        # If ref is list (pointer), access idx 0
        if isinstance(start_y_ref, list): 
            cy = int(start_y_ref[0])
        else:
            cy = int(start_y_ref)
        
        if cy < GLOBAL_MINY or cy > GLOBAL_MAXY:
            flush_worker_data(tag, local_buffer, output_file, existing_inscriptions)
            if not stop_event.is_set():
                safe_print(f"[{tag}] Finished range. Sleeping...")
                time.sleep(10)
            continue

        safe_print(f"[{tag}] Y={cy}...")
        cx = GLOBAL_MINX
        while cx < GLOBAL_MAXX:
            if stop_event.is_set(): break
            
            # Skip if already done
            current_last_x = state.bot_north_last_x if tag == "BOT_NORTH" else state.bot_south_last_x
            if tag == "BOT_CENTER_NORTH": current_last_x = state.bot_center_north_last_x
            elif tag == "BOT_CENTER_SOUTH": current_last_x = state.bot_center_south_last_x
            
            if cx <= current_last_x and current_last_x != -1:
                cx += TILE_SIZE
                continue

            safe_print(f"[{tag}] Processing Tile X={cx}...")

            found = process_tile_content(ex, cx, cy, cx+TILE_SIZE, cy+TILE_SIZE, existing_inscriptions, tag)
            
            if found:
                local_buffer.extend(found)
                for item in found: existing_inscriptions.add(item['inscricao'])
                safe_print(f"[{tag}] Holding {len(local_buffer)} new lots (Save target: {WORKER_BATCH_SIZE})")
                
                if len(local_buffer) >= WORKER_BATCH_SIZE:
                    flush_worker_data(tag, local_buffer, output_file, existing_inscriptions)

            if tag == "BOT_NORTH": state.bot_north_last_x = cx
            elif tag == "BOT_SOUTH": state.bot_south_last_x = cx
            elif tag == "BOT_CENTER_NORTH": state.bot_center_north_last_x = cx
            elif tag == "BOT_CENTER_SOUTH": state.bot_center_south_last_x = cx
            cx += TILE_SIZE
        
        # Reset minor axis for next row
        if tag == "BOT_NORTH": state.bot_north_last_x = -1
        elif tag == "BOT_SOUTH": state.bot_south_last_x = -1
        elif tag == "BOT_CENTER_NORTH": state.bot_center_north_last_x = -1
        elif tag == "BOT_CENTER_SOUTH": state.bot_center_south_last_x = -1
        
        flush_worker_data(tag, local_buffer, output_file, existing_inscriptions)
        
        if isinstance(start_y_ref, list):
            start_y_ref[0] += step

def worker_horizontal(tag, worker_idx, start_x_ref, step, stop_event, output_file, existing_inscriptions, state):
    import random
    startup_delay = random.randint(3, 10)
    safe_print(f"[{tag}] Waiting {startup_delay}s...")
    time.sleep(startup_delay)
    
    p = get_proxy_for_worker(worker_idx)
    safe_print(f"[{tag}] Using Proxy: {p['http'] if p else 'Direct'}")
    
    ex = ExtratorCompletoGuaruja(proxies=p, verbose=True)
    while not stop_event.is_set():
        try:
            if ex.iniciar_sessao(): break
        except Exception as e:
            safe_print(f"[{tag}] Session init failed: {str(e)}. Retrying in 10s...")
        time.sleep(10)
    if stop_event.is_set(): return

    local_buffer = []

    while not stop_event.is_set():
        cx = int(start_x_ref[0])
        
        if cx < GLOBAL_MINX or cx > GLOBAL_MAXX:
            flush_worker_data(tag, local_buffer, output_file, existing_inscriptions)
            if not stop_event.is_set():
                safe_print(f"[{tag}] Finished range. Sleeping...")
                time.sleep(10)
            continue

        safe_print(f"[{tag}] X={cx}...")
        cy = GLOBAL_MINY
        while cy < GLOBAL_MAXY:
            if stop_event.is_set(): break
            
            # Skip if already done
            # Skip if already done
            current_last_y = -1
            if tag == "BOT_WEST": current_last_y = state.bot_west_last_y
            elif tag == "BOT_EAST": current_last_y = state.bot_east_last_y
            elif tag == "BOT_CENTER_WEST": current_last_y = state.bot_center_west_last_y
            elif tag == "BOT_CENTER_EAST": current_last_y = state.bot_center_east_last_y
            elif tag == "BOT_Q1_WEST": current_last_y = state.bot_q1_west_last_y
            elif tag == "BOT_Q3_EAST": current_last_y = state.bot_q3_east_last_y
            
            if cy <= current_last_y and current_last_y != -1:
                cy += TILE_SIZE
                continue

            safe_print(f"[{tag}] Processing Tile Y={cy}...")
            found = process_tile_content(ex, cx, cy, cx+TILE_SIZE, cy+TILE_SIZE, existing_inscriptions, tag)
            
            if found:
                local_buffer.extend(found)
                for item in found: existing_inscriptions.add(item['inscricao'])
                
                if len(local_buffer) >= WORKER_BATCH_SIZE:
                    flush_worker_data(tag, local_buffer, output_file, existing_inscriptions)

            if tag == "BOT_WEST": state.bot_west_last_y = cy
            elif tag == "BOT_EAST": state.bot_east_last_y = cy
            elif tag == "BOT_CENTER_WEST": state.bot_center_west_last_y = cy
            elif tag == "BOT_CENTER_EAST": state.bot_center_east_last_y = cy
            elif tag == "BOT_Q1_WEST": state.bot_q1_west_last_y = cy
            elif tag == "BOT_Q3_EAST": state.bot_q3_east_last_y = cy
            cy += TILE_SIZE

        # Reset minor axis for next column
        if tag == "BOT_WEST": state.bot_west_last_y = -1
        elif tag == "BOT_EAST": state.bot_east_last_y = -1
        elif tag == "BOT_CENTER_WEST": state.bot_center_west_last_y = -1
        elif tag == "BOT_CENTER_EAST": state.bot_center_east_last_y = -1
        elif tag == "BOT_Q1_WEST": state.bot_q1_west_last_y = -1
        elif tag == "BOT_Q3_EAST": state.bot_q3_east_last_y = -1
        
        flush_worker_data(tag, local_buffer, output_file, existing_inscriptions)
        start_x_ref[0] += step

def capture_and_vectorize(limit: int = 200000, output_file: str = "lotes_vetorizados.json"):
    print("--- 10-BOT HYPER Scanner (N, S, W, E, CW, CE, CN, CS, Q1W, Q3E) ---")
    
    state = ExtractionState()
    existing_inscriptions = set()
    
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r') as f:
                d = json.load(f)
                for l in d:
                    if 'inscricao' in l:
                        if not l['inscricao'].startswith('Unk'):
                            existing_inscriptions.add(l['inscricao'])
        except: pass
    
    stop_event = threading.Event()
    
    # Defaults in case not in state
    if not hasattr(state, 'center_y'): state.center_y = (GLOBAL_MINY + GLOBAL_MAXY) // 2
    if not hasattr(state, 'q1_x'): state.q1_x = GLOBAL_MINX + (GLOBAL_MAXX - GLOBAL_MINX) // 4
    if not hasattr(state, 'q3_x'): state.q3_x = GLOBAL_MINX + 3 * (GLOBAL_MAXX - GLOBAL_MINX) // 4
    
    # Pointers to current positions (Lists allow pass-by-reference)
    p_top = [state.top_down_y]
    p_bottom = [state.bottom_up_y]
    p_left = [state.left_right_x]
    p_right = [state.right_left_x]
    
    p_center_left = [state.center_left_x]
    p_center_right = [state.center_right_x]
    
    p_center_up = [getattr(state, 'center_up_curr_y', state.center_y)]
    p_center_down = [getattr(state, 'center_down_curr_y', state.center_y)]
    p_q1_left = [getattr(state, 'q1_curr_x', state.q1_x)]
    p_q3_right = [getattr(state, 'q3_curr_x', state.q3_x)]

    threads = []
    # Vertical Bots (Top-Down, Bottom-Up)
    threads.append(threading.Thread(target=worker_vertical, args=("BOT_NORTH", 0, p_top, -TILE_SIZE, stop_event, output_file, existing_inscriptions, state)))
    threads.append(threading.Thread(target=worker_vertical, args=("BOT_SOUTH", 1, p_bottom, TILE_SIZE, stop_event, output_file, existing_inscriptions, state)))
    
    # Horizontal Bots (Left-Right, Right-Left)
    threads.append(threading.Thread(target=worker_horizontal, args=("BOT_WEST", 2, p_left, TILE_SIZE, stop_event, output_file, existing_inscriptions, state)))
    threads.append(threading.Thread(target=worker_horizontal, args=("BOT_EAST", 3, p_right, -TILE_SIZE, stop_event, output_file, existing_inscriptions, state)))
    
    # Center Bots (Center-West, Center-East)
    threads.append(threading.Thread(target=worker_horizontal, args=("BOT_CENTER_WEST", 4, p_center_left, -TILE_SIZE, stop_event, output_file, existing_inscriptions, state)))
    threads.append(threading.Thread(target=worker_horizontal, args=("BOT_CENTER_EAST", 5, p_center_right, TILE_SIZE, stop_event, output_file, existing_inscriptions, state)))

    # NEW BOTS - 10-Bot HYPER Scanner
    # Vertical Centers
    threads.append(threading.Thread(target=worker_vertical, args=("BOT_CENTER_NORTH", 6, p_center_up, TILE_SIZE, stop_event, output_file, existing_inscriptions, state)))
    threads.append(threading.Thread(target=worker_vertical, args=("BOT_CENTER_SOUTH", 7, p_center_down, -TILE_SIZE, stop_event, output_file, existing_inscriptions, state)))
    
    # Horizontal Quarters
    threads.append(threading.Thread(target=worker_horizontal, args=("BOT_Q1_WEST", 8, p_q1_left, -TILE_SIZE, stop_event, output_file, existing_inscriptions, state)))
    threads.append(threading.Thread(target=worker_horizontal, args=("BOT_Q3_EAST", 9, p_q3_right, TILE_SIZE, stop_event, output_file, existing_inscriptions, state)))

    for t in threads: t.start()
    
    try:
        while True:
            time.sleep(5)
            # Sync pointers back to state
            state.top_down_y = p_top[0]
            state.bottom_up_y = p_bottom[0]
            state.left_right_x = p_left[0]
            state.right_left_x = p_right[0]
            state.center_left_x = p_center_left[0]
            state.center_right_x = p_center_right[0]
            
            # Sync new bots
            state.center_up_curr_y = p_center_up[0]
            state.center_down_curr_y = p_center_down[0]
            state.q1_curr_x = p_q1_left[0]
            state.q3_curr_x = p_q3_right[0]
            
            state.save()
    except KeyboardInterrupt:
        safe_print("Stopping...")
        stop_event.set()
    
    for t in threads: t.join()

if __name__ == "__main__":
    capture_and_vectorize()
.gitignore
