// ============================================================================
// ESTUDIO 15 — send-appointment-email
// Alternativa 100% gratis al SMS: cuando una cita se acepta o rechaza,
// le manda un correo al cliente (no un SMS). Usa Resend (resend.com),
// que tiene un plan gratis de 3,000 correos/mes y no exige tener un
// dominio propio (se puede mandar desde "onboarding@resend.dev").
//
// Se dispara igual que la de SMS: con un Database Webhook en la tabla
// appointments, evento Update.
//
// Despliegue:
//   supabase functions deploy send-appointment-email --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();

    // Supabase Database Webhooks envían: { type, table, record, old_record }
    const record = payload.record;
    const oldRecord = payload.old_record;

    if (!record || !oldRecord) {
      return new Response(JSON.stringify({ skipped: "sin record" }), { status: 200 });
    }

    const statusChanged = record.status !== oldRecord.status;
    const isRelevantStatus = record.status === "accepted" || record.status === "rejected";

    if (!statusChanged || !isRelevantStatus) {
      return new Response(JSON.stringify({ skipped: "no aplica correo" }), { status: 200 });
    }

    if (!record.client_id) {
      return new Response(JSON.stringify({ skipped: "sin cliente" }), { status: 200 });
    }

    // El correo del cliente vive en auth.users, no en profiles — hace
    // falta el service_role para leerlo (esto SOLO corre en el servidor).
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(record.client_id);
    if (userError || !userData?.user?.email) {
      return new Response(JSON.stringify({ skipped: "sin correo del cliente" }), { status: 200 });
    }

    const fecha = record.appointment_date;
    const hora = record.appointment_time;
    const nombre = record.client_name || "Hola";

    const subject = record.status === "accepted"
      ? "Tu cita en Estudio 15 fue confirmada"
      : "Tu cita en Estudio 15 fue rechazada";

    const html = record.status === "accepted"
      ? "<p>Hola " + nombre + ",</p><p>Tu cita del <strong>" + fecha + "</strong> a las <strong>" + hora + "</strong> en Estudio 15 fue <strong>confirmada</strong>. ¡Te esperamos!</p>"
      : "<p>Hola " + nombre + ",</p><p>Lamentablemente tu cita del <strong>" + fecha + "</strong> a las <strong>" + hora + "</strong> en Estudio 15 fue <strong>rechazada</strong>. Por favor agenda otro horario cuando quieras.</p>";

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + (Deno.env.get("RESEND_API_KEY") ?? ""),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Estudio 15 <onboarding@resend.dev>",
        to: userData.user.email,
        subject: subject,
        html: html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Error de Resend:", resendData);
      return new Response(JSON.stringify({ error: resendData }), { status: 500 });
    }

    return new Response(JSON.stringify({ sent: true, id: resendData.id }), { status: 200 });
  } catch (err) {
    console.error("Error en send-appointment-email:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});