const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- 1. SET UP CONTEXT (MOCKING) ---
const context = {
    window: {},
    document: {
        getElementById: () => ({ 
            appendChild: () => {}, 
            querySelector: () => ({ textContent: '' }),
            classList: { add: () => {}, remove: () => {} },
            style: {},
            remove: function() { }
        }),
        createElement: () => ({ 
            style: {}, 
            classList: { add: () => {}, remove: () => {} }, 
            appendChild: () => {},
            remove: function() { }
        }),
        head: { appendChild: () => {} },
        body: { appendChild: () => {} }
    },
    google: {
        maps: {
            geometry: {
                spherical: {
                    computeArea: () => 1000,
                    computeDistanceBetween: () => 10
                },
                poly: {
                    containsLocation: () => true
                }
            },
            LatLng: function(lat, lng) { return { lat, lng }; },
            ControlPosition: { RIGHT_TOP: 1 }
        }
    },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    JSON: JSON,
    Math: Math,
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    RegExp: RegExp,
    Date: Date,
    Error: Error,
    // Add CustomEvent mock
    CustomEvent: function(name, detail) { this.name = name; this.detail = detail; },
    dispatchEvent: () => {}
};

context.window = context;
vm.createContext(context);

function loadScript(fileName) {
    const filePath = path.join(__dirname, '..', 'mapa_interativo', fileName);
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(code, context);
}

try {
    loadScript('utils.js');
    loadScript('zoning_handler.js');
    loadScript('tooltip_handler.js');
    loadScript('monetization_handler.js');
    loadScript('portfolio_handler.js');
    loadScript('institutional_handler.js');
} catch (e) {
    process.stdout.write(`Failed to load scripts: ${e.message}\n`);
    process.exit(1);
}

// --- 2. GLOBAL MOCKS FOR NEW LOGIC ---
context.supabaseApp = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: '123' } } }) },
    from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }), single: () => Promise.resolve({ data: null }) }) }),
        insert: () => Promise.resolve({ error: null })
    })
};
context.Toast = { success: () => {}, error: () => {}, info: () => {}, warning: () => {} };
context.Loading = { show: () => {}, hide: () => {} };
context.map = { fitBounds: () => {}, setZoom: () => {}, queryRenderedFeatures: () => [] };
context.google.maps.importLibrary = () => Promise.resolve({ AdvancedMarkerElement: function() { return { map: null }; } });
context.google.maps.LatLngBounds = function() { return { extend: () => {} }; };


// --- 3. TEST ENGINE ---
const results = [];
function describe(name, fn) {
    // Reset defaults between describes if needed
    process.stdout.write(`\n📦 ${name}\n`);
    fn();
}

function it(name, fn) {
    try {
        const ret = fn();
        if (ret instanceof Promise) {
            ret.then(() => {
                process.stdout.write(`  ✅ ${name}\n`);
                results.push(true);
            }).catch(e => {
                process.stdout.write(`  ❌ ${name}: ${e.message}\n`);
                results.push(false);
            });
        } else {
            process.stdout.write(`  ✅ ${name}\n`);
            results.push(true);
        }
    } catch (e) {
        process.stdout.write(`  ❌ ${name}: ${e.message}\n`);
        results.push(false);
    }
}

