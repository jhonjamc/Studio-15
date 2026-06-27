/* ============================================================================
   ESTUDIO 15 — LOGIN.JS
   Login con número de cédula (no correo). Por debajo sigue siendo
   Supabase Auth: la Edge Function "login-with-cedula" busca el correo
   real (con permisos de servidor, nunca expuesto al navegador) y hace
   el login de verdad, devolviendo los tokens de sesión.
   Requiere supabase-client.js y auth.js cargados antes.
   ============================================================================ */

document.addEventListener("DOMContentLoaded", function () {

  var form = document.querySelector(".form");
  if (!form) return;

  var cedulaInput = document.getElementById("login-cedula");
  var passwordInput = document.getElementById("login-password");
  var submitBtn = form.querySelector(".button-submit");
  var errorEl = document.getElementById("login-error");
  var toggleBtn = document.getElementById("toggle-login-password");

  function showError(msg) {
    if (errorEl) errorEl.textContent = msg;
  }

  // Botón de mostrar/ocultar contraseña
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      var showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      toggleBtn.innerHTML = '<i data-lucide="' + (showing ? "eye" : "eye-off") + '"></i>';
      if (window.lucide) lucide.createIcons();
    });
  }

  // Si ya hay sesión activa, no tiene sentido mostrar el login.
  getCurrentProfile().then(function (profile) {
    if (profile) window.location.href = ROLE_HOME[profile.role] || "../index/index.html";
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError("");

    var cedula = cedulaInput.value.trim();
    var password = passwordInput.value.trim();

    if (!cedula || !password) {
      showError("Por favor completa tu cédula y contraseña.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Ingresando...";

    var { data, error } = await supabaseClient.functions.invoke("login-with-cedula", {
      body: { cedula: cedula, password: password },
    });

    if (error || !data || data.error || !data.access_token) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Iniciar sesión";
      showError("Cédula o contraseña incorrectos.");
      return;
    }

    await supabaseClient.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });

    var profile = await getCurrentProfile();
    submitBtn.disabled = false;
    submitBtn.textContent = "Iniciar sesión";

    if (!profile) {
      showError("No se encontró tu perfil. Contacta al administrador.");
      return;
    }

    var redirectTo = sessionStorage.getItem("post_login_redirect");
    if (redirectTo) {
      sessionStorage.removeItem("post_login_redirect");
      window.location.href = redirectTo;
      return;
    }

    window.location.href = ROLE_HOME[profile.role] || "../index/index.html";
  });

});