// ============================================================================
// ESTUDIO 15 — admin-create-employee
// Crea el usuario de Auth de un nuevo empleado y lo deja con role='employee'.
// Solo el administrador puede llamar esto (se verifica el rol del que llama
// dentro de la función, con permisos de servidor).
//
// Despliegue:
//   supabase functions deploy admin-create-employee
// (no necesita secrets nuevos, Supabase ya pone SUPABASE_URL,
//  SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY automáticamente)
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
    // 1) Confirmar quién está llamando (su token llega solo automáticamente
    //    porque el frontend usa supabaseClient.functions.invoke).
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAsCaller = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: callerData } = await supabaseAsCaller.auth.getUser();
    if (!callerData?.user) {
      return new Response(JSON.stringify({ error: "No autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 2) Confirmar que quien llama de verdad es admin
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Solo el administrador puede crear empleados." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Crear el usuario de empleado
    const { fullName, cedula, phone, email, password, commissionPercentage } = await req.json();

    if (!fullName || !cedula || !email || !password) {
      return new Response(JSON.stringify({ error: "Faltan datos obligatorios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone, cedula: cedula },
    });

    if (createError || !created?.user) {
      return new Response(JSON.stringify({ error: createError?.message || "No se pudo crear el usuario." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // El trigger handle_new_user ya creó su profile con role='client';
    // lo promovemos a empleado con su comisión.
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role: "employee", commission_percentage: commissionPercentage ?? 50 })
      .eq("id", created.user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error en admin-create-employee:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});