// ============================================================================
// ESTUDIO 15 — admin-setup-puesto
// El admin le da usuario y contraseña a:
//   - un puesto de barbero (2, 3 o 4), o
//   - el encargado de bebidas (sin acceso a nada más, no puede borrar ventas)
// Todo sin tocar Supabase ni el SQL Editor. Si ya existía, esto solo
// actualiza usuario/contraseña.
//
// Como Supabase Auth necesita un correo para crear la cuenta, se genera
// uno interno automáticamente (la persona nunca lo ve ni lo necesita —
// inicia sesión con el "usuario" que pongas aquí).
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

    // targetRole: "employee" (puesto de barbero, requiere puestoNumber)
    //          o "drinks_admin" (encargado de bebidas, sin puestoNumber)
    const { targetRole, puestoNumber, username, password } = await req.json();
    const role = targetRole === "drinks_admin" ? "drinks_admin" : "employee";

    if (!username || !password || (role === "employee" && !puestoNumber)) {
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

    // ¿Ya existe esa cuenta? (un puesto por número, o el encargado de
    // bebidas por su usuario). Si sí, solo actualizamos su contraseña.
    var existingQuery = supabaseAdmin.from("profiles").select("id").eq("role", role);
    existingQuery = role === "employee"
      ? existingQuery.eq("puesto_number", puestoNumber)
      : existingQuery.eq("cedula", username);
    const { data: existing } = await existingQuery.maybeSingle();

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
    // necesita la persona (inicia sesión con "username", no con esto).
    const fakeEmail = role + "-" + Date.now() + "@estudio15.internal";

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password: password,
      email_confirm: true,
      user_metadata: { cedula: username, puesto_number: role === "employee" ? puestoNumber : null },
    });

    if (createError || !created?.user) {
      return new Response(JSON.stringify({ error: createError?.message || "No se pudo crear la cuenta." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = { role: role, cedula: username };
    if (role === "employee") {
      updates.puesto_number = puestoNumber;
      updates.commission_percentage = 50;
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updates)
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