/* ============================================================================
   ESTUDIO 15 — CLIENTE.JS
   Panel del cliente: sus citas, su barra de fidelidad y su historial
   de compras. Todo filtrado por RLS a client_id = auth.uid().

   El cliente puede ARCHIVAR cualquier cita/compra (solo la oculta de
   la vista principal, los datos siguen intactos). Solo puede ELIMINAR
   las que sigan en "pendiente" (la base de datos también lo exige).
   ============================================================================ */

var STATUS_LABELS = {
  pending: "Pendiente",
  accepted: "Confirmada",
  rejected: "Rechazada",
  completed: "Completada",
  cancelled: "Cancelada",
};

var PURCHASE_STATUS_LABELS = { pending: "Pendiente", approved: "Aprobada", declined: "Rechazada" };
var PURCHASE_STATUS_BADGE_CLASS = { pending: "pending", approved: "accepted", declined: "rejected" };

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
  setupArchiveToggles();

  if (window.lucide) lucide.createIcons();
});

function setupArchiveToggles() {
  [
    ["appointments-archive-toggle", "appointments-archived"],
    ["purchases-archive-toggle", "purchases-archived"],
  ].forEach(function (pair) {
    var btn = document.getElementById(pair[0]);
    var list = document.getElementById(pair[1]);
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", function () {
      list.style.display = list.style.display === "none" ? "" : "none";
    });
  });
}


/* ============================================================
   BARRA DE FIDELIDAD
   ============================================================ */
var LOYALTY_CYCLE = 11; // el corte número 11 sale gratis

function renderLoyalty(completedCuts) {
  var positionInCycle = completedCuts % LOYALTY_CYCLE; // 0..10
  var track = document.getElementById("loyalty-track");
  var countEl = document.getElementById("loyalty-count");
  var msgEl = document.getElementById("loyalty-message");

  countEl.textContent = positionInCycle + " / " + LOYALTY_CYCLE;

  track.innerHTML = "";
  for (var i = 0; i < LOYALTY_CYCLE; i++) {
    var dot = document.createElement("div");
    dot.className = "loyalty-dot";
    if (i === LOYALTY_CYCLE - 1) dot.classList.add("free");
    if (i < positionInCycle) dot.classList.add("filled");
    track.appendChild(dot);
  }

  if (positionInCycle === LOYALTY_CYCLE - 1) {
    msgEl.textContent = "¡Tu próximo corte es GRATIS! Menciónalo al agendar o en el local.";
    msgEl.classList.add("ready");
  } else {
    var faltan = (LOYALTY_CYCLE - 1) - positionInCycle;
    msgEl.textContent = "Te faltan " + faltan + " corte" + (faltan === 1 ? "" : "s") + " para tu corte " + LOYALTY_CYCLE + " gratis.";
    msgEl.classList.remove("ready");
  }
}


/* ============================================================
   MIS CITAS
   ============================================================ */
var APPT_SWIPE_ACTIONS_BOTH = [
  { className: "archive", icon: "archive", label: "Archivar" },
  { className: "delete", icon: "trash-2", label: "Eliminar" },
];

function appointmentCardHtml(appt) {
  return (
    '<div class="appt-card-top">' +
      '<div><p class="appt-client-name">' + appt.service_name + '</p>' +
      '<p class="appt-service">' + (appt.is_free ? '<span class="free-badge">🎁 Gratis</span>' : '$' + Number(appt.price).toFixed(2)) + '</p></div>' +
      '<span class="status-badge ' + appt.status + '">' + STATUS_LABELS[appt.status] + '</span>' +
    '</div>' +
    '<div class="appt-meta">' +
      '<span><i data-lucide="calendar"></i> ' + formatDateEs(appt.appointment_date) + '</span>' +
      '<span><i data-lucide="clock"></i> ' + appt.appointment_time + '</span>' +
    '</div>'
  );
}

