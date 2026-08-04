document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("menu-btn");
  const menu = document.getElementById("mobile-menu");
  const backdrop = document.getElementById("mobile-menu-backdrop");
  const header = document.getElementById("site-header");

  if (!btn || !menu || !backdrop || !header) return;

  const setOpen = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    menu.setAttribute("aria-hidden", String(!open));
    menu.dataset.open = String(open);
    backdrop.dataset.open = String(open);
    document.body.classList.toggle("overflow-hidden", open);
  };

  btn.addEventListener("click", () => {
    setOpen(btn.getAttribute("aria-expanded") !== "true");
  });

  backdrop.addEventListener("click", () => setOpen(false));

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && btn.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      btn.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 768px)").matches) setOpen(false);
  });
});
