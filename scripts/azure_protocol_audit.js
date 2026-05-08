#!/usr/bin/env node
/**
 * Auditoria V6.1 com Azure OpenAI.
 * Sem AZURE_OPENAI_KEY no ambiente, roda em dry-run e imprime o prompt consolidado.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
const apiKey = process.env.AZURE_OPENAI_KEY;

const filesToAudit = [
    'DEVELOPMENT_RULES.md',
    '.agents/workflows/MANIFESTOS_OFICIAIS.md',
    '.agents/workflows/guarugeo-cartografia.md',
    '.agents/workflows/guarugeo-security-ops.md',
    '.agents/workflows/guarugep-anti-entropy.md'
];

const context = filesToAudit
    .map((filePath) => `\n--- ${filePath} ---\n${read(filePath).slice(0, 6000)}`)
    .join('\n');

const prompt = `
Você é o auditor técnico do Guarujá GeoMap.
Avalie aderência ao Protocolo Bruno Giovani V6.1, LGPD, GIS, performance mobile e arquitetura anti-entropia.

Responda em português com:
1. riscos críticos,
2. violações de padrão,
3. correções recomendadas,
4. checklist objetivo para o próximo commit.

Contexto oficial:
${context}
`;

async function run() {
    if (!endpoint || !apiKey) {
        console.log('[dry-run] Configure AZURE_OPENAI_ENDPOINT e AZURE_OPENAI_KEY para chamar o Azure.');
        console.log(prompt.trim());
        return;
    }

    const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey
        },
        body: JSON.stringify({
            messages: [
                { role: 'system', content: 'Você é um auditor sênior de engenharia, segurança e GIS.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.2
        })
    });

    if (!response.ok) {
        throw new Error(`Azure audit failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    console.log(data.choices?.[0]?.message?.content || 'Sem resposta do modelo.');
}

run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
