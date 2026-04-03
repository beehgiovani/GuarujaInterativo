/**
 * SOLAR_HANDLER.JS
 * Calculates solar position and times using SunCalc.
 * Provides widgets for the UI.
 */

window.SolarHandler = (function() {
    
    function getSolarInfo(lat, lng, customHour = null) {
        if (!window.SunCalc) return null;

        const date = new Date();
        if (customHour !== null) {
            date.setHours(customHour);
            date.setMinutes(0);
        }
        
        const times = SunCalc.getTimes(new Date(), lat, lng); // Sunrise/Sunset are always for "today"
        const position = SunCalc.getPosition(date, lat, lng);
        
        let azimuthDeg = position.azimuth * (180 / Math.PI);
        let compassDeg = (azimuthDeg + 180) % 360;
        
        return {
            sunrise: times.sunrise,
            sunset: times.sunset,
            altitude: position.altitude,
            azimuth: compassDeg,
            targetTime: date
        };
    }

    function getSolarWidgetHTML(lat, lng, inscricao) {
        const info = getSolarInfo(lat, lng);
        if (!info) return '';

        const sunriseStr = info.sunrise.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const sunsetStr = info.sunset.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const currentHour = new Date().getHours();

        return `
            <div id="solar-widget-${inscricao}" style="background: linear-gradient(to right, #fff7ed, #ffedd5); padding: 15px; border-radius: 12px; border: 1px solid #fed7aa; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 800; color: #c2410c; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-sun"></i> Simulador Solar 360º
                    </div>
                    <div id="sun-direction-${inscricao}" style="font-size: 11px; color: #ea580c; font-weight: 700; background: white; padding: 2px 8px; border-radius: 20px; border: 1px solid #fed7aa;">Calculando...</div>
                </div>
                
                <div style="margin: 15px 0 10px 0;">
                    <input type="range" min="6" max="19" value="${currentHour}" 
                        style="width: 100%; cursor: pointer; accent-color: #ea580c;"
                        oninput="window.SolarHandler.updateSimulation('${inscricao}', ${lat}, ${lng}, this.value)">
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #9a3412; font-weight: 600;">
                    <div><i class="fas fa-arrow-up"></i> ${sunriseStr}</div>
                    <div id="sun-time-display-${inscricao}" style="font-size: 12px; color: #ea580c; font-weight: 800;">${currentHour}:00</div>
                    <div><i class="fas fa-arrow-down"></i> ${sunsetStr}</div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 9px; color: #c2410c; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px;">
                    <span>Manhã</span>
                    <span>Meio-dia</span>
                    <span>Tarde</span>
                </div>
                
                <script>
                    setTimeout(() => window.SolarHandler.updateSimulation('${inscricao}', ${lat}, ${lng}, ${currentHour}), 100);
                </script>
            </div>
        `;
    }

    function updateSimulation(inscricao, lat, lng, hour) {
        const info = getSolarInfo(lat, lng, parseInt(hour));
        if (!info) return;

        const dirEl = document.getElementById('sun-direction-' + inscricao);
        const timeEl = document.getElementById('sun-time-display-' + inscricao);
        
        if (timeEl) timeEl.innerText = hour + ':00';

        let sunDirection = '';
        if (info.azimuth >= 45 && info.azimuth < 135) sunDirection = '🌞 Face Leste (Manhã)';
        else if (info.azimuth >= 135 && info.azimuth < 225) sunDirection = '☀️ Face Norte (Zênite)';
        else if (info.azimuth >= 225 && info.azimuth < 315) sunDirection = '🌅 Face Oeste (Tarde)';
        else sunDirection = '☁️ Face Sul (Indireto)';

        if (dirEl) dirEl.innerText = sunDirection;
    }

    return {
        getSolarWidgetHTML,
        updateSimulation
    };
})();
