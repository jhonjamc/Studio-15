/* ============================================================================
   ESTUDIO 15 — ADMIN.JS
   Panel del administrador (dueño/barbero). Ve todo: sus citas, las de
   los empleados, ganancias por empleado, fidelidad de clientes y un
   formulario para activar nuevos empleados.
   ============================================================================ */

var ADM_STATUS_LABELS = {
  pending: "Pendiente",
  accepted: "Confirmada",
  rejected: "Rechazada",
  completed: "Completada",
  cancelled: "Cancelada",
};

var currentAdminId = null;
var profilesById = {}; // cache id -> profile, para mostrar nombres
var lastCitasAdminTotal = 0; // se actualiza en loadEarnings, se reusa al refrescar ventas

document.addEventListener("DOMContentLoaded", async function () {

  var profile = await requireRole(["admin"]);
  if (!profile) return;

  currentAdminId = profile.id;
  document.getElementById("admin-name").textContent = profile.full_name || "Admin";

  await loadProfilesCache();
  await loadAppointments();
  var citasAdminTotal = await loadEarnings();
  await loadProductSales(citasAdminTotal);
  await loadPendingPurchases();
  await loadClientsLoyalty();
  setupLinkEmployeeForm();

  if (window.lucide) lucide.createIcons();
});


/* ============================================================
   CACHE DE PERFILES (para mostrar nombres en las cards)
   ============================================================ */
async function loadProfilesCache() {
  var { data, error } = await supabaseClient.from("profiles").select("*");
  if (error) { console.error(error); return; }
  data.forEach(function (p) { profilesById[p.id] = p; });
}


/* ============================================================
   CITAS (propias del admin + del equipo)
   ============================================================ */
