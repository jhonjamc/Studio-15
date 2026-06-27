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
  document.getElementById("admin-name").textContent = getStaffLabel(profile);
  addBebidasNavLink();

  await loadProfilesCache();
  await loadAppointments();
  var citasAdminTotal = await loadEarnings();
  await loadWeeklyPayouts();
  await loadProductSales(citasAdminTotal);
  await loadPendingPurchases();
  await loadClientsLoyalty();
  setupUserManagement();

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
  var ownArchived = document.getElementById("own-appointments-archived");
  var teamPending = document.getElementById("team-appointments-pending");
  var teamCompleted = document.getElementById("team-appointments-completed");
  var teamArchived = document.getElementById("team-appointments-archived");

  if (error) {
    ownPending.innerHTML = teamPending.innerHTML = '<p class="dashboard-empty">No se pudieron cargar las citas.</p>';
    console.error(error);
    return;
  }

  var own = data.filter(function (a) { return a.employee_id === currentAdminId; });
  var team = data.filter(function (a) { return a.employee_id !== currentAdminId; });

  function isPending(a) { return a.status === "pending" || a.status === "accepted"; }

  var ownActive = own.filter(function (a) { return !a.is_archived; });
  var teamActive = team.filter(function (a) { return !a.is_archived; });
  var ownArch = own.filter(function (a) { return a.is_archived; });
  var teamArch = team.filter(function (a) { return a.is_archived; });

  var ownP = ownActive.filter(isPending), ownC = ownActive.filter(function (a) { return !isPending(a); });
  var teamP = teamActive.filter(isPending), teamC = teamActive.filter(function (a) { return !isPending(a); });

  document.getElementById("kpi-pending-count").textContent =
    data.filter(function (a) { return a.status === "pending" && !a.is_archived; }).length;

  ownPending.innerHTML = ownP.length ? "" : '<p class="dashboard-empty">No tienes citas pendientes.</p>';
  ownP.forEach(function (a) { ownPending.appendChild(buildAppointmentCard(a, false, false)); });

  ownCompleted.innerHTML = ownC.length ? "" : '<p class="dashboard-empty">Sin historial todavía.</p>';
  ownC.forEach(function (a) { ownCompleted.appendChild(buildAppointmentCard(a, false, true)); });

  teamPending.innerHTML = teamP.length ? "" : '<p class="dashboard-empty">El equipo no tiene citas pendientes.</p>';
  teamP.forEach(function (a) { teamPending.appendChild(buildAppointmentCard(a, true, false)); });

  teamCompleted.innerHTML = teamC.length ? "" : '<p class="dashboard-empty">Sin historial todavía.</p>';
  teamC.forEach(function (a) { teamCompleted.appendChild(buildAppointmentCard(a, true, true)); });

  document.getElementById("own-appointments-archive-count").textContent = ownArch.length;
  ownArchived.innerHTML = "";
  ownArch.forEach(function (a) { ownArchived.appendChild(buildArchivedAppointmentCard(a)); });

  document.getElementById("team-appointments-archive-count").textContent = teamArch.length;
  teamArchived.innerHTML = "";
  teamArch.forEach(function (a) { teamArchived.appendChild(buildArchivedAppointmentCard(a)); });

  if (window.lucide) lucide.createIcons();
  setupAppointmentActions();
}

var APPT_SWIPE_ACTIONS = [
  { className: "archive", icon: "archive", label: "Archivar" },
  { className: "delete", icon: "trash-2", label: "Eliminar" },
];

