/* ============================================================================
   ESTUDIO 15 — CONTEXT-MENU.JS
   Acciones sobre una card (cita o compra):
   - PC: clic derecho → menú contextual con varias opciones.
   - Celular: deslizar hacia la izquierda → aparecen los botones
     (estilo iPhone), uno al lado del otro si hay más de una acción.
   Más un cuadro de confirmación propio (nada de confirm() feo).

   Uso:
   attachContextMenu(contenedor, '[data-row-id]', [
     { label: "Archivar", icon: "archive", onClick: function (targetEl) { ... } },
     { label: "Eliminar", icon: "trash-2", onClick: function (targetEl) { ... } },
   ]);
   attachSwipeActions(contenedor, '.swipe-wrap', [
     { className: "archive", icon: "archive", label: "Archivar", onClick: function (wrapEl, closeFn) { ... } },
     { className: "delete", icon: "trash-2", label: "Eliminar", onClick: function (wrapEl, closeFn) { ... } },
   ]);
   showConfirmDialog("¿Seguro?", function () { ... });
   ============================================================================ */


/* ============================================================
   CUADRO DE CONFIRMACIÓN PROPIO (reemplaza confirm())
   ============================================================ */
function showConfirmDialog(message, onConfirm) {
  var overlay = document.createElement("div");
  overlay.className = "confirm-overlay";
  overlay.innerHTML =
    '<div class="confirm-box">' +
      '<p class="confirm-message">' + message + '</p>' +
      '<div class="confirm-actions">' +
        '<button type="button" class="confirm-btn confirm-cancel">Cancelar</button>' +
        '<button type="button" class="confirm-btn confirm-delete">Confirmar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  function close() { overlay.remove(); }

  overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
  overlay.querySelector(".confirm-cancel").addEventListener("click", close);
  overlay.querySelector(".confirm-delete").addEventListener("click", function () {
    close();
    onConfirm();
  });
}


/* ============================================================
   MENÚ CONTEXTUAL (solo PC, clic derecho)
   ============================================================ */
function attachContextMenu(container, targetSelector, items) {
  if (!container) return;
  var menuEl = null;

  function closeMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
    document.removeEventListener("click", closeMenu);
    document.removeEventListener("scroll", closeMenu, true);
  }

  function openMenu(x, y, targetEl) {
    closeMenu();
    menuEl = document.createElement("div");
    menuEl.className = "ctx-menu";

    items.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ctx-menu-item";
      btn.innerHTML = (item.icon ? '<i data-lucide="' + item.icon + '"></i> ' : "") + item.label;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeMenu();
        item.onClick(targetEl);
      });
      menuEl.appendChild(btn);
    });

    document.body.appendChild(menuEl);
    if (window.lucide) lucide.createIcons();

    var menuWidth = menuEl.offsetWidth;
    var menuHeight = menuEl.offsetHeight;
    var maxX = window.innerWidth - menuWidth - 8;
    var maxY = window.innerHeight - menuHeight - 8;
    menuEl.style.left = Math.max(8, Math.min(x, maxX)) + "px";
    menuEl.style.top = Math.max(8, Math.min(y, maxY)) + "px";

    setTimeout(function () {
      document.addEventListener("click", closeMenu);
      document.addEventListener("scroll", closeMenu, true);
    }, 0);
  }

  container.addEventListener("contextmenu", function (e) {
    var targetEl = e.target.closest(targetSelector);
    if (!targetEl) return;
    e.preventDefault();
    openMenu(e.clientX, e.clientY, targetEl);
  });
}


/* ============================================================
   SWIPE DE ACCIONES (solo celular, estilo iPhone)
   Requiere que cada card esté envuelta así:
   <div class="swipe-wrap" data-row-id="...">
     <div class="swipe-actions">
       <button class="swipe-action archive">...</button>
       <button class="swipe-action delete">...</button>
     </div>
     <article class="dash-card ...">...</article>
   </div>
   ============================================================ */
function attachSwipeActions(container, wrapSelector, actions) {
  if (!container) return;
  var ACTION_WIDTH = 84;
  var REVEAL = ACTION_WIDTH * actions.length;
  var openWrap = null;
  var startX, startY, baseX, dragging, activeWrap, activeCard;

  function setTransform(card, x, animate) {
    card.style.transition = animate ? "transform .2s ease" : "none";
    card.style.transform = "translateX(" + x + "px)";
  }

  function getTranslateX(card) {
    var m = window.getComputedStyle(card).transform;
    if (!m || m === "none") return 0;
    var match = m.match(/matrix\(([^)]+)\)/);
    return match ? parseFloat(match[1].split(",")[4]) : 0;
  }

  function closeWrap(wrap) {
    var card = wrap.querySelector(".dash-card");
    if (card) setTransform(card, 0, true);
    wrap.classList.remove("swiped-open");
    if (openWrap === wrap) openWrap = null;
  }

  container.addEventListener("touchstart", function (e) {
    var wrap = e.target.closest(wrapSelector);
    if (!wrap) return;
    if (openWrap && openWrap !== wrap) closeWrap(openWrap);

    activeWrap = wrap;
    activeCard = wrap.querySelector(".dash-card");
    baseX = wrap.classList.contains("swiped-open") ? -REVEAL : 0;
    var t = e.touches[0];
    startX = t.clientX; startY = t.clientY; dragging = false;
  }, { passive: true });

  container.addEventListener("touchmove", function (e) {
    if (!activeWrap) return;
    var t = e.touches[0];
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;

    if (!dragging) {
      if (Math.abs(dy) > Math.abs(dx) + 4) { activeWrap = null; return; } // es scroll vertical
      if (Math.abs(dx) > 6) dragging = true;
    }
    if (!dragging) return;

    var x = Math.min(0, Math.max(baseX + dx, -REVEAL - 16));
    setTransform(activeCard, x, false);
  }, { passive: true });

  container.addEventListener("touchend", function () {
    if (!activeWrap || !dragging) { activeWrap = null; return; }

    var wrap = activeWrap, card = activeCard;
    var x = getTranslateX(card);

    if (x <= -REVEAL / 2) {
      setTransform(card, -REVEAL, true);
      wrap.classList.add("swiped-open");
      openWrap = wrap;
    } else {
      setTransform(card, 0, true);
      wrap.classList.remove("swiped-open");
      if (openWrap === wrap) openWrap = null;
    }

    activeWrap = null; activeCard = null; dragging = false;
  });

  // Tap en cualquiera de los botones revelados
  container.addEventListener("click", function (e) {
    var btn = e.target.closest(".swipe-action");
    if (!btn) return;
    var wrap = btn.closest(wrapSelector);
    if (!wrap) return;
    var index = Array.prototype.indexOf.call(btn.parentNode.children, btn);
    var action = actions[index];
    if (action) action.onClick(wrap, function () { closeWrap(wrap); });
  });

  // Tocar afuera cierra el que esté abierto
  document.addEventListener("touchstart", function (e) {
    if (openWrap && !openWrap.contains(e.target)) closeWrap(openWrap);
  }, { passive: true });
}

/* Construye el HTML de los botones de swipe a partir de la misma
   lista de acciones que se le pasa a attachSwipeActions. */
function buildSwipeActionsHtml(actions) {
  return '<div class="swipe-actions">' +
    actions.map(function (a) {
      return '<button type="button" class="swipe-action ' + (a.className || "") + '">' +
        '<i data-lucide="' + a.icon + '"></i> ' + a.label +
      '</button>';
    }).join("") +
  '</div>';
}