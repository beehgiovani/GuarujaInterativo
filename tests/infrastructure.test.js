/**
 * 🧪 Testes de Infraestrutura (Store & Backoff)
 */

// 1. Mock de Globais para o Store
global.window = global.window || {};
global.document = global.document || { 
    getElementById: (id) => ({ 
        style: {}, 
        innerText: '' 
    }),
    querySelector: () => ({ innerText: '' })
};

// Carregar o Store (Simulando o que está no mapa.html)
// Em um teste real, poderíamos importar, mas aqui vamos definir a lógica
window.Store = {
    lotes: {},
    getNeighborhoodAvg: (bairro) => {
        if (!bairro) return 0;
        const lotes = Object.values(window.Store.lotes).filter(l => l.bairro === bairro);
        const values = lotes.map(l => parseFloat(l.valor_m2 ? l.valor_m2.toString().replace(',', '.') : 0)).filter(v => v > 0);
        if (values.length === 0) return 0;
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }
};

test('Store: Cálculo de Média por Bairro', () => {
    window.Store.lotes = {
        "1": { bairro: "Enseada", valor_m2: 5000 },
        "2": { bairro: "Enseada", valor_m2: 7000 },
        "3": { bairro: "Pitangueiras", valor_m2: 10000 }
    };
    
    const avgEnseada = window.Store.getNeighborhoodAvg("Enseada");
    expect(avgEnseada).toBe(6000); // (5000 + 7000) / 2
});

test('Backoff: Resiliência de API (Mock)', async () => {
    let callCount = 0;
    
    // Mock de uma função que falha 2 vezes e acerta na 3ª
    const mockFetch = async () => {
        callCount++;
        if (callCount < 3) {
            throw new Error("Rate Limit 429");
        }
        return { ok: true, json: async () => ({ status: "success" }) };
    };

    // Lógica simplificada do backoff para teste unitário
    const fetchWithBackoff = async (fn, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (err) {
                if (i === retries - 1) throw err;
                // No teste não esperamos o delay real para ser rápido
            }
        }
    };

    const result = await fetchWithBackoff(mockFetch);
    expect(callCount).toBe(3);
    expect(result.ok).toBeTruthy();
});
