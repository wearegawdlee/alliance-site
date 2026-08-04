document.addEventListener("DOMContentLoaded", () => {
  const mobileViewport = window.matchMedia("(max-width: 767px)");

  document.querySelectorAll("[data-mobile-before]").forEach((section) => {
    const targetId = section.getAttribute("data-mobile-before");
    const target = targetId ? document.getElementById(targetId) : null;

    if (!target || target.parentElement !== section.parentElement) return;

    const originalPosition = document.createComment(`original-position:${section.id || "section"}`);
    section.before(originalPosition);

    const syncOrder = () => {
      if (mobileViewport.matches) {
        target.before(section);
      } else {
        originalPosition.after(section);
      }
    };

    syncOrder();

    if (typeof mobileViewport.addEventListener === "function") {
      mobileViewport.addEventListener("change", syncOrder);
    } else {
      mobileViewport.addListener(syncOrder);
    }

    if (mobileViewport.matches && window.location.hash === `#${section.id}`) {
      window.requestAnimationFrame(() => section.scrollIntoView());
    }
  });
});