function buildAppointmentCard(appt, showEmployeeName, compact) {
  var wrap = document.createElement("div");
  wrap.className = "swipe-wrap";
  wrap.dataset.apptId = appt.id;

  var card = document.createElement("article");
  card.className = "dash-card appt-card" + (compact ? " compact" : "");

  var employeeLabel = "";
  if (showEmployeeName) {
    var emp = profilesById[appt.employee_id];
    employeeLabel = '<p class="appt-service">Barbero: ' + getStaffLabel(emp) + '</p>';
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
    '<div class="appt-price">' + (appt.is_free ? '<span class="free-badge">🎁 Gratis</span>' : '$' + Number(appt.price).toFixed(2)) + '</div>' +
    actionsHtml;

  wrap.innerHTML = buildSwipeActionsHtml(APPT_SWIPE_ACTIONS);
  wrap.appendChild(card);

  return wrap;
}

function buildArchivedAppointmentCard(appt) {
  var card = document.createElement("article");
  card.className = "dash-card appt-card compact";
  card.innerHTML =
    '<div class="appt-card-top">' +
      '<div><p class="appt-client-name">' + appt.client_name + '</p>' +
      '<p class="appt-service">' + appt.service_name + '</p></div>' +
      '<span class="status-badge ' + appt.status + '">' + ADM_STATUS_LABELS[appt.status] + '</span>' +
    '</div>' +
    '<div class="appt-meta">' +
      '<span><i data-lucide="calendar"></i> ' + appt.appointment_date + '</span>' +
      '<span><i data-lucide="clock"></i> ' + appt.appointment_time + '</span>' +
    '</div>' +
    '<div class="appt-price">' + (appt.is_free ? '<span class="free-badge">🎁 Gratis</span>' : '$' + Number(appt.price).toFixed(2)) + '</div>' +
    '<button type="button" class="unarchive-btn" data-unarchive-appt="' + appt.id + '"><i data-lucide="archive-restore"></i> Desarchivar</button>';
  return card;
}

document.addEventListener("click", async function (e) {
  var unarchiveBtn = e.target.closest("[data-unarchive-appt]");
  if (unarchiveBtn) {
    unarchiveBtn.disabled = true;
    var { error } = await supabaseClient.from("appointments").update({ is_archived: false }).eq("id", unarchiveBtn.dataset.unarchiveAppt);
    if (error) { alert("No se pudo desarchivar."); console.error(error); unarchiveBtn.disabled = false; return; }
    await loadAppointments();
  }
});

/* ============================================================
   ARCHIVAR / ELIMINAR CITA: clic derecho (PC) + swipe (celular)
   ============================================================ */
async function archiveAppointment(id) {
  var { error } = await supabaseClient.from("appointments").update({ is_archived: true }).eq("id", id);
  if (error) { alert("No se pudo archivar la cita."); console.error(error); return; }
  await loadAppointments();
}

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

function toggleArchivedSection(toggleBtnId, listId) {
  var btn = document.getElementById(toggleBtnId);
  var list = document.getElementById(listId);
  if (!btn) return;
  btn.addEventListener("click", function () {
    var showing = list.style.display !== "none";
    list.style.display = showing ? "none" : "";
  });
}

var contextMenusReady = false;
function setupAppointmentActions() {
  toggleArchivedSection("own-appointments-archive-toggle", "own-appointments-archived");
  toggleArchivedSection("team-appointments-archive-toggle", "team-appointments-archived");

  if (contextMenusReady) return; // los contenedores no se reemplazan, solo su contenido
  if (typeof attachContextMenu !== "function") return;
  contextMenusReady = true;

  [
    document.getElementById("own-appointments-wrap"),
    document.getElementById("team-appointments-wrap"),
  ].forEach(function (wrapEl) {
    attachContextMenu(wrapEl, "[data-appt-id]", [
      {
        label: "Archivar cita",
        icon: "archive",
        onClick: function (targetEl) { archiveAppointment(targetEl.dataset.apptId); },
      },
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

    if (typeof attachSwipeActions === "function") {
      attachSwipeActions(wrapEl, ".swipe-wrap", [
        {
          className: "archive", icon: "archive", label: "Archivar",
          onClick: function (wrapElInner) { archiveAppointment(wrapElInner.dataset.apptId); },
        },
        {
          className: "delete", icon: "trash-2", label: "Eliminar",
          onClick: function (wrapElInner) {
            showConfirmDialog("¿Eliminar esta cita? Esta acción no se puede deshacer.", function () {
              deleteAppointment(wrapElInner.dataset.apptId);
            });
          },
        },
      ]);
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
  await loadWeeklyPayouts();
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
    var name = getStaffLabel(profilesById[id]);
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

  var { data: drinkData, error: drinkError } = await supabaseClient.from("drink_sales").select("total");
  var totalDrinks = 0;
  if (!drinkError && drinkData) {
    totalDrinks = drinkData.reduce(function (sum, d) { return sum + Number(d.total); }, 0);
  } else if (drinkError) {
    console.error(drinkError);
  }

  document.getElementById("kpi-products-total").textContent = "$" + totalProducts.toFixed(2);
  document.getElementById("kpi-products-count").textContent = (data ? data.length : 0);
  document.getElementById("kpi-drinks-total-summary").textContent = "$" + totalDrinks.toFixed(2);
  document.getElementById("kpi-grand-total").textContent = "$" + (Number(citasAdminTotal || 0) + totalProducts + totalDrinks).toFixed(2);
}


/* ============================================================
   PAGO SEMANAL POR PUESTO
   Semana actual (lunes a domingo). Cada puesto se queda con su
   comisión, el resto queda para ti. El domingo esto representa
   la semana completa lista para pagar.
   ============================================================ */
async function loadWeeklyPayouts() {
  var list = document.getElementById("weekly-payout-list");

  var now = new Date();
  var day = now.getDay(); // 0 = domingo
  var diffToMonday = day === 0 ? -6 : 1 - day;
  var monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  var mondayStr = monday.toISOString().split("T")[0];

  var { data, error } = await supabaseClient
    .from("appointment_earnings")
    .select("*")
    .gte("appointment_date", mondayStr);

  if (error) {
    list.innerHTML = '<p class="dashboard-empty">No se pudieron cargar los pagos.</p>';
    console.error(error);
    return;
  }

  var byEmployee = {};
  data.forEach(function (row) {
    if (row.employee_id === currentAdminId) return; // a uno mismo no se "paga"
    if (!byEmployee[row.employee_id]) byEmployee[row.employee_id] = 0;
    byEmployee[row.employee_id] += Number(row.performer_earning);
  });

  var ids = Object.keys(byEmployee);
  if (!ids.length) {
    list.innerHTML = '<p class="dashboard-empty">Ningún puesto tiene citas completadas esta semana todavía.</p>';
    return;
  }

  list.innerHTML = "";
  ids.forEach(function (id) {
    var emp = profilesById[id];
    var amount = byEmployee[id];
    var card = document.createElement("article");
    card.className = "dash-card";
    card.innerHTML =
      '<p class="dash-card-label">' + getStaffLabel(emp) + '</p>' +
      '<p class="dash-card-value">$' + amount.toFixed(2) + '</p>' +
      '<p class="dash-card-sub">Eso es lo que le pagas esta semana</p>';
    list.appendChild(card);
  });
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
    var LOYALTY_CYCLE = 11;
    var pos = (client.completed_cuts || 0) % LOYALTY_CYCLE;
    var dotsHtml = "";
    for (var i = 0; i < LOYALTY_CYCLE; i++) {
      var cls = "loyalty-dot" + (i === LOYALTY_CYCLE - 1 ? " free" : "") + (i < pos ? " filled" : "");
      dotsHtml += '<div class="' + cls + '"></div>';
    }

    var card = document.createElement("article");
    card.className = "dash-card loyalty-card";
    card.innerHTML =
      '<div class="loyalty-top"><span class="loyalty-name">' + (client.full_name || "Cliente") + '</span>' +
      '<span class="loyalty-count">' + pos + ' / ' + LOYALTY_CYCLE + '</span></div>' +
      '<div class="loyalty-track">' + dotsHtml + '</div>' +
      (pos === LOYALTY_CYCLE - 1 ? '<p class="loyalty-message ready">Próximo corte gratis</p>' : '');
    list.appendChild(card);
  });
}


/* ============================================================
   ENLACE A BEBIDAS EN EL NAVBAR (solo admin)
   ============================================================ */
function addBebidasNavLink() {
  var label = document.getElementById("dashboard-panel-label");
  if (!label || document.getElementById("bebidas-nav-link")) return;
  var link = document.createElement("a");
  link.id = "bebidas-nav-link";
  link.href = "../bebidas/bebidas.html";
  link.className = "dashboard-panel-label dashboard-bebidas-link";
  link.innerHTML = '<i data-lucide="cup-soda"></i> Bebidas';
  label.insertAdjacentElement("afterend", link);
  if (window.lucide) lucide.createIcons();
}


/* ============================================================
   GESTIONAR USUARIOS: eliminar empleados o clientes
   ⚠️ Borra TAMBIÉN sus citas, compras y reseñas (no se puede
   deshacer). Solo el admin puede hacerlo, y no puede borrarse
   a sí mismo (la Edge Function también lo bloquea).
   ============================================================ */
async function deleteUserAccount(userId) {
  var { data, error } = await supabaseClient.functions.invoke("admin-delete-user", {
    body: { userId: userId },
  });

  if (error || !data || data.error) {
    alert("No se pudo eliminar: " + ((data && data.error) || (error && error.message) || "intenta de nuevo."));
    console.error(error || (data && data.error));
    return;
  }

  await loadProfilesCache();
  await loadEmployeesManageList();
  await loadAppointments();
  await loadEarnings();
  await loadClientsLoyalty();
}

function setupUserManagement() {
  loadEmployeesManageList();

  var findForm = document.getElementById("find-client-form");
  var findMsg = document.getElementById("find-client-msg");
  var foundCard = document.getElementById("found-client-card");

  findForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    findMsg.textContent = "";
    findMsg.className = "dash-form-msg";
    foundCard.innerHTML = "";

    var cedula = document.getElementById("find-client-cedula").value.trim();
    if (!cedula) return;

    var { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("cedula", cedula)
      .maybeSingle();

    if (error || !data) {
      findMsg.textContent = "No se encontró ningún usuario con esa cédula.";
      findMsg.classList.add("error");
      return;
    }

    foundCard.innerHTML =
      '<div class="dash-card">' +
        '<p class="dash-card-label">' + (data.role === "client" ? "Cliente" : data.role === "employee" ? "Empleado" : "Admin") + '</p>' +
        '<p class="dash-card-value" style="font-size:1.3rem;">' + (data.full_name || "Sin nombre") + '</p>' +
        '<p class="dash-card-sub">Cédula: ' + (data.cedula || "—") + ' · Tel: ' + (data.phone || "—") + '</p>' +
        '<button type="button" class="appt-btn appt-btn-reject" style="margin-top:12px;" id="delete-found-user-btn">' +
          '<i data-lucide="trash-2"></i> Eliminar este usuario' +
        '</button>' +
      '</div>';
    if (window.lucide) lucide.createIcons();

    document.getElementById("delete-found-user-btn").addEventListener("click", function () {
      showConfirmDialog(
        "¿Eliminar a " + (data.full_name || "este usuario") + "? Esto borra también sus citas, compras y reseñas. No se puede deshacer.",
        function () {
          deleteUserAccount(data.id);
          foundCard.innerHTML = "";
          findForm.reset();
        }
      );
    });
  });
}

async function loadEmployeesManageList() {
  var list = document.getElementById("employees-manage-list");
  var employees = Object.keys(profilesById)
    .map(function (id) { return profilesById[id]; })
    .filter(function (p) { return p.role === "employee"; });

  if (!employees.length) {
    list.innerHTML = '<p class="dashboard-empty">No tienes empleados todavía.</p>';
    return;
  }

  list.innerHTML = "";
  employees.forEach(function (emp) {
    var card = document.createElement("article");
    card.className = "dash-card";
    card.innerHTML =
      '<p class="dash-card-label">Empleado</p>' +
      '<p class="dash-card-value" style="font-size:1.2rem;">' + getStaffLabel(emp) + '</p>' +
      '<p class="dash-card-sub">Cédula: ' + (emp.cedula || "—") + ' · Comisión: ' + emp.commission_percentage + '%</p>' +
      '<button type="button" class="appt-btn appt-btn-reject" style="margin-top:12px;" data-delete-employee="' + emp.id + '">' +
        '<i data-lucide="trash-2"></i> Eliminar' +
      '</button>';
    list.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

document.addEventListener("click", function (e) {
  var btn = e.target.closest("[data-delete-employee]");
  if (!btn) return;
  var emp = profilesById[btn.dataset.deleteEmployee];
  showConfirmDialog(
    "¿Eliminar a " + getStaffLabel(emp) + "? Esto borra también sus citas. No se puede deshacer.",
    function () { deleteUserAccount(btn.dataset.deleteEmployee); }
  );
});