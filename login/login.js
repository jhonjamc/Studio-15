/* ============================================================================
   ESTUDIO 15 — LOGIN.JS
   Login real contra Supabase Auth. Tras iniciar sesión, lee el rol en
   profiles y redirige al panel correspondiente (admin/empleado/cliente).
   Requiere supabase-client.js y auth.js cargados antes.
   ============================================================================ */

document.addEventListener("DOMContentLoaded", function () {

  var form = document.querySelector(".form");
  if (!form) return;

  var emailInput = form.querySelector('input[type="text"]');
  var passwordInput = form.querySelector('input[type="password"]');
  var submitBtn = form.querySelector(".button-submit");
  var errorEl = document.getElementById("login-error");

  function showError(msg) {
    if (errorEl) errorEl.textContent = msg;
  }

  // Si ya hay sesión activa, no tiene sentido mostrar el login.
  getCurrentProfile().then(function (profile) {
    if (profile) window.location.href = ROLE_HOME[profile.role] || "../index/index.html";
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError("");

    var email = emailInput.value.trim();
    var password = passwordInput.value.trim();

    if (!email || !password) {
      showError("Por favor completa tu correo y contraseña.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Ingresando...";

    var { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Iniciar sesión";
      showError("Correo o contraseña incorrectos.");
      return;
    }

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