// ============================================================================
// ESTUDIO 15 — admin-setup-puesto
// El admin le da usuario y contraseña a un puesto (2, 3 o 4) y queda
// listo, sin tocar Supabase ni el SQL Editor. Si ese puesto ya tenía
// alguien asignado, esto actualiza su usuario/contraseña (el número
// de puesto nunca cambia).
//
// Como Supabase Auth necesita un correo para crear la cuenta, se
// genera uno interno automáticamente (el empleado nunca lo ve ni lo
// necesita — inicia sesión con el "usuario" que pongas aquí).
//
// Despliegue:
//   supabase functions deploy admin-setup-puesto
// (no necesita secrets nuevos)
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

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Solo el administrador puede hacer esto." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { puestoNumber, username, password } = await req.json();

    if (!puestoNumber || !username || !password) {
      return new Response(JSON.stringify({ error: "Faltan datos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ¿Ya hay alguien en ese puesto? Si sí, solo le actualizamos
    // usuario/contraseña (el puesto en sí no cambia).
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("puesto_number", puestoNumber)
      .eq("role", "employee")
      .maybeSingle();

    if (existing) {
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
      if (pwError) {
        return new Response(JSON.stringify({ error: pwError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: cedError } = await supabaseAdmin
        .from("profiles")
        .update({ cedula: username })
        .eq("id", existing.id);
      if (cedError) {
        return new Response(JSON.stringify({ error: cedError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, action: "updated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No existe todavía: lo creamos. El correo es interno, nunca lo
    // necesita el empleado (inicia sesión con "username", no con esto).
    const fakeEmail = "puesto" + puestoNumber + "-" + Date.now() + "@estudio15.internal";

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password: password,
      email_confirm: true,
      user_metadata: { cedula: username, puesto_number: puestoNumber },
    });

    if (createError || !created?.user) {
      return new Response(JSON.stringify({ error: createError?.message || "No se pudo crear el puesto." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role: "employee", puesto_number: puestoNumber, commission_percentage: 50, cedula: username })
      .eq("id", created.user.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, action: "created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error en admin-setup-puesto:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});