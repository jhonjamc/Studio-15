/* ============================================================================
   ESTUDIO 15 — CLIENTE.JS
   Panel del cliente: sus citas, su barra de fidelidad y su historial
   de compras. Todo filtrado por RLS a client_id = auth.uid().
   ============================================================================ */

var STATUS_LABELS = {
  pending: "Pendiente",
  accepted: "Confirmada",
  rejected: "Rechazada",
  completed: "Completada",
  cancelled: "Cancelada",
};

function formatDateEs(isoDate) {
  var parts = isoDate.split("-");
  var d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

document.addEventListener("DOMContentLoaded", async function () {

  var profile = await requireRole(["client"]);
  if (!profile) return;

  document.getElementById("client-name").textContent = profile.full_name || "Cliente";

  renderLoyalty(profile.completed_cuts || 0);
  await loadAppointments(profile.id);
  await loadPurchases(profile.id);

  if (window.lucide) lucide.createIcons();
});


/* ============================================================
   BARRA DE FIDELIDAD
   ============================================================ */
function renderLoyalty(completedCuts) {
  var positionInCycle = completedCuts % 6; // 0..5
  var track = document.getElementById("loyalty-track");
  var countEl = document.getElementById("loyalty-count");
  var msgEl = document.getElementById("loyalty-message");

  countEl.textContent = positionInCycle + " / 6";

  track.innerHTML = "";
  for (var i = 0; i < 6; i++) {
    var dot = document.createElement("div");
    dot.className = "loyalty-dot";
    if (i === 5) dot.classList.add("free");
    if (i < positionInCycle) dot.classList.add("filled");
    track.appendChild(dot);
  }

  if (positionInCycle === 5) {
    msgEl.textContent = "¡Tu próximo corte es GRATIS! Menciónalo al agendar o en el local.";
    msgEl.classList.add("ready");
  } else {
    var faltan = 5 - positionInCycle;
    msgEl.textContent = "Te faltan " + faltan + " corte" + (faltan === 1 ? "" : "s") + " para tu 6to gratis.";
    msgEl.classList.remove("ready");
  }
}


/* ============================================================
   MIS CITAS
   ============================================================ */
async function loadAppointments(clientId) {
  var list = document.getElementById("appointments-list");

  var { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .eq("client_id", clientId)
    .order("appointment_date", { ascending: false });

  if (error) {
    list.innerHTML = '<p class="dashboard-empty">No se pudieron cargar tus citas.</p>';
    console.error(error);
    return;
  }

  if (!data.length) {
    list.innerHTML = '<p class="dashboard-empty">Todavía no tienes citas agendadas.</p>';
    return;
  }

  list.innerHTML = "";
  data.forEach(function (appt) {
    var cardHtml =
      '<div class="appt-card-top">' +
        '<div><p class="appt-client-name">' + appt.service_name + '</p>' +
        '<p class="appt-service">$' + Number(appt.price).toFixed(2) + '</p></div>' +
        '<span class="status-badge ' + appt.status + '">' + STATUS_LABELS[appt.status] + '</span>' +
      '</div>' +
      '<div class="appt-meta">' +
        '<span><i data-lucide="calendar"></i> ' + formatDateEs(appt.appointment_date) + '</span>' +
        '<span><i data-lucide="clock"></i> ' + appt.appointment_time + '</span>' +
      '</div>';

    if (appt.status === "pending") {
      // Solo las pendientes se pueden eliminar (clic derecho en PC,
      // deslizar a la izquierda en celular).
      var wrap = document.createElement("div");
      wrap.className = "appt-swipe-wrap";
      wrap.dataset.apptId = appt.id;
      wrap.innerHTML = '<div class="appt-swipe-action"><i data-lucide="trash-2"></i> Eliminar</div>';
      var card = document.createElement("article");
      card.className = "dash-card appt-card";
      card.innerHTML = cardHtml;
      wrap.appendChild(card);
      list.appendChild(wrap);
    } else {
      var plainCard = document.createElement("article");
      plainCard.className = "dash-card appt-card";
      plainCard.innerHTML = cardHtml;
      list.appendChild(plainCard);
    }
  });
  if (window.lucide) lucide.createIcons();
  setupAppointmentDeleteForClient();
}

/* ============================================================
   ELIMINAR CITA (solo si sigue pendiente): clic derecho (PC) +
   swipe izquierda (celular). Citas ya aceptadas/completadas no
   se pueden borrar (la base de datos también lo bloquea).
   ============================================================ */
var clientDeleteReady = false;
function setupAppointmentDeleteForClient() {
  if (clientDeleteReady) return; // el contenedor no se reemplaza, solo su contenido
  if (typeof attachContextMenu !== "function") return;
  clientDeleteReady = true;

  var listEl = document.getElementById("appointments-list");

  async function deleteOwnAppointment(id) {
    var { error } = await supabaseClient.from("appointments").delete().eq("id", id);
    if (error) {
      alert("No se pudo eliminar la cita.");
      console.error(error);
      return;
    }
    var profile = await getCurrentProfile();
    await loadAppointments(profile.id);
  }

  attachContextMenu(listEl, "[data-appt-id]", [
    {
      label: "Eliminar cita",
      icon: "trash-2",
      onClick: function (targetEl) {
        showConfirmDialog("¿Eliminar esta cita pendiente? Esta acción no se puede deshacer.", function () {
          deleteOwnAppointment(targetEl.dataset.apptId);
        });
      },
    },
  ]);

  if (typeof attachSwipeToDelete === "function") {
    attachSwipeToDelete(listEl, ".appt-swipe-wrap", function (swipeWrapEl) {
      showConfirmDialog("¿Eliminar esta cita pendiente? Esta acción no se puede deshacer.", function () {
        deleteOwnAppointment(swipeWrapEl.dataset.apptId);
      });
    });
  }
}


/* ============================================================
   HISTORIAL DE COMPRAS
   ============================================================ */
async function loadPurchases(clientId) {
  var list = document.getElementById("purchases-list");

  var { data, error } = await supabaseClient
    .from("purchases")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    list.innerHTML = '<p class="dashboard-empty">No se pudo cargar tu historial.</p>';
    console.error(error);
    return;
  }

  if (!data.length) {
    list.innerHTML = '<p class="dashboard-empty">Todavía no tienes compras registradas.</p>';
    return;
  }

var PURCHASE_STATUS_LABELS = { pending: "Pendiente", approved: "Aprobada", declined: "Rechazada" };
var PURCHASE_STATUS_BADGE_CLASS = { pending: "pending", approved: "accepted", declined: "rejected" };

  list.innerHTML = "";
  data.forEach(function (purchase) {
    var date = new Date(purchase.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    var itemsHtml = purchase.items.map(function (item) {
      return '<div class="purchase-item-row"><span>' + item.name + ' x' + item.qty + '</span><span>$' + (item.price * item.qty).toFixed(2) + '</span></div>';
    }).join("");
    var status = purchase.status || "pending";

    var card = document.createElement("article");
    card.className = "dash-card purchase-card";
    card.innerHTML =
      '<div class="purchase-top"><span class="purchase-date">' + date + '</span>' +
      '<span class="purchase-total">$' + Number(purchase.total).toFixed(2) + '</span></div>' +
      '<span class="status-badge ' + PURCHASE_STATUS_BADGE_CLASS[status] + '">' + PURCHASE_STATUS_LABELS[status] + '</span>' +
      '<div class="purchase-items">' + itemsHtml + '</div>';
    list.appendChild(card);
  });
}