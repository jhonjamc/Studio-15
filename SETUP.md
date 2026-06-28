# ESTUDIO 15 — Guía de instalación (Supabase + SMS)

## 1. Base de datos
Supabase Dashboard → **SQL Editor** → New query → pega todo `supabase/schema.sql` → Run.

Crea: `profiles`, `services`, `appointments`, `purchases`, la vista `appointment_earnings`,
los triggers (perfil automático al registrarse, contador de fidelidad) y las políticas RLS.

## 2. Credenciales del frontend
Dashboard → **Project Settings → API**. Copia `Project URL` y `anon public key`,
pégalas en `supabase-client.js`:

```js
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU-ANON-KEY-AQUI";
```

## 3. Crear tu usuario administrador
1. Dashboard → **Authentication → Add user** → crea tu usuario (email + password).
2. Copia su **UUID** (columna `UID` en la tabla de usuarios).
3. SQL Editor → ejecuta (cambia el UUID y el %):

```sql
update public.profiles
set role = 'admin', full_name = 'Tu Nombre', commission_percentage = 60
where id = 'PEGA-AQUI-EL-UUID';
```

Para agregar empleados después, no necesitas SQL: usa el formulario
**"Vincular empleado"** dentro de `admin.html` (solo pide el UUID que copiaste
del paso 1, aplicado a cada empleado).

## 4. SMS con Twilio
1. Crea cuenta en https://www.twilio.com, compra/activa un número.
2. Instala la CLI de Supabase si no la tienes: `npm install -g supabase`
3. Despliega la función:
   ```
   supabase login
   supabase link --project-ref TU-PROJECT-REF
   supabase functions deploy send-appointment-sms
   ```
4. Configura los secrets:
   ```
   supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx
   supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxx
   supabase secrets set TWILIO_FROM_NUMBER=+10000000000
   ```
5. Dashboard → **Database → Webhooks → Create a new hook**
   - Table: `appointments`
   - Events: `Update`
   - Type: `Supabase Edge Functions`
   - Function: `send-appointment-sms`

Listo: cuando aceptes o rechaces una cita (desde `admin.html` o `empleado.html`),
el webhook dispara la función y el cliente recibe el SMS al número que escribió
al agendar.

## 5. Pagos online con Mercado Pago (compra de productos)
1. Crea tu cuenta **personal** (no necesitas RUT) en https://www.mercadopago.com.co
2. Dashboard → **Tus integraciones → Crear aplicación**. Dale un nombre
   cualquiera (ej. "Estudio 15") y elige "Pagos online" como producto.
3. Dentro de tu aplicación → **Credenciales de producción** (o de prueba
   mientras testeas): copia el **Access Token**. Empieza con `TEST-` en modo
   prueba o `APP_USR-` en producción.
4. Despliega las dos Edge Functions:
   ```
   supabase functions deploy mp-create-preference
   supabase functions deploy mp-webhook --no-verify-jwt
   ```
   (la de `mp-webhook` necesita `--no-verify-jwt` porque Mercado Pago la
   llama directamente, sin tu token de Supabase).
5. Configura el secret del Access Token (sirve para ambas funciones):
   ```
   supabase secrets set MP_ACCESS_TOKEN=TEST-xxxxxxxx
   ```
6. Copia la URL pública de la función `mp-webhook` (Supabase Dashboard →
   Edge Functions → mp-webhook → te muestra la URL) y:
   - Pégala como secret, para que las preferencias avisen ahí automáticamente:
     ```
     supabase secrets set MP_NOTIFICATION_URL=https://tu-proyecto.functions.supabase.co/mp-webhook
     ```
   - Además, pégala en Mercado Pago → tu aplicación → **Webhooks →
     Configurar notificaciones** → modo productivo → selecciona el evento
     **Pagos** → Guardar. Eso te revela un **secreto** (clic en el ícono
     del ojo) — cópialo y:
     ```
     supabase secrets set MP_WEBHOOK_SECRET=xxxxxxxx
     ```

