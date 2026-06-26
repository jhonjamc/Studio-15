-- ============================================================================
-- ESTUDIO 15 — SCHEMA.SQL
-- Ejecuta este archivo completo en Supabase: Dashboard → SQL Editor → New query
-- Es seguro volver a correrlo (usa "if not exists" / "or replace" donde aplica).
--
-- Índice:
-- 1. Tabla profiles (roles: admin, employee, client)
-- 2. Tabla services
-- 3. Tabla appointments (citas)
-- 4. Tabla purchases (historial de compras)
-- 5. Tabla reviews (reseñas públicas)
-- 6. Trigger: crear profile automático al registrarse
-- 7. Trigger: contador de cortes para la barra de fidelidad
-- 8. Vista de ganancias (appointment_earnings)
-- 9. RLS (seguridad por fila)
-- 10. Función pública de estadísticas (clientes y reseñas para el home)
-- ============================================================================


-- ============================================================
-- 1. PROFILES
-- Un registro por usuario de auth.users. El rol decide qué
-- panel ve (admin.html / empleado.html / cliente.html).
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'client' check (role in ('admin', 'employee', 'client')),
  full_name text,
  phone text,
  avatar_url text,
  -- % que se gana el barbero (admin o empleado) por cada cita completada.
  -- El admin, por ser dueño, tiene un % más alto. Los empleados van iguales.
  commission_percentage numeric not null default 50,
  -- contador para la barra de fidelidad (5 cortes -> el 6to gratis)
  completed_cuts integer not null default 0,
  created_at timestamptz not null default now()
);

comment on column public.profiles.commission_percentage is
  'Porcentaje que se queda el barbero por cita. El resto queda para el negocio (admin).';


-- ============================================================
-- 2. SERVICES
-- Catálogo de servicios (lectura pública, lo usa el widget de agendar).
-- ============================================================
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null,
  duration_minutes integer not null default 30,
  is_active boolean not null default true
);

insert into public.services (name, price, duration_minutes)
select * from (values
  ('Corte Caballero Premium', 25.00, 45),
  ('Diseño de Barba & Ritual', 18.00, 30),
  ('Combo Imperial (Corte + Barba)', 38.00, 60)
) as v(name, price, duration_minutes)
where not exists (select 1 from public.services);


-- ============================================================
-- 3. APPOINTMENTS
-- Guarda el nombre y teléfono tal cual se escribieron al agendar
-- (snapshot), porque el SMS se manda a ESE número, sin importar
-- si el perfil del cliente cambia el suyo después.
-- ============================================================
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id),
  employee_id uuid references public.profiles(id),
  service_id uuid references public.services(id),
  service_name text not null,
  price numeric not null,
  client_name text not null,
  client_phone text not null,
  appointment_date date not null,
  appointment_time text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_appointments_employee on public.appointments(employee_id);
create index if not exists idx_appointments_client on public.appointments(client_id);

-- Impide guardar dos citas ACTIVAS (pendiente o confirmada) con el mismo
-- barbero, misma fecha y misma hora. Esto es la red de seguridad final:
-- aunque el front-end falle o dos personas confirmen al mismo tiempo,
-- la base de datos rechaza la segunda.
create unique index if not exists uniq_active_appointment_slot
  on public.appointments (employee_id, appointment_date, appointment_time)
  where status in ('pending', 'accepted');

-- Mantener updated_at al día en cada cambio de estado
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute procedure public.set_updated_at();


-- ============================================================
-- 4. PURCHASES
-- Una fila por compra del carrito (no por producto).
-- items: [{ "name": "Pomada Mate", "price": 18, "qty": 2 }, ...]
-- status empieza en 'pending' y el webhook de Mercado Pago (Edge
-- Function mp-webhook) la actualiza a 'approved' o 'declined' cuando
-- el pago se confirma de verdad. Las ganancias del admin SOLO deben
-- contar las compras 'approved'.
-- ============================================================
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  items jsonb not null,
  total numeric not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  payment_reference text unique,
  payment_provider_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchases_client on public.purchases(client_id);
create index if not exists idx_purchases_reference on public.purchases(payment_reference);


-- ============================================================
-- 5. REVIEWS
-- Reseñas públicas que se muestran en el home (estrellas + comentario).
-- Cualquiera las puede leer; solo un cliente logueado puede crear la suya.
-- ============================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  client_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_created on public.reviews(created_at desc);


