(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SinifDengeCsv = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalizeHeader(value) {
    return String(value)
      .replace(/^\ufeff/, "")
      .trim()
      .toLocaleLowerCase("tr")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replaceAll("ı", "i")
      .replace(/\s+/g, " ");
  }

  function normalizeToken(value) {
    return normalizeHeader(value)
      .replace(/[()/?_\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseBehaviorToken(value) {
    const token = normalizeToken(value);
    const trueValues = [
      "evet",
      "e",
      "1",
      "true",
      "var",
      "x",
      "yes",
      "isaretli",
      "mevcut",
    ];
    const falseValues = [
      "hayir",
      "h",
      "0",
      "false",
      "yok",
      "no",
      "isaretsiz",
    ];
    if (trueValues.includes(token)) return true;
    if (falseValues.includes(token)) return false;
    return null;
  }

  function findColumn(headers, ...names) {
    return headers.findIndex((header) =>
      names.some(
        (name) =>
          header === name ||
          header.startsWith(`${name} `) ||
          header.endsWith(` ${name}`)
      )
    );
  }

  function resolveBehaviorAndNotes(behaviorValue, notesValue) {
    let behavior = parseBehaviorToken(behaviorValue);
    let notes = String(notesValue || "").trim();
    const noteBehavior = parseBehaviorToken(notes);
    if (behavior === null && noteBehavior !== null) {
      behavior = noteBehavior;
      notes = "";
    }
    return {
      behavior: behavior === true,
      notes,
    };
  }

  return {
    findColumn,
    normalizeHeader,
    parseBehaviorToken,
    resolveBehaviorAndNotes,
  };
});
