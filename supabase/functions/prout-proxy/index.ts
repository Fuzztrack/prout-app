import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PROUT_BACKEND_URL = "https://prout-backend.onrender.com/prout";

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Vérifier l'authentification Supabase via le header Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Extraire le path pour le router correctement (/prout, /prout/read, /prout/pendingSent...)
    const url = new URL(req.url);
    // Remove the function name part from the pathname
    const route = url.pathname.replace('/prout-proxy', ''); 
    const targetUrl = `${PROUT_BACKEND_URL}${route}`;

    // 3. Récupérer la clé d'API backend protégée depuis les secrets de l'Edge Function
    const BACKEND_API_KEY = Deno.env.get("BACKEND_API_KEY");
    if (!BACKEND_API_KEY) {
      throw new Error("Missing BACKEND_API_KEY environment variable");
    }

    // 4. Lire le body de la requête initiale
    const bodyText = await req.text();

    // 5. Relayer la requête au backend NestJS
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": BACKEND_API_KEY, // Injectée de façon sécurisée !
      },
      body: bodyText,
    });

    const responseData = await response.text();

    return new Response(responseData, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
