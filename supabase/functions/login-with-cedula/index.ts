// ============================================================================
// ESTUDIO 15 — login-with-cedula
// Permite iniciar sesión con número de cédula en vez de correo.
// Supabase Auth solo entiende correo/contraseña, así que aquí:
//   1) Buscamos a qué usuario pertenece esa cédula (con service_role,
//      esto NUNCA se hace desde el navegador para no exponer correos).
//   2) Intentamos el login real contra Supabase con ese correo.
//   3) Si la contraseña es correcta, devolvemos los tokens de sesión
//      (access_token / refresh_token) — el navegador nunca ve el correo.
//
// Despliegue:
//   supabase functions deploy login-with-cedula
// (no necesita secrets nuevos: SUPABASE_URL, SUPABASE_ANON_KEY y
//  SUPABASE_SERVICE_ROLE_KEY ya los pone Supabase automáticamente)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { cedula, password } = await req.json();

    if (!cedula || !password) {
      return new Response(JSON.stringify({ error: "Faltan datos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1) ¿Qué usuario tiene esta cédula?
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("cedula", cedula)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Cédula o contraseña incorrectos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Su correo real (solo accesible con permisos de administrador)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (userError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: "Cédula o contraseña incorrectos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Probar el login real contra Supabase Auth con ese correo
    const tokenRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify({ email: userData.user.email, password }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return new Response(JSON.stringify({ error: "Cédula o contraseña incorrectos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error en login-with-cedula:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});