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
    let lat: string | number | null = null;
    let lng: string | number | null = null;
    
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      lat = body.lat;
      lng = body.lng;
    } else {
      const urlParams = new URL(req.url).searchParams;
      lat = urlParams.get('lat');
      lng = urlParams.get('lng');
    }

    if (!lat || !lng) {
      return new Response(JSON.stringify({ error: "Coordenadas ausentes" }), { 
        status: 200, // Return 200 even on logical error to avoid console noise during setup
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const apiKey = Deno.env.get('OPENWEATHER_API_KEY') || 'bae2c60e1d4d76016228188c9855a891';
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=pt_br`;

    console.log(`[Weather] Chamando OpenWeather para: ${lat}, ${lng}`);

    const response = await fetch(weatherUrl);
    const data = await response.json();

    if (!response.ok) {
        console.error("[Weather] OpenWeather Error:", data);
        
        // Se a chave for inválida (401), retornamos uma mensagem amigável no 200
        // para o frontend saber que a chave ainda não propagou no OpenWeather
        if (response.status === 401) {
            return new Response(JSON.stringify({ 
                error: "KEY_NOT_ACTIVE", 
                message: "A chave OpenWeatherMap ainda está sendo ativada. Pode levar até 2 horas.",
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

    const conditionId = data.weather?.[0]?.id;
    let iconCode = 'clear';
    if (conditionId >= 200 && conditionId < 300) iconCode = 'thunderstorm';
    else if (conditionId >= 300 && conditionId < 500) iconCode = 'drizzle';
    else if (conditionId >= 500 && conditionId < 600) iconCode = 'rain';
    else if (conditionId >= 600 && conditionId < 700) iconCode = 'snow';
    else if (conditionId >= 700 && conditionId < 800) iconCode = 'fog';
    else if (conditionId === 800) iconCode = 'clear';
    else if (conditionId === 801) iconCode = 'mostly_clear';
    else if (conditionId === 802) iconCode = 'partly_cloudy';
    else if (conditionId >= 803) iconCode = 'cloudy';

    return new Response(JSON.stringify({
      temperature: data.main?.temp || 0,
      description: data.weather?.[0]?.description || 'Céu Limpo',
      iconCode: iconCode,
      city: data.name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
})
