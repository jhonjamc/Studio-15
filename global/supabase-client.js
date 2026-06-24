/* ============================================================================
   ESTUDIO 15 — SUPABASE-CLIENT.JS
   ⚠️ PON AQUÍ TUS CREDENCIALES (Supabase Dashboard → Project Settings → API).
   La "anon key" es pública por diseño, no es un secreto: la seguridad real
   la dan las políticas RLS que ya están en supabase/schema.sql.

   Este archivo se debe cargar DESPUÉS del script de la librería:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script src="supabase-client.js"></script>
   ============================================================================ */

const SUPABASE_URL = "https://aovuanbmdytmxrjrwhyb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdnVhbmJtZHl0bXhyanJ3aHliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNDg3NjYsImV4cCI6MjA5NzgyNDc2Nn0.y5ONrot-F6OFBMd1yvm29kXbFMtV9BFFhYqv5C82P0g";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
