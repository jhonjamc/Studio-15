/* ============================================================================
   ESTUDIO 15 — INDEX.JS
   Lógica EXCLUSIVA de index.html.
   global.js ya se encarga de: iconos lucide, año del footer y el carrito.

   Índice:
   1. Carrusel de cortes
   2. Widget de agendamiento (4 pasos)
   ============================================================================ */

document.addEventListener("DOMContentLoaded", function () {

  /* ============================================================
     1. CARRUSEL DE CORTES
     ============================================================ */
  var viewport = document.getElementById("carouselViewport");
  var track = document.getElementById("carouselTrack");
  var prevBtn = document.getElementById("carouselPrev");
  var nextBtn = document.getElementById("carouselNext");
  var dotsWrap = document.getElementById("carouselDots");

  if (viewport && track) {
    var slides = Array.prototype.slice.call(track.children);
    var current = 0;
    var autoplayId = null;

    function buildDots() {
      dotsWrap.innerHTML = "";
      slides.forEach(function (_, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel-dot" + (i === current ? " active" : "");
        dot.setAttribute("aria-label", "Ir al corte " + (i + 1));
        dot.addEventListener("click", function () { goTo(i); });
        dotsWrap.appendChild(dot);
      });
    }

    function updateDots() {
      var dots = dotsWrap.querySelectorAll(".carousel-dot");
      dots.forEach(function (d, i) { d.classList.toggle("active", i === current); });
    }

    function slideWidth() {
      return slides[0].getBoundingClientRect().width + 20; // 20 = gap
    }

    function goTo(index) {
      current = ((index % slides.length) + slides.length) % slides.length;
      viewport.scrollTo({ left: current * slideWidth(), behavior: "smooth" });
      updateDots();
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    function startAutoplay() { stopAutoplay(); autoplayId = setInterval(next, 4200); }
    function stopAutoplay() { if (autoplayId) clearInterval(autoplayId); }

    buildDots();
    startAutoplay();

    nextBtn && nextBtn.addEventListener("click", function () { next(); startAutoplay(); });
    prevBtn && prevBtn.addEventListener("click", function () { prev(); startAutoplay(); });

    viewport.addEventListener("mouseenter", stopAutoplay);
    viewport.addEventListener("mouseleave", startAutoplay);

    viewport.setAttribute("tabindex", "0");
    viewport.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    });

    window.addEventListener("resize", function () {
      viewport.scrollTo({ left: current * slideWidth(), behavior: "auto" });
    });

    var scrollTimeout;
    viewport.addEventListener("scroll", function () {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(function () {
        var idx = Math.round(viewport.scrollLeft / slideWidth());
        if (idx !== current) { current = idx; updateDots(); }
      }, 100);
    });
  }

  /* ============================================================
     2. WIDGET DE AGENDAMIENTO
     ============================================================ */
  initBookingWidget();

  /* ============================================================
     3. STATS DEL HERO + RESEÑAS
     ============================================================ */
  loadHeroStats();
  initReviews();
});

async function initBookingWidget() {
  var container = document.querySelector(".booking-widget-container");
  if (!container) return;

  var gate = document.getElementById("booking-login-gate");
  var stepsHeader = document.querySelector(".booking-steps");
  var nav = document.getElementById("booking-nav");

  var profile = await getCurrentProfile();

  var gateLoginLink = document.getElementById("booking-gate-login-link");
  if (gateLoginLink) {
    gateLoginLink.addEventListener("click", function () {
      sessionStorage.setItem("post_login_redirect", window.location.pathname + "#agendar");
    });
  }

  if (!profile) {
    gate.style.display = "block";
    stepsHeader.style.display = "none";
    nav.style.display = "none";
    document.querySelectorAll(".booking-step-panel").forEach(function (p) { p.classList.remove("active"); });
    return;
  }

  var totalSteps = 4;
  var step = 1;

  var booking = {
    serviceId: null, serviceName: null, servicePrice: 0,
    barberId: null, barberName: null,
    date: null, time: null,
  };

  var panels = {
    1: document.getElementById("step-panel-1"),
    2: document.getElementById("step-panel-2"),
    3: document.getElementById("step-panel-3"),
    4: document.getElementById("step-panel-4"),
    success: document.getElementById("step-panel-success"),
  };
  var indicators = {
    1: document.getElementById("step-ind-1"),
    2: document.getElementById("step-ind-2"),
    3: document.getElementById("step-ind-3"),
    4: document.getElementById("step-ind-4"),
  };

  var backBtn = document.getElementById("booking-back-btn");
  var nextBtn = document.getElementById("booking-next-btn");
  var errorEl = document.getElementById("booking-error");

  var dateInput = document.getElementById("booking-date");
  var todayStr = new Date().toISOString().split("T")[0];
  dateInput.min = todayStr;
  dateInput.value = todayStr;
  booking.date = todayStr;

  // Prellenar datos del cliente si ya los tenemos en su perfil
  var nameInput = document.getElementById("client-name");
  var phoneInput = document.getElementById("client-phone");
  if (profile.full_name) nameInput.value = profile.full_name;
  if (profile.phone) phoneInput.value = profile.phone;

  function showError(msg) { errorEl.textContent = msg; }
  function clearError() { errorEl.textContent = ""; }

  function renderStep() {
    [1, 2, 3, 4].forEach(function (n) {
      panels[n].classList.toggle("active", n === step);
      indicators[n].classList.toggle("active", n === step);
      indicators[n].classList.toggle("completed", n < step);
    });
    backBtn.style.visibility = step === 1 ? "hidden" : "visible";
    nextBtn.textContent = step === totalSteps ? "Confirmar y Agendar" : "Siguiente";
    clearError();
    if (step === 4) updateSummary();
  }

  function validateStep() {
    if (step === 1 && !booking.serviceId) { showError("Por favor selecciona un servicio para continuar."); return false; }
    if (step === 2 && !booking.barberId) { showError("Por favor selecciona un barbero para continuar."); return false; }
    if (step === 3) {
      if (!booking.date) { showError("Selecciona una fecha."); return false; }
      if (!booking.time) { showError("Selecciona un horario disponible."); return false; }
    }
    if (step === 4) {
      if (!nameInput.value.trim()) { showError("Por favor escribe tu nombre completo."); return false; }
      if (!phoneInput.value.trim()) { showError("Por favor escribe tu número celular."); return false; }
    }
    return true;
  }

  function updateSummary() {
    document.getElementById("sum-service").textContent = booking.serviceName || "-";
    document.getElementById("sum-barber").textContent = booking.barberName || "-";
    document.getElementById("sum-date").textContent = booking.date ? formatDate(booking.date) : "-";
    document.getElementById("sum-time").textContent = booking.time || "-";
    document.getElementById("sum-total").textContent = "$" + booking.servicePrice.toFixed(2);
  }

  function formatDate(isoStr) {
    var parts = isoStr.split("-");
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  }

  /* --------------------------------------------------------
     Paso 1: servicios (cargados desde Supabase)
     -------------------------------------------------------- */
  var servicesList = document.getElementById("services-list");
  var { data: services, error: servicesError } = await supabaseClient
    .from("services").select("*").eq("is_active", true);

  if (servicesError || !services || !services.length) {
    servicesList.innerHTML = '<p>No se pudieron cargar los servicios. Intenta más tarde.</p>';
  } else {
    servicesList.innerHTML = "";
    services.forEach(function (s) {
      var opt = document.createElement("div");
      opt.className = "service-option";
      opt.dataset.id = s.id;
      opt.dataset.name = s.name;
      opt.dataset.price = s.price;
      opt.innerHTML =
        '<div class="service-info-left">' +
          '<div class="service-radio"></div>' +
          '<div class="service-details"><h4>' + s.name + '</h4><p>Duración aproximada: ' + s.duration_minutes + ' min.</p></div>' +
        '</div>' +
        '<div class="service-price">$' + Number(s.price).toFixed(2) + '</div>';
      opt.addEventListener("click", function () {
        servicesList.querySelectorAll(".service-option").forEach(function (o) { o.classList.remove("selected"); });
        opt.classList.add("selected");
        booking.serviceId = s.id;
        booking.serviceName = s.name;
        booking.servicePrice = Number(s.price);
        clearError();
      });
      servicesList.appendChild(opt);
    });
  }

  /* --------------------------------------------------------
     Paso 2: barberos (admin + empleados, cargados desde Supabase)
     -------------------------------------------------------- */
  var barbersList = document.getElementById("barbers-list");
  var { data: barbers, error: barbersError } = await supabaseClient
    .from("profiles").select("*").in("role", ["admin", "employee"]);

  if (barbersError || !barbers || !barbers.length) {
    barbersList.innerHTML = '<p>No se pudieron cargar los barberos. Intenta más tarde.</p>';
  } else {
    barbersList.innerHTML = "";
    barbers.forEach(function (b) {
      var card = document.createElement("div");
      card.className = "barber-card";
      card.dataset.id = b.id;
      card.dataset.name = b.full_name || "Barbero";
      card.innerHTML =
        '<div class="barber-avatar-wrapper" style="display:grid;place-items:center;background:var(--color-bg-alt);">' +
          '<i data-lucide="scissors" style="width:32px;height:32px;color:var(--color-red);"></i>' +
        '</div>' +
        '<h4 class="barber-name">' + (b.full_name || "Barbero") + '</h4>' +
        '<span class="barber-role">' + (b.role === "admin" ? "Barbero principal" : "Barbero") + '</span>';
      card.addEventListener("click", function () {
        barbersList.querySelectorAll(".barber-card").forEach(function (c) { c.classList.remove("selected"); });
        card.classList.add("selected");
        booking.barberId = b.id;
        booking.barberName = b.full_name || "Barbero";
        clearError();
        refreshTimeSlots();
      });
      barbersList.appendChild(card);
    });
    if (window.lucide) lucide.createIcons();
  }

  // --- Paso 3: fecha y hora ---
  var timeSlots = container.querySelectorAll(".time-slot");

  // Consulta las citas activas (pendiente/aceptada) de ESE barbero en ESA
  // fecha y apaga los horarios que ya estén ocupados. Se vuelve a llamar
  // cada vez que cambia el barbero o la fecha.
  async function refreshTimeSlots() {
    if (!booking.barberId || !booking.date) return;

    var { data: taken, error: takenError } = await supabaseClient
      .from("appointments")
      .select("appointment_time")
      .eq("employee_id", booking.barberId)
      .eq("appointment_date", booking.date)
      .in("status", ["pending", "accepted"]);

    if (takenError) { console.error(takenError); return; }

    var takenTimes = (taken || []).map(function (r) { return r.appointment_time; });

    timeSlots.forEach(function (slot) {
      var isTaken = takenTimes.indexOf(slot.dataset.time) !== -1;
      slot.classList.toggle("disabled", isTaken);
      if (isTaken && slot.classList.contains("selected")) {
        slot.classList.remove("selected");
        booking.time = null;
      }
    });
  }

  dateInput.addEventListener("change", function () {
    booking.date = dateInput.value;
    clearError();
    refreshTimeSlots();
  });

  timeSlots.forEach(function (slot) {
    slot.addEventListener("click", function () {
      if (slot.classList.contains("disabled")) return;
      timeSlots.forEach(function (s) { s.classList.remove("selected"); });
      slot.classList.add("selected");
      booking.time = slot.dataset.time;
      clearError();
    });
  });

  // --- Navegación ---
  nextBtn.addEventListener("click", function () {
    if (!validateStep()) return;
    if (step === 2) refreshTimeSlots(); // por si pasó tiempo desde que cargó la página
    if (step < totalSteps) { step++; renderStep(); } else { submitBooking(); }
  });

  backBtn.addEventListener("click", function () {
    if (step > 1) { step--; renderStep(); }
  });

  async function submitBooking() {
    nextBtn.disabled = true;
    nextBtn.textContent = "Agendando...";

    var { error } = await supabaseClient.from("appointments").insert({
      client_id: profile.id,
      employee_id: booking.barberId,
      service_id: booking.serviceId,
      service_name: booking.serviceName,
      price: booking.servicePrice,
      client_name: nameInput.value.trim(),
      client_phone: phoneInput.value.trim(),
      appointment_date: booking.date,
      appointment_time: booking.time,
      notes: document.getElementById("client-notes").value.trim(),
    });

    nextBtn.disabled = false;
    nextBtn.textContent = "Confirmar y Agendar";

    if (error) {
      if (error.code === "23505") {
        showError("Justo ese horario se acaba de ocupar. Elige otro, por favor.");
        await refreshTimeSlots();
      } else {
        showError("No se pudo agendar tu cita. Intenta de nuevo.");
      }
      console.error(error);
      return;
    }

    [1, 2, 3, 4].forEach(function (n) { panels[n].classList.remove("active"); });
    panels.success.classList.add("active");
    stepsHeader.style.display = "none";
    nav.style.display = "none";
  }

  var resetBtn = document.getElementById("reset-booking-btn");
  resetBtn.addEventListener("click", function () {
    window.location.reload();
  });

  renderStep();
}


/* ============================================================================
   STATS DEL HERO (clientes reales + promedio de estrellas real)
   Usa la función get_public_stats() de Supabase, que solo devuelve
   números agregados (no expone perfiles ni reseñas completas).
   ============================================================================ */
async function loadHeroStats() {
  var clientsEl = document.getElementById("stat-clients");
  var ratingEl = document.getElementById("stat-rating");
  var ratingLabelEl = document.getElementById("stat-rating-label");
  if (!clientsEl || !ratingEl) return;

  try {
    var { data, error } = await supabaseClient.rpc("get_public_stats");
    if (error || !data) throw error;

    clientsEl.textContent = formatCount(data.client_count);

    if (data.review_count > 0) {
      ratingEl.textContent = Number(data.avg_rating).toFixed(1) + "★";
      ratingLabelEl.textContent = "Reseñas (" + data.review_count + ")";
    } else {
      ratingEl.textContent = "—";
      ratingLabelEl.textContent = "Sin reseñas aún";
    }
  } catch (e) {
    console.error("Error cargando stats:", e);
    clientsEl.textContent = "—";
    ratingEl.textContent = "—";
  }
}

function formatCount(n) {
  n = Number(n) || 0;
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
  return String(n);
}


/* ============================================================================
   RESEÑAS — panel público + formulario para clientes logueados
   ============================================================================ */
async function initReviews() {
  var listEl = document.getElementById("reviews-list");
  var formCard = document.getElementById("review-form-card");
  var loginHint = document.getElementById("review-login-hint");
  if (!listEl) return;

  await loadReviews();

  if (typeof getCurrentProfile !== "function") return;
  var profile = await getCurrentProfile();

  if (!profile) {
    formCard.style.display = "none";
    loginHint.style.display = "block";
    return;
  }

  loginHint.style.display = "none";
  formCard.style.display = "block";
  setupReviewForm(profile);
}

async function loadReviews() {
  var listEl = document.getElementById("reviews-list");

  var { data, error } = await supabaseClient
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    listEl.innerHTML = '<p class="reviews-empty">No se pudieron cargar las reseñas.</p>';
    console.error(error);
    return;
  }

  if (!data.length) {
    listEl.innerHTML = '<p class="reviews-empty">Todavía no hay reseñas. ¡Sé el primero en dejar la tuya!</p>';
    return;
  }

  listEl.innerHTML = "";
  data.forEach(function (review) {
    var stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
    var date = new Date(review.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

    var card = document.createElement("article");
    card.className = "review-card";
    card.innerHTML =
      '<div class="review-stars">' + stars + '</div>' +
      (review.comment ? '<p class="review-comment">' + review.comment + '</p>' : '') +
      '<p class="review-author">' + review.client_name + '</p>' +
      '<p class="review-date">' + date + '</p>';
    listEl.appendChild(card);
  });
}

function setupReviewForm(profile) {
  var starBtns = document.querySelectorAll("#star-picker .star-btn");
  var commentInput = document.getElementById("review-comment");
  var submitBtn = document.getElementById("review-submit-btn");
  var msgEl = document.getElementById("review-form-msg");
  var selectedRating = 0;

  starBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectedRating = parseInt(btn.dataset.value, 10);
      starBtns.forEach(function (b) {
        b.classList.toggle("active", parseInt(b.dataset.value, 10) <= selectedRating);
      });
    });
  });

  submitBtn.addEventListener("click", async function () {
    msgEl.textContent = "";
    msgEl.className = "review-form-msg";

    if (!selectedRating) {
      msgEl.textContent = "Selecciona cuántas estrellas quieres dejar.";
      msgEl.classList.add("error");
      return;
    }

    submitBtn.disabled = true;

    var { error } = await supabaseClient.from("reviews").insert({
      client_id: profile.id,
      client_name: profile.full_name || "Cliente",
      rating: selectedRating,
      comment: commentInput.value.trim() || null,
    });

    submitBtn.disabled = false;

    if (error) {
      msgEl.textContent = "No se pudo publicar tu reseña. Intenta de nuevo.";
      msgEl.classList.add("error");
      console.error(error);
      return;
    }

    msgEl.textContent = "¡Gracias por tu reseña!";
    msgEl.classList.add("ok");
    commentInput.value = "";
    selectedRating = 0;
    starBtns.forEach(function (b) { b.classList.remove("active"); });

    await loadReviews();
    await loadHeroStats();
  });
}
