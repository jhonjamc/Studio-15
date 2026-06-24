/* ============================================================================
   ESTUDIO 15 — PRODUCTS.JS
   Lógica EXCLUSIVA de products.html.
   global.js ya se encarga de: iconos lucide, año del footer y el carrito.

   Índice:
   1. Filtros de categoría
   ============================================================================ */

document.addEventListener("DOMContentLoaded", function () {

  var buttons = document.querySelectorAll(".filter-btn");
  var cards = document.querySelectorAll("#productsGrid .card");

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var filter = btn.dataset.filter;
      cards.forEach(function (card) {
        var show = filter === "all" || card.dataset.cat === filter;
        card.style.display = show ? "" : "none";
      });
    });
  });

});
