// ============================================================================
// ESTUDIO 15 — send-appointment-sms
// Edge Function de Supabase. Se dispara con un Database Webhook cuando
// una cita (appointments) cambia de estado. Si el nuevo estado es
// 'accepted' o 'rejected', manda un SMS al cliente vía Twilio.
//
// Despliegue:
//   supabase functions deploy send-appointment-sms
//
// Variables de entorno (secrets) requeridas:
//   supabase secrets set TWILIO_ACCOUNT_SID=xxxx
//   supabase secrets set TWILIO_AUTH_TOKEN=xxxx
//   supabase secrets set TWILIO_FROM_NUMBER=+10000000000
//
// Webhook en Supabase Dashboard → Database → Webhooks:
//   Tabla: appointments | Evento: Update | Destino: esta Edge Function
// ============================================================================

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
      return new Response(JSON.stringify({ skipped: "no aplica SMS" }), { status: 200 });
    }

    const phone = record.client_phone;
    if (!phone) {
      return new Response(JSON.stringify({ error: "sin teléfono" }), { status: 200 });
    }

    const fecha = record.appointment_date;
    const hora = record.appointment_time;

    const message =
      record.status === "accepted"
        ? `Estudio 15: tu cita del ${fecha} a las ${hora} fue CONFIRMADA. ¡Te esperamos!`
        : `Estudio 15: tu cita del ${fecha} a las ${hora} fue RECHAZADA. Por favor agenda otro horario.`;

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: phone,
      From: fromNumber ?? "",
      Body: message,
    });

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Error de Twilio:", twilioData);
      return new Response(JSON.stringify({ error: twilioData }), { status: 500 });
    }

    return new Response(JSON.stringify({ sent: true, sid: twilioData.sid }), { status: 200 });
  } catch (err) {
    console.error("Error en send-appointment-sms:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