-- ============================================================
-- 6. TRIGGER: crear profile automático al registrarse
-- Todo el que se registra desde register.html entra como
-- 'client'. Los empleados/admin se promueven manualmente desde
-- el panel de admin (ver ADMIN_GUIA.md).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    'client'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- 7. TRIGGER: contador de cortes (fidelidad)
-- Cuando una cita pasa a 'completed', suma 1 al contador del
-- cliente. La barra de progreso en el panel del cliente muestra
-- completed_cuts % 6 (0 a 5, y al llegar a 5 el próximo es gratis).
-- ============================================================
create or replace function public.handle_appointment_completed()
returns trigger as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.profiles
    set completed_cuts = completed_cuts + 1
    where id = new.client_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_appointment_completed on public.appointments;
create trigger trg_appointment_completed
  after update on public.appointments
  for each row execute procedure public.handle_appointment_completed();


-- ============================================================
-- 8. VISTA DE GANANCIAS
-- performer_earning = lo que se gana quien hizo el corte (admin o empleado)
-- shop_earning      = lo que queda para el negocio (la diferencia)
-- Solo cuenta citas con status = 'completed'.
-- ============================================================
create or replace view public.appointment_earnings
with (security_invoker = true)
as
select
  a.id as appointment_id,
  a.employee_id,
  a.client_id,
  a.service_name,
  a.price,
  a.appointment_date,
  p.commission_percentage,
  round(a.price * p.commission_percentage / 100, 2) as performer_earning,
  round(a.price - (a.price * p.commission_percentage / 100), 2) as shop_earning
from public.appointments a
join public.profiles p on p.id = a.employee_id
where a.status = 'completed';


-- ============================================================
-- 9. RLS (seguridad por fila)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.purchases enable row level security;
alter table public.reviews enable row level security;

-- Función auxiliar: ¿el usuario actual es admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer set search_path = public;

-- ---------- profiles ----------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- Cualquier usuario logueado necesita ver la lista de barberos (admin +
-- empleados) para poder elegir uno al agendar. Esto NO expone otros
-- clientes, solo perfiles con role admin/employee.
drop policy if exists "profiles_select_staff_public" on public.profiles;
create policy "profiles_select_staff_public" on public.profiles
  for select using (role in ('admin', 'employee'));

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
  for insert with check (public.is_admin());

-- ---------- services ----------
drop policy if exists "services_select_all" on public.services;
create policy "services_select_all" on public.services
  for select using (true);

drop policy if exists "services_write_admin" on public.services;
create policy "services_write_admin" on public.services
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- appointments ----------
drop policy if exists "appointments_select" on public.appointments;
create policy "appointments_select" on public.appointments
  for select using (
    client_id = auth.uid() or employee_id = auth.uid() or public.is_admin()
  );

drop policy if exists "appointments_insert_own_client" on public.appointments;
create policy "appointments_insert_own_client" on public.appointments
  for insert with check (client_id = auth.uid());

drop policy if exists "appointments_update" on public.appointments;
create policy "appointments_update" on public.appointments
  for update using (employee_id = auth.uid() or public.is_admin());

-- El admin puede eliminar cualquier cita; un empleado solo las suyas.
drop policy if exists "appointments_delete" on public.appointments;
create policy "appointments_delete" on public.appointments
  for delete using (
    employee_id = auth.uid()
    or public.is_admin()
    or (client_id = auth.uid() and status = 'pending')
  );

-- ---------- purchases ----------
drop policy if exists "purchases_select_own_or_admin" on public.purchases;
create policy "purchases_select_own_or_admin" on public.purchases
  for select using (client_id = auth.uid() or public.is_admin());

drop policy if exists "purchases_insert_own" on public.purchases;
create policy "purchases_insert_own" on public.purchases
  for insert with check (client_id = auth.uid());

-- El admin confirma pagos manuales (Nequi/Bancolombia) marcando la
-- compra como aprobada o rechazada desde su panel.
drop policy if exists "purchases_update_admin" on public.purchases;
create policy "purchases_update_admin" on public.purchases
  for update using (public.is_admin());

-- ---------- reviews ----------
-- Públicas para lectura (se muestran en el home a cualquiera).
drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all" on public.reviews
  for select using (true);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
  for insert with check (client_id = auth.uid());


-- ============================================================
-- 10. FUNCIÓN PÚBLICA DE ESTADÍSTICAS
-- El home necesita mostrar "cuántos clientes" y "promedio de
-- estrellas", pero un visitante (o cliente normal) no puede leer
-- la tabla profiles completa por RLS. Esta función SOLO devuelve
-- números agregados (nunca filas con datos personales), y corre
-- con permisos elevados (security definer) para poder contarlos.
-- ============================================================
create or replace function public.get_public_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'client_count', (select count(*) from public.profiles where role = 'client'),
    'review_count', (select count(*) from public.reviews),
    'avg_rating', (select coalesce(round(avg(rating)::numeric, 1), 0) from public.reviews)
  );
$$;

grant execute on function public.get_public_stats() to anon, authenticated;