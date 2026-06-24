/* ============================================================================
   ESTUDIO 15 — AUTH.JS
   Helpers de autenticación compartidos por las páginas que necesitan login:
   login.html, register.html, admin.html, empleado.html, cliente.html,
   y también index.html/products.html (para agendar citas y comprar).

   Requiere que supabase-client.js ya esté cargado antes que este archivo.

   Índice:
   1. Mapa de rol -> panel
   2. Obtener sesión y perfil actuales
   3. Proteger una página según el rol permitido
   4. Cerrar sesión
   ============================================================================ */


/* ============================================================
   1. MAPA DE ROL -> PANEL
   ============================================================ */
const ROLE_HOME = {
  admin: "../admin/admin.html",
  employee: "../empleado/empleado.html",
  client: "../cliente/cliente.html",
};


/* ============================================================
   2. OBTENER SESIÓN Y PERFIL ACTUALES
   ============================================================ */
async function getCurrentSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Error obteniendo sesión:", error);
    return null;
  }
  return data.session;
}

async function getCurrentProfile() {
  const session = await getCurrentSession();
  if (!session) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error("Error obteniendo perfil:", error);
    return null;
  }
  return data;
}


/* ============================================================
   3. PROTEGER UNA PÁGINA SEGÚN EL ROL PERMITIDO
   Úsalo al inicio de cada panel:
     const profile = await requireRole(["admin"]);
     if (!profile) return; // ya redirigió
   ============================================================ */
async function requireRole(allowedRoles) {
  const profile = await getCurrentProfile();

  if (!profile) {
    window.location.href = "../login/login.html";
    return null;
  }

  if (!allowedRoles.includes(profile.role)) {
    // Está logueado pero no tiene permiso: lo mandamos a SU panel.
    window.location.href = ROLE_HOME[profile.role] || "../login/login.html";
    return null;
  }

  return profile;
}


/* ============================================================
   4. CERRAR SESIÓN
   Engancha cualquier botón con [data-logout] a esta función.
   ============================================================ */
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "../login/login.html";
}

document.addEventListener("click", function (e) {
  if (e.target.closest("[data-logout]")) {
    logout();
  }
});
