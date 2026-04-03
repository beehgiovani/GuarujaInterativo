/**
 * GOOGLE_EARTH_HANDLER.JS
 * Universal KML Engine for Guarugeo
 */

window.GoogleEarthHandler = {
    /**
     * Gera e dispara o download de um arquivo KML
     */
    downloadKML: function (filename, kmlContent) {
        const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Exporta um lote único para KML
     */
    exportLotToKML: function (lote) {
        if (!lote || !lote.minx) {
            window.Toast.error("Dados do lote insuficientes para exportação.");
            return;
        }

        const centerX = (parseFloat(lote.minx) + parseFloat(lote.maxx)) / 2;
        const centerY = (parseFloat(lote.miny) + parseFloat(lote.maxy)) / 2;
        const coords = window.utmToLatLon(centerX, centerY);

        const name = lote.building_name || `Lote ${lote.inscricao}`;
        const description = `
            Inscrição: ${lote.inscricao}
            Bairro: ${lote.bairro || '-'}
            Zona: ${lote.zona || '-'}
            Setor: ${lote.setor || '-'}
            Quadra: ${lote.quadra || '-'}
        `.trim();

        const kml = this.generateSimpleKML(name, description, coords.lat, coords.lng);
        this.downloadKML(`Guarugeo_Lote_${lote.inscricao}.kml`, kml);
        window.Toast.success("KML do lote gerado com sucesso!");
    },

    /**
     * Exporta TODOS os lotes visíveis/carregados para KML
     */
    exportAllToKML: function () {
        if (!window.allLotes || window.allLotes.length === 0) {
            window.Toast.warning("Nenhum dado carregado para exportar.");
            return;
        }

        window.Loading.show("Gerando KML...", `Processando ${window.allLotes.length} lotes`);

        let placemarks = "";
        window.allLotes.forEach(lote => {
            const b = lote.bounds_utm || lote.bounds;
            if (!b || !b.minx) return;

            const cx = (parseFloat(b.minx) + parseFloat(b.maxx)) / 2;
            const cy = (parseFloat(b.miny) + parseFloat(b.maxy)) / 2;
            const ll = window.utmToLatLon(cx, cy);

            const label = lote.building_name || lote.inscricao;
            placemarks += `
    <Placemark>
        <name>${label}</name>
        <description>Inscrição: ${lote.inscricao}</description>
        <Point>
            <coordinates>${ll.lng},${ll.lat},0</coordinates>
        </Point>
    </Placemark>`;
        });

        const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Guarugeo - Todos os Lotes</name>
    ${placemarks}
  </Document>
</kml>`;

        this.downloadKML("Guarugeo_Base_Completa.kml", kml);
        window.Loading.hide();
        window.Toast.success("Base completa exportada para KML!");
    },

    /**
     * Helper para gerar KML de ponto único
     */
    generateSimpleKML: function (name, description, lat, lng) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>${name}</name>
    <description>${description}</description>
    <Point>
      <coordinates>${lng},${lat},0</coordinates>
    </Point>
  </Placemark>
</kml>`;
    },

    /**
     * Abre o Google Earth Web centralizado nas coordenadas
     */
    openInGoogleEarth: function (lat, lng) {
        const url = `https://earth.google.com/web/search/${lat},${lng}`;
        window.open(url, '_blank');
    }
};

console.log("✅ Google Earth Handler loaded");
