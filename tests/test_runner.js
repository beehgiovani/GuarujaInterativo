/**
 * 🧪 Guaruja Geo - Simple Test Runner
 * Um executor de testes minimalista para ambiente Node.js/Frontend.
 */

const tests = [];

global.test = (name, fn) => {
    tests.push({ name, fn });
};

global.expect = (value) => ({
    toBe: (expected) => {
        if (value !== expected) {
            throw new Error(`Esperado ${expected}, mas recebeu ${value}`);
        }
    },
    toBeTruthy: () => {
        if (!value) {
            throw new Error(`Esperado valor verdadeiro, mas recebeu ${value}`);
        }
    },
    toBeFalsy: () => {
        if (value) {
            throw new Error(`Esperado valor falso, mas recebeu ${value}`);
        }
    }
});

async function runTests() {
    console.log('\n🚀 Iniciando Testes Unitários...\n');
    let passed = 0;
    let failed = 0;

    for (const { name, fn } of tests) {
        try {
            await fn();
            console.log(` ✅ PASS: ${name}`);
            passed++;
        } catch (error) {
            console.log(` ❌ FAIL: ${name}`);
            console.error(`    -> ${error.message}`);
            failed++;
        }
    }

    console.log(`\n📊 Resumo: ${passed} passaram, ${failed} falharam.\n`);
    process.exit(failed > 0 ? 1 : 0);
}

// Importar os arquivos de teste aqui
require('./utils.test.js');
require('./enrichment.test.js');
require('./infrastructure.test.js');

runTests();
