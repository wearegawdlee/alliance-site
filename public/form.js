(function () {
  const source = document.getElementById("source");
  const other = document.getElementById("source_other");
  const zip = document.getElementById("zip");

  const toggleOther = () => {
    if (!source || !other) return;
    const selected = source.value;
    if (selected === "Other" || selected === "Friend / Referral") {
      other.style.display = "block";
    } else {
      other.style.display = "none";
      other.value = "";
    }
  };

  const normalizeZip = () => {
    if (!zip) return;
    zip.value = zip.value.replace(/\D/g, "").slice(0, 5);
  };

  if (source) {
    source.addEventListener("change", toggleOther);
    toggleOther();
  }

  if (zip) {
    zip.addEventListener("input", normalizeZip);
    zip.addEventListener("blur", normalizeZip);
  }
})();
