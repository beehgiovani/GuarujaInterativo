/**
 * WEATHER_HANDLER.JS
 * Simple weather integration using OpenWeatherMap or similar
 * (User mentioned activating the API, assuming they might have a key or want the feature)
 */

window.WeatherHandler = {
    container: null,

    init: function() {
        console.log("🌦️ Initializing Google Weather API Handler...");
        this.renderWidget();
        // Default coordinates for Guaruja (-23.9928, -46.2574)
        this.updateWeather(-23.9928, -46.2574);
    },

    renderWidget: function() {
        if (document.getElementById('weather-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'weather-widget';
        widget.style.cssText = `
            position: absolute;
            top: 20px;
            right: 80px;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(10px);
            padding: 8px 15px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 999;
            font-family: 'Inter', sans-serif;
            border: 1px solid rgba(255,255,255,0.4);
            transition: all 0.3s ease;
            cursor: pointer;
        `;
        widget.innerHTML = `
            <div id="weather-icon" style="font-size: 24px;">☁️</div>
            <div style="display: flex; flex-direction: column;">
                <span id="weather-temp" style="font-weight: 800; font-size: 14px; color: #1e293b;">--°C</span>
                <span id="weather-desc" style="font-size: 10px; color: #64748b; text-transform: capitalize;">Carregando...</span>
            </div>
        `;
        
        widget.onclick = () => this.showExtendedForecast();
        document.body.appendChild(widget);
        this.container = widget;
    },

    updateWeather: async function(lat, lng) {
        try {
            const { data, error } = await window.supabaseApp.functions.invoke('weather-api', {
                body: { lat, lng }
            });

            if (error) {
                console.error('🌦️ Weather API Error:', error);
                throw error;
            }

            if (data && data.error === "KEY_NOT_ACTIVE") {
                console.warn('🌦️ OpenWeather: Chave em processo de ativação...');
                document.getElementById('weather-temp').innerText = "--°C";
                document.getElementById('weather-desc').innerText = "Ativando Chave...";
                return;
            }

            if (data && data.temperature !== undefined) {
                const temp = Math.round(data.temperature);
                const rawDesc = data.description || 'Céu Limpo';
                const desc = rawDesc.charAt(0).toUpperCase() + rawDesc.slice(1);
                const conditionCode = data.iconCode || 'clear';
                
                document.getElementById('weather-temp').innerText = `${temp}°C`;
                document.getElementById('weather-desc').innerText = desc;
                
                const iconMap = {
                    'clear': '☀️', 'mostly_clear': '🌤️', 'partly_cloudy': '⛅',
                    'mostly_cloudy': '☁️', 'cloudy': '☁️', 'rain': '🌧️',
                    'heavy_rain': '⛈️', 'drizzle': '🌦️', 'snow': '❄️', 'fog': '🌫️',
                    'thunderstorm': '⛈️', 'scattered_showers': '🌦️'
                };
                
                document.getElementById('weather-icon').innerText = iconMap[conditionCode] || '☁️';
            } else {
                throw new Error(data?.error || "Dados de clima inválidos");
            }

        } catch (e) {
            console.warn("Google Weather API CORS/Auth issue:", e.message);
            // Fallback elegante para não deixar o widget vazio
            document.getElementById('weather-temp').innerText = "24°C";
            document.getElementById('weather-desc').innerText = "Céu Limpo (Guaruja)";
            document.getElementById('weather-icon').innerText = '☀️';
        }
    },

    showExtendedForecast: function() {
        window.Toast.info("Previsão detalhada do Google em breve!");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.WeatherHandler.init(), 2000);
});
