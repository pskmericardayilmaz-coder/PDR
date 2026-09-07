(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SinifDengeAkademik = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const labels = {
    1: "Desteklenmeli",
    2: "Orta",
    3: "İyi",
  };

  function normalize(value) {
    const text = String(value ?? "")
      .trim()
      .toLocaleLowerCase("tr");
    if (text.includes("destek")) return 1;
    if (text.includes("orta")) return 2;
    if (text.includes("iyi")) return 3;
    const numeric = Number.parseInt(text, 10);
    if (!Number.isFinite(numeric)) return 2;
    return Math.max(1, Math.min(3, numeric));
  }

  function migrateLegacy(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return normalize(value);
    if (numeric <= 2) return 1;
    if (numeric === 3) return 2;
    return 3;
  }

  function format(value) {
    const normalized = normalize(value);
    return labels[normalized];
  }

  return {
    labels,
    format,
    migrateLegacy,
    normalize,
  };
});
