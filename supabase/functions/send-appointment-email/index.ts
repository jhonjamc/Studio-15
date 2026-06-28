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
    const isAccepted = record.status === "accepted";

    const subject = isAccepted
      ? "✂️ Tu cita en Estudio 15 fue confirmada"
      : "Tu cita en Estudio 15 fue rechazada";

    var badgeColor = isAccepted ? "#2ecc71" : "#d4282c";
    var badgeText = isAccepted ? "CONFIRMADA" : "RECHAZADA";
    var message = isAccepted
      ? "Tu cita quedó <strong>confirmada</strong>. ¡Te esperamos!"
      : "Lamentablemente tu cita fue <strong>rechazada</strong>. Por favor agenda otro horario cuando quieras.";

    var html =
      '<div style="background:#0a0a0f; padding:32px 16px; font-family:Arial,Helvetica,sans-serif;">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto; background:#171923; border-radius:16px; overflow:hidden; border:1px solid #222533;">' +

          // Franja roja/blanca/azul (estilo poste de barbería)
          '<tr><td style="height:6px; background-image:linear-gradient(90deg, #d4282c 0%, #d4282c 33%, #ffffff 33%, #ffffff 66%, #1c4dd4 66%, #1c4dd4 100%);"></td></tr>' +

          // Logo / encabezado
          '<tr><td style="padding:28px 28px 8px; text-align:center;">' +
            '<div style="font-size:22px; font-weight:800; letter-spacing:1px; color:#f3ede3;">' +
              'BARBER&Iacute;A <span style="color:#d4282c;">ESTUDIO 15</span>' +
            '</div>' +
          '</td></tr>' +

          // Badge de estado
          '<tr><td style="padding:8px 28px 0; text-align:center;">' +
            '<span style="display:inline-block; background:' + badgeColor + '22; color:' + badgeColor + '; font-size:12px; font-weight:800; letter-spacing:1px; padding:6px 16px; border-radius:999px;">' + badgeText + '</span>' +
          '</td></tr>' +

          // Mensaje
          '<tr><td style="padding:20px 28px 4px; color:#f3ede3; font-size:15px; line-height:1.6;">' +
            'Hola ' + nombre + ',<br><br>' + message +
          '</td></tr>' +

          // Tarjeta con los datos de la cita
          '<tr><td style="padding:20px 28px;">' +
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f; border:1px solid #222533; border-radius:12px;">' +
              '<tr><td style="padding:16px 20px; color:#9a9aa5; font-size:12px; text-transform:uppercase; letter-spacing:1px;">Fecha</td>' +
              '<td style="padding:16px 20px; color:#f3ede3; font-size:14px; font-weight:700; text-align:right;">' + fecha + '</td></tr>' +
              '<tr><td style="padding:0 20px 16px; color:#9a9aa5; font-size:12px; text-transform:uppercase; letter-spacing:1px;">Hora</td>' +
              '<td style="padding:0 20px 16px; color:#f3ede3; font-size:14px; font-weight:700; text-align:right;">' + hora + '</td></tr>' +
            '</table>' +
          '</td></tr>' +

          // Footer
          '<tr><td style="padding:8px 28px 28px; text-align:center; color:#756b5d; font-size:12px;">' +
            '© 2026 Estudio 15 &middot; Barber&iacute;a' +
          '</td></tr>' +

        '</table>' +
      '</div>';

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