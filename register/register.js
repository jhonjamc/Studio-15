/* ============================================================================
   ESTUDIO 15 — REGISTER.JS
   Registro de CLIENTES. El trigger handle_new_user (schema.sql) crea
   automáticamente su fila en profiles con role='client'.
   ============================================================================ */

document.addEventListener("DOMContentLoaded", function () {

  var form = document.getElementById("register-form");
  if (!form) return;

  var errorEl = document.getElementById("register-error");
  var submitBtn = form.querySelector(".button-submit");

  function showError(msg) {
    errorEl.textContent = msg;
  }

  var toggleBtn = document.getElementById("toggle-reg-password");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      var passwordInput = document.getElementById("reg-password");
      var showing = passwordInput.type === "text";
      passwordInput.type = showing ? "password" : "text";
      toggleBtn.innerHTML = '<i data-lucide="' + (showing ? "eye" : "eye-off") + '"></i>';
      if (window.lucide) lucide.createIcons();
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError("");

    var name = document.getElementById("reg-name").value.trim();
    var cedula = document.getElementById("reg-cedula").value.trim();
    var phone = document.getElementById("reg-phone").value.trim();
    var email = document.getElementById("reg-email").value.trim();
    var password = document.getElementById("reg-password").value.trim();

    if (!name || !cedula || !phone || !email || !password) {
      showError("Completa todos los campos.");
      return;
    }
    if (password.length < 6) {
      showError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creando cuenta...";

    var { error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { full_name: name, phone: phone, cedula: cedula },
      },
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Crear cuenta";

    if (error) {
      showError(error.message === "User already registered"
        ? "Ese correo ya tiene una cuenta."
        : "No se pudo crear la cuenta. Intenta de nuevo.");
      return;
    }

    submitBtn.disabled = false;
    submitBtn.textContent = "¡Cuenta creada!";

    errorEl.classList.remove("error");
    errorEl.classList.add("ok");
    errorEl.textContent = "Listo. Te llevamos a iniciar sesión...";

    setTimeout(function () {
      window.location.href = "../login/login.html";
    }, 1500);
  });

});