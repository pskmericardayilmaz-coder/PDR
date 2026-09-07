"use strict";

const assert = require("node:assert/strict");
const engine = require("./solver.js");

function sampleStudents() {
  const students = [];
  for (let oldClassIndex = 0; oldClassIndex < 6; oldClassIndex += 1) {
    for (let index = 0; index < 12; index += 1) {
      students.push({
        id: `s-${oldClassIndex}-${index}`,
        name: `Öğrenci ${oldClassIndex}-${index}`,
        gender: index < 6 ? "K" : "E",
        oldClass: `4${String.fromCharCode(65 + oldClassIndex)}`,
        academic: ((index + oldClassIndex) % 3) + 1,
        behavior: index === 0,
      });
    }
  }
  return students;
}

const students = sampleStudents();
const requests = [
  {
    id: "r-1",
    studentA: "s-0-0",
    choices: ["s-1-1", "s-3-1", "s-4-1"],
    type: "together",
    priority: "auto",
  },
  {
    id: "r-2",
    studentA: "s-2-2",
    choices: ["s-2-3"],
    type: "apart",
    priority: "hard",
  },
  {
    id: "r-3",
    studentA: "s-5-6",
    choices: ["s-0-6", "s-1-6", "s-3-6"],
    type: "apart",
    priority: "auto",
  },
];

const result = engine.solve(students, requests, {
  classCount: 6,
  classPrefix: "5",
  seed: 12345,
  restarts: 18,
});

assert.equal(Object.keys(result.assignment).length, students.length);
assert.equal(result.analysis.perClass.length, 6);
assert.deepEqual(
  result.analysis.perClass.map((item) => item.size),
  [12, 12, 12, 12, 12, 12]
);
assert.ok(result.analysis.metrics.femaleSpread <= 1);
assert.ok(result.analysis.metrics.behaviorSpread <= 1);
assert.ok(
  requests[0].choices.some(
    (choiceId) =>
      result.assignment["s-0-0"] === result.assignment[choiceId]
  ),
  "Sıralı tercihlerden en az biri karşılanmalı"
);
assert.ok(
  result.analysis.requestOutcomes.every((outcome) => outcome.satisfied),
  "Her istek grubundan en az bir tercih karşılanmalı"
);
assert.ok(
  !result.analysis.violations.some(
    (item) => item.category === "Kendi sınıfından hemcinsi"
  ),
  "Kendi sınıfından hemcinsi kuralı sağlanmalı"
);
assert.ok(
  result.analysis.requestOutcomes.find(
    (outcome) => outcome.requestId === "r-1"
  ).satisfiedIds.length >= 1,
  "Otomatik dağıtım en az bir birlikte tercihini karşılamalı"
);

const multipleTogetherAssignment = {
  ...result.assignment,
  "s-0-0": 0,
  "s-1-1": 0,
  "s-3-1": 0,
  "s-4-1": 2,
};
const multipleTogetherAnalysis = engine.analyze(
  students,
  [requests[0]],
  multipleTogetherAssignment,
  {
    classCount: 6,
    classPrefix: "5",
  }
);
const multipleTogetherOutcome =
  multipleTogetherAnalysis.requestOutcomes.find(
    (outcome) => outcome.requestId === "r-1"
  );
assert.equal(
  multipleTogetherOutcome.satisfied,
  true,
  "Birlikte isteğinde birden fazla tercih aynı sınıftaysa istek karşılanmış sayılmalı"
);
assert.equal(
  multipleTogetherAnalysis.violations.some(
    (item) => item.category === "Veli isteği"
  ),
  false,
  "Birden fazla birlikte tercihi karşılanınca veli isteği uyarısı çıkmamalı"
);
assert.notEqual(
  result.assignment["s-2-2"],
  result.assignment["s-2-3"],
  "Kesin ayrı olma isteği karşılanmalı"
);
for (const choiceId of requests[2].choices) {
  assert.notEqual(
    result.assignment["s-5-6"],
    result.assignment[choiceId],
    "Otomatik ayrı isteğinde tüm tercihler ayrı tutulmalı"
  );
}

const conflicts = engine.detectRequestConflicts(
  [
    {
      id: "c-1",
      studentA: "s-0-0",
      choices: ["s-1-1"],
      type: "together",
      priority: "hard",
    },
    {
      id: "c-2",
      studentA: "s-1-1",
      choices: ["s-0-0"],
      type: "apart",
      priority: "hard",
    },
  ],
  students
);
assert.equal(conflicts.length, 1, "Çelişen kesin istek algılanmalı");

const multiChoiceConflicts = engine.detectRequestConflicts(
  [
    {
      id: "mc-1",
      studentA: "s-0-0",
      choices: ["s-1-1", "s-2-1", "s-3-1"],
      type: "together",
      priority: "auto",
    },
    {
      id: "mc-2",
      studentA: "s-0-0",
      choices: ["s-2-1"],
      type: "apart",
      priority: "auto",
    },
  ],
  students
);
assert.equal(
  multiChoiceConflicts.length,
  1,
  "Çok tercihli birlikte isteğinde aynı öğrenci ayrı da yazılırsa çelişki algılanmalı"
);

const hardTogether = engine.solve(
  students,
  [
    {
      id: "hard-all",
      studentA: "s-0-0",
      choices: ["s-1-1", "s-2-1"],
      type: "together",
      priority: "hard",
    },
  ],
  {
    classCount: 6,
    classPrefix: "5",
    seed: 9876,
    restarts: 18,
  }
);
assert.equal(
  hardTogether.assignment["s-0-0"],
  hardTogether.assignment["s-1-1"],
  "Kesin birlikte isteği ilk öğrenciyi aynı sınıfa almalı"
);
assert.equal(
  hardTogether.assignment["s-0-0"],
  hardTogether.assignment["s-2-1"],
  "Kesin birlikte isteği tüm girilen öğrencileri aynı sınıfa almalı"
);

const deliberatelyImbalancedAssignment = Object.fromEntries(
  [
    ...students.filter((student) => student.gender === "K"),
    ...students.filter((student) => student.gender === "E"),
  ].map((student, index) => [student.id, Math.floor(index / 12)])
);
const criteriaDisabled = engine.analyze(
  students,
  [],
  deliberatelyImbalancedAssignment,
  {
    classCount: 6,
    classPrefix: "5",
    criteria: {
      gender: false,
      academic: false,
      oldClass: false,
      sameOldClassGender: false,
      behavior: false,
    },
  }
);
assert.equal(
  criteriaDisabled.violations.filter((item) =>
    [
      "Cinsiyet",
      "Akademik",
      "Eski şube",
      "Kendi sınıfından hemcinsi",
      "Davranış",
    ].includes(item.category)
  ).length,
  0,
  "Etkin olmayan kriterler uyarı üretmemeli"
);
const criteriaEnabled = engine.analyze(
  students,
  [],
  deliberatelyImbalancedAssignment,
  {
    classCount: 6,
    classPrefix: "5",
  }
);
assert.ok(
  criteriaEnabled.violations.some(
    (item) => item.category === "Cinsiyet"
  ),
  "Etkin kriter dengesiz dağılım için uyarı üretmeli"
);

const oldClassConcentratedAssignment = Object.fromEntries(
  students.map((student) => [
    student.id,
    Number(student.oldClass.charCodeAt(1) - 65),
  ])
);
const oldClassWarning = engine
  .analyze(students, [], oldClassConcentratedAssignment, {
    classCount: 6,
    classPrefix: "5",
  })
  .violations.find((item) => item.category === "Eski şube");
assert.ok(oldClassWarning, "Eski şube dengesizliği uyarı üretmeli");
assert.match(
  oldClassWarning.message,
  /\(5A-\d+ \/ 5B-\d+ \/ 5C-\d+ \/ 5D-\d+ \/ 5E-\d+ \/ 5F-\d+\)/,
  "Eski şube uyarısı yeni sınıf adları ve sayılarıyla gösterilmeli"
);

const sameOldClassGenderBrokenAssignment = { ...result.assignment };
sameOldClassGenderBrokenAssignment["s-0-0"] = 0;
sameOldClassGenderBrokenAssignment["s-0-6"] = 0;
for (const student of students) {
  if (student.id !== "s-0-0" && student.id !== "s-0-6") {
    sameOldClassGenderBrokenAssignment[student.id] = 1 + (Number(student.id.split("-")[2]) % 5);
  }
}
const sameOldClassGenderWarning = engine
  .analyze(students, [], sameOldClassGenderBrokenAssignment, {
    classCount: 6,
    classPrefix: "5",
  })
  .violations.find(
    (item) => item.category === "Kendi sınıfından hemcinsi"
  );
assert.ok(
  sameOldClassGenderWarning,
  "Kendi sınıfından hemcinsi olmayan öğrenci uyarı üretmeli"
);

for (const oldClass of ["4A", "4B", "4C", "4D", "4E", "4F"]) {
  const counts = result.analysis.perClass.map(
    (item) => item.oldClasses[oldClass] || 0
  );
  assert.ok(
    Math.max(...counts) - Math.min(...counts) <= 1,
    `${oldClass} dengeli dağılmalı`
  );
}

console.log(
  JSON.stringify(
    {
      quality: result.analysis.quality,
      metrics: result.analysis.metrics,
      warnings: result.analysis.violations.length,
    },
    null,
    2
  )
);