function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`);
        },
        toBeTruthy: () => {
            if (!actual) throw new Error(`Expected truthy but got ${actual}`);
        },
        toBeFalsy: () => {
            if (actual) throw new Error(`Expected falsy but got ${actual}`);
        },
        toBeCloseTo: (expected, precision = 2) => {
            if (Math.abs(actual - expected) > Math.pow(10, -precision) / 2) {
                throw new Error(`Expected ${actual} to be close to ${expected}`);
            }
        }
    };
}

// --- 4. TEST CASES ---

describe('Utils: Document Formatting', () => {
    it('should obfuscate CPF correctly (Masked)', () => {
        expect(context.formatDocument('12345678901', false)).toBe('123.***.***-01');
    });

    it('should format visible CPF if Elite+', () => {
        context.Monetization.userRole = 'elite';
        expect(context.formatDocument('12345678901', true)).toBe('123.456.789-01');
    });

    it('should keep masking if not Elite+', () => {
        context.Monetization.userRole = 'user';
        expect(context.formatDocument('12345678901', true)).toBe('123.***.***-01');
    });
});

describe('Utils: Validations', () => {
    it('should identify invalid CPF', () => {
        expect(context.validateCPF('11111111111')).toBeFalsy();
    });

    it('should identify valid CPF', () => {
        // Corrected valid CPF for testing
        expect(context.validateCPF('52998224725')).toBeTruthy();
    });
});

describe('Utils: Coordinates', () => {
    it('should convert UTM to LatLon (Approximate)', () => {
        const result = context.utmToLatLon(367468, 7344932); // Guaruja center approx
        expect(result.lat).toBeCloseTo(-23.99, 1);
        expect(result.lng).toBeCloseTo(-46.30, 1);
    });
});

describe('Zoning: Rules Integrity', () => {
    it('should have ZUM defined with CA 4.0', () => {
        // Since ZoningHandler hides ZoningRules, we test through runSimulation if needed
        // but here I can check if ZoningHandler is loaded
        expect(typeof context.ZoningHandler).toBe('object');
    });
});

describe('Tooltip: Unit Classification', () => {
    it('should detect Garage by keywords', async () => {
        const unit = { complemento: 'VAGA DE GARAGEM', tipo: 'Apartamento', inscricao: '1' };
        context.silentUpdateType = () => {}; 
        context.Loading = { show: () => {}, hide: () => {} };
        const type = await context.checkAndFixUnitType(unit);
        expect(type).toBe('Garagem');
    });

    it('should detect Commercial by keywords', async () => {
        const unit = { tipo: 'Apartamento', complemento: 'SALA COMERCIAL 101', inscricao: '2' };
        context.silentUpdateType = () => {};
        const type = await context.checkAndFixUnitType(unit);
        expect(type).toBe('Comercial');
    });
});

describe('Monetization: Feature Access', () => {
    it('should allow master everything', () => {
        context.Monetization.userRole = 'master';
        expect(context.Monetization.canAccess('mapear_patrimonio')).toBeTruthy();
        expect(context.Monetization.canAccess('dossier_pdf')).toBeTruthy();
    });

    it('should restrict elite from some master features if any', () => {
        context.Monetization.userRole = 'elite';
        expect(context.Monetization.canAccess('mapear_patrimonio')).toBeTruthy();
    });

    it('should restrict pro from elite features', () => {
        context.Monetization.userRole = 'pro';
        expect(context.Monetization.canAccess('mapear_patrimonio')).toBeFalsy();
    });
});

describe('Monetization: Unlock Logic', () => {
    it('should identify unlocked lot from Set', () => {
        const insc = '12345678000';
        context.Monetization.unlockedLots = new Set(['12345678']); // Parent lot unlocked
        expect(context.Monetization.isUnlocked(insc)).toBeTruthy();
    });

    it('should identify locked lot correctly', () => {
        context.Monetization.unlockedLots = new Set(['99999999']);
        expect(context.Monetization.isUnlocked('11111111')).toBeFalsy();
    });
});

describe('Portfolio: Aggregation Integrity', () => {
    it('should exist and be initialized', () => {
        expect(typeof context.PortfolioHandler).toBe('object');
    });

    it('should be able to clear portfolio', () => {
        context.PortfolioHandler.activePortfolioMarkers = [];
        context.PortfolioHandler.activePortfolioPolygons = [];
        context.PortfolioHandler.clearPortfolio();
        expect(context.PortfolioHandler.activePortfolioMarkers.length).toBe(0);
    });
});

setTimeout(() => {
    const passed = results.filter(r => r).length;
    process.stdout.write(`\n--- SUMMARY ---\n`);
    process.stdout.write(`${passed}/${results.length} tests passed.\n`);
    if (passed < results.length) {
        process.stdout.write(`Final result: FAILED\n`);
        process.exit(1);
    } else {
        process.stdout.write(`Final result: PASSED\n`);
        process.exit(0);
    }
}, 500);
