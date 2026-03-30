(function () {
  const source = document.getElementById("source");
  const other = document.getElementById("source_other");

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

  if (source) {
    source.addEventListener("change", toggleOther);
    toggleOther();
  }
})();