async function loadAppointments() {
  var { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .order("appointment_date", { ascending: true });

  var ownPending = document.getElementById("own-appointments-pending");
  var ownCompleted = document.getElementById("own-appointments-completed");
  var teamPending = document.getElementById("team-appointments-pending");
  var teamCompleted = document.getElementById("team-appointments-completed");

  if (error) {
    ownPending.innerHTML = teamPending.innerHTML = '<p class="dashboard-empty">No se pudieron cargar las citas.</p>';
    console.error(error);
    return;
  }

  var own = data.filter(function (a) { return a.employee_id === currentAdminId; });
  var team = data.filter(function (a) { return a.employee_id !== currentAdminId; });

  // "Pendientes" = todavía no termina (pending/accepted). El resto
  // (completed/rejected/cancelled) ya está cerrado, va a "Completadas".
  function isPending(a) { return a.status === "pending" || a.status === "accepted"; }

  var ownP = own.filter(isPending), ownC = own.filter(function (a) { return !isPending(a); });
  var teamP = team.filter(isPending), teamC = team.filter(function (a) { return !isPending(a); });

  document.getElementById("kpi-pending-count").textContent =
    data.filter(function (a) { return a.status === "pending"; }).length;

  ownPending.innerHTML = ownP.length ? "" : '<p class="dashboard-empty">No tienes citas pendientes.</p>';
  ownP.forEach(function (a) { ownPending.appendChild(buildAppointmentCard(a, false, false)); });

  ownCompleted.innerHTML = ownC.length ? "" : '<p class="dashboard-empty">Sin historial todavía.</p>';
  ownC.forEach(function (a) { ownCompleted.appendChild(buildAppointmentCard(a, false, true)); });

  teamPending.innerHTML = teamP.length ? "" : '<p class="dashboard-empty">El equipo no tiene citas pendientes.</p>';
  teamP.forEach(function (a) { teamPending.appendChild(buildAppointmentCard(a, true, false)); });

  teamCompleted.innerHTML = teamC.length ? "" : '<p class="dashboard-empty">Sin historial todavía.</p>';
  teamC.forEach(function (a) { teamCompleted.appendChild(buildAppointmentCard(a, true, true)); });

  if (window.lucide) lucide.createIcons();
  setupAppointmentContextMenus();
}

function buildAppointmentCard(appt, showEmployeeName, compact) {
  var wrap = document.createElement("div");
  wrap.className = "appt-swipe-wrap";
  wrap.dataset.apptId = appt.id;

  var card = document.createElement("article");
  card.className = "dash-card appt-card" + (compact ? " compact" : "");

  var employeeLabel = "";
  if (showEmployeeName) {
    var emp = profilesById[appt.employee_id];
    employeeLabel = '<p class="appt-service">Barbero: ' + (emp ? emp.full_name : "—") + '</p>';
  }

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
      '<p class="appt-service">' + appt.service_name + '</p>' + employeeLabel + '</div>' +
      '<span class="status-badge ' + appt.status + '">' + ADM_STATUS_LABELS[appt.status] + '</span>' +
    '</div>' +
    '<div class="appt-meta">' +
      '<span><i data-lucide="calendar"></i> ' + appt.appointment_date + '</span>' +
      '<span><i data-lucide="clock"></i> ' + appt.appointment_time + '</span>' +
      phoneHtml +
    '</div>' +
    '<div class="appt-price">$' + Number(appt.price).toFixed(2) + '</div>' +
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
  await loadClientsLoyalty();
}

var contextMenusReady = false;
function setupAppointmentContextMenus() {
  if (contextMenusReady) return; // los contenedores no se reemplazan, solo su contenido
  if (typeof attachContextMenu !== "function") return;
  contextMenusReady = true;

  [
    document.getElementById("own-appointments-wrap"),
    document.getElementById("team-appointments-wrap"),
  ].forEach(function (wrapEl) {
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
  });
}

document.addEventListener("click", async function (e) {
  var btn = e.target.closest("[data-action]");
  if (!btn) return;

  var id = btn.dataset.id;
  var action = btn.dataset.action;
  var newStatus = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "completed";

  btn.disabled = true;

  var { error } = await supabaseClient.from("appointments").update({ status: newStatus }).eq("id", id);

  if (error) {
    alert("No se pudo actualizar la cita.");
    console.error(error);
    btn.disabled = false;
    return;
  }

  await loadAppointments();
  await loadEarnings();
  await loadClientsLoyalty();
});


/* ============================================================
   GANANCIAS (KPIs generales + barra por empleado)
   ============================================================ */
async function loadEarnings() {
  var { data, error } = await supabaseClient.from("appointment_earnings").select("*");
  var card = document.getElementById("employee-earnings-card");

  if (error) {
    card.innerHTML = '<p class="dashboard-empty">No se pudieron cargar las ganancias.</p>';
    console.error(error);
    return 0;
  }

  var totalRevenue = 0;
  var totalEmployees = 0; // solo empleados (sin contar al admin)
  var totalAdmin = 0;     // comisión propia del admin + lo que queda para el negocio en TODAS las citas
  var byEmployee = {};    // employee_id -> { earning, shop }

  data.forEach(function (row) {
    var earning = Number(row.performer_earning);
    var shop = Number(row.shop_earning);
    totalRevenue += earning + shop;
    totalAdmin += shop; // el negocio (admin) se queda con esto de TODAS las citas

    if (row.employee_id === currentAdminId) {
      totalAdmin += earning; // su propia comisión como barbero
    } else {
      totalEmployees += earning;
    }

    if (!byEmployee[row.employee_id]) byEmployee[row.employee_id] = { earning: 0, shop: 0 };
    byEmployee[row.employee_id].earning += earning;
    byEmployee[row.employee_id].shop += shop;
  });

  document.getElementById("kpi-revenue").textContent = "$" + totalRevenue.toFixed(2);
  document.getElementById("kpi-employees-total").textContent = "$" + totalEmployees.toFixed(2);
  document.getElementById("kpi-admin-total").textContent = "$" + totalAdmin.toFixed(2);
  var maxEarning = Math.max.apply(null, Object.keys(byEmployee).map(function (id) {
    return id === currentAdminId ? byEmployee[id].earning + byEmployee[id].shop : byEmployee[id].earning;
  }).concat([0.01]));

  var ids = Object.keys(byEmployee);
  if (!ids.length) {
    card.innerHTML = '<p class="dashboard-empty">Todavía no hay citas completadas.</p>';
    lastCitasAdminTotal = totalAdmin;
    return totalAdmin;
  }

  card.innerHTML = "";
  ids.forEach(function (id) {
    var name = profilesById[id] ? profilesById[id].full_name : "—";
    var isAdmin = id === currentAdminId;
    // Para el admin, sus citas son 100% para él (su comisión + lo que
    // normalmente queda para "el negocio", porque el negocio es él).
    var value = isAdmin ? byEmployee[id].earning + byEmployee[id].shop : byEmployee[id].earning;
    var pct = (value / maxEarning) * 100;

    var row = document.createElement("div");
    row.className = "earnings-row";
    row.innerHTML =
      '<div class="earnings-row-top">' +
        '<span class="earnings-row-name">' + name + (isAdmin ? " (tú)" : "") + '</span>' +
        '<span class="earnings-row-value">$' + value.toFixed(2) + '</span>' +
      '</div>' +
      '<div class="earnings-track"><div class="earnings-fill' + (isAdmin ? " blue" : "") + '" style="width:' + pct + '%"></div></div>';
    card.appendChild(row);
  });

  lastCitasAdminTotal = totalAdmin;
    return totalAdmin;
}


/* ============================================================
   COMPRAS PENDIENTES DE PAGO (Nequi/Bancolombia manual)
   El admin revisa que sí llegó la plata y la marca a mano.
   ============================================================ */
async function loadPendingPurchases() {
  var list = document.getElementById("pending-purchases-list");

  var { data, error } = await supabaseClient
    .from("purchases")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    list.innerHTML = '<p class="dashboard-empty">No se pudieron cargar las compras pendientes.</p>';
    console.error(error);
    return;
  }

  if (!data.length) {
    list.innerHTML = '<p class="dashboard-empty">No hay compras pendientes de confirmar.</p>';
    return;
  }

  list.innerHTML = "";
  data.forEach(function (purchase) {
    var clientProfile = profilesById[purchase.client_id];
    var clientName = clientProfile ? clientProfile.full_name : "Cliente";
    var date = new Date(purchase.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    var itemsHtml = purchase.items.map(function (item) {
      return '<div class="purchase-item-row"><span>' + item.name + ' x' + item.qty + '</span><span>$' + (item.price * item.qty).toFixed(2) + '</span></div>';
    }).join("");

    var card = document.createElement("article");
    card.className = "dash-card purchase-card";
    card.innerHTML =
      '<div class="purchase-top"><span class="purchase-date">' + clientName + ' · ' + date + '</span>' +
      '<span class="purchase-total">$' + Number(purchase.total).toFixed(2) + '</span></div>' +
      '<div class="purchase-items">' + itemsHtml + '</div>' +
      '<div class="appt-actions" style="margin-top:14px;">' +
        '<button class="appt-btn appt-btn-accept" data-purchase-action="approved" data-purchase-id="' + purchase.id + '"><i data-lucide="check"></i> Marcar pagada</button>' +
        '<button class="appt-btn appt-btn-reject" data-purchase-action="declined" data-purchase-id="' + purchase.id + '"><i data-lucide="x"></i> Rechazar</button>' +
      '</div>';
    list.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

document.addEventListener("click", async function (e) {
  var btn = e.target.closest("[data-purchase-action]");
  if (!btn) return;

  btn.disabled = true;
  var { error } = await supabaseClient
    .from("purchases")
    .update({ status: btn.dataset.purchaseAction })
    .eq("id", btn.dataset.purchaseId);

  if (error) {
    alert("No se pudo actualizar la compra.");
    console.error(error);
    btn.disabled = false;
    return;
  }

  await loadPendingPurchases();
  await loadProductSales(lastCitasAdminTotal);
});


/* ============================================================
   VENTAS DE LA TIENDA (PRODUCTOS) — 100% para el admin, aparte
   de lo que se reparte en las citas.
   ============================================================ */
async function loadProductSales(citasAdminTotal) {
  var { data, error } = await supabaseClient.from("purchases").select("total").eq("status", "approved");

  var totalProducts = 0;
  if (!error && data) {
    totalProducts = data.reduce(function (sum, p) { return sum + Number(p.total); }, 0);
  } else if (error) {
    console.error(error);
  }

  document.getElementById("kpi-products-total").textContent = "$" + totalProducts.toFixed(2);
  document.getElementById("kpi-products-count").textContent = (data ? data.length : 0);
  document.getElementById("kpi-grand-total").textContent = "$" + (Number(citasAdminTotal || 0) + totalProducts).toFixed(2);
}


/* ============================================================
   FIDELIDAD DE CLIENTES
   ============================================================ */
async function loadClientsLoyalty() {
  var list = document.getElementById("clients-loyalty-list");

  var { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("role", "client")
    .order("completed_cuts", { ascending: false });

  if (error) {
    list.innerHTML = '<p class="dashboard-empty">No se pudo cargar la fidelidad de clientes.</p>';
    console.error(error);
    return;
  }

  if (!data.length) {
    list.innerHTML = '<p class="dashboard-empty">Todavía no hay clientes registrados.</p>';
    return;
  }

  list.innerHTML = "";
  data.forEach(function (client) {
    var pos = (client.completed_cuts || 0) % 6;
    var dotsHtml = "";
    for (var i = 0; i < 6; i++) {
      var cls = "loyalty-dot" + (i === 5 ? " free" : "") + (i < pos ? " filled" : "");
      dotsHtml += '<div class="' + cls + '"></div>';
    }

    var card = document.createElement("article");
    card.className = "dash-card loyalty-card";
    card.innerHTML =
      '<div class="loyalty-top"><span class="loyalty-name">' + (client.full_name || "Cliente") + '</span>' +
      '<span class="loyalty-count">' + pos + ' / 6</span></div>' +
      '<div class="loyalty-track">' + dotsHtml + '</div>' +
      (pos === 5 ? '<p class="loyalty-message ready">Próximo corte gratis</p>' : '');
    list.appendChild(card);
  });
}


/* ============================================================
   VINCULAR EMPLEADO
   ============================================================ */
function setupLinkEmployeeForm() {
  var form = document.getElementById("link-employee-form");
  var msgEl = document.getElementById("link-employee-msg");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    msgEl.textContent = "";
    msgEl.className = "dash-form-msg";

    var uuid = document.getElementById("emp-uuid").value.trim();
    var name = document.getElementById("emp-name").value.trim();
    var phone = document.getElementById("emp-phone").value.trim();
    var commission = parseFloat(document.getElementById("emp-commission").value);

    if (!uuid || !name) {
      msgEl.textContent = "Completa al menos el UUID y el nombre.";
      msgEl.classList.add("error");
      return;
    }

    var { error } = await supabaseClient.from("profiles").upsert({
      id: uuid,
      role: "employee",
      full_name: name,
      phone: phone,
      commission_percentage: commission,
    });

    if (error) {
      msgEl.textContent = "No se pudo activar: " + error.message;
      msgEl.classList.add("error");
      console.error(error);
      return;
    }

    msgEl.textContent = "Empleado activado correctamente.";
    msgEl.classList.add("ok");
    form.reset();
    document.getElementById("emp-commission").value = 50;
    await loadProfilesCache();
    await loadEarnings();
  });
}