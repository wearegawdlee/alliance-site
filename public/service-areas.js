(function () {
  const serviceAreas = [
    "Alpharetta","Atlanta","Brookhaven","Buckhead","Buford","Canton","Chamblee",
    "Cumming","Decatur","Doraville","Duluth","Dunwoody","Druid Hills","East Cobb","Johns Creek","Kennesaw",
    "Marietta","Milton","Norcross","Peachtree Corners","Roswell","Sandy Springs","Smyrna","Suwanee","Woodstock",
  ];

  const input = document.getElementById("service-area-input");
  const button = document.getElementById("service-area-check");
  const result = document.getElementById("service-area-result");
  const cityInput = document.getElementById("city");

  const check = () => {
    if (!input || !result) return;
    const value = (input.value || "").trim();
    if (!value) {
      result.className = "mt-3 text-sm text-amber-300";
      result.textContent = "Enter a city to check.";
      return;
    }
    const match = serviceAreas.find((area) => area.toLowerCase() === value.toLowerCase());
    if (match) {
      result.className = "mt-3 text-sm text-emerald-300";
      result.textContent = `Yes — we service ${match}.`;
      if (cityInput) cityInput.value = match;
    } else {
      result.className = "mt-3 text-sm text-amber-300";
      result.textContent = "Not seeing your area? Call us and we’ll check availability.";
    }
  };

  if (button) button.addEventListener("click", check);
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        check();
      }
    });
  }
})();
