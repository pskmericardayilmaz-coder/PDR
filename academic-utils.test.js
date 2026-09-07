"use strict";

const assert = require("node:assert/strict");
const academic = require("./academic-utils.js");

assert.equal(academic.normalize(1), 1);
assert.equal(academic.normalize("2 - Orta"), 2);
assert.equal(academic.normalize("İyi"), 3);
assert.equal(academic.normalize(5), 3);
assert.equal(academic.normalize("bilinmiyor"), 2);

assert.equal(academic.migrateLegacy(1), 1);
assert.equal(academic.migrateLegacy(2), 1);
assert.equal(academic.migrateLegacy(3), 2);
assert.equal(academic.migrateLegacy(4), 3);
assert.equal(academic.migrateLegacy(5), 3);

assert.equal(academic.format(1), "Desteklenmeli");
assert.equal(academic.format(2), "Orta");
assert.equal(academic.format(3), "İyi");

console.log("Üç seviyeli akademik durum testleri başarılı.");
