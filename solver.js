(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.SinifDengeMotoru = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_WEIGHTS = {
    gender: 26,
    academic: 22,
    behavior: 28,
    oldClass: 30,
    hardTogether: 900,
    hardApart: 1100,
    softTogether: 130,
    softApart: 160,
    missingPreference: 100000,
    sameOldClassGender: 1500000,
    preferenceRank: 38,
    softPreference: 280,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createRng(seed) {
    let value = Number(seed) || 1;
    return function random() {
      value |= 0;
      value = (value + 0x6d2b79f5) | 0;
      let t = Math.imul(value ^ (value >>> 15), 1 | value);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, random) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildClassNames(count, prefix, suppliedNames) {
    if (Array.isArray(suppliedNames) && suppliedNames.length === count) {
      return suppliedNames.map((name) => String(name).trim());
    }
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return Array.from({ length: count }, (_, index) => {
      const suffix = letters[index] || String(index + 1);
      return `${prefix || "5"}${suffix}`;
    });
  }

  function normalizeStudent(student, index) {
    return {
      id: String(student.id || `ogrenci-${index + 1}`),
      name: String(student.name || `Öğrenci ${index + 1}`).trim(),
      gender: student.gender === "E" ? "E" : "K",
      oldClass: String(student.oldClass || "Belirsiz").trim().toUpperCase(),
      academic: clamp(Number(student.academic) || 2, 1, 3),
      behavior: Boolean(student.behavior),
      notes: String(student.notes || "").trim(),
    };
  }

  function normalizeRequest(request, validIds) {
    const studentA = String(request.studentA || "");
    const rawChoices = Array.isArray(request.choices)
      ? request.choices
      : [request.studentB];
    const choices = [
      ...new Set(
        rawChoices
          .map((choice) => String(choice || ""))
          .filter(
            (choice) =>
              validIds.has(choice) && choice !== studentA
          )
      ),
    ].slice(0, 5);
    if (!validIds.has(studentA) || choices.length === 0) {
      return null;
    }
    return {
      id: String(request.id || `${studentA}-${choices.join("-")}`),
      studentA,
      choices,
      type: request.type === "apart" ? "apart" : "together",
      priority: ["hard", "auto", "soft"].includes(request.priority)
        ? request.priority
        : "auto",
      note: String(request.note || "").trim(),
    };
  }

  function requestOutcome(request, assignment) {
    const subjectClass = assignment[request.studentA];
    if (subjectClass === undefined) {
      return {
        satisfied: false,
        rank: -1,
        studentId: null,
        satisfiedIds: [],
        violatedIds: request.choices.slice(),
      };
    }
    const satisfiedIds = [];
    const violatedIds = [];
    request.choices.forEach((choiceId) => {
      const choiceClass = assignment[choiceId];
      if (choiceClass === undefined) {
        violatedIds.push(choiceId);
        return;
      }
      const relationSatisfied =
        request.type === "together"
          ? subjectClass === choiceClass
          : subjectClass !== choiceClass;
      (relationSatisfied ? satisfiedIds : violatedIds).push(choiceId);
    });
    const requiresAll =
      request.priority === "hard" || request.type === "apart";
    let satisfied;
    if (requiresAll) {
      satisfied = violatedIds.length === 0;
    } else if (
      request.priority === "auto" &&
      request.type === "together"
    ) {
      satisfied = satisfiedIds.length > 0;
    } else {
      satisfied = satisfiedIds.length > 0;
    }
    const studentId = satisfiedIds[0] || null;
    return {
      satisfied,
      rank: studentId ? request.choices.indexOf(studentId) : -1,
      studentId,
      satisfiedIds,
      violatedIds,
    };
  }

  function pairKey(studentA, studentB) {
    return [studentA, studentB].sort().join("|");
  }

  function detectRequestConflicts(requests, students) {
    const validIds = new Set(
      (Array.isArray(students) ? students : []).map((student) =>
        String(student.id)
      )
    );
    const normalized = (Array.isArray(requests) ? requests : [])
      .map((request) => normalizeRequest(request, validIds))
      .filter(Boolean);
    const directRelations = new Map();
    const conflicts = [];
    const seen = new Set();

    normalized.forEach((request) => {
      request.choices.forEach((choiceId) => {
        const key = pairKey(request.studentA, choiceId);
        if (!directRelations.has(key)) directRelations.set(key, []);
        directRelations.get(key).push(request);
      });
    });

    directRelations.forEach((relations) => {
      const together = relations.filter(
        (request) => request.type === "together"
      );
      const apart = relations.filter((request) => request.type === "apart");
      if (!together.length || !apart.length) return;
      const requestIds = [...together, ...apart].map(
        (request) => request.id
      );
      const key = requestIds.slice().sort().join("|");
      if (seen.has(key)) return;
      seen.add(key);
      conflicts.push({
        requestIds,
        message:
          "Aynı iki öğrenci için hem birlikte hem ayrı isteği bulunuyor.",
      });
    });

    normalized.forEach((request) => {
      const oppositeType =
        request.type === "together" ? "apart" : "together";
      const blockedChoices = request.choices.filter((choiceId) => {
        const relations =
          directRelations.get(pairKey(request.studentA, choiceId)) || [];
        return relations.some(
          (relation) =>
            relation.type === oppositeType &&
            relation.id !== request.id
        );
      });
      if (
        blockedChoices.length === request.choices.length &&
        request.choices.length > 1
      ) {
        const blockingIds = request.choices.flatMap((choiceId) =>
          (directRelations.get(pairKey(request.studentA, choiceId)) || [])
            .filter((relation) => relation.type === oppositeType)
            .map((relation) => relation.id)
        );
        const requestIds = [request.id, ...blockingIds];
        const key = requestIds.slice().sort().join("|");
        if (seen.has(key)) return;
        seen.add(key);
        conflicts.push({
          requestIds,
          message:
            "Bu öğrencinin tüm tercihleri başka kesin isteklerle çelişiyor.",
        });
      }
    });

    return conflicts;
  }

  function buildContext(students, requests, settings) {
    const normalizedStudents = students.map(normalizeStudent);
    const validIds = new Set(normalizedStudents.map((student) => student.id));
    const normalizedRequests = requests
      .map((request) => normalizeRequest(request, validIds))
      .filter(Boolean);
    const requestedClassCount = clamp(
      Math.round(Number(settings.classCount) || 6),
      2,
      12
    );
    const classCount = requestedClassCount;
    const baseSize = Math.floor(normalizedStudents.length / classCount);
    const remainder = normalizedStudents.length % classCount;
    const capacities = Array.from(
      { length: classCount },
      (_, index) => baseSize + (index < remainder ? 1 : 0)
    );
    const classNames = buildClassNames(
      classCount,
      settings.classPrefix,
      settings.classNames
    );
    const totals = normalizedStudents.reduce(
      (acc, student) => {
        acc.gender[student.gender] += 1;
        acc.academic += student.academic;
        acc.behavior += student.behavior ? 1 : 0;
        acc.oldClass[student.oldClass] =
          (acc.oldClass[student.oldClass] || 0) + 1;
        return acc;
      },
      {
        gender: { K: 0, E: 0 },
        academic: 0,
        behavior: 0,
        oldClass: {},
      }
    );
    const degree = {};
    normalizedRequests.forEach((request) => {
      degree[request.studentA] = (degree[request.studentA] || 0) + 1;
      request.choices.forEach((choiceId) => {
        degree[choiceId] = (degree[choiceId] || 0) + 1;
      });
    });
    const weights = {
      ...DEFAULT_WEIGHTS,
      ...(settings.weights || {}),
    };
    const criteria = {
      gender: settings.criteria?.gender !== false,
      academic: settings.criteria?.academic !== false,
      oldClass: settings.criteria?.oldClass !== false,
      sameOldClassGender:
        settings.criteria?.sameOldClassGender !== false,
      behavior: settings.criteria?.behavior !== false,
    };
    if (!criteria.gender) weights.gender = 0;
    if (!criteria.academic) weights.academic = 0;
    if (!criteria.oldClass) weights.oldClass = 0;
    if (!criteria.sameOldClassGender) weights.sameOldClassGender = 0;
    if (!criteria.behavior) weights.behavior = 0;
    return {
      students: normalizedStudents,
      requests: normalizedRequests,
      classCount,
      classNames,
      capacities,
      totals,
      degree,
      weights,
      criteria,
    };
  }

  function mapAssignments(groups) {
    const assignment = {};
    groups.forEach((group, classIndex) => {
      group.forEach((student) => {
        assignment[student.id] = classIndex;
      });
    });
    return assignment;
  }

  function sameOldClassGenderSingles(groups) {
    const singles = [];
    groups.forEach((group, classIndex) => {
      const buckets = new Map();
      group.forEach((student) => {
        const key = `${student.oldClass}|${student.gender}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(student);
      });
      buckets.forEach((studentsInBucket) => {
        if (studentsInBucket.length === 1) {
          singles.push({
            classIndex,
            student: studentsInBucket[0],
          });
        }
      });
    });
    return singles;
  }

  function scoreGroups(groups, context) {
    const {
      students,
      requests,
      capacities,
      totals,
      weights,
      classCount,
    } = context;
    const totalCount = Math.max(students.length, 1);
    let score = 0;
    const assignment = mapAssignments(groups);

    groups.forEach((group, classIndex) => {
      const capacity = capacities[classIndex];
      const stats = group.reduce(
        (acc, student) => {
          acc.gender[student.gender] += 1;
          acc.academic += student.academic;
          acc.behavior += student.behavior ? 1 : 0;
          acc.oldClass[student.oldClass] =
            (acc.oldClass[student.oldClass] || 0) + 1;
          return acc;
        },
        {
          gender: { K: 0, E: 0 },
          academic: 0,
          behavior: 0,
          oldClass: {},
        }
      );

      const sizeDifference = group.length - capacity;
      score += sizeDifference * sizeDifference * 5000;

      ["K", "E"].forEach((gender) => {
        const expected = (totals.gender[gender] * capacity) / totalCount;
        const difference = stats.gender[gender] - expected;
        score += difference * difference * weights.gender;
      });

      const expectedAcademic = (totals.academic * capacity) / totalCount;
      const academicDifference = stats.academic - expectedAcademic;
      score +=
        (academicDifference * academicDifference * weights.academic) /
        Math.max(capacity, 1);

      const expectedBehavior = (totals.behavior * capacity) / totalCount;
      const behaviorDifference = stats.behavior - expectedBehavior;
      score +=
        behaviorDifference * behaviorDifference * weights.behavior;

      Object.entries(totals.oldClass).forEach(([oldClass, count]) => {
        const expected = (count * capacity) / totalCount;
        const difference = (stats.oldClass[oldClass] || 0) - expected;
        score += difference * difference * weights.oldClass;
      });
    });

    requests.forEach((request) => {
      const outcome = requestOutcome(request, assignment);
      if (request.priority === "hard") {
        score +=
          outcome.violatedIds.length * weights.missingPreference * 1.45;
      } else if (request.priority === "auto") {
        if (request.type === "apart") {
          score +=
            outcome.violatedIds.length * weights.missingPreference * 1.35;
        } else {
          score +=
            Math.abs(outcome.satisfiedIds.length - 1) *
            weights.missingPreference *
            1.2;
        }
      } else if (request.type === "apart") {
        score += outcome.violatedIds.length * weights.softPreference;
      } else if (!outcome.satisfied) {
        score += weights.softPreference;
      }
    });

    Object.keys(totals.oldClass).forEach((oldClass) => {
      const counts = groups.map(
        (group) =>
          group.filter((student) => student.oldClass === oldClass).length
      );
      const spread = Math.max(...counts) - Math.min(...counts);
      if (spread > 1) {
        score += (spread - 1) * (spread - 1) * weights.oldClass * classCount;
      }
    });

    if (context.criteria.sameOldClassGender) {
      score +=
        sameOldClassGenderSingles(groups).length *
        weights.sameOldClassGender;
    }

    return score;
  }

  function greedyGroups(context, random) {
    const {
      students,
      capacities,
      classCount,
      totals,
      requests,
      degree,
      weights,
    } = context;
    const totalCount = Math.max(students.length, 1);
    const groups = Array.from({ length: classCount }, () => []);
    const stats = Array.from({ length: classCount }, () => ({
      gender: { K: 0, E: 0 },
      academic: 0,
      behavior: 0,
      oldClass: {},
    }));
    const assigned = {};
    const ordered = shuffle(students, random).sort((a, b) => {
      const degreeDifference = (degree[b.id] || 0) - (degree[a.id] || 0);
      if (degreeDifference !== 0) return degreeDifference;
      const behaviorDifference = context.criteria.behavior
        ? Number(b.behavior) - Number(a.behavior)
        : 0;
      if (behaviorDifference !== 0) return behaviorDifference;
      return context.criteria.academic
        ? Math.abs(b.academic - 2) - Math.abs(a.academic - 2)
        : 0;
    });

    ordered.forEach((student) => {
      let bestClass = -1;
      let bestCost = Number.POSITIVE_INFINITY;

      for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
        if (groups[classIndex].length >= capacities[classIndex]) continue;
        const classStats = stats[classIndex];
        const capacity = capacities[classIndex];
        let cost = random() * 2;
        const genderExpected =
          (totals.gender[student.gender] * capacity) / totalCount;
        const genderAfter = classStats.gender[student.gender] + 1;
        cost +=
          (genderAfter - genderExpected) *
          (genderAfter - genderExpected) *
          weights.gender;

        const academicExpected = (totals.academic * capacity) / totalCount;
        const academicAfter = classStats.academic + student.academic;
        cost +=
          ((academicAfter - academicExpected) *
            (academicAfter - academicExpected) *
            weights.academic) /
          Math.max(capacity, 1);

        const behaviorExpected = (totals.behavior * capacity) / totalCount;
        const behaviorAfter =
          classStats.behavior + (student.behavior ? 1 : 0);
        cost +=
          (behaviorAfter - behaviorExpected) *
          (behaviorAfter - behaviorExpected) *
          weights.behavior;

        const oldClassExpected =
          ((totals.oldClass[student.oldClass] || 0) * capacity) / totalCount;
        const oldClassAfter =
          (classStats.oldClass[student.oldClass] || 0) + 1;
        cost +=
          (oldClassAfter - oldClassExpected) *
          (oldClassAfter - oldClassExpected) *
          weights.oldClass *
          1.8;

        const fillRatio =
          (groups[classIndex].length + 1) / Math.max(capacity, 1);
        cost += fillRatio * fillRatio * 8;

        if (context.criteria.sameOldClassGender) {
          const sameOldClassGenderCount = groups[classIndex].filter(
            (peer) =>
              peer.oldClass === student.oldClass &&
              peer.gender === student.gender
          ).length;
          if (sameOldClassGenderCount === 1) {
            cost -= weights.sameOldClassGender * 0.04;
          } else if (sameOldClassGenderCount === 0) {
            cost += weights.sameOldClassGender * 0.003;
          }
        }

        requests.forEach((request) => {
          const isSubject = request.studentA === student.id;
          const choiceIndex = request.choices.indexOf(student.id);
          if (!isSubject && choiceIndex < 0) return;
          if (
            request.priority === "auto" &&
            request.type === "together"
          ) {
            const subjectClass = isSubject
              ? classIndex
              : assigned[request.studentA];
            if (subjectClass === undefined) return;
            const sameCount = request.choices.reduce(
              (count, choiceId) => {
                const choiceClass =
                  choiceId === student.id
                    ? classIndex
                    : assigned[choiceId];
                return count + (choiceClass === subjectClass ? 1 : 0);
              },
              0
            );
            cost +=
              Math.abs(sameCount - 1) *
              weights.missingPreference *
              0.25;
            return;
          }
          const peerIds = isSubject
            ? request.choices
            : [request.studentA];
          peerIds.forEach((peerId) => {
            const peerClass = assigned[peerId];
            if (peerClass === undefined) return;
            const relationSatisfied =
              request.type === "together"
                ? peerClass === classIndex
                : peerClass !== classIndex;
            const mandatory =
              request.priority === "hard" ||
              (request.priority === "auto" &&
                request.type === "apart");
            if (!relationSatisfied && mandatory) {
              cost += weights.missingPreference * 0.4;
            } else if (relationSatisfied && request.type === "together") {
              cost -=
                request.priority === "soft"
                  ? weights.softPreference * 0.25
                  : weights.preferenceRank;
            } else if (
              !relationSatisfied &&
              request.priority === "soft"
            ) {
              cost += weights.softPreference * 0.2;
            }
          });
        });

        if (cost < bestCost) {
          bestCost = cost;
          bestClass = classIndex;
        }
      }

      const selected = bestClass < 0 ? 0 : bestClass;
      groups[selected].push(student);
      assigned[student.id] = selected;
      stats[selected].gender[student.gender] += 1;
      stats[selected].academic += student.academic;
      stats[selected].behavior += student.behavior ? 1 : 0;
      stats[selected].oldClass[student.oldClass] =
        (stats[selected].oldClass[student.oldClass] || 0) + 1;
    });

    return groups;
  }

  function sameOldClassGenderPair(group, random) {
    const buckets = new Map();
    group.forEach((student, index) => {
      const key = `${student.oldClass}|${student.gender}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(index);
    });
    const candidates = Array.from(buckets.values()).filter(
      (indexes) => indexes.length >= 2
    );
    if (!candidates.length) return null;
    const indexes = candidates[Math.floor(random() * candidates.length)];
    const firstPosition = Math.floor(random() * indexes.length);
    let secondPosition = Math.floor(random() * indexes.length);
    if (firstPosition === secondPosition) {
      secondPosition = (secondPosition + 1) % indexes.length;
    }
    return [indexes[firstPosition], indexes[secondPosition]];
  }

  function improveGroups(initialGroups, context, random, iterations) {
    const groups = initialGroups.map((group) => group.slice());
    let currentScore = scoreGroups(groups, context);
    let bestScore = currentScore;
    let bestGroups = groups.map((group) => group.slice());

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const classA = Math.floor(random() * groups.length);
      let classB = Math.floor(random() * groups.length);
      if (classA === classB) classB = (classB + 1) % groups.length;
      if (!groups[classA].length || !groups[classB].length) continue;
      const usePairSwap =
        context.criteria.sameOldClassGender && random() < 0.45;
      const pairA = usePairSwap
        ? sameOldClassGenderPair(groups[classA], random)
        : null;
      const pairB = usePairSwap
        ? sameOldClassGenderPair(groups[classB], random)
        : null;
      const swapIndexesA = pairA && pairB
        ? pairA
        : [Math.floor(random() * groups[classA].length)];
      const swapIndexesB = pairA && pairB
        ? pairB
        : [Math.floor(random() * groups[classB].length)];
      const studentsA = swapIndexesA.map((index) => groups[classA][index]);
      const studentsB = swapIndexesB.map((index) => groups[classB][index]);
      swapIndexesA.forEach((index, position) => {
        groups[classA][index] = studentsB[position];
      });
      swapIndexesB.forEach((index, position) => {
        groups[classB][index] = studentsA[position];
      });

      const nextScore = scoreGroups(groups, context);
      const progress = iteration / Math.max(iterations - 1, 1);
      const temperature = Math.max(0.35, 18 * (1 - progress));
      const accept =
        nextScore <= currentScore ||
        random() < Math.exp((currentScore - nextScore) / temperature);

      if (accept) {
        currentScore = nextScore;
        if (nextScore < bestScore) {
          bestScore = nextScore;
          bestGroups = groups.map((group) => group.slice());
        }
      } else {
        swapIndexesA.forEach((index, position) => {
          groups[classA][index] = studentsA[position];
        });
        swapIndexesB.forEach((index, position) => {
          groups[classB][index] = studentsB[position];
        });
      }
    }

    return { groups: bestGroups, score: bestScore };
  }

  function solve(students, requests, settings) {
    if (!Array.isArray(students) || students.length === 0) {
      throw new Error("Dağıtım için en az bir öğrenci gereklidir.");
    }
    const context = buildContext(
      students,
      Array.isArray(requests) ? requests : [],
      settings || {}
    );
    const seed = Number(settings && settings.seed) || Date.now();
    const random = createRng(seed);
    const restartCount = clamp(
      Number(settings && settings.restarts) ||
        (context.criteria.sameOldClassGender ? 22 : 14),
      4,
      36
    );
    const requestedIterations = Number(settings && settings.iterations);
    const iterations = clamp(
      requestedIterations ||
        context.students.length *
          (context.criteria.sameOldClassGender ? 48 : 34),
      800,
      context.criteria.sameOldClassGender ? 12000 : 7500
    );
    let best = null;

    for (let restart = 0; restart < restartCount; restart += 1) {
      const initial = greedyGroups(context, random);
      const improved = improveGroups(initial, context, random, iterations);
      if (!best || improved.score < best.score) {
        best = improved;
      }
    }

    const assignment = mapAssignments(best.groups);
    return {
      assignment,
      classNames: context.classNames,
      score: Math.round(best.score * 100) / 100,
      analysis: analyze(
        context.students,
        context.requests,
        assignment,
        {
          ...settings,
          classCount: context.classCount,
          classNames: context.classNames,
        }
      ),
    };
  }

  function analyze(students, requests, assignment, settings) {
    const context = buildContext(
      students,
      Array.isArray(requests) ? requests : [],
      settings || {}
    );
    const groups = Array.from({ length: context.classCount }, () => []);
    context.students.forEach((student) => {
      const classIndex = Number(assignment[student.id]);
      if (
        Number.isInteger(classIndex) &&
        classIndex >= 0 &&
        classIndex < groups.length
      ) {
        groups[classIndex].push(student);
      }
    });
    const perClass = groups.map((group, classIndex) => {
      const female = group.filter((student) => student.gender === "K").length;
      const male = group.length - female;
      const academicSum = group.reduce(
        (sum, student) => sum + student.academic,
        0
      );
      const behavior = group.filter((student) => student.behavior).length;
      const oldClasses = {};
      group.forEach((student) => {
        oldClasses[student.oldClass] =
          (oldClasses[student.oldClass] || 0) + 1;
      });
      return {
        index: classIndex,
        name: context.classNames[classIndex],
        size: group.length,
        female,
        male,
        academicAverage: group.length
          ? Math.round((academicSum / group.length) * 100) / 100
          : 0,
        behavior,
        oldClasses,
        students: group
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, "tr")),
      };
    });

    const violations = [];
    const sizes = perClass.map((item) => item.size);
    const sizeSpread = Math.max(...sizes) - Math.min(...sizes);
    if (sizeSpread > 1) {
      violations.push({
        severity: "high",
        category: "Mevcut",
        message: `Sınıf mevcutları arasında ${sizeSpread} öğrenci fark var.`,
      });
    }
    const maxClassSize = Number(settings.maxClassSize) || 0;
    if (maxClassSize > 0) {
      perClass
        .filter((item) => item.size > maxClassSize)
        .forEach((item) => {
          violations.push({
            severity: "high",
            category: "Kapasite",
            message: `${item.name} sınıfında ${item.size} öğrenci var; en fazla ${maxClassSize} olmalı.`,
          });
        });
    }

    const requestOutcomes = [];
    context.requests.forEach((request) => {
      const outcome = requestOutcome(request, assignment);
      const studentA = context.students.find(
        (student) => student.id === request.studentA
      );
      const selectedStudent = context.students.find(
        (student) => student.id === outcome.studentId
      );
      requestOutcomes.push({
        requestId: request.id,
        satisfied: outcome.satisfied,
        rank: outcome.rank,
        studentId: outcome.studentId,
        studentName: selectedStudent ? selectedStudent.name : "",
        satisfiedIds: outcome.satisfiedIds,
        violatedIds: outcome.violatedIds,
      });
      if (outcome.satisfied) return;
      violations.push({
        severity: request.priority === "soft" ? "medium" : "high",
        category: "Veli isteği",
        requestId: request.id,
        message:
          request.type === "apart"
            ? `${studentA.name} için ayrı olma isteği tam karşılanamadı.`
            : `${studentA.name} için girilen ${request.choices.length} birlikte olma seçeneğinden hiçbiri karşılanamadı.`,
      });
    });

    detectRequestConflicts(context.requests, context.students).forEach(
      (conflict) => {
        violations.push({
          severity: "high",
          category: "Çelişen istek",
          message: conflict.message,
          requestIds: conflict.requestIds,
        });
      }
    );

    if (context.criteria.oldClass) {
      Object.keys(context.totals.oldClass).forEach((oldClass) => {
      const counts = perClass.map(
        (item) => item.oldClasses[oldClass] || 0
      );
      const spread = Math.max(...counts) - Math.min(...counts);
      if (spread > 1) {
        const distribution = perClass
          .map(
            (item) =>
              `${item.name}-${item.oldClasses[oldClass] || 0}`
          )
          .join(" / ");
        violations.push({
          severity: spread > 2 ? "high" : "medium",
          category: "Eski şube",
          message: `${oldClass} öğrencileri yeni sınıflara eşit dağılmadı (${distribution}).`,
        });
      }
      });
    }

    if (context.criteria.sameOldClassGender) {
      const singlesByClass = new Map();
      sameOldClassGenderSingles(groups).forEach((item) => {
        if (!singlesByClass.has(item.classIndex)) {
          singlesByClass.set(item.classIndex, []);
        }
        singlesByClass.get(item.classIndex).push(item.student);
      });
      singlesByClass.forEach((items, classIndex) => {
        const details = items
          .slice(0, 8)
          .map(
            (student) =>
              `${student.name} (${student.oldClass}, ${
                student.gender === "K" ? "Kız" : "Erkek"
              })`
          )
          .join(", ");
        const suffix =
          items.length > 8 ? ` ve ${items.length - 8} öğrenci daha` : "";
        violations.push({
          severity: "high",
          category: "Kendi sınıfından hemcinsi",
          message: `${context.classNames[classIndex]} içinde eski sınıfından hemcinsi olmayan öğrenciler var: ${details}${suffix}.`,
        });
      });
    }

    const femaleCounts = perClass.map((item) => item.female);
    const femaleSpread = Math.max(...femaleCounts) - Math.min(...femaleCounts);
    if (context.criteria.gender && femaleSpread > 1) {
      violations.push({
        severity: femaleSpread > 2 ? "high" : "medium",
        category: "Cinsiyet",
        message: `Kız öğrenci sayıları arasında ${femaleSpread} fark var.`,
      });
    }

    const academicAverages = perClass
      .filter((item) => item.size)
      .map((item) => item.academicAverage);
    const academicSpread = academicAverages.length
      ? Math.max(...academicAverages) - Math.min(...academicAverages)
      : 0;
    if (context.criteria.academic && academicSpread > 0.35) {
      violations.push({
        severity: academicSpread > 0.65 ? "high" : "medium",
        category: "Akademik",
        message: `Sınıf başarı ortalamaları arasında ${academicSpread.toFixed(
          2
        )} puan fark var.`,
      });
    }

    const behaviorCounts = perClass.map((item) => item.behavior);
    const behaviorSpread =
      Math.max(...behaviorCounts) - Math.min(...behaviorCounts);
    if (context.criteria.behavior && behaviorSpread > 1) {
      violations.push({
        severity: behaviorSpread > 2 ? "high" : "medium",
        category: "Davranış",
        message: `Davranış desteği gereken öğrenci sayıları arasında ${behaviorSpread} fark var.`,
      });
    }

    const unassigned = context.students.filter(
      (student) => assignment[student.id] === undefined
    );
    if (unassigned.length) {
      violations.push({
        severity: "high",
        category: "Atama",
        message: `${unassigned.length} öğrenci bir sınıfa atanmadı.`,
      });
    }

    const highCount = violations.filter(
      (item) => item.severity === "high"
    ).length;
    const mediumCount = violations.filter(
      (item) => item.severity === "medium"
    ).length;
    const quality = clamp(
      Math.round(
        100 -
          highCount * 13 -
          mediumCount * 5 -
          (context.criteria.academic ? academicSpread * 6 : 0) -
          Math.max(0, sizeSpread - 1) * 8
      ),
      0,
      100
    );

    return {
      perClass,
      violations,
      requestOutcomes,
      quality,
      metrics: {
        sizeSpread,
        femaleSpread,
        academicSpread: Math.round(academicSpread * 100) / 100,
        behaviorSpread,
      },
      criteria: context.criteria,
      score: Math.round(scoreGroups(groups, context) * 100) / 100,
    };
  }

  return {
    solve,
    analyze,
    buildClassNames,
    detectRequestConflicts,
    requestOutcome,
  };
});
