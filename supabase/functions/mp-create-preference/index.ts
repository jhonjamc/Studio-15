// ============================================================================
// ESTUDIO 15 — mp-create-preference
// Crea una "preferencia de pago" en Mercado Pago y devuelve la URL
// (init_point) a la que hay que mandar al cliente para que pague.
// El Access Token es privado y NUNCA debe estar en el navegador, por
// eso esto vive en una Edge Function.
//
// Despliegue:
//   supabase functions deploy mp-create-preference
//   supabase secrets set MP_ACCESS_TOKEN=TEST-xxxxxxxx (o APP_USR-xxxx en producción)
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // El navegador manda primero una petición OPTIONS (CORS preflight)
  // antes de la real. Si no respondemos esto, la petición de verdad
  // se queda "pending" para siempre y nunca llega a la función.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    var payload;
    try {
      payload = await req.json();
    } catch (parseErr) {
      return new Response(JSON.stringify({ error: "Body vacío o no es JSON válido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { items, externalReference, redirectUrl } = payload;

    if (!items || !items.length || !externalReference) {
      return new Response(JSON.stringify({ error: "Faltan datos (items, externalReference)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
    const notificationUrl = Deno.env.get("MP_NOTIFICATION_URL") ?? undefined;

    const body: Record<string, unknown> = {
      items: items.map((i: { name: string; price: number; qty: number }) => ({
        title: i.name,
        quantity: i.qty,
        unit_price: i.price,
        currency_id: "COP",
      })),
      external_reference: externalReference,
      back_urls: {
        success: redirectUrl,
        failure: redirectUrl,
        pending: redirectUrl,
      },
      auto_return: "approved",
    };

    if (notificationUrl) body.notification_url = notificationUrl;

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Error creando preferencia en Mercado Pago:", mpData);
      return new Response(JSON.stringify({ error: mpData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error en mp-create-preference:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});