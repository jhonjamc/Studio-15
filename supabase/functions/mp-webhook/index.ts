// ============================================================================
// ESTUDIO 15 — mp-webhook
// Mercado Pago llama a esta función cuando un pago cambia de estado.
// 1) Validamos que el aviso sea REALMENTE de Mercado Pago (firma HMAC).
// 2) Consultamos el pago real en su API (nunca confiamos en el body a ciegas).
// 3) Actualizamos la compra correspondiente en `purchases`.
// Esta es la única fuente de verdad sobre si se pagó o no.
//
// Despliegue (con --no-verify-jwt porque Mercado Pago no manda nuestro token):
//   supabase functions deploy mp-webhook --no-verify-jwt
//   supabase secrets set MP_WEBHOOK_SECRET=xxxxxxxx
//   supabase secrets set MP_ACCESS_TOKEN=TEST-xxxxxxxx
//
// Luego pega la URL de esta función en:
//   Mercado Pago → Tus integraciones → tu app → Webhooks → Configurar notificaciones
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    const dataId = url.searchParams.get("data.id") || body?.data?.id;
    const xSignature = req.headers.get("x-signature") ?? "";
    const xRequestId = req.headers.get("x-request-id") ?? "";

    if (!dataId) {
      return new Response(JSON.stringify({ skipped: "sin data.id" }), { status: 200 });
    }

    // ---- 1) Validar la firma (manifest oficial de Mercado Pago) ----
    var sigParts: Record<string, string> = {};
    xSignature.split(",").forEach((part) => {
      var [k, v] = part.split("=");
      if (k && v) sigParts[k.trim()] = v.trim();
    });

    var secret = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";
    var manifest = `id:${dataId};request-id:${xRequestId};ts:${sigParts.ts};`;
    var computed = await hmacSha256Hex(secret, manifest);

    if (computed !== sigParts.v1) {
      console.error("Firma inválida: este webhook NO viene de Mercado Pago (o el secreto está mal configurado).");
      return new Response(JSON.stringify({ error: "firma inválida" }), { status: 400 });
    }

    // ---- 2) Consultar el pago real en la API (nunca confiar solo en el body) ----
    var accessToken = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
    var paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    var payment = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error("Error consultando el pago en Mercado Pago:", payment);
      return new Response(JSON.stringify({ error: payment }), { status: 200 });
    }

    var reference = payment.external_reference;
    if (!reference) {
      return new Response(JSON.stringify({ skipped: "sin external_reference" }), { status: 200 });
    }

    var newStatus =
      payment.status === "approved" ? "approved" :
      payment.status === "rejected" || payment.status === "cancelled" ? "declined" :
      "pending";

    // ---- 3) Actualizar la compra (con service_role, que sí puede saltarse RLS) ----
    var supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    var { error } = await supabaseAdmin
      .from("purchases")
      .update({ status: newStatus, payment_provider_id: String(payment.id) })
      .eq("payment_reference", reference);

    if (error) {
      console.error("Error actualizando la compra:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), { status: 200 });
  } catch (err) {
    console.error("Error en mp-webhook:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});