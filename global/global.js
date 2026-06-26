/* ============================================================================
   ESTUDIO 15 — GLOBAL.JS
   Lógica compartida por TODAS las páginas: header, footer y carrito se
   definen UNA SOLA VEZ aquí y se inyectan en cada página. Para que se
   muestren, cada .html debe tener estos 3 contenedores vacíos:

     <div id="site-header"></div>   (donde quieras el navbar)
     <div id="site-footer"></div>   (donde quieras el footer)
     <div id="site-cart"></div>     (en cualquier parte, es un drawer)

   Índice:
   1. Plantillas (header, footer, carrito)
   2. Inyección de las plantillas en la página
   3. Inicialización general (iconos lucide)
   4. Estado del carrito (localStorage)
   5. Render del carrito
   6. Acciones del carrito (agregar, quitar, cambiar cantidad)
   7. Abrir / cerrar el drawer
   8. Listeners globales (delegación de eventos)
   ============================================================================ */


/* ============================================================
   1. PLANTILLAS
   Edita aquí el header o el footer y se actualiza en TODAS
   las páginas que tengan los contenedores #site-header /
   #site-footer / #site-cart.
   ============================================================ */
var HEADER_TEMPLATE = `
<header class="header" id="top-header">
  <div class="header-inner">
    <a href="../index/index.html" class="logo">
      <span class="logo-icon"><i data-lucide="scissors"></i></span>
      <span class="logo-text">BARBERÍA <span class="accent">ESTUDIO 15</span></span>
    </a>
    <nav class="nav-desktop">
      <a href="../index/index.html#cortes">Cortes</a>
      <a href="../index/index.html#servicios">Servicios</a>
      <a href="../products/products.html">Shop</a>
      <a href="../index/index.html#agendar">Agendar</a>
      <a href="../index/index.html#contacto">Contacto</a>
    </nav>
    <div class="header-actions">
      <button type="button" class="cart-trigger" id="cartTrigger" aria-label="Abrir carrito">
        <i data-lucide="shopping-bag"></i>
        <span class="cart-count" id="cartCount" data-empty="true">0</span>
      </button>
      <a href="../login/login.html" class="btn-shine btn-reservar">
        <i data-lucide="calendar"></i> Iniciar sesión
      </a>
    </div>
  </div>
  <div class="pole-strip"></div>
</header>
`;

var FOOTER_TEMPLATE = `
<footer class="footer">
  <div class="footer-inner">

    <div class="footer-col footer-brand">
      <div class="footer-logo">
        <span class="logo-icon small"><i data-lucide="scissors"></i></span>
        <span class="footer-logo-text">ESTUDIO 15</span>
      </div>
      <p class="footer-desc">Barbería moderna con cortes clásicos, fades, diseños y productos premium para el cuidado del pelo y la barba.</p>
      <div class="footer-social">
        <a href="#" aria-label="Instagram"><i data-lucide="instagram"></i></a>
        <a href="tel:+10000000000" aria-label="Llamar"><i data-lucide="phone"></i></a>
        <a href="#" aria-label="Facebook"><i data-lucide="facebook"></i></a>
      </div>
    </div>

    <div class="footer-col">
      <h4 class="footer-col-title">Navegación</h4>
      <a href="../index/index.html#cortes">Cortes</a>
      <a href="../index/index.html#servicios">Servicios</a>
      <a href="../products/products.html">Shop</a>
      <a href="../index/index.html#agendar">Agendar</a>
    </div>

    <div class="footer-col">
      <h4 class="footer-col-title">Contacto</h4>
      <p><i data-lucide="map-pin"></i> Calle Principal 123, Centro</p>
      <p><i data-lucide="clock"></i> Lun–Sáb · 9:00 — 20:00</p>
      <p><i data-lucide="phone"></i> +1 (000) 000-0000</p>
    </div>

  </div>
</footer>
`;

var CART_TEMPLATE = `
<div class="cart-overlay" id="cartOverlay"></div>
<aside class="cart-drawer" id="cartDrawer" aria-hidden="true">
  <div class="cart-drawer-header">
    <h3>Tu carrito</h3>
    <button type="button" class="cart-close-btn" id="cartCloseBtn" aria-label="Cerrar carrito"><i data-lucide="x"></i></button>
  </div>
  <div class="cart-items" id="cartItems">
    <p class="cart-empty" id="cartEmpty">Tu carrito está vacío.</p>
  </div>
  <div class="cart-drawer-footer">
    <div class="cart-total-row"><span>Total</span><span id="cartTotal">$0.00</span></div>
    <button type="button" class="btn-shine cart-checkout-btn">Finalizar compra</button>
    <p class="cart-checkout-msg" id="cartCheckoutMsg"></p>
  </div>

  <div class="cart-payment-instructions" id="cartPaymentInstructions" style="display:none;">
    <p class="cpi-title">¡Pedido registrado! Total: <span id="cpiTotal">$0.00</span></p>
    <p class="cpi-text">Transfiere a:</p>
    <div class="cpi-method"><strong>Nequi:</strong> <span id="cpiNequi"></span></div>
    <div class="cpi-method"><strong>Bancolombia:</strong> <span id="cpiBancolombia"></span></div>
    <p class="cpi-text">Y envíanos el comprobante para confirmar tu compra:</p>
    <a class="btn-shine cart-checkout-btn" id="cpiWhatsappBtn" target="_blank" rel="noopener">
      Enviar comprobante por WhatsApp
    </a>
    <button type="button" class="cpi-close-btn" id="cpiCloseBtn">Listo, ya transferí</button>
  </div>
</aside>
`;


/* ============================================================
   2. INYECCIÓN DE LAS PLANTILLAS
   Si una página no tiene el contenedor (ej. no quieres carrito
   en alguna página), simplemente no se inyecta nada ahí.
   ============================================================ */
function injectPartials() {
  var headerSlot = document.getElementById("site-header");
  if (headerSlot) headerSlot.innerHTML = HEADER_TEMPLATE;

  var footerSlot = document.getElementById("site-footer");
  if (footerSlot) footerSlot.innerHTML = FOOTER_TEMPLATE;

  var cartSlot = document.getElementById("site-cart");
  if (cartSlot) cartSlot.innerHTML = CART_TEMPLATE;
}


document.addEventListener("DOMContentLoaded", function () {

  /* ============================================================
     3. INICIALIZACIÓN GENERAL
     Importante: los partials se inyectan PRIMERO, porque lucide
     y el carrito necesitan que el header/footer ya existan en
     el DOM.
     ============================================================ */
  injectPartials();

  if (window.lucide) lucide.createIcons();

  initCart();
  updateHeaderAuthState();
});


/* ============================================================
   3.1 ESTADO DE SESIÓN EN EL HEADER
   Si hay sesión activa, el botón "Iniciar sesión" cambia a un
   acceso directo al panel del usuario + un botón para cerrar
   sesión (reutiliza el estilo circular del carrito).
   Requiere que auth.js esté cargado (getCurrentProfile / ROLE_HOME).
   ============================================================ */
async function updateHeaderAuthState() {
  if (typeof getCurrentProfile !== "function") return;

  var profile = await getCurrentProfile();
  var loginBtn = document.querySelector(".btn-reservar");
  if (!profile || !loginBtn) return;

  loginBtn.setAttribute("href", ROLE_HOME[profile.role] || "index.html");
  var firstName = profile.full_name ? profile.full_name.split(" ")[0] : "Mi cuenta";
  loginBtn.innerHTML = '<i data-lucide="user"></i> ' + firstName;

  var actions = document.querySelector(".header-actions");
  if (actions && !actions.querySelector("[data-logout]")) {
    var logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "cart-trigger";
    logoutBtn.setAttribute("data-logout", "");
    logoutBtn.setAttribute("aria-label", "Cerrar sesión");
    logoutBtn.innerHTML = '<i data-lucide="log-out"></i>';
    actions.appendChild(logoutBtn);
  }

  if (window.lucide) lucide.createIcons();
}


/* ============================================================
   4. ESTADO DEL CARRITO (localStorage)
   ============================================================ */
var CART_STORAGE_KEY = "estudio15_cart";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}


function initCart() {
  var trigger = document.getElementById("cartTrigger");
  var overlay = document.getElementById("cartOverlay");
  var drawer = document.getElementById("cartDrawer");
  var closeBtn = document.getElementById("cartCloseBtn");

  if (!drawer || !overlay) return; // la página no tiene carrito incluido

  /* --------------------------------------------------------
     7. ABRIR / CERRAR EL DRAWER
     -------------------------------------------------------- */
  function openCart() {
    drawer.classList.add("open");
    overlay.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    resetCartView();
    var msgEl = document.getElementById("cartCheckoutMsg");
    if (msgEl) { msgEl.textContent = ""; msgEl.className = "cart-checkout-msg"; }
  }
  function closeCart() {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  trigger && trigger.addEventListener("click", openCart);
  closeBtn && closeBtn.addEventListener("click", closeCart);
  overlay.addEventListener("click", closeCart);

  var checkoutBtn = drawer.querySelector(".cart-checkout-btn");
  checkoutBtn && checkoutBtn.addEventListener("click", handleCheckout);

  /* --------------------------------------------------------
     5. RENDER DEL CARRITO
     -------------------------------------------------------- */
  function renderCart() {
    var cart = getCart();
    var itemsWrap = document.getElementById("cartItems");
    var totalEl = document.getElementById("cartTotal");
    var countEl = document.getElementById("cartCount");

    itemsWrap.innerHTML = "";

    if (cart.length === 0) {
      itemsWrap.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
    } else {
      cart.forEach(function (item) {
        var row = document.createElement("div");
        row.className = "cart-item";
        row.dataset.id = item.id;
        row.innerHTML =
          '<div class="cart-item-img"><img src="' + item.img + '" alt="' + item.name + '"></div>' +
          '<div class="cart-item-info">' +
            '<p class="cart-item-name">' + item.name + '</p>' +
            '<p class="cart-item-price">$' + (item.price * item.qty).toFixed(2) + '</p>' +
            '<div class="cart-item-qty">' +
              '<button class="cart-qty-btn" type="button" data-action="dec" aria-label="Disminuir cantidad">-</button>' +
              '<span class="cart-item-qty-value">' + item.qty + '</span>' +
              '<button class="cart-qty-btn" type="button" data-action="inc" aria-label="Aumentar cantidad">+</button>' +
            '</div>' +
          '</div>' +
          '<button class="cart-item-remove" type="button" data-action="remove" aria-label="Quitar producto"><i data-lucide="trash-2"></i></button>';
        itemsWrap.appendChild(row);
      });
      if (window.lucide) lucide.createIcons();
    }

    var total = cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
    totalEl.textContent = "$" + total.toFixed(2);

    var totalQty = cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
    countEl.textContent = totalQty;
    countEl.dataset.empty = totalQty === 0 ? "true" : "false";
  }

  /* --------------------------------------------------------
     6. ACCIONES DEL CARRITO
     -------------------------------------------------------- */
  function addToCart(product) {
    var cart = getCart();
    var existing = cart.find(function (i) { return i.id === product.id; });
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ id: product.id, name: product.name, price: product.price, img: product.img, qty: 1 });
    }
    saveCart(cart);
    renderCart();
    openCart();
  }

  function changeQty(id, delta) {
    var cart = getCart();
    var item = cart.find(function (i) { return i.id === id; });
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(function (i) { return i.id !== id; });
    }
    saveCart(cart);
    renderCart();
  }

  function removeFromCart(id) {
    var cart = getCart().filter(function (i) { return i.id !== id; });
    saveCart(cart);
    renderCart();
  }

  /* --------------------------------------------------------
     Finalizar compra: requiere login, registra el pedido como
     "pending" y le muestra al cliente los datos para transferir
     (Nequi/Bancolombia). El admin lo confirma a mano desde su
     panel cuando vea que llegó la plata.
     -------------------------------------------------------- */
  function showCheckoutMsg(msg, type) {
    var msgEl = document.getElementById("cartCheckoutMsg");
    if (!msgEl) return;
    msgEl.textContent = msg;
    msgEl.className = "cart-checkout-msg" + (type ? " " + type : "");
  }

  function showPaymentInstructions(total, orderRef) {
    document.getElementById("cartItems").style.display = "none";
    document.querySelector(".cart-drawer-footer").style.display = "none";

    document.getElementById("cpiTotal").textContent = "$" + total.toFixed(2);
    document.getElementById("cpiNequi").textContent = PAYMENT_INFO.nequiNumber + " (" + PAYMENT_INFO.nequiName + ")";
    document.getElementById("cpiBancolombia").textContent =
      PAYMENT_INFO.bancolombiaAccountType + " " + PAYMENT_INFO.bancolombiaAccountNumber + " (" + PAYMENT_INFO.bancolombiaName + ")";

    var message = "Hola! Acabo de hacer un pedido en Estudio 15 por $" + total.toFixed(2) +
      " (referencia " + orderRef + "). Aquí va mi comprobante de pago.";
    document.getElementById("cpiWhatsappBtn").href =
      "https://wa.me/" + PAYMENT_INFO.whatsappNumber + "?text=" + encodeURIComponent(message);

    document.getElementById("cartPaymentInstructions").style.display = "block";
  }

  function resetCartView() {
    document.getElementById("cartItems").style.display = "";
    document.querySelector(".cart-drawer-footer").style.display = "";
    document.getElementById("cartPaymentInstructions").style.display = "none";
  }

  async function handleCheckout() {
    var cart = getCart();
    if (!cart.length) {
      showCheckoutMsg("Tu carrito está vacío. Agrega algo antes de comprar.", "error");
      return;
    }

    if (typeof supabaseClient === "undefined" || typeof getCurrentProfile !== "function") {
      showCheckoutMsg("No se pudo conectar con la tienda. Intenta más tarde.", "error");
      return;
    }

    var profile = await getCurrentProfile();
    if (!profile) {
      showCheckoutMsg("Inicia sesión para completar tu compra. Te llevamos...", "error");
      setTimeout(function () { window.location.href = "../login/login.html"; }, 1400);
      return;
    }

    showCheckoutMsg("Registrando tu pedido...", "");

    var total = cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
    var items = cart.map(function (i) { return { name: i.name, price: i.price, qty: i.qty }; });

    var { data, error } = await supabaseClient
      .from("purchases")
      .insert({ client_id: profile.id, items: items, total: total, status: "pending" })
      .select()
      .single();

    if (error) {
      showCheckoutMsg("No se pudo registrar tu pedido. Intenta de nuevo.", "error");
      console.error(error);
      return;
    }

    showCheckoutMsg("", "");
    var orderRef = String(data.id).slice(0, 8).toUpperCase();
    showPaymentInstructions(total, orderRef);
    saveCart([]);
    renderCart();
  }

  var cpiCloseBtn = document.getElementById("cpiCloseBtn");
  cpiCloseBtn && cpiCloseBtn.addEventListener("click", function () {
    resetCartView();
    closeCart();
  });

  /* --------------------------------------------------------
     8. LISTENERS GLOBALES (delegación de eventos)
     Cualquier botón con [data-add-cart] agrega el producto más
     cercano que tenga [data-product] con sus atributos data-*.
     -------------------------------------------------------- */
  document.addEventListener("click", function (e) {
    var addBtn = e.target.closest("[data-add-cart]");
    if (addBtn) {
      var card = addBtn.closest("[data-product]");
      if (!card) return;
      addToCart({
        id: card.dataset.id,
        name: card.dataset.name,
        price: parseFloat(card.dataset.price),
        img: card.dataset.img
      });
      return;
    }

    var qtyBtn = e.target.closest(".cart-qty-btn");
    if (qtyBtn) {
      var row = qtyBtn.closest(".cart-item");
      changeQty(row.dataset.id, qtyBtn.dataset.action === "inc" ? 1 : -1);
      return;
    }

    var removeBtn = e.target.closest('.cart-item-remove');
    if (removeBtn) {
      var row2 = removeBtn.closest(".cart-item");
      removeFromCart(row2.dataset.id);
      return;
    }
  });

  renderCart();
}