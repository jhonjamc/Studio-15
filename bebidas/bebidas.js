/* ============================================================================
   ESTUDIO 15 — BEBIDAS.JS
   Registro manual de ventas de bebidas (solo admin). No pasa por el
   carrito de los clientes — esta ganancia es 100% del admin.
   ============================================================================ */

document.addEventListener("DOMContentLoaded", async function () {

  var profile = await requireRole(["admin", "drinks_admin"]);
  if (!profile) return;

  currentDrinksProfile = profile;
  setupDrinkSaleForm(profile.id);
  await loadDrinkSales();

  if (window.lucide) lucide.createIcons();
});

var currentDrinksProfile = null;

function setupDrinkSaleForm(adminId) {
  var form = document.getElementById("drink-sale-form");
  var msgEl = document.getElementById("drink-sale-msg");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    msgEl.textContent = "";
    msgEl.className = "dash-form-msg";

    var select = document.getElementById("drink-name");
    var customName = document.getElementById("drink-name-custom").value.trim();
    var name = select.value === "Otra" ? customName : select.value;
    var price = parseFloat(document.getElementById("drink-price").value);
    var qty = parseInt(document.getElementById("drink-qty").value, 10);

    if (!name || !price || !qty) {
      msgEl.textContent = "Completa la bebida, el precio y la cantidad.";
      msgEl.classList.add("error");
      return;
    }

    var total = price * qty;

    var { error } = await supabaseClient.from("drink_sales").insert({
      drink_name: name,
      unit_price: price,
      quantity: qty,
      total: total,
      created_by: adminId,
    });

    if (error) {
      msgEl.textContent = "No se pudo registrar la venta.";
      msgEl.classList.add("error");
      console.error(error);
      return;
    }

    msgEl.textContent = "¡Venta registrada! $" + total.toFixed(2);
    msgEl.classList.add("ok");
    form.reset();
    document.getElementById("drink-qty").value = 1;

    await loadDrinkSales();
  });
}

async function loadDrinkSales() {
  var list = document.getElementById("drink-sales-list");

  var { data, error } = await supabaseClient
    .from("drink_sales")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    list.innerHTML = '<p class="dashboard-empty">No se pudieron cargar las ventas.</p>';
    console.error(error);
    return;
  }

  // --- KPIs ---
  var now = new Date();
  var todayStr = now.toISOString().split("T")[0];

  var day = now.getDay();
  var diffToMonday = day === 0 ? -6 : 1 - day;
  var monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  var totalToday = 0, totalWeek = 0, totalAll = 0;
  data.forEach(function (sale) {
    var saleDate = new Date(sale.created_at);
    totalAll += Number(sale.total);
    if (sale.created_at.split("T")[0] === todayStr) totalToday += Number(sale.total);
    if (saleDate >= monday) totalWeek += Number(sale.total);
  });

  document.getElementById("kpi-drinks-today").textContent = "$" + totalToday.toFixed(2);
  document.getElementById("kpi-drinks-week").textContent = "$" + totalWeek.toFixed(2);
  document.getElementById("kpi-drinks-total").textContent = "$" + totalAll.toFixed(2);

  // --- Listado ---
  if (!data.length) {
    list.innerHTML = '<p class="dashboard-empty">Todavía no has registrado ninguna venta.</p>';
    return;
  }

  var isRealAdmin = currentDrinksProfile && currentDrinksProfile.role === "admin";

  list.innerHTML = "";
  data.forEach(function (sale) {
    var date = new Date(sale.created_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    var cardHtml =
      '<p class="dash-card-label">' + date + '</p>' +
      '<p class="dash-card-value" style="font-size:1.2rem;">' + sale.drink_name + ' x' + sale.quantity + '</p>' +
      '<p class="dash-card-sub">$' + Number(sale.unit_price).toFixed(2) + ' c/u</p>' +
      '<p class="appt-price">$' + Number(sale.total).toFixed(2) + '</p>';

    if (isRealAdmin) {
      var wrap = document.createElement("div");
      wrap.className = "swipe-wrap";
      wrap.dataset.saleId = sale.id;
      wrap.innerHTML = buildSwipeActionsHtml([{ className: "delete", icon: "trash-2", label: "Eliminar" }]);
      var card = document.createElement("article");
      card.className = "dash-card";
      card.innerHTML = cardHtml;
      wrap.appendChild(card);
      list.appendChild(wrap);
    } else {
      var plainCard = document.createElement("article");
      plainCard.className = "dash-card";
      plainCard.innerHTML = cardHtml;
      list.appendChild(plainCard);
    }
  });

  if (isRealAdmin) setupDrinkSaleDelete();
  if (window.lucide) lucide.createIcons();
}

/* ============================================================
   ELIMINAR VENTA (solo admin de verdad, nunca el encargado)
   ============================================================ */
async function deleteDrinkSale(id) {
  var { error } = await supabaseClient.from("drink_sales").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar la venta.");
    console.error(error);
    return;
  }
  await loadDrinkSales();
}

var drinkSaleDeleteReady = false;
function setupDrinkSaleDelete() {
  if (drinkSaleDeleteReady) return; // el contenedor no se reemplaza, solo su contenido
  if (typeof attachContextMenu !== "function") return;
  drinkSaleDeleteReady = true;

  var listEl = document.getElementById("drink-sales-list");

  attachContextMenu(listEl, "[data-sale-id]", [
    {
      label: "Eliminar venta",
      icon: "trash-2",
      onClick: function (targetEl) {
        showConfirmDialog("¿Eliminar esta venta? Esta acción no se puede deshacer.", function () {
          deleteDrinkSale(targetEl.dataset.saleId);
        });
      },
    },
  ]);

  if (typeof attachSwipeActions === "function") {
    attachSwipeActions(listEl, ".swipe-wrap", [
      {
        className: "delete", icon: "trash-2", label: "Eliminar",
        onClick: function (wrapElInner) {
          showConfirmDialog("¿Eliminar esta venta? Esta acción no se puede deshacer.", function () {
            deleteDrinkSale(wrapElInner.dataset.saleId);
          });
        },
      },
    ]);
  }
}