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

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError("");

    var name = document.getElementById("reg-name").value.trim();
    var phone = document.getElementById("reg-phone").value.trim();
    var email = document.getElementById("reg-email").value.trim();
    var password = document.getElementById("reg-password").value.trim();

    if (!name || !phone || !email || !password) {
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
        data: { full_name: name, phone: phone },
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

    alert("Cuenta creada. Revisa tu correo para confirmar (si tu proyecto lo requiere) y luego inicia sesión.");
    window.location.href = "../login/login.html";
  });

});
