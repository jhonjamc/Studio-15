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

Deno.serve(async (req) => {
  try {
    const { items, externalReference, redirectUrl } = await req.json();

    if (!items || !items.length || !externalReference) {
      return new Response(JSON.stringify({ error: "Faltan datos (items, externalReference)" }), { status: 400 });
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
      return new Response(JSON.stringify({ error: mpData }), { status: 500 });
    }

    return new Response(
      JSON.stringify({
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error en mp-create-preference:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});