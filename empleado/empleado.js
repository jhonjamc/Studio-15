/* ============================================================================
   ESTUDIO 15 — EMPLEADO.JS
   Panel del empleado. RLS garantiza que solo vea sus propias citas
   (employee_id = auth.uid()) y sus propias ganancias.
   ============================================================================ */

var EMP_STATUS_LABELS = {
  pending: "Pendiente",
  accepted: "Confirmada",
  rejected: "Rechazada",
  completed: "Completada",
  cancelled: "Cancelada",
};

var currentEmployeeId = null;

document.addEventListener("DOMContentLoaded", async function () {

  var profile = await requireRole(["employee", "admin"]);
  if (!profile) return;

  currentEmployeeId = profile.id;
  document.getElementById("employee-name").textContent = profile.full_name || "Empleado";
  document.getElementById("kpi-commission-pct").textContent = profile.commission_percentage + "%";

  await loadAppointments();
  await loadEarnings();

  if (window.lucide) lucide.createIcons();
});


/* ============================================================
   CITAS
   ============================================================ */
async function loadAppointments() {
  var pendingList = document.getElementById("appointments-pending");
  var completedList = document.getElementById("appointments-completed");

  var { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .eq("employee_id", currentEmployeeId)
    .order("appointment_date", { ascending: true });

  if (error) {
    pendingList.innerHTML = '<p class="dashboard-empty">No se pudieron cargar las citas.</p>';
    console.error(error);
    return;
  }

  function isPending(a) { return a.status === "pending" || a.status === "accepted"; }
  var pending = data.filter(isPending);
  var completed = data.filter(function (a) { return !isPending(a); });

  pendingList.innerHTML = pending.length ? "" : '<p class="dashboard-empty">No tienes citas pendientes.</p>';
  pending.forEach(function (appt) { pendingList.appendChild(buildAppointmentCard(appt, false)); });

  completedList.innerHTML = completed.length ? "" : '<p class="dashboard-empty">Sin historial todavía.</p>';
  completed.forEach(function (appt) { completedList.appendChild(buildAppointmentCard(appt, true)); });

  if (window.lucide) lucide.createIcons();
  setupAppointmentContextMenu();
}

function buildAppointmentCard(appt, compact) {
  var wrap = document.createElement("div");
  wrap.className = "appt-swipe-wrap";
  wrap.dataset.apptId = appt.id;

  var card = document.createElement("article");
  card.className = "dash-card appt-card" + (compact ? " compact" : "");

  var actionsHtml = "";
  if (!compact && appt.status === "pending") {
    actionsHtml =
      '<div class="appt-actions">' +
        '<button class="appt-btn appt-btn-accept" data-action="accept" data-id="' + appt.id + '"><i data-lucide="check"></i> Aceptar</button>' +
        '<button class="appt-btn appt-btn-reject" data-action="reject" data-id="' + appt.id + '"><i data-lucide="x"></i> Rechazar</button>' +
      '</div>';
  } else if (!compact && appt.status === "accepted") {
    actionsHtml =
      '<div class="appt-actions">' +
        '<button class="appt-btn appt-btn-complete" data-action="complete" data-id="' + appt.id + '"><i data-lucide="check-check"></i> Marcar completada</button>' +
      '</div>';
  }

  // En modo compacto (completadas) se quita el teléfono del cliente.
  var phoneHtml = compact ? "" : '<span><i data-lucide="phone"></i> ' + appt.client_phone + '</span>';

  card.innerHTML =
    '<div class="appt-card-top">' +
      '<div><p class="appt-client-name">' + appt.client_name + '</p>' +
      '<p class="appt-service">' + appt.service_name + '</p></div>' +
      '<span class="status-badge ' + appt.status + '">' + EMP_STATUS_LABELS[appt.status] + '</span>' +
    '</div>' +
    '<div class="appt-meta">' +
      '<span><i data-lucide="calendar"></i> ' + appt.appointment_date + '</span>' +
      '<span><i data-lucide="clock"></i> ' + appt.appointment_time + '</span>' +
      phoneHtml +
    '</div>' +
    '<div class="appt-price">' + (appt.is_free ? '<span class="free-badge">🎁 Gratis</span>' : '$' + Number(appt.price).toFixed(2)) + '</div>' +
    actionsHtml;

  wrap.innerHTML = '<div class="appt-swipe-action"><i data-lucide="trash-2"></i> Eliminar</div>';
  wrap.appendChild(card);

  return wrap;
}

/* ============================================================
   ELIMINAR CITA: clic derecho (PC) + swipe izquierda (celular)
   ============================================================ */
async function deleteAppointment(id) {
  var { error } = await supabaseClient.from("appointments").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar la cita.");
    console.error(error);
    return;
  }
  await loadAppointments();
  await loadEarnings();
}

var contextMenuReady = false;
function setupAppointmentContextMenu() {
  if (contextMenuReady) return; // el contenedor no se reemplaza, solo su contenido
  if (typeof attachContextMenu !== "function") return;
  contextMenuReady = true;

  var wrapEl = document.getElementById("appointments-wrap");

  attachContextMenu(wrapEl, "[data-appt-id]", [
    {
      label: "Eliminar cita",
      icon: "trash-2",
      onClick: function (targetEl) {
        showConfirmDialog("¿Eliminar esta cita? Esta acción no se puede deshacer.", function () {
          deleteAppointment(targetEl.dataset.apptId);
        });
      },
    },
  ]);

  if (typeof attachSwipeToDelete === "function") {
    attachSwipeToDelete(wrapEl, ".appt-swipe-wrap", function (swipeWrapEl, closeFn) {
      showConfirmDialog("¿Eliminar esta cita? Esta acción no se puede deshacer.", function () {
        deleteAppointment(swipeWrapEl.dataset.apptId);
      });
    });
  }
}

document.addEventListener("click", async function (e) {
  var btn = e.target.closest("[data-action]");
  if (!btn) return;

  var id = btn.dataset.id;
  var action = btn.dataset.action;
  var newStatus = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "completed";

  btn.disabled = true;

  var { error } = await supabaseClient
    .from("appointments")
    .update({ status: newStatus })
    .eq("id", id);


  if (error) {
    alert("No se pudo actualizar la cita.");
    console.error(error);
    btn.disabled = false;
    return;
  }

  // El SMS de confirmación/rechazo lo manda automáticamente el
  // Database Webhook -> Edge Function (send-appointment-sms).
  await loadAppointments();
  await loadEarnings();
});


/* ============================================================
   GANANCIAS (solo las propias)
   ============================================================ */
async function loadEarnings() {
  var { data, error } = await supabaseClient
    .from("appointment_earnings")
    .select("*")
    .eq("employee_id", currentEmployeeId);

  if (error) {
    console.error(error);
    return;
  }

  var totalEarned = 0;
  var totalShop = 0;
  data.forEach(function (row) {
    totalEarned += Number(row.performer_earning);
    totalShop += Number(row.shop_earning);
  });

  document.getElementById("kpi-total-earned").textContent = "$" + totalEarned.toFixed(2);
  document.getElementById("kpi-completed-count").textContent = data.length;

  var total = totalEarned + totalShop;
  var employeePct = total > 0 ? (totalEarned / total) * 100 : 0;
  var shopPct = total > 0 ? (totalShop / total) * 100 : 0;

  document.getElementById("bar-employee-value").textContent = "$" + totalEarned.toFixed(2);
  document.getElementById("bar-shop-value").textContent = "$" + totalShop.toFixed(2);
  document.getElementById("bar-employee-fill").style.width = employeePct + "%";
  document.getElementById("bar-shop-fill").style.width = shopPct + "%";
}