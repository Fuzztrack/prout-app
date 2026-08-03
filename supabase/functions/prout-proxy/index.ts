import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // 1. Extraire le jeton JWT depuis le header Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // 2. Initialiser Supabase Auth Client pour vérifier le jeton
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 3. Vérifier le jeton auprès de Supabase Auth
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired user session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Déterminer la route cible sur le backend NestJS
    const url = new URL(req.url);
    const route = url.pathname.replace('/prout-proxy', ''); 
    const targetUrl = `${PROUT_BACKEND_URL}${route}`;

    const BACKEND_API_KEY = Deno.env.get("BACKEND_API_KEY");
    if (!BACKEND_API_KEY) {
      throw new Error("Missing BACKEND_API_KEY environment variable");
    }

    // 5. Forcer le senderId / userId certifié de l'utilisateur authentifié
    const bodyText = await req.text();
    let updatedBody = bodyText;

    if (bodyText && req.method === "POST") {
      try {
        const bodyJson = JSON.parse(bodyText);
        if (bodyJson.senderId) {
          bodyJson.senderId = user.id;
        }
        if (bodyJson.extraData && bodyJson.extraData.senderId) {
          bodyJson.extraData.senderId = user.id;
        }
        if (bodyJson.userId) {
          bodyJson.userId = user.id;
        }
        updatedBody = JSON.stringify(bodyJson);
      } catch (_e) {
        // Garder le body tel quel si non-JSON
      }
    }

    // 6. Transmettre au backend NestJS avec l'identité certifiée
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": BACKEND_API_KEY,
      },
      body: updatedBody,
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
