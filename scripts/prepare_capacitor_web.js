const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'www');

const entries = [
    'index.html',
    'mapa.html',
    'portal.html',
    'portal_login.html',
    'privacidade.html',
    'termos_uso.html',
    'manifest.json',
    'sw.js',
    'css',
    'js',
    'assets'
];

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);

    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        for (const child of fs.readdirSync(src)) {
            copyRecursive(path.join(src, child), path.join(dest, child));
        }
        return;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const entry of entries) {
    const src = path.join(root, entry);
    if (!fs.existsSync(src)) {
        console.warn(`[Capacitor] Ignorando ausente: ${entry}`);
        continue;
    }
    copyRecursive(src, path.join(outDir, entry));
}

console.log(`[Capacitor] Bundle web preparado em ${path.relative(root, outDir)}`);