async function loadAppointments(clientId) {
  var list = document.getElementById("appointments-list");
  var archivedList = document.getElementById("appointments-archived");

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

  var active = data.filter(function (a) { return !a.is_archived; });
  var archived = data.filter(function (a) { return a.is_archived; });

  list.innerHTML = active.length ? "" : '<p class="dashboard-empty">Todavía no tienes citas agendadas.</p>';
  active.forEach(function (appt) {
    var wrap = document.createElement("div");
    wrap.className = "swipe-wrap";
    wrap.dataset.apptId = appt.id;
    wrap.innerHTML = buildSwipeActionsHtml(APPT_SWIPE_ACTIONS_BOTH);
    var card = document.createElement("article");
    card.className = "dash-card appt-card";
    card.innerHTML = appointmentCardHtml(appt);
    wrap.appendChild(card);
    list.appendChild(wrap);
  });

  document.getElementById("appointments-archive-count").textContent = archived.length;
  archivedList.innerHTML = "";
  archived.forEach(function (appt) {
    var card = document.createElement("article");
    card.className = "dash-card appt-card compact";
    card.innerHTML = appointmentCardHtml(appt) +
      '<button type="button" class="unarchive-btn" data-unarchive-appt="' + appt.id + '"><i data-lucide="archive-restore"></i> Desarchivar</button>';
    archivedList.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
  setupAppointmentActionsForClient();
}

async function archiveOwnAppointment(id) {
  var { error } = await supabaseClient.from("appointments").update({ is_archived: true }).eq("id", id);
  if (error) { alert("No se pudo archivar la cita."); console.error(error); return; }
  var profile = await getCurrentProfile();
  await loadAppointments(profile.id);
}

async function deleteOwnAppointment(id) {
  var { error } = await supabaseClient.from("appointments").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar la cita. Recuerda que solo se pueden eliminar las que sigan pendientes.");
    console.error(error);
    return;
  }
  var profile = await getCurrentProfile();
  await loadAppointments(profile.id);
}

document.addEventListener("click", async function (e) {
  var unarchiveBtn = e.target.closest("[data-unarchive-appt]");
  if (unarchiveBtn) {
    unarchiveBtn.disabled = true;
    var { error } = await supabaseClient.from("appointments").update({ is_archived: false }).eq("id", unarchiveBtn.dataset.unarchiveAppt);
    if (error) { alert("No se pudo desarchivar."); console.error(error); unarchiveBtn.disabled = false; return; }
    var profile = await getCurrentProfile();
    await loadAppointments(profile.id);
  }
});

var clientApptActionsReady = false;
function setupAppointmentActionsForClient() {
  if (clientApptActionsReady) return; // el contenedor no se reemplaza, solo su contenido
  if (typeof attachContextMenu !== "function") return;
  clientApptActionsReady = true;

  var listEl = document.getElementById("appointments-list");

  attachContextMenu(listEl, "[data-appt-id]", [
    {
      label: "Archivar cita",
      icon: "archive",
      onClick: function (targetEl) { archiveOwnAppointment(targetEl.dataset.apptId); },
    },
    {
      label: "Eliminar cita (solo pendientes)",
      icon: "trash-2",
      onClick: function (targetEl) {
        showConfirmDialog("¿Eliminar esta cita? Solo funciona si sigue pendiente. Esta acción no se puede deshacer.", function () {
          deleteOwnAppointment(targetEl.dataset.apptId);
        });
      },
    },
  ]);

  if (typeof attachSwipeActions === "function") {
    attachSwipeActions(listEl, ".swipe-wrap", [
      {
        className: "archive", icon: "archive", label: "Archivar",
        onClick: function (wrapElInner) { archiveOwnAppointment(wrapElInner.dataset.apptId); },
      },
      {
        className: "delete", icon: "trash-2", label: "Eliminar",
        onClick: function (wrapElInner) {
          showConfirmDialog("¿Eliminar esta cita pendiente? Esta acción no se puede deshacer.", function () {
            deleteOwnAppointment(wrapElInner.dataset.apptId);
          });
        },
      },
    ]);
  }
}


/* ============================================================
   HISTORIAL DE COMPRAS
   ============================================================ */
var PURCHASE_SWIPE_ACTIONS_BOTH = [
  { className: "archive", icon: "archive", label: "Archivar" },
  { className: "delete", icon: "trash-2", label: "Eliminar" },
];

function purchaseCardHtml(purchase) {
  var date = new Date(purchase.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  var itemsHtml = purchase.items.map(function (item) {
    return '<div class="purchase-item-row"><span>' + item.name + ' x' + item.qty + '</span><span>$' + (item.price * item.qty).toFixed(2) + '</span></div>';
  }).join("");
  var status = purchase.status || "pending";

  return (
    '<div class="purchase-top"><span class="purchase-date">' + date + '</span>' +
    '<span class="purchase-total">$' + Number(purchase.total).toFixed(2) + '</span></div>' +
    '<span class="status-badge ' + PURCHASE_STATUS_BADGE_CLASS[status] + '">' + PURCHASE_STATUS_LABELS[status] + '</span>' +
    '<div class="purchase-items">' + itemsHtml + '</div>'
  );
}

async function loadPurchases(clientId) {
  var list = document.getElementById("purchases-list");
  var archivedList = document.getElementById("purchases-archived");

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

  var active = data.filter(function (p) { return !p.is_archived; });
  var archived = data.filter(function (p) { return p.is_archived; });

  list.innerHTML = active.length ? "" : '<p class="dashboard-empty">Todavía no tienes compras registradas.</p>';
  active.forEach(function (purchase) {
    var wrap = document.createElement("div");
    wrap.className = "swipe-wrap";
    wrap.dataset.purchaseId = purchase.id;
    wrap.innerHTML = buildSwipeActionsHtml(PURCHASE_SWIPE_ACTIONS_BOTH);
    var card = document.createElement("article");
    card.className = "dash-card purchase-card";
    card.innerHTML = purchaseCardHtml(purchase);
    wrap.appendChild(card);
    list.appendChild(wrap);
  });

  document.getElementById("purchases-archive-count").textContent = archived.length;
  archivedList.innerHTML = "";
  archived.forEach(function (purchase) {
    var card = document.createElement("article");
    card.className = "dash-card purchase-card compact";
    card.innerHTML = purchaseCardHtml(purchase) +
      '<button type="button" class="unarchive-btn" data-unarchive-purchase="' + purchase.id + '"><i data-lucide="archive-restore"></i> Desarchivar</button>';
    archivedList.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
  setupPurchaseActionsForClient();
}

async function archiveOwnPurchase(id) {
  var { error } = await supabaseClient.from("purchases").update({ is_archived: true }).eq("id", id);
  if (error) { alert("No se pudo archivar la compra."); console.error(error); return; }
  var profile = await getCurrentProfile();
  await loadPurchases(profile.id);
}

async function deleteOwnPurchase(id) {
  var { error } = await supabaseClient.from("purchases").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar la compra. Recuerda que solo se pueden eliminar las que sigan pendientes.");
    console.error(error);
    return;
  }
  var profile = await getCurrentProfile();
  await loadPurchases(profile.id);
}

document.addEventListener("click", async function (e) {
  var unarchiveBtn = e.target.closest("[data-unarchive-purchase]");
  if (unarchiveBtn) {
    unarchiveBtn.disabled = true;
    var { error } = await supabaseClient.from("purchases").update({ is_archived: false }).eq("id", unarchiveBtn.dataset.unarchivePurchase);
    if (error) { alert("No se pudo desarchivar."); console.error(error); unarchiveBtn.disabled = false; return; }
    var profile = await getCurrentProfile();
    await loadPurchases(profile.id);
  }
});

var clientPurchaseActionsReady = false;
function setupPurchaseActionsForClient() {
  if (clientPurchaseActionsReady) return; // el contenedor no se reemplaza, solo su contenido
  if (typeof attachContextMenu !== "function") return;
  clientPurchaseActionsReady = true;

  var listEl = document.getElementById("purchases-list");

  attachContextMenu(listEl, "[data-purchase-id]", [
    {
      label: "Archivar compra",
      icon: "archive",
      onClick: function (targetEl) { archiveOwnPurchase(targetEl.dataset.purchaseId); },
    },
    {
      label: "Eliminar compra (solo pendientes)",
      icon: "trash-2",
      onClick: function (targetEl) {
        showConfirmDialog("¿Eliminar esta compra? Solo funciona si sigue pendiente. Esta acción no se puede deshacer.", function () {
          deleteOwnPurchase(targetEl.dataset.purchaseId);
        });
      },
    },
  ]);

  if (typeof attachSwipeActions === "function") {
    attachSwipeActions(listEl, ".swipe-wrap", [
      {
        className: "archive", icon: "archive", label: "Archivar",
        onClick: function (wrapElInner) { archiveOwnPurchase(wrapElInner.dataset.purchaseId); },
      },
      {
        className: "delete", icon: "trash-2", label: "Eliminar",
        onClick: function (wrapElInner) {
          showConfirmDialog("¿Eliminar esta compra pendiente? Esta acción no se puede deshacer.", function () {
            deleteOwnPurchase(wrapElInner.dataset.purchaseId);
          });
        },
      },
    ]);
  }
}