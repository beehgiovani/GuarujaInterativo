const fs = require('fs');
const path = require('path');

const MERGED_FILE = 'mapa_interativo/lotes_merged.json';
const NEW_DATA_FILE = 'saida_imoveis.json';

// Use a stream-based approach or huge max string length if needed, 
// but 60MB is fine for readFileSync in Node.js (default limit is ~512MB for string or 2GB for buffer)

try {
    console.log(`Reading ${MERGED_FILE}...`);
    const mergedRaw = fs.readFileSync(MERGED_FILE, 'utf8');
    const lotesMerged = JSON.parse(mergedRaw);
    console.log(`Loaded ${lotesMerged.length} lots from lotes_merged.json`);

    console.log(`Reading ${NEW_DATA_FILE}...`);
    const newRaw = fs.readFileSync(NEW_DATA_FILE, 'utf8');
    const newUnits = JSON.parse(newRaw);
    console.log(`Loaded ${newUnits.length} units from saida_imoveis.json`);

    // Index lots by 8-digit inscription for O(1) lookup
    const lotMap = new Map();
    lotesMerged.forEach(lot => {
        if (lot.inscricao) {
            lotMap.set(lot.inscricao, lot);
        }
    });

    let addedCount = 0;
    let skippedNoLotCount = 0;
    let skippedDuplicateCount = 0;

    newUnits.forEach(unit => {
        if (!unit.inscricao || unit.inscricao.length < 8) {
            return; // Invalid
        }

        const lotId = unit.inscricao.substring(0, 8);
        const targetLot = lotMap.get(lotId);

        if (targetLot) {
            // Initialize units array if missing
            if (!targetLot.unidades) {
                targetLot.unidades = [];
            }

            // Check for duplicates
            const exists = targetLot.unidades.some(u => u.inscricao === unit.inscricao);

            if (!exists) {
                targetLot.unidades.push(unit);
                addedCount++;
            } else {
                skippedDuplicateCount++;
            }
        } else {
            // Lot does not exist in the map geometry file
            // We cannot add it because we don't have coordinates
            skippedNoLotCount++;
        }
    });

    console.log('Merge complete.');
    console.log(`Added: ${addedCount} new units`);
    console.log(`Skipped (Duplicate): ${skippedDuplicateCount}`);
    console.log(`Skipped (No Matching Lot Geometry): ${skippedNoLotCount}`);

    console.log(`Writing updated data to ${MERGED_FILE}...`);
    fs.writeFileSync(MERGED_FILE, JSON.stringify(lotesMerged, null, 2), 'utf8');
    console.log('File saved successfully.');

} catch (err) {
    console.error('Error during merge:', err);
}
.gitignore
