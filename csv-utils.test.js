"use strict";

const assert = require("node:assert/strict");
const csv = require("./csv-utils.js");

const headers = [
  "Ad Soyad",
  "Cinsiyet",
  "Eski Sınıf",
  "Akademik Başarı",
  "Davranış Sorunu Var mı?",
  "Not",
].map(csv.normalizeHeader);

assert.equal(csv.findColumn(headers, "davranis"), 4);
assert.equal(csv.findColumn(headers, "not", "aciklama"), 5);

const requestHeaders = [
  "Birlikte - Ayrı",
  "Tercihte bulunan öğrenci ismi",
  "1. tercih",
  "2. tercih",
  "3. tercih",
  "4. tercih",
  "5. tercih",
].map(csv.normalizeHeader);
assert.equal(csv.findColumn(requestHeaders, "birlikte - ayri"), 0);
assert.equal(
  csv.findColumn(requestHeaders, "tercihte bulunan ogrenci ismi"),
  1
);
assert.equal(csv.findColumn(requestHeaders, "1. tercih"), 2);

for (const value of ["Evet", "EVET ", "e", "1", "Var", "İşaretli", "X"]) {
  assert.equal(csv.parseBehaviorToken(value), true, `${value} doğru olmalı`);
}

for (const value of ["Hayır", "HAYIR ", "h", "0", "Yok", "İşaretsiz"]) {
  assert.equal(csv.parseBehaviorToken(value), false, `${value} yanlış olmalı`);
}

assert.equal(csv.parseBehaviorToken("Öğretmen görüşü"), null);

assert.deepEqual(csv.resolveBehaviorAndNotes("", "Evet"), {
  behavior: true,
  notes: "",
});
assert.deepEqual(csv.resolveBehaviorAndNotes("", "Hayır"), {
  behavior: false,
  notes: "",
});
assert.deepEqual(csv.resolveBehaviorAndNotes("", "Öğretmen görüşü"), {
  behavior: false,
  notes: "Öğretmen görüşü",
});
assert.deepEqual(csv.resolveBehaviorAndNotes("Evet", "Yakın takip"), {
  behavior: true,
  notes: "Yakın takip",
});

console.log("CSV davranış alanı testleri başarılı.");
