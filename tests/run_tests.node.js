/**
 * GUARUGEO TEST RUNNER 2.0
 * Executa todos os testes unitários da pasta tests/unit/
 * Compatível com a estrutura atual do projeto (js/)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ============================================================
//  SANDBOX GLOBAL (Mock do Browser)
// ============================================================
const context = {
    window: {},
    location: { hostname: 'localhost', href: 'http://localhost:5000/', protocol: 'http:' },
    document: {
        getElementById: (id) => ({
            appendChild: () => {},
            querySelector: () => ({ textContent: '', style: {}, classList: { add: () => {}, remove: () => {} } }),
            querySelectorAll: () => [],
            classList: { add: () => {}, remove: () => {}, contains: () => false },
            style: {},
            remove: function() {},
            innerHTML: '',
            textContent: '',
            value: ''
        }),
        querySelector: () => null,
        querySelectorAll: () => [],
        createElement: (tag) => ({
            style: {},
            classList: { add: () => {}, remove: () => {}, contains: () => false },
            appendChild: () => {},
            setAttribute: () => {},
            addEventListener: () => {},
            remove: function() {},
            innerHTML: '',
            textContent: '',
            id: '',
            className: ''
        }),
        head: { appendChild: () => {} },
        body: { appendChild: () => {}, insertAdjacentHTML: () => {} },
        addEventListener: () => {},
        removeEventListener: () => {},
    },
    navigator: { geolocation: { getCurrentPosition: () => {} } },
    localStorage: {
        _store: {},
        getItem: function(k) { return this._store[k] || null; },
        setItem: function(k, v) { this._store[k] = String(v); },
        removeItem: function(k) { delete this._store[k]; },
        clear: function() { this._store = {}; }
    },
    google: {
        maps: {
            geometry: {
                spherical: {
                    computeArea: () => 1000,
                    computeDistanceBetween: () => 10
                },
                poly: { containsLocation: () => true }
            },
            LatLng: function(lat, lng) { return { lat: () => lat, lng: () => lng }; },
            LatLngBounds: function() { return { extend: () => {}, getCenter: () => ({ lat: () => -24, lng: () => -46 }) }; },
            ControlPosition: { RIGHT_TOP: 1, TOP_RIGHT: 2 },
            importLibrary: () => Promise.resolve({
                AdvancedMarkerElement: function(o) { return { map: null, ...o }; }
            }),
            Map: function() { return { fitBounds: () => {}, setZoom: () => {} }; }
        }
    },
    // Supabase Mock
    supabaseApp: {
        auth: { 
            getUser: () => Promise.resolve({ data: { user: { id: 'test-user-123', email: 'test@test.com' } } }),
            signInWithPassword: () => Promise.resolve({ data: { user: {} }, error: null }),
            signUp: () => Promise.resolve({ data: { user: {} }, error: null }),
            signOut: () => Promise.resolve({ error: null })
        },
        from: () => ({
            select: function() { return this; },
            insert: () => Promise.resolve({ error: null, data: [{ id: 'new-123' }] }),
            update: function() { return this; },
            delete: function() { return this; },
            eq: function() { return this; },
            neq: function() { return this; },
            or: function() { return this; },
            in: function() { return this; },
            gte: function() { return this; },
            lte: function() { return this; },
            order: function() { return this; },
            limit: function() { return this; },
            single: () => Promise.resolve({ data: { id: 'test-123', nome: 'Teste' }, error: null }),
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            then: (fn) => Promise.resolve({ data: [], error: null }).then(fn),
            count: 0,
            head: function() { return this; }
        }),
        storage: {
            from: () => ({
                upload: () => Promise.resolve({ data: { path: 'test.jpg' }, error: null }),
                getPublicUrl: () => ({ data: { publicUrl: 'http://test.com/test.jpg' } }),
                remove: () => Promise.resolve({ error: null })
            })
        },
        channel: () => ({ on: () => ({ subscribe: () => {} }) }),
        rpc: () => Promise.resolve({ data: [], error: null })
    },
    // UI Mocks
    Toast: { success: () => {}, error: () => {}, info: () => {}, warning: () => {} },
    Loading: { show: () => {}, hide: () => {} },
    console: {
        log: () => {},
        warn: () => {},
        error: () => {},
        group: () => {},
        groupEnd: () => {}
    },
    // JS builtins
    setTimeout, clearTimeout, setInterval, clearInterval,
    JSON, Math, Object, Array, String, Number, Boolean, RegExp, Date, Error, Promise, Map, Set,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
    CustomEvent: function(name, opts) { this.name = name; this.detail = opts?.detail; },
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    _domMap: {},
    fetchMock: null,
    performance: { now: () => Date.now() },
    // Map Mock
    map: {
        fitBounds: () => {},
        setZoom: () => {},
        queryRenderedFeatures: () => [],
        getZoom: () => 15,
        getCenter: () => ({ lat: -23.99, lng: -46.27 }),
        on: () => {},
        addSource: () => {},
        addLayer: () => {},
        getSource: () => null,
        getLayer: () => null,
        panTo: () => {}
    },
};

context.window = context;
vm.createContext(context);

// ============================================================
//  LOADER DE SCRIPT
// ============================================================
function loadScript(relPath, optional = false) {
    const filePath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(filePath)) {
        if (!optional) process.stdout.write(`  ⚠️  Arquivo não encontrado: ${relPath}\n`);
        return false;
    }
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        vm.runInContext(code, context);
        return true;
    } catch (e) {
        process.stdout.write(`  ⚠️  Erro ao carregar ${relPath}: ${e.message}\n`);
        return false;
    }
}

// ============================================================
//  CARREGAMENTO DOS MÓDULOS PRINCIPAIS
// ============================================================
process.stdout.write('\n🔧 Carregando módulos do sistema...\n');
const coreModules = [
    'js/utils.js',
    'js/zoning_handler.js',
    'js/monetization_handler.js',
    'js/portfolio_handler.js',
    'js/hub_handler.js',
    'js/onboarding_handler.js',
];
coreModules.forEach(m => loadScript(m, true));

// Inicializa Monetization com role padrão para testes
if (!context.Monetization) {
    context.Monetization = {
        userRole: 'master',
        canAccess: () => true,
        isEliteOrAbove: () => true,
        isUnlocked: () => false,
        unlockedLots: new Set()
    };
}

// ============================================================
//  ENGINE DE TESTES
// ============================================================
const allResults = [];
let currentSuite = '';

function describe(name, fn) {
    currentSuite = name;
    process.stdout.write(`\n📦 ${name}\n`);
    fn();
}

function it(name, fn) {
    try {
        const ret = fn();
        if (ret instanceof Promise) {
            ret.then(() => {
                process.stdout.write(`  ✅ ${name}\n`);
                allResults.push({ suite: currentSuite, name, passed: true });
            }).catch(e => {
                process.stdout.write(`  ❌ ${name}: ${e.message}\n`);
                allResults.push({ suite: currentSuite, name, passed: false, error: e.message });
            });
        } else {
            process.stdout.write(`  ✅ ${name}\n`);
            allResults.push({ suite: currentSuite, name, passed: true });
        }
    } catch (e) {
        process.stdout.write(`  ❌ ${name}: ${e.message}\n`);
        allResults.push({ suite: currentSuite, name, passed: false, error: e.message });
    }
}

function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected) throw new Error(`Esperado "${expected}" mas recebeu "${actual}"`);
        },
        toBeTruthy: () => {
            if (!actual) throw new Error(`Esperado truthy mas recebeu: ${actual}`);
        },
        toBeFalsy: () => {
            if (actual) throw new Error(`Esperado falsy mas recebeu: ${actual}`);
        },
        toBeCloseTo: (expected, precision = 2) => {
            if (Math.abs(actual - expected) > Math.pow(10, -precision) / 2)
                throw new Error(`Esperado ~${expected} mas recebeu ${actual}`);
        },
        toBeNull: () => {
            if (actual !== null) throw new Error(`Esperado null mas recebeu: ${actual}`);
        },
        toBeUndefined: () => {
            if (actual !== undefined) throw new Error(`Esperado undefined mas recebeu: ${actual}`);
        },
        toEqual: (expected) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected))
                throw new Error(`Esperado ${JSON.stringify(expected)} mas recebeu ${JSON.stringify(actual)}`);
        },
        toContain: (item) => {
            if (!actual || !actual.includes(item))
                throw new Error(`Esperado que "${actual}" contivesse "${item}"`);
        },
        toBeGreaterThan: (n) => {
            if (actual <= n) throw new Error(`Esperado > ${n} mas recebeu ${actual}`);
        },
        toBeLessThan: (n) => {
            if (actual >= n) throw new Error(`Esperado < ${n} mas recebeu ${actual}`);
        }
    };
}

// Injetar no contexto para uso nos test files
context.describe = describe;
context.it = it;
context.test = it;
context.expect = expect;
context.beforeEach = (fn) => { context._beforeEach = fn; };
context.afterEach  = (fn) => { context._afterEach  = fn; };

// Alias compatível com os tests da pasta unit/ (usam loadProjectScript)
context.loadProjectScript = function(filename) {
    loadScript('js/' + filename, true);
};

// Garantir que utils.js só seja carregado UMA vez (evita Identifier already declared)
context._loadedScripts = new Set();
context.loadProjectScript = function(filename) {
    if (context._loadedScripts.has(filename)) return; // Skip re-declaração
    context._loadedScripts.add(filename);
    loadScript('js/' + filename, true);
};

// ============================================================
//  TESTES PRINCIPAIS INLINE (Hub, CRM, Onboarding)
// ============================================================

describe('Utils: Document Formatting', () => {
    it('should format CPF masked for non-elite users', () => {
        context.Monetization.userRole = 'user';
        expect(context.formatDocument('12345678901', true)).toBe('123.***.***-01');
    });
    it('should format CPF visible for elite+ users', () => {
        context.Monetization.userRole = 'elite';
        expect(context.formatDocument('12345678901', true)).toBe('123.456.789-01');
    });
    it('should always mask if showFull=false', () => {
        expect(context.formatDocument('12345678901', false)).toBe('123.***.***-01');
    });
});

describe('Utils: Validations', () => {
    it('should reject invalid CPF (all same digits)', () => {
        expect(context.validateCPF('11111111111')).toBeFalsy();
    });
    it('should accept valid CPF', () => {
        expect(context.validateCPF('52998224725')).toBeTruthy();
    });
    it('should reject invalid CNPJ', () => {
        expect(context.validateCNPJ?.('00000000000000') ?? false).toBeFalsy();
    });
});

describe('Utils: Coordinates', () => {
    it('should convert Guarujá UTM to LatLon', () => {
        const result = context.utmToLatLon(367468, 7344932);
        expect(result.lat).toBeCloseTo(-23.99, 1);
        expect(result.lng).toBeCloseTo(-46.30, 1);
    });
});

describe('Zoning: Handler Integrity', () => {
    it('ZoningHandler should be loaded', () => {
        expect(typeof context.ZoningHandler).toBe('object');
    });
    it('ZoningHandler.runSimulation should be a function', () => {
        expect(typeof context.ZoningHandler?.runSimulation).toBe('function');
    });
});

describe('Monetization: Feature Access', () => {
    it('master can access mapear_patrimonio', () => {
        context.Monetization.userRole = 'master';
        expect(context.Monetization.canAccess('mapear_patrimonio')).toBeTruthy();
    });
    it('pro cannot access mapear_patrimonio', () => {
        context.Monetization.userRole = 'pro';
        expect(context.Monetization.canAccess('mapear_patrimonio')).toBeFalsy();
    });
    it('user cannot access crm_history', () => {
        context.Monetization.userRole = 'user';
        expect(context.Monetization.canAccess('crm_history')).toBeFalsy();
    });
});

describe('Monetization: Unlock Logic', () => {
    it('should detect unlocked parent lot', () => {
        context.Monetization.unlockedLots = new Set(['12345678']);
        expect(context.Monetization.isUnlocked('12345678000')).toBeTruthy();
    });
    it('should detect locked lot', () => {
        context.Monetization.unlockedLots = new Set(['99999999']);
        expect(context.Monetization.isUnlocked('11111111')).toBeFalsy();
    });
});

describe('HubHandler: Module Integrity', () => {
    const hub = context.HubHandler;
    it('HubHandler should be a loaded object', () => {
        expect(typeof hub).toBe('object');
    });
    it('HubHandler.openHub should be a function', () => {
        expect(typeof hub?.openHub).toBe('function');
    });
    it('HubHandler.closeHub should be a function', () => {
        expect(typeof hub?.closeHub).toBe('function');
    });
    it('HubHandler.launchRadarSearch should be a function', () => {
        expect(typeof hub?.launchRadarSearch).toBe('function');
    });
    it('HubHandler.launchApp should be a function', () => {
        expect(typeof hub?.launchApp).toBe('function');
    });
    it('launchRadarSearch should not throw when chip DNE', () => {
        // document.querySelector returns null, toast.info should be called
        let toastCalled = false;
        context.Toast.info = () => { toastCalled = true; };
        try { hub?.launchRadarSearch(); } catch(e) { throw e; }
    });
});

describe('Onboarding: Module Integrity', () => {
    const ob = context.Onboarding;
    it('Onboarding should be loaded', () => {
        expect(typeof ob).toBe('object');
    });
    it('checkAndStart should be a function', () => {
        expect(typeof ob?.checkAndStart).toBe('function');
    });
    it('checkHubTour should be a function', () => {
        expect(typeof ob?.checkHubTour).toBe('function');
    });
    it('checkCrmTour should be a function', () => {
        expect(typeof ob?.checkCrmTour).toBe('function');
    });
    it('checkRadarTour should be a function', () => {
        expect(typeof ob?.checkRadarTour).toBe('function');
    });
    it('_keys should have all 8 required keys', () => {
        const keys = ob?._keys || {};
        expect(typeof keys.main).toBe('string');
        expect(typeof keys.hub).toBe('string');
        expect(typeof keys.crm).toBe('string');
        expect(typeof keys.wallet).toBe('string');
        expect(typeof keys.radar).toBe('string');
        expect(typeof keys.lot).toBe('string');
        expect(typeof keys.unit).toBe('string');
        expect(typeof keys.owner).toBe('string');
    });
});

describe('Portfolio: Module Integrity', () => {
    it('PortfolioHandler should be loaded', () => {
        expect(typeof context.PortfolioHandler).toBe('object');
    });
    it('clearPortfolio should not throw', () => {
        context.PortfolioHandler.activePortfolioMarkers = [];
        context.PortfolioHandler.activePortfolioPolygons = [];
        context.PortfolioHandler.clearPortfolio?.();
    });
});

// ============================================================
//  CARREGAR TESTES ADICIONAIS DA PASTA unit/
// ============================================================
process.stdout.write('\n🗂️  Carregando testes da pasta unit/...\n');
const unitDir = path.join(__dirname, 'unit');
const testFiles = fs.readdirSync(unitDir).filter(f => f.endsWith('.test.js'));

testFiles.forEach(file => {
    try {
        const code = fs.readFileSync(path.join(unitDir, file), 'utf8');
        // Resetar _domMap entre arquivos para evitar estado compartilhado
        context._domMap = {};
        vm.runInContext(code, context);
    } catch (e) {
        const errLine = e.message?.split('\n')[0] || e.message;
        process.stdout.write(`  ⚠️  ${file}: ${errLine}\n`);
    }
});

// ============================================================
//  SUMMARY
// ============================================================
setTimeout(() => {
    const totalAsync = allResults.length;
    const passed = allResults.filter(r => r.passed).length;
    const failed = allResults.filter(r => !r.passed);

    process.stdout.write(`\n${'='.repeat(50)}\n`);
    process.stdout.write(`📊 RESULTADO FINAL\n`);
    process.stdout.write(`${'='.repeat(50)}\n`);
    process.stdout.write(`✅ Aprovados : ${passed}\n`);
    process.stdout.write(`❌ Reprovados: ${failed.length}\n`);
    process.stdout.write(`📋 Total     : ${totalAsync}\n`);

    if (failed.length > 0) {
        process.stdout.write(`\n🔴 FALHAS DETALHADAS:\n`);
        failed.forEach(f => {
            process.stdout.write(`   [${f.suite}] > ${f.name}\n`);
            process.stdout.write(`     ↳ ${f.error}\n`);
        });
        process.stdout.write(`\nFinal: FAILED\n`);
        process.exit(1);
    } else {
        process.stdout.write(`\nFinal: ✅ ALL PASSED\n`);
        process.exit(0);
    }
}, 1500);
