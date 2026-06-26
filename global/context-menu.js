/* ============================================================================
   ESTUDIO 15 — CONTEXT-MENU.JS
   Acciones para eliminar una cita:
   - PC: clic derecho → menú contextual.
   - Celular: deslizar hacia la izquierda → aparece "Eliminar" (estilo iPhone).
   Más un cuadro de confirmación propio (nada de confirm() feo del navegador).

   Uso:
   attachContextMenu(contenedor, '[data-appt-id]', [
     { label: "Eliminar cita", icon: "trash-2", onClick: function (targetEl) { ... } }
   ]);
   attachSwipeToDelete(contenedor, '.appt-swipe-wrap', function (wrapEl, closeFn) { ... });
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
        '<button type="button" class="confirm-btn confirm-delete">Eliminar</button>' +
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
   SWIPE TO DELETE (solo celular, estilo iPhone)
   Requiere que cada card esté envuelta así:
   <div class="appt-swipe-wrap" data-appt-id="...">
     <div class="appt-swipe-action">...</div>
     <article class="dash-card appt-card">...</article>
   </div>
   ============================================================ */
function attachSwipeToDelete(container, wrapSelector, onDelete) {
  if (!container) return;
  var REVEAL = 84;
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
    var card = wrap.querySelector(".appt-card");
    if (card) setTransform(card, 0, true);
    wrap.classList.remove("swiped-open");
    if (openWrap === wrap) openWrap = null;
  }

  container.addEventListener("touchstart", function (e) {
    var wrap = e.target.closest(wrapSelector);
    if (!wrap) return;
    if (openWrap && openWrap !== wrap) closeWrap(openWrap);

    activeWrap = wrap;
    activeCard = wrap.querySelector(".appt-card");
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

  // Tap en el botón rojo "Eliminar" que queda revelado
  container.addEventListener("click", function (e) {
    var actionBtn = e.target.closest(".appt-swipe-action");
    if (!actionBtn) return;
    var wrap = actionBtn.closest(wrapSelector);
    if (!wrap) return;
    onDelete(wrap, function () { closeWrap(wrap); });
  });

  // Tocar afuera cierra el que esté abierto
  document.addEventListener("touchstart", function (e) {
    if (openWrap && !openWrap.contains(e.target)) closeWrap(openWrap);
  }, { passive: true });
}