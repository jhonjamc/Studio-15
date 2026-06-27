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

## 6. Login con cédula y creación de empleados sin Supabase
Estas dos funciones nuevas no necesitan secrets nuevos (usan las que
Supabase ya pone automáticamente: SUPABASE_URL, SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY). Solo despliégalas:

```
supabase functions deploy login-with-cedula
supabase functions deploy admin-create-employee
```

- `login-with-cedula`: permite iniciar sesión con cédula en vez de
  correo, sin exponer correos al navegador.
- `admin-create-employee`: deja crear empleados desde el botón
  "Crear empleado" del panel de admin, sin tocar Supabase ni copiar
  ningún UUID. Solo el admin puede llamarla (se valida su rol dentro
  de la función).

## 7. Subir el sitio
Sube toda la carpeta tal cual (incluida `img/`) a GitHub Pages / Netlify / Vercel.
La carpeta `supabase/` no se sirve como sitio web, son solo los archivos que usas
para configurar tu proyecto de Supabase (no afecta el frontend).

## Notas importantes
- El registro (`register.html`) **solo crea clientes**. Los empleados y el admin
  se activan manualmente (pasos 3 y "Vincular empleado") porque crear usuarios de
  Auth requiere la `service_role key`, que nunca debe estar en el navegador.
- La barra de fidelidad cuenta TODAS las citas marcadas como `completed`, sin
  distinguir tipo de servicio. Si quieres que solo cuenten los cortes (no barba
  u otros servicios), dímelo y ajusto el trigger en `schema.sql`.
- El "6to gratis" se calcula automáticamente, pero el descuento en el precio
  hay que aplicarlo manualmente al marcar la cita como completada (no hay
  todavía un campo de precio editable en el flujo de "completar").