/**
 * TEST RUNNER (V1.7.0 - ASYNC ENHANCED)
 * Motor de simulação com suporte a Promises (resolves/rejects).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const results = { pass: 0, fail: 0 };
const testFiles = fs.readdirSync(path.join(__dirname, 'unit')).filter(f => f.endsWith('.test.js'));

async function runTests() {
    process.stdout.write(`\n🚀 Iniciando Suíte de Testes Consolidados...\n`);

    for (const file of testFiles) {
        const testQueue = [];
        const context = {
            window: {},
            console: console,
            setTimeout: setTimeout,
            clearTimeout: clearTimeout,
            setInterval: setInterval,
            clearInterval: clearInterval,
            process: process,
            __dirname: __dirname,
            require: require,
            fs: fs,
            path: path,
            Promise: Promise,
            Error: Error,
            TypeError: TypeError,
            ReferenceError: ReferenceError,
            URL: URL,
            navigator: { userAgent: 'NodeTestRunner' },
            CustomEvent: class CustomEvent { constructor(type, detail) { this.type = type; this.detail = detail; } },
            Event: class Event { constructor(type) { this.type = type; } },
            dispatchEvent: () => true,
            addEventListener: () => {}
        };
        vm.createContext(context);
        context.window = context;
        context.global = context;
        context.self = context;

        context.loadProjectScript = (fileName) => {
            const filePath = path.join(__dirname, '..', 'js', fileName);
            if (!fs.existsSync(filePath)) throw new Error(`Script not found: ${filePath}`);
            const code = fs.readFileSync(filePath, 'utf8');
            vm.runInContext(code, context, { filename: fileName });
        };

        context.describe = (name, fn) => {
            process.stdout.write(`\n📦 ${name}\n`);
            fn(); 
        };

        context.beforeEach = (fn) => { context._beforeEach = fn; };

        context.it = (name, fn) => {
            testQueue.push({ name, fn });
        };

        context.expect = (val) => {
            const matchers = {
                toBe: (exp) => { if (val !== exp) throw new Error(`Expected ${exp}, got ${val}`); },
                toBeCloseTo: (exp, precision = 2) => {
                    const diff = Math.abs(val - exp);
                    if (diff > Math.pow(10, -precision) / 2) throw new Error(`Expected ${val} to be close to ${exp}`);
                },
                toContain: (exp) => { if (!val || !val.toString().includes(exp)) throw new Error(`Expected ${val} to contain ${exp}`); },
                toBeFalsy: () => { if (val) throw new Error(`Expected falsy, got ${val}`); },
                toBeTruthy: () => { if (!val) throw new Error(`Expected truthy, got ${val}`); },
                resolves: {
                    toBe: async (exp) => {
                        const resolved = await val;
                        if (resolved !== exp) throw new Error(`Expected resolved ${exp}, got ${resolved}`);
                    },
                    toBeTruthy: async () => {
                        const resolved = await val;
                        if (!resolved) throw new Error(`Expected resolved truthy, got ${resolved}`);
                    }
                }
            };
            return matchers;
        };

        const mocksCode = fs.readFileSync(path.join(__dirname, 'mocks.js'), 'utf8');
        vm.runInContext(mocksCode, context, { filename: 'mocks.js' });

        // Carregar Camada de Configuração (CONFIÁVEL/BLINDADA)
        const configPath = path.join(__dirname, '..', 'js', 'config.js');
        if (fs.existsSync(configPath)) {
            const configCode = fs.readFileSync(configPath, 'utf8');
            vm.runInContext(configCode, context, { filename: 'config.js' });
        } else {
            // Fallback para o Sample se o real não existir (Útil para CI/CD)
            const samplePath = path.join(__dirname, '..', 'js', 'config.sample.js');
            const sampleCode = fs.readFileSync(samplePath, 'utf8');
            vm.runInContext(sampleCode, context, { filename: 'config.sample.js' });
        }

        const testCode = fs.readFileSync(path.join(__dirname, 'unit', file), 'utf8');
        try {
            vm.runInContext(testCode, context, { filename: file });
            
            for (const test of testQueue) {
                try {
                    if (typeof context._beforeEach === 'function') await context._beforeEach();
                    await test.fn();
                    results.pass++;
                    process.stdout.write(`  ✅ ${test.name}\n`);
                } catch (e) {
                    process.stdout.write(`  ❌ ${test.name}: ${e.message}\n`);
                    results.fail++;
                }
            }
        } catch (e) {
            process.stdout.write(`\n💥 Fatal Error in ${file}: ${e.message}\n`);
        }
    }

    process.stdout.write(`\n==============================\n📊 SUMÁRIO: ✅ ${results.pass} Passou | ❌ ${results.fail} Falhou\n==============================\n`);
    if (results.fail > 0) process.exit(1);
    else process.exit(0);
}

runTests().catch(e => {
    console.error("Test runner crashed:", e);
    process.exit(1);
});
