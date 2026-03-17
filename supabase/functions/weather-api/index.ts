import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let type = 'current';
    let lat: string | number | null = null;
    let lng: string | number | null = null;
    
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      lat = body.lat;
      lng = body.lng;
      type = body.type || 'current';
    } else {
      const urlParams = new URL(req.url).searchParams;
      lat = urlParams.get('lat');
      lng = urlParams.get('lng');
      type = urlParams.get('type') || 'current';
    }

    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: "Coordenadas ausentes" }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const apiKey = Deno.env.get('OPENWEATHER_API_KEY') || 'bae2c60e1d4d76016228188c9855a891';
    const endpoint = type === 'forecast' ? 'forecast' : 'weather';
    const weatherUrl = `https://api.openweathermap.org/data/2.5/${endpoint}?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=pt_br`;

    console.log(`[Weather] Chamando OpenWeather (${type}) para: ${lat}, ${lng}`);

    const response = await fetch(weatherUrl);
    const data = await response.json();

    if (!response.ok) {
        console.error(`[Weather] OpenWeather Error (${type}):`, data);
        
        if (response.status === 401) {
            return new Response(JSON.stringify({ 
                error: "KEY_NOT_ACTIVE", 
                message: "A chave OpenWeatherMap ainda está sendo ativada.",
                temp_fallback: 24
            }), {
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: "EXTERNAL_API_ERROR", details: data }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Processar Resultado
    if (type === 'forecast') {
        // Retornar um resumo simplificado para o frontend economizar processamento
        const forecast = data.list.filter((_: any, i: number) => i % 8 === 0).map((item: any) => {
            const date = new Date(item.dt * 1000);
            return {
                dt: item.dt,
                weekday: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
                date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                temp: Math.round(item.main.temp),
                temp_min: Math.round(item.main.temp_min),
                temp_max: Math.round(item.main.temp_max),
                description: item.weather[0].description,
                iconCode: getIconCode(item.weather[0].id)
            };
        });

        return new Response(JSON.stringify({ forecast, city: data.city.name }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    } else {
        return new Response(JSON.stringify({
          temperature: data.main?.temp || 0,
          description: data.weather?.[0]?.description || 'Céu Limpo',
          iconCode: getIconCode(data.weather?.[0]?.id),
          city: data.name
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});

function getIconCode(conditionId: number): string {
    if (conditionId >= 200 && conditionId < 300) return 'thunderstorm';
    if (conditionId >= 300 && conditionId < 500) return 'drizzle';
    if (conditionId >= 500 && conditionId < 600) return 'rain';
    if (conditionId >= 600 && conditionId < 700) return 'snow';
    if (conditionId >= 700 && conditionId < 800) return 'fog';
    if (conditionId === 800) return 'clear';
    if (conditionId === 801) return 'mostly_clear';
    if (conditionId === 802) return 'partly_cloudy';
    if (conditionId >= 803) return 'cloudy';
    return 'clear';
}