Cómo funciona: al darle "Finalizar compra", se guarda la compra como
`pending`, se crea una preferencia de pago, y el cliente es enviado a la
página de Mercado Pago a pagar (tarjeta, PSE, Nequi, efectivo). Cuando
termina, vuelve a tu sitio. El estado real y definitivo SOLO lo confirma
el webhook (servidor a servidor, no se puede falsificar desde el navegador)
y solo entonces la compra pasa a `approved`. Las ganancias del admin por
productos solo cuentan las compras `approved`.

⚠️ Mientras uses el Access Token `TEST-`, los pagos son de prueba (con
tarjetas de prueba de Mercado Pago, no se cobra plata real). Cuando quieras
cobrar de verdad, activa tus credenciales de producción y cambia el secret
`MP_ACCESS_TOKEN` por el que empieza con `APP_USR-`.

A diferencia de Wompi, aquí **no necesitas ninguna llave pública en el
navegador** — todo el trabajo de pago pasa por las Edge Functions.

## 6. Login con cédula + eliminar usuarios
Estas funciones no necesitan secrets nuevos (usan las que Supabase ya
pone automáticamente: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).

```
supabase functions deploy login-with-cedula
supabase functions deploy admin-delete-user
```

- `login-with-cedula`: permite iniciar sesión con cédula (clientes) o
  código de puesto (empleados/admin), sin exponer correos al navegador.
- `admin-delete-user`: deja al admin eliminar usuarios desde "Gestionar
  usuarios" en su panel. ⚠️ Borra también sus citas/compras/reseñas.

## 7. Puestos de trabajo (1 = admin, 2 a 4 = empleados)
La misma función de arriba también crea al **encargado de bebidas**
(panel de admin → "Encargado de bebidas") — esa cuenta solo puede
entrar a `bebidas.html` para registrar ventas, no ve nada más, y no
puede eliminar ninguna venta (eso solo lo puede hacer el admin real).

Despliega esta función nueva (no necesita secrets nuevos):
```
supabase functions deploy admin-setup-puesto
```

Puestos 2, 3 y 4: desde el panel de admin → **"Asignar puesto de trabajo"**
→ eliges el puesto, pones un usuario (ej. `PUESTO2`) y una contraseña →
"Guardar puesto". Ya queda creado, sin SQL y sin Supabase. Si ese puesto
ya existía, esto solo le cambia la contraseña (el número de puesto no
cambia nunca).

Puesto 1 (tú, el admin): si todavía no tienes `puesto_number` asignado,
corre una vez en el SQL Editor (solo para ti, porque tú ya tienes cuenta):
```sql
update public.profiles
set role = 'admin', puesto_number = 1
where cedula = 'TU-CODIGO-O-CEDULA';
```

## 8. Bebidas (registro manual, solo admin)
Ya no están en el carrito de los clientes. El admin las registra a mano
desde **Bebidas** en su navbar (`bebidas/bebidas.html`) cuando vende una
en el local — esa ganancia es 100% suya y se suma sola al total real.
No necesita ninguna Edge Function ni configuración aparte, solo que ya
hayas corrido el SQL de la tabla `drink_sales` (paso 1).

## 9. Subir el sitio
Sube toda la carpeta tal cual (incluida `img/`) a GitHub Pages / Netlify / Vercel.
La carpeta `supabase/` no se sirve como sitio web, son solo los archivos que usas
para configurar tu proyecto de Supabase (no afecta el frontend).

## Notas importantes
- El registro (`register.html`) crea cuentas como `client` por defecto.
  Los puestos (admin/empleados) se activan a mano por SQL siguiendo el
  paso 7 — son cuentas fijas, no se "registran" de nuevo cada vez.
- La fidelidad ahora es un ciclo de 11 cortes (el 11vo sale gratis).
- Ya no se muestran nombres de admin/empleados en ningún lado — todo
  se identifica por "Puesto N". Los clientes sí se siguen mostrando
  por su nombre real.
- La barra de fidelidad cuenta TODAS las citas marcadas como `completed`, sin
  distinguir tipo de servicio. Si quieres que solo cuenten los cortes (no barba
  u otros servicios), dímelo y ajusto el trigger en `schema.sql`.
- El "6to gratis" se calcula automáticamente, pero el descuento en el precio
  hay que aplicarlo manualmente al marcar la cita como completada (no hay
  todavía un campo de precio editable en el flujo de "completar").