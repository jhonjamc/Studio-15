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

## 5. Subir el sitio
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
