/**
 * TEST RUNNER (V2.2.0 - FULL BROWSER SANDBOX)
 * Motor de simulação isolado para testes "Extreme".
 * Inclui APIs como URLSearchParams e localStorage mockado.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RESULTS = { pass: 0, fail: 0 };
const argFile = process.argv[2];
const unitDir = path.join(__dirname, 'unit');
const testFiles = argFile 
    ? [path.basename(argFile)] 
    : fs.readdirSync(unitDir).filter(f => f.endsWith('.test.js'));

async function runTests() {
    process.stdout.write(`\n🚀 Iniciando Suíte de Testes Consolidados (Modo Full Sandbox)...\n`);

    for (const file of testFiles) {
        const testQueue = [];
        let beforeEachHooks = [];
        let afterEachHooks = [];

        // 1. Criar Contexto Sandbox Limpo para CADA arquivo
        const context = {
            window: {},
            console: {
                log: (...args) => {
                    const msg = String(args[0]);
                    if (msg.includes('Mocks') || msg.includes('module loaded') || msg.includes('Configuração de Segurança')) return;
                    console.log(...args);
                },
                error: console.error,
                warn: console.warn,
                info: console.info
            },
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            setInterval: setInterval,
            clearInterval: clearInterval,
            process: process,
            Buffer: Buffer,
            __dirname: __dirname,
            require: require,
            URL: URL,
            URLSearchParams: URLSearchParams,
            navigator: { userAgent: 'NodeTestRunner' },
            CustomEvent: class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } },
            Event: class Event { constructor(type) { this.type = type; } },
            dispatchEvent: () => true,
            addEventListener: () => {},
            // LocalStorage Mock
            localStorage: {
                _data: {},
                setItem: (k, v) => { context.localStorage._data[k] = String(v); },
                getItem: (k) => context.localStorage._data[k] || null,
                removeItem: (k) => { delete context.localStorage._data[k]; },
                clear: () => { context.localStorage._data = {}; }
            },
            // UI Mocks
            prompt: () => '',
            Image: class { constructor() { setTimeout(() => this.onload && this.onload(), 10); } },
            atob: (str) => Buffer.from(str, 'base64').toString('binary'),
            btoa: (str) => Buffer.from(str, 'binary').toString('base64')
        };

        vm.createContext(context);
        context.window = context;
        context.self = context;

        // 2. Definir helpers globais para o contexto
        context.loadProjectScript = (name) => {
            const filePath = path.join(__dirname, '..', 'js', name);
            if (!fs.existsSync(filePath)) {
                const altPath = path.join(__dirname, name);
                const unitPath = path.join(unitDir, name);
                const finalPath = fs.existsSync(altPath) ? altPath : (fs.existsSync(unitPath) ? unitPath : null);
                
                if (finalPath) {
                    const code = fs.readFileSync(finalPath, 'utf8');
                    vm.runInContext(code, context, { filename: name });
                    return;
                }
                throw new Error(`Script não encontrado: ${name}`);
            }
            const code = fs.readFileSync(filePath, 'utf8');
            vm.runInContext(code, context, { filename: name });
        };

        context.describe = (name, fn) => {
            process.stdout.write(`\n📦 ${name}\n`);
            fn(); 
        };

        context.beforeEach = (fn) => beforeEachHooks.push(fn);
        context.afterEach = (fn) => afterEachHooks.push(fn);
        context.it = (name, fn) => testQueue.push({ name, fn });

        context.expect = (val) => {
            const matchers = (negated = false) => ({
                toBe: (exp) => { 
                    const pass = val === exp;
                    if (negated ? pass : !pass) throw new Error(`Expected ${val} ${negated ? 'not ' : ''}to be ${exp}`); 
                },
                toContain: (exp) => { 
                    const pass = String(val).includes(String(exp));
                    if (negated ? pass : !pass) throw new Error(`Expected ${val} ${negated ? 'not ' : ''}to contain ${exp}`); 
                },
                toBeDefined: () => { 
                    const pass = val !== undefined;
                    if (negated ? pass : !pass) throw new Error(`Expected ${negated ? 'not ' : ''}defined, got ${val}`); 
                },
                toBeGreaterThan: (exp) => { 
                    const pass = val > exp;
                    if (negated ? pass : !pass) throw new Error(`Expected ${val} ${negated ? 'not ' : ''}to be > ${exp}`); 
                },
                toBeNull: () => { 
                    const pass = val === null;
                    if (negated ? pass : !pass) throw new Error(`Expected ${negated ? 'not ' : ''}null, got ${val}`); 
                },
                toBeTruthy: () => { 
                    const pass = !!val;
                    if (negated ? pass : !pass) throw new Error(`Expected ${negated ? 'not ' : ''}truthy, got ${val}`); 
                },
                toBeFalsy: () => { 
                    const pass = !val;
                    if (negated ? pass : !pass) throw new Error(`Expected ${negated ? 'not ' : ''}falsy, got ${val}`); 
                },
                toBeCloseTo: (exp, precision = 2) => {
                    const pass = Math.abs(val - exp) < (Math.pow(10, -precision) / 2);
                    if (negated ? pass : !pass) throw new Error(`Expected ${val} ${negated ? 'not ' : ''}to be close to ${exp} (prec: ${precision})`);
                },
                toThrow: () => {
                    let thrown = false;
                    try { val(); } catch (e) { thrown = true; }
                    if (negated ? thrown : !thrown) throw new Error(`Expected function ${negated ? 'not ' : ''}to throw`);
                }
            });
            const base = matchers(false);
            base.not = matchers(true);
            return base;
        };

        // 3. Carregar Mocks Universais PRIMEIRO
        try {
            const mocksPath = path.join(__dirname, 'mocks.js');
            const mocksCode = fs.readFileSync(mocksPath, 'utf8');
            vm.runInContext(mocksCode, context, { filename: 'mocks.js' });

            // 3.1. Carregar RBush (Motor Espacial) para suporte a Map/Zoning
            const rbushPath = path.join(__dirname, '..', 'js', 'rbush.min.js');
            if (fs.existsSync(rbushPath)) {
                const rbushCode = fs.readFileSync(rbushPath, 'utf8');
                vm.runInContext(rbushCode, context, { filename: 'rbush.min.js' });
            }

            // 4. Carregar o Arquivo de Teste
            const testPath = path.join(unitDir, file);
            const testCode = fs.readFileSync(testPath, 'utf8');
            vm.runInContext(testCode, context, { filename: file });

            // 5. Executar Fila de Testes
            for (const test of testQueue) {
                try {
                    for (const hook of beforeEachHooks) await hook();
                    await test.fn();
                    for (const hook of afterEachHooks) await hook();
                    RESULTS.pass++;
                    process.stdout.write(`  ✅ ${test.name}\n`);
                } catch (e) {
                    RESULTS.fail++;
                    process.stdout.write(`  ❌ ${test.name}: ${e.message}\n`);
                }
            }
        } catch (err) {
            RESULTS.fail++;
            process.stdout.write(`  🔥 Erro Fatal em ${file}: ${err.message}\n`);
            console.error(err);
        }
    }

    process.stdout.write(`\n==============================`);
    process.stdout.write(`\n📊 SUMÁRIO: ✅ ${RESULTS.pass} Passou | ❌ ${RESULTS.fail} Falhou`);
    process.stdout.write(`\n==============================\n`);

    if (RESULTS.fail > 0) process.exit(1);
}

runTests().catch(err => {
    console.error("Runner Fatal Error:", err);
    process.exit(1);
});
