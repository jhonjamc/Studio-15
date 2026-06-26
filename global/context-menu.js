/* ============================================================================
   ESTUDIO 15 — CONTEXT-MENU.JS
   Menú contextual reutilizable: clic derecho en PC, mantener presionado
   en celular. Se usa en admin.html y empleado.html para "Eliminar cita".

   Uso:
   attachContextMenu(contenedor, '[data-appt-id]', [
     { label: "Eliminar cita", icon: "trash-2", onClick: function (targetEl) { ... } }
   ]);
   ============================================================================ */

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

  // ---- Clic derecho (PC) ----
  container.addEventListener("contextmenu", function (e) {
    var targetEl = e.target.closest(targetSelector);
    if (!targetEl) return;
    e.preventDefault();
    openMenu(e.clientX, e.clientY, targetEl);
  });

  // ---- Mantener presionado (mobile) ----
  var pressTimer = null;

  container.addEventListener("touchstart", function (e) {
    var targetEl = e.target.closest(targetSelector);
    if (!targetEl) return;
    var touch = e.touches[0];
    pressTimer = setTimeout(function () {
      openMenu(touch.clientX, touch.clientY, targetEl);
    }, 550);
  }, { passive: true });

  container.addEventListener("touchend", function () { clearTimeout(pressTimer); });
  container.addEventListener("touchmove", function () { clearTimeout(pressTimer); });
}