"""
Address Matcher - Validates scraped addresses against unit addresses
"""
import re
from typing import Dict, Tuple

def normalize_logradouro(logradouro: str) -> str:
    """Normalize street name for comparison"""
    if not logradouro:
        return ""
    
    # Convert to uppercase
    norm = logradouro.upper().strip()
    
    # Replace abbreviations
    replacements = {
        'AV.': 'AVENIDA',
        'AV ': 'AVENIDA ',
        'R.': 'RUA',
        'R ': 'RUA ',
        'AL.': 'ALAMEDA',
        'AL ': 'ALAMEDA ',
        'TVL': 'TRAVESSA',
        'PÇA': 'PRAÇA',
        'PCA': 'PRAÇA',
        'EST.': 'ESTRADA',
    }
    
    for abbr, full in replacements.items():
        norm = norm.replace(abbr, full)
    
    # Remove extra spaces
    norm = re.sub(r'\s+', ' ', norm)
    
    return norm.strip()

def normalize_numero(numero: str) -> str:
    """Normalize street number"""
    if not numero:
        return ""
    
    # Remove leading zeros
    return str(int(numero)) if numero.isdigit() else numero.strip()

def calculate_match_score(scraped_addr: str, unit_logradouro: str, unit_numero: str, unit_bairro: str) -> Tuple[int, str]:
    """
    Calculate match score between scraped address and unit address
    Returns: (score 0-100, reason)
    """
    if not scraped_addr:
        return 0, "Endereço scraped vazio"
    
    scraped_upper = scraped_addr.upper()
    
    # Normalize unit data
    norm_logradouro = normalize_logradouro(unit_logradouro or "")
    norm_numero = normalize_numero(unit_numero or "")
    norm_bairro = (unit_bairro or "").upper().strip()
    
    score = 0
    reasons = []
    
    # Check logradouro (50 points)
    if norm_logradouro and norm_logradouro in scraped_upper:
        score += 50
        reasons.append(f"✓ Logradouro match: {norm_logradouro}")
    elif norm_logradouro:
        # Try fuzzy match (partial match)
        words = norm_logradouro.split()
        matched_words = sum(1 for word in words if len(word) > 3 and word in scraped_upper)
        if matched_words >= len(words) * 0.6:  # 60% of words match
            partial_score = int(50 * (matched_words / len(words)))
            score += partial_score
            reasons.append(f"≈ Logradouro parcial ({matched_words}/{len(words)} palavras)")
        else:
            reasons.append(f"✗ Logradouro não encontrado: {norm_logradouro}")
    
    # Check número (40 points)
    if norm_numero:
        # Try exact number match
        if norm_numero in scraped_upper or f", {norm_numero}" in scraped_upper or f" {norm_numero} " in scraped_upper:
            score += 40
            reasons.append(f"✓ Número match: {norm_numero}")
        else:
            reasons.append(f"✗ Número não encontrado: {norm_numero}")
    
    # Check bairro (10 points bonus)
    if norm_bairro and norm_bairro in scraped_upper:
        score += 10
        reasons.append(f"✓ Bairro match: {norm_bairro}")
    
    reason_str = " | ".join(reasons)
    return min(score, 100), reason_str

def validate_address(scraped_addr: str, unit_data: Dict) -> Tuple[int, str]:
    """
    Main validation function
    Args:
        scraped_addr: Full address extracted from listing
        unit_data: Dict with keys: logradouro, numero, bairro
    
    Returns:
        (match_score, reason_string)
    """
    score, reason = calculate_match_score(
        scraped_addr,
        unit_data.get('logradouro', ''),
        unit_data.get('numero', ''),
        unit_data.get('bairro', '')
    )
    
    return score, reason

if __name__ == '__main__':
    # Test cases
    test_cases = [
        {
            'scraped': 'Avenida Miguel Alonso Gonzalez, 164 - Astúrias, Guarujá',
            'unit': {'logradouro': 'AV MIGUEL ALONSO GONZALEZ', 'numero': '00164', 'bairro': 'ASTÚRIAS'}
        },
        {
            'scraped': 'Rua Floriano Peixoto, 407 - Pitangueiras',
            'unit': {'logradouro': 'AL MAL FLORIANO PEIXOTO', 'numero': '00407', 'bairro': 'PITANGUEIRAS'}
        }
    ]
    
    for test in test_cases:
        score, reason = validate_address(test['scraped'], test['unit'])
        print(f"\nScraped: {test['scraped']}")
        print(f"Score: {score}% - {reason}")
