
import cv2
import numpy as np
import json
import sys
import math

# --- Coordinate Utils (Copied for stability) ---
def utm_to_latlon(easting, northing, zone=23, south=True):
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    b = a * (1 - f)
    e2 = (a**2 - b**2) / a**2
    e2_prime = (a**2 - b**2) / b**2
    x = easting - 500000.0
    y = northing
    if south: y -= 10000000.0
    M = y / k0
    mu = M / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1_rad = mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu) + \
                (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu) + \
                (151 * e1**3 / 96) * math.sin(6 * mu)
    N1 = a / math.sqrt(1 - e2 * math.sin(phi1_rad)**2)
    T1 = math.tan(phi1_rad)**2
    C1 = e2_prime * math.cos(phi1_rad)**2
    R1 = a * (1 - e2) / math.pow(1 - e2 * math.sin(phi1_rad)**2, 1.5)
    D = x / (N1 * k0)
    lat_rad = phi1_rad - (N1 * math.tan(phi1_rad) / R1) * \
              (D**2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1**2 - 9 * e2_prime) * D**4 / 24 + \
               (61 + 90 * T1 + 298 * C1 + 45 * T1**2 - 252 * e2_prime - 3 * C1**2) * D**6 / 720)
    lon0 = math.radians((zone - 1) * 6 - 180 + 3)
    lon_rad = lon0 + (D - (1 + 2 * T1 + C1) * D**3 / 6 + \
              (5 - 2 * C1 + 28 * T1 - 3 * C1**2 + 8 * e2_prime + 24 * T1**2) * D**5 / 120) / math.cos(phi1_rad)
    return math.degrees(lat_rad), math.degrees(lon_rad)

def transform_point(x, y, offset_lat, offset_lon):
    lat, lon = utm_to_latlon(x, y)
    return lat + offset_lat, lon + offset_lon

def vectorize(image_path, minx, miny, maxx, maxy, offset_lat, offset_lon, output_file):
    print(f"Processing {image_path}...")
    
    # Load image (unchanged, keeping alpha)
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    
    if img is None:
        print("Error: Could not load image")
        sys.exit(1)
        
    height, width = img.shape[:2]
    
    # Extract Alpha Channel
    if img.shape[2] == 4:
        alpha = img[:, :, 3]
    else:
        # If no alpha, assume black lines on white, so invert to get white lines on black
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        alpha = cv2.bitwise_not(gray) # white lines, black bg

    # Threshold to get the LINES as white (255)
    # The 'Lotes' layer usually draws outlines.
    _, lines_mask = cv2.threshold(alpha, 10, 255, cv2.THRESH_BINARY)
    
    # We want the AREA defined by the lines.
    # The image is centered on the lot. So the center pixel should be INSIDE the lot.
    # The lines separate the center from the outside.
    
    cx, cy = width // 2, height // 2
    
    # Create valid mask for floodfill (height+2, width+2)
    h_ff, w_ff = height + 2, width + 2
    mask_ff = np.zeros((h_ff, w_ff), np.uint8)
    
    # We operate on a copy because floodFill modifies image
    # Invert lines_mask: Lines are 0 (walls), Empty space is 255 (walkable)
    # Actually floodFill works on the image values.
    # Let's simple create a "Walls" image where Lines=255, Empty=0.
    # If we floodfill from center on a black canvas with white walls, 
    # and the center is 0 (black/empty), success.
    # If the center pixel IS a line (unlikely if lot is big enough), we might need to search neighbors.
    
    flood_img = lines_mask.copy()
    
    # Verify center is not a line
    if flood_img[cy, cx] > 128:
        # Center is on a line. Spiral search for empty space?
        # Simple search 2px around
        found = False
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                ny, nx = cy+dy, cx+dx
                if 0 <= ny < height and 0 <= nx < width:
                    if flood_img[ny, nx] < 128:
                        cx, cy = nx, ny
                        found = True
                        break
            if found: break
            
    # FloodFill to get the internal area
    # floodFill paints connected component.
    # We flood with separate color (128)
    retval, _, _, _ = cv2.floodFill(flood_img, mask_ff, (cx, cy), 128, flags=4 | (255 << 8))
    
    # Now extract ONLY the flooded area (value 128)
    # Create mask for value 128
    lot_mask = np.zeros_like(lines_mask)
    lot_mask[flood_img == 128] = 255
    
    # Find contours on this mask (the filled lot area)
    contours, _ = cv2.findContours(lot_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    print(f"Found {len(contours)} contours (Targeting main lot)")
    
    polygons = []
    
    # There should ideally be one main contour. Take the largest one.
    if contours:
        cnt = max(contours, key=cv2.contourArea)
        
        # Simplify contour
        # Reduced epsilon factor for higher precision as requested by user
        epsilon = 0.0002 * cv2.arcLength(cnt, True) 
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        
        if len(approx) >= 3:
            poly_coords = []
            
            for point in approx:
                px, py = point[0]
                
                # Pixel to UTM
                # X: 0 -> width maps to minx -> maxx
                ux = minx + (px / width) * (maxx - minx)
                
                # Y: 0 -> height maps to maxy -> miny (Image Y is down, Map Y is up)
                uy = maxy - (py / height) * (maxy - miny)
                
                lat, lon = transform_point(ux, uy, offset_lat, offset_lon)
                poly_coords.append([lat, lon])
                
            polygons.append(poly_coords)
        
    # Save to JSON
    with open(output_file, 'w') as f:
        json.dump(polygons, f)
        
    print(f"Saved {len(polygons)} polygons to {output_file}")

if __name__ == "__main__":
    if len(sys.argv) < 9:
        print("Usage: python vectorizer.py image_path minx miny maxx maxy offset_lat offset_lon output.json")
        sys.exit(1)
        
    vectorize(
        sys.argv[1],
        float(sys.argv[2]), float(sys.argv[3]), 
        float(sys.argv[4]), float(sys.argv[5]),
        float(sys.argv[6]), float(sys.argv[7]),
        sys.argv[8]
    )
.gitignore
