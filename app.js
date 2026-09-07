(function () {
  "use strict";

  const STORAGE_KEY = "karmacheck-v1";
  const MAX_CLASS_SIZE = 25;
  const Engine = window.SinifDengeMotoru;
  const Csv = window.SinifDengeCsv;
  const Academic = window.SinifDengeAkademik;
  const academicLabels = Academic.labels;
  const viewTitles = {
    students: "Öğrenci Listesi",
    requests: "Veli İstekleri",
    distribution: "Sınıf Yerleşimi",
    results: "Kontrol Sonuçları",
  };

  let state = loadState();
  let toastTimer = null;
  let draggedStudentId = null;
  let pendingRequestRows = [];
  let pendingRequestMode = "import";
  let pendingImportCleanRows = [];
  const pendingDeletedRequestIds = new Set();
  const selectedManualStudents = new Set();
  let manualStudentSearchQuery = "";
  let manualStudentOldClassFilter = "";
  let manualWarningSearchQuery = "";
  let manualWarningOldClassFilter = "";
  let requestSearchQuery = "";
  let requestOldClassFilter = "";
  let requestMatchSearchQuery = "";
  let editingRequestId = "";
  let focusedRequestId = "";
  let dragScrollFrame = null;
  let dragScrollSpeed = 0;
  const classSorts = {};

  const el = (id) => document.getElementById(id);
  const elements = {
    pageTitle: el("pageTitle"),
    saveState: el("saveState"),
    navStudentCount: el("navStudentCount"),
    navRequestCount: el("navRequestCount"),
    studentTotal: el("studentTotal"),
    genderTotal: el("genderTotal"),
    academicTotal: el("academicTotal"),
    behaviorTotal: el("behaviorTotal"),
    oldClassSummary: el("oldClassSummary"),
    studentTableBody: el("studentTableBody"),
    studentEmptyState: el("studentEmptyState"),
    studentSearch: el("studentSearch"),
    oldClassFilter: el("oldClassFilter"),
    inlineEditor: el("inlineEditor"),
    inlineEditorTitle: el("inlineEditorTitle"),
    inlineEditorControl: el("inlineEditorControl"),
    studentDialog: el("studentDialog"),
    studentForm: el("studentForm"),
    studentDialogTitle: el("studentDialogTitle"),
    studentId: el("studentId"),
    studentName: el("studentName"),
    studentGender: el("studentGender"),
    studentOldClass: el("studentOldClass"),
    studentAcademic: el("studentAcademic"),
    academicOutput: el("academicOutput"),
    studentBehavior: el("studentBehavior"),
    studentNotes: el("studentNotes"),
    requestForm: el("requestForm"),
    requestStudentA: el("requestStudentA"),
    requestChoices: [
      el("requestChoice1"),
      el("requestChoice2"),
      el("requestChoice3"),
      el("requestChoice4"),
      el("requestChoice5"),
    ],
    requestType: el("requestType"),
    requestNote: el("requestNote"),
    addRequestButton: el("addRequestButton"),
    requestCsvInput: el("requestCsvInput"),
    exportStudentsButton: el("exportStudentsButton"),
    exportRequestsButton: el("exportRequestsButton"),
    requestMatchDialog: el("requestMatchDialog"),
    requestMatchForm: el("requestMatchForm"),
    requestMatchEyebrow: el("requestMatchEyebrow"),
    requestMatchTitle: el("requestMatchTitle"),
    requestMatchIntro: el("requestMatchIntro"),
    requestMatchList: el("requestMatchList"),
    requestMatchSearch: el("requestMatchSearch"),
    requestMatchNotice: el("requestMatchNotice"),
    saveRequestMatchesButton: el("saveRequestMatchesButton"),
    clearUnmatchedChoicesButton: el("clearUnmatchedChoicesButton"),
    requestList: el("requestList"),
    requestEmptyState: el("requestEmptyState"),
    requestListSummary: el("requestListSummary"),
    refreshRequestsButton: el("refreshRequestsButton"),
    checkRequestsButton: el("checkRequestsButton"),
    requestSearch: el("requestSearch"),
    requestOldClassFilter: el("requestOldClassFilter"),
    requestConflictPanel: el("requestConflictPanel"),
    clearRequestsButton: el("clearRequestsButton"),
    classCount: el("classCount"),
    classPrefix: el("classPrefix"),
    criterionGender: el("criterionGender"),
    criterionAcademic: el("criterionAcademic"),
    criterionOldClass: el("criterionOldClass"),
    criterionSameOldClassGender: el("criterionSameOldClassGender"),
    criterionBehavior: el("criterionBehavior"),
    classNamePreview: el("classNamePreview"),
    readyStudents: el("readyStudents"),
    readyRequests: el("readyRequests"),
    readyOldClasses: el("readyOldClasses"),
    manualTargetClass: el("manualTargetClass"),
    assignSelectedButton: el("assignSelectedButton"),
    clearSelectionButton: el("clearSelectionButton"),
    resetAssignmentButton: el("resetAssignmentButton"),
    manualUnassignedDrop: el("manualUnassignedDrop"),
    manualStudentSearch: el("manualStudentSearch"),
    manualStudentOldClassFilter: el("manualStudentOldClassFilter"),
    manualUnassignedList: el("manualUnassignedList"),
    manualUnassignedCount: el("manualUnassignedCount"),
    manualClassGrid: el("manualClassGrid"),
    manualCheckSummary: el("manualCheckSummary"),
    manualWarningList: el("manualWarningList"),
    manualWarningSearch: el("manualWarningSearch"),
    manualWarningOldClassFilter: el("manualWarningOldClassFilter"),
    solveReadiness: el("solveReadiness"),
    solveTitle: el("solveTitle"),
    solveButton: el("solveButton"),
    noResults: el("noResults"),
    resultsContent: el("resultsContent"),
    resultMetrics: el("resultMetrics"),
    csvInput: el("csvInput"),
    resultCsvInput: el("resultCsvInput"),
    toast: el("toast"),
    solvingOverlay: el("solvingOverlay"),
    privacyDialog: el("privacyDialog"),
    acceptPrivacyButton: el("acceptPrivacyButton"),
  };

  function defaultState() {
    return {
      dataVersion: 5,
      students: [],
      requests: [],
      settings: {
        classCount: "",
        classPrefix: "",
        criteria: {
          gender: true,
          academic: true,
          oldClass: true,
          sameOldClassGender: true,
          behavior: true,
        },
      },
      assignment: null,
      ignoredWarningKeys: [],
      activeView: "students",
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.students)) return defaultState();
      const loaded = {
        ...defaultState(),
        ...saved,
        settings: {
          ...defaultState().settings,
          ...(saved.settings || {}),
          criteria: {
            ...defaultState().settings.criteria,
            ...(saved.settings?.criteria || {}),
          },
        },
      };
      if (Number(saved.dataVersion || 1) < 2) {
        loaded.students = loaded.students.map((student) => {
          if (student.behavior) return student;
          const repaired = Csv.resolveBehaviorAndNotes("", student.notes);
          return { ...student, ...repaired };
        });
        loaded.dataVersion = 2;
      }
      if (Number(saved.dataVersion || 1) < 3) {
        loaded.students = loaded.students.map((student) => ({
          ...student,
          academic: Academic.migrateLegacy(student.academic),
        }));
        loaded.assignment = null;
        loaded.dataVersion = 3;
      }
      if (Number(saved.dataVersion || 1) < 4) {
        loaded.requests = loaded.requests
          .map((request) => ({
            ...request,
            choices: Array.isArray(request.choices)
              ? request.choices
              : [request.studentB].filter(Boolean),
          }))
          .filter(
            (request) =>
              request.studentA && request.choices.length > 0
          );
        loaded.assignment = null;
        loaded.dataVersion = 4;
      }
      if (Number(saved.dataVersion || 1) < 5) {
        loaded.requests = loaded.requests.map((request) => ({
          ...request,
          priority: ["hard", "auto", "soft"].includes(request.priority)
            ? request.priority
            : "auto",
        }));
        loaded.assignment = null;
        loaded.dataVersion = 5;
      }
      loaded.requests = (loaded.requests || []).map((request) => ({
        ...request,
        priority: "auto",
      }));
      loaded.ignoredWarningKeys = Array.isArray(loaded.ignoredWarningKeys)
        ? loaded.ignoredWarningKeys
        : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
      return loaded;
    } catch (error) {
      return defaultState();
    }
  }

  function saveState() {
    elements.saveState.textContent = "Kaydediliyor...";
    elements.saveState.classList.add("saving");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.setTimeout(() => {
      elements.saveState.textContent = "Kaydedildi";
      elements.saveState.classList.remove("saving");
    }, 250);
  }

  function invalidateResult() {
    syncAssignmentWithSetup();
  }

  function validClassCount(value = state.settings.classCount) {
    if (String(value ?? "").trim() === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(2, Math.min(12, Math.round(parsed)));
  }

  function classPrefixValue(value = state.settings.classPrefix) {
    return String(value ?? "").trim();
  }

  function hasClassSetup() {
    return Boolean(validClassCount() && classPrefixValue());
  }

  function syncAssignmentWithSetup() {
    const classCount = validClassCount();
    if (!classCount || !classPrefixValue()) {
      state.assignment = null;
      selectedManualStudents.clear();
      return;
    }
    if (!state.assignment || typeof state.assignment !== "object") {
      state.assignment = {};
    }
    const validIds = new Set(state.students.map((student) => student.id));
    Object.keys(state.assignment).forEach((studentId) => {
      const classIndex = Number(state.assignment[studentId]);
      if (
        !validIds.has(studentId) ||
        !Number.isInteger(classIndex) ||
        classIndex < 0 ||
        classIndex >= classCount
      ) {
        delete state.assignment[studentId];
      }
    });
    selectedManualStudents.forEach((studentId) => {
      if (!validIds.has(studentId)) selectedManualStudents.delete(studentId);
    });
  }

  function manualClassNames() {
    const classCount = validClassCount();
    if (!classCount) return [];
    return Engine.buildClassNames(
      classCount,
      classPrefixValue(),
      state.settings.classNames
    );
  }

  function assignedStudentsByClass() {
    const classNames = manualClassNames();
    const groups = classNames.map(() => []);
    const assignment = state.assignment || {};
    state.students.forEach((student) => {
      const classIndex = Number(assignment[student.id]);
      if (
        Number.isInteger(classIndex) &&
        classIndex >= 0 &&
        classIndex < groups.length
      ) {
        groups[classIndex].push(student);
      }
    });
    return groups;
  }

  function classSize(classIndex, excludingStudentId = "") {
    return state.students.filter(
      (student) =>
        student.id !== excludingStudentId &&
        Number(state.assignment?.[student.id]) === Number(classIndex)
    ).length;
  }

  function uid(prefix) {
    if (window.crypto && window.crypto.randomUUID) {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  const oldClassPalette = [
    { bg: "#e0f2fe", fg: "#075985", border: "#7dd3fc", accent: "#0284c7" },
    { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d", accent: "#d97706" },
    { bg: "#f1f5f9", fg: "#334155", border: "#cbd5e1", accent: "#64748b" },
    { bg: "#ede9fe", fg: "#5b21b6", border: "#c4b5fd", accent: "#7c3aed" },
    { bg: "#dcfce7", fg: "#166534", border: "#86efac", accent: "#16a34a" },
    { bg: "#ffe4e6", fg: "#9f1239", border: "#fda4af", accent: "#e11d48" },
    { bg: "#ccfbf1", fg: "#115e59", border: "#5eead4", accent: "#0d9488" },
    { bg: "#ffedd5", fg: "#9a3412", border: "#fdba74", accent: "#ea580c" },
    { bg: "#e0e7ff", fg: "#3730a3", border: "#a5b4fc", accent: "#4f46e5" },
    { bg: "#fae8ff", fg: "#86198f", border: "#f0abfc", accent: "#c026d3" },
    { bg: "#dbeafe", fg: "#1e3a8a", border: "#93c5fd", accent: "#2563eb" },
    { bg: "#ecfccb", fg: "#3f6212", border: "#bef264", accent: "#65a30d" },
  ];

  function normalizeText(value) {
    return String(value ?? "").trim().toLocaleLowerCase("tr");
  }

  function oldClassNames() {
    return [...new Set(state.students.map((student) => student.oldClass).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  }

  function oldClassColor(oldClass) {
    const index = Math.max(0, oldClassNames().indexOf(oldClass));
    if (index < oldClassPalette.length) return oldClassPalette[index];
    const hue = (index * 47) % 360;
    return {
      bg: `hsl(${hue} 86% 94%)`,
      fg: `hsl(${hue} 68% 26%)`,
      border: `hsl(${hue} 76% 76%)`,
      accent: `hsl(${hue} 72% 44%)`,
    };
  }

  function oldClassStyle(oldClass) {
    const color = oldClassColor(oldClass);
    return `style="--old-bg:${color.bg};--old-fg:${color.fg};--old-border:${color.border};--old-accent:${color.accent};"`;
  }

  function oldClassBadge(oldClass) {
    return `<span class="old-class-badge" ${oldClassStyle(oldClass)}>${escapeHtml(oldClass)}</span>`;
  }

  function studentNameChip(student, extraClass = "") {
    return `
      <span class="student-name-chip ${extraClass}" ${oldClassStyle(student.oldClass)}>
        ${escapeHtml(student.name)}
      </span>
    `;
  }

  function richClassText(value) {
    const source = String(value ?? "");
    const tokenSources = [];
    const seenNames = new Set();
    state.students.forEach((student) => {
      if (!student.name || seenNames.has(student.name)) return;
      seenNames.add(student.name);
      tokenSources.push({
        text: student.name,
        html: studentNameChip(student, "compact"),
      });
    });
    oldClassNames().forEach((oldClass) => {
      tokenSources.push({
        text: oldClass,
        html: oldClassBadge(oldClass),
      });
    });

    const matches = [];
    tokenSources
      .filter((token) => token.text)
      .sort((a, b) => b.text.length - a.text.length)
      .forEach((token) => {
        let start = source.indexOf(token.text);
        while (start !== -1) {
          const end = start + token.text.length;
          const overlaps = matches.some(
            (match) => start < match.end && end > match.start
          );
          if (!overlaps) matches.push({ start, end, html: token.html });
          start = source.indexOf(token.text, end);
        }
      });

    if (!matches.length) return escapeHtml(source);
    matches.sort((a, b) => a.start - b.start);
    let cursor = 0;
    let html = "";
    matches.forEach((match) => {
      html += escapeHtml(source.slice(cursor, match.start));
      html += match.html;
      cursor = match.end;
    });
    html += escapeHtml(source.slice(cursor));
    return html;
  }

  function resetManualFilters() {
    manualStudentSearchQuery = "";
    manualStudentOldClassFilter = "";
    manualWarningSearchQuery = "";
    manualWarningOldClassFilter = "";
    requestSearchQuery = "";
    requestOldClassFilter = "";
    requestMatchSearchQuery = "";
    editingRequestId = "";
  }

  function stopDragAutoScroll() {
    dragScrollSpeed = 0;
    if (dragScrollFrame) {
      window.cancelAnimationFrame(dragScrollFrame);
      dragScrollFrame = null;
    }
  }

  function runDragAutoScroll() {
    if (!draggedStudentId || !dragScrollSpeed) {
      stopDragAutoScroll();
      return;
    }
    window.scrollBy({ top: dragScrollSpeed, left: 0, behavior: "auto" });
    dragScrollFrame = window.requestAnimationFrame(runDragAutoScroll);
  }

  function updateDragAutoScroll(pointerY) {
    if (!draggedStudentId) {
      stopDragAutoScroll();
      return;
    }
    const edge = 90;
    const maxSpeed = 26;
    if (pointerY < edge) {
      dragScrollSpeed = -Math.max(
        8,
        Math.round(((edge - pointerY) / edge) * maxSpeed)
      );
    } else if (pointerY > window.innerHeight - edge) {
      dragScrollSpeed = Math.max(
        8,
        Math.round(((pointerY - (window.innerHeight - edge)) / edge) * maxSpeed)
      );
    } else {
      stopDragAutoScroll();
      return;
    }
    if (!dragScrollFrame) {
      dragScrollFrame = window.requestAnimationFrame(runDragAutoScroll);
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("show");
    }, 2800);
  }

  function navigate(view) {
    const safeView = viewTitles[view] ? view : "students";
    state.activeView = safeView;
    document.querySelectorAll(".view").forEach((section) => {
      section.classList.toggle("active", section.id === `${safeView}View`);
    });
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === safeView);
    });
    elements.pageTitle.textContent = viewTitles[safeView];
    document.querySelector(".sidebar").classList.remove("open");
    if (safeView === "results") renderResults();
    saveState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderAll() {
    renderSummary();
    renderStudentFilters();
    renderStudents();
    renderRequestSelectors();
    renderRequests();
    renderDistribution();
    renderResults();
    elements.navStudentCount.textContent = state.students.length;
    elements.navRequestCount.textContent = state.requests.length;
    navigate(state.activeView || "students");
  }

  function renderSummary() {
    const female = state.students.filter(
      (student) => student.gender === "K"
    ).length;
    const male = state.students.length - female;
    const academicAverage = state.students.length
      ? state.students.reduce(
          (sum, student) => sum + Academic.normalize(student.academic),
          0
        ) / state.students.length
      : 0;
    const behavior = state.students.filter(
      (student) => student.behavior
    ).length;
    const oldClasses = new Set(
      state.students.map((student) => student.oldClass).filter(Boolean)
    );

    elements.studentTotal.textContent = state.students.length;
    elements.genderTotal.textContent = `${female} / ${male}`;
    elements.academicTotal.textContent = academicAverage
      ? academicAverage.toFixed(2)
      : "-";
    elements.behaviorTotal.textContent = behavior;
    elements.oldClassSummary.textContent = oldClasses.size
      ? `${oldClasses.size} eski şubeden`
      : "Henüz veri yok";
  }

  function renderStudentFilters() {
    const selected = elements.oldClassFilter.value;
    const oldClasses = [...new Set(state.students.map((s) => s.oldClass))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "tr"));
    elements.oldClassFilter.innerHTML =
      '<option value="">Tüm Eski Sınıflar</option>' +
      oldClasses
        .map(
          (oldClass) =>
            `<option value="${escapeHtml(oldClass)}">${escapeHtml(
              oldClass
            )}</option>`
        )
        .join("");
    if (oldClasses.includes(selected)) elements.oldClassFilter.value = selected;
  }

  function renderStudents() {
    const query = elements.studentSearch.value
      .trim()
      .toLocaleLowerCase("tr");
    const oldClass = elements.oldClassFilter.value;
    const filtered = state.students
      .filter((student) => {
        const searchable =
          `${student.name} ${student.oldClass}`.toLocaleLowerCase("tr");
        return (
          (!query || searchable.includes(query)) &&
          (!oldClass || student.oldClass === oldClass)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    elements.studentTableBody.innerHTML = filtered
      .map(
        (student) => `
          <tr class="${student.gender === "E" ? "gender-e" : "gender-k"}">
            <td>
              <button
                class="editable-cell student-name"
                type="button"
                data-inline-edit="name"
                data-student-id="${escapeHtml(student.id)}"
                title="Öğrenci adını düzenle"
              >
                <span>
                  <strong>${studentNameChip(student)}</strong>
                </span>
              </button>
            </td>
            <td>
              <button
                class="editable-cell editable-value"
                type="button"
                data-inline-edit="gender"
                data-student-id="${escapeHtml(student.id)}"
                title="Cinsiyeti düzenle"
              >${student.gender === "K" ? "Kız" : "Erkek"}</button>
            </td>
            <td>
              <button
                class="editable-cell"
                type="button"
                data-inline-edit="oldClass"
                data-student-id="${escapeHtml(student.id)}"
                title="Eski Sınıfı Düzenle"
              >${oldClassBadge(student.oldClass)}</button>
            </td>
            <td>
              <button
                class="editable-cell"
                type="button"
                data-inline-edit="academic"
                data-student-id="${escapeHtml(student.id)}"
                title="Akademik puanı düzenle"
              ><span class="academic-badge">${escapeHtml(
                Academic.format(student.academic)
              )}</span></button>
            </td>
            <td>
              <button
                class="editable-cell editable-value"
                type="button"
                data-inline-edit="behavior"
                data-student-id="${escapeHtml(student.id)}"
                title="Davranış durumunu düzenle"
              >${
                student.behavior
                  ? '<span class="behavior-badge">İşaretli</span>'
                  : '<span class="muted">Yok</span>'
              }</button>
            </td>
            <td>
              <button
                class="editable-cell editable-note"
                type="button"
                data-inline-edit="notes"
                data-student-id="${escapeHtml(student.id)}"
                title="Notu düzenle"
              >${escapeHtml(student.notes || "-")}</button>
            </td>
            <td class="actions-cell">
              <button class="icon-button danger" data-delete-student="${escapeHtml(
                student.id
              )}">Sil</button>
            </td>
          </tr>
        `
      )
      .join("");

    const table = elements.studentTableBody.closest("table");
    const showEmpty = state.students.length === 0;
    table.hidden = showEmpty;
    elements.studentEmptyState.hidden = !showEmpty;
    if (!showEmpty && filtered.length === 0) {
      elements.studentTableBody.innerHTML = `
        <tr><td colspan="7" class="muted">Aramanızla eşleşen öğrenci bulunamadı.</td></tr>
      `;
    }
  }

  function openInlineEditor(button) {
    const student = studentById(button.dataset.studentId);
    const field = button.dataset.inlineEdit;
    if (!student || !field) return;

    const titles = {
      name: "Öğrenci adını düzenle",
      gender: "Cinsiyeti düzenle",
      oldClass: "Eski Sınıfı Düzenle",
      academic: "Akademik puanı düzenle",
      behavior: "Davranış durumunu düzenle",
      notes: "Öğrenci notunu düzenle",
    };
    let control = "";
    if (field === "name") {
      control = `<input name="value" type="text" required value="${escapeHtml(
        student.name
      )}" autocomplete="off" />`;
    } else if (field === "gender") {
      control = `
        <select name="value">
          <option value="K" ${student.gender === "K" ? "selected" : ""}>Kız</option>
          <option value="E" ${student.gender === "E" ? "selected" : ""}>Erkek</option>
        </select>`;
    } else if (field === "oldClass") {
      control = `<input name="value" type="text" required maxlength="12" value="${escapeHtml(
        student.oldClass
      )}" autocomplete="off" />`;
    } else if (field === "academic") {
      control = `
        <select name="value">
          ${Object.entries(academicLabels)
            .map(
              ([value, label]) =>
                `<option value="${value}" ${
                  Number(student.academic) === Number(value) ? "selected" : ""
                }>${value} - ${escapeHtml(label)}</option>`
            )
            .join("")}
        </select>`;
    } else if (field === "behavior") {
      control = `
        <select name="value">
          <option value="false" ${student.behavior ? "" : "selected"}>Yok</option>
          <option value="true" ${student.behavior ? "selected" : ""}>İşaretli</option>
        </select>`;
    } else if (field === "notes") {
      control = `<textarea name="value" rows="3" placeholder="Not ekleyin...">${escapeHtml(
        student.notes || ""
      )}</textarea>`;
    }

    elements.inlineEditor.dataset.studentId = student.id;
    elements.inlineEditor.dataset.field = field;
    elements.inlineEditorTitle.textContent = titles[field];
    elements.inlineEditorControl.innerHTML = control;
    elements.inlineEditor.hidden = false;

    const rect = button.getBoundingClientRect();
    const editorWidth = elements.inlineEditor.offsetWidth;
    const editorHeight = elements.inlineEditor.offsetHeight;
    const left = Math.max(
      10,
      Math.min(rect.left, window.innerWidth - editorWidth - 10)
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= editorHeight + 10
        ? rect.bottom + 6
        : Math.max(10, rect.top - editorHeight - 6);
    elements.inlineEditor.style.left = `${left}px`;
    elements.inlineEditor.style.top = `${top}px`;
    const input = elements.inlineEditor.querySelector(
      "input, select, textarea"
    );
    if (input) {
      input.focus();
      if (input.select && input.tagName !== "SELECT") input.select();
    }
  }

  function closeInlineEditor() {
    elements.inlineEditor.hidden = true;
    elements.inlineEditorControl.innerHTML = "";
    delete elements.inlineEditor.dataset.studentId;
    delete elements.inlineEditor.dataset.field;
  }

  function saveInlineEdit(event) {
    event.preventDefault();
    const student = studentById(elements.inlineEditor.dataset.studentId);
    const field = elements.inlineEditor.dataset.field;
    const control = elements.inlineEditor.querySelector("[name='value']");
    if (!student || !field || !control) return;
    let value = control.value.trim();
    if ((field === "name" || field === "oldClass") && !value) {
      showToast("Bu alan boş bırakılamaz.");
      return;
    }
    if (field === "oldClass") value = value.toLocaleUpperCase("tr");
    if (field === "academic") value = Number(value);
    if (field === "behavior") value = value === "true";
    student[field] = value;
    invalidateResult();
    closeInlineEditor();
    saveState();
    renderSummary();
    renderStudentFilters();
    renderStudents();
    renderRequestSelectors();
    renderRequests();
    renderDistribution();
    renderResults();
    showToast("Öğrenci bilgisi güncellendi.");
  }

  function openStudentDialog(student) {
    elements.studentForm.reset();
    elements.studentId.value = student ? student.id : "";
    elements.studentName.value = student ? student.name : "";
    elements.studentGender.value = student ? student.gender : "K";
    elements.studentOldClass.value = student ? student.oldClass : "";
    elements.studentAcademic.value = student
      ? Academic.normalize(student.academic)
      : 2;
    elements.studentBehavior.checked = student ? student.behavior : false;
    elements.studentNotes.value = student ? student.notes || "" : "";
    elements.studentDialogTitle.textContent = student
      ? "Öğrenciyi düzenle"
      : "Yeni öğrenci";
    renderAcademicOutput();
    elements.studentDialog.showModal();
    window.setTimeout(() => elements.studentName.focus(), 50);
  }

  function renderAcademicOutput() {
    const value = Number(elements.studentAcademic.value);
    elements.academicOutput.textContent = Academic.format(value);
  }

  function saveStudent(event) {
    event.preventDefault();
    if (event.submitter && event.submitter.value === "cancel") {
      elements.studentDialog.close();
      return;
    }
    const id = elements.studentId.value || uid("ogr");
    const student = {
      id,
      name: elements.studentName.value.trim(),
      gender: elements.studentGender.value,
      oldClass: elements.studentOldClass.value.trim().toLocaleUpperCase("tr"),
      academic: Academic.normalize(elements.studentAcademic.value),
      behavior: elements.studentBehavior.checked,
      notes: elements.studentNotes.value.trim(),
    };
    if (!student.name || !student.oldClass) {
      showToast("Ad soyad ve eski sınıf alanları gereklidir.");
      return;
    }
    const index = state.students.findIndex((item) => item.id === id);
    if (index >= 0) state.students[index] = student;
    else state.students.push(student);
    invalidateResult();
    elements.studentDialog.close();
    saveState();
    renderAll();
    showToast(index >= 0 ? "Öğrenci güncellendi." : "Öğrenci eklendi.");
  }

  function deleteStudent(id) {
    const student = state.students.find((item) => item.id === id);
    if (!student) return;
    const relatedRequests = state.requests.filter(
      (request) =>
        request.studentA === id ||
        request.choices.includes(id)
    ).length;
    const detail = relatedRequests
      ? ` Bu öğrenciye bağlı ${relatedRequests} veli isteği de silinecek.`
      : "";
    if (!window.confirm(`${student.name} silinsin mi?${detail}`)) return;
    state.students = state.students.filter((item) => item.id !== id);
    state.requests = state.requests
      .filter((request) => request.studentA !== id)
      .map((request) => ({
        ...request,
        choices: request.choices.filter((choiceId) => choiceId !== id),
      }))
      .filter((request) => request.choices.length > 0);
    invalidateResult();
    saveState();
    renderAll();
    showToast("Öğrenci silindi.");
  }

  function renderRequestSelectors() {
    const currentA = elements.requestStudentA.value;
    const currentChoices = elements.requestChoices.map(
      (select) => select.value
    );
    const options = state.students
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .map(
        (student) =>
          `<option value="${escapeHtml(student.id)}">${escapeHtml(
            student.name
          )} (${escapeHtml(student.oldClass)})</option>`
      )
      .join("");
    const placeholder =
      state.students.length < 2
        ? '<option value="">En az iki öğrenci ekleyin</option>'
        : '<option value="">Öğrenci seçin</option>';
    const optionalPlaceholder =
      state.students.length < 2
        ? '<option value="">En az iki öğrenci ekleyin</option>'
        : '<option value="">Tercih eklenmedi</option>';
    elements.requestStudentA.innerHTML = placeholder + options;
    elements.requestChoices.forEach((select, index) => {
      select.innerHTML =
        (index === 0 ? placeholder : optionalPlaceholder) + options;
    });
    if (state.students.some((item) => item.id === currentA)) {
      elements.requestStudentA.value = currentA;
    }
    currentChoices.forEach((choiceId, index) => {
      if (state.students.some((item) => item.id === choiceId)) {
        elements.requestChoices[index].value = choiceId;
      }
    });
    elements.requestStudentA.disabled = state.students.length < 2;
    elements.requestChoices.forEach((select) => {
      select.disabled = state.students.length < 2;
    });
    elements.addRequestButton.disabled = state.students.length < 2;
    elements.addRequestButton.textContent = editingRequestId
      ? "İsteği Güncelle"
      : "İsteği Ekle";
  }

  function renderRequestFilterOptions() {
    const classNames = oldClassNames();
    if (requestOldClassFilter && !classNames.includes(requestOldClassFilter)) {
      requestOldClassFilter = "";
    }
    elements.requestOldClassFilter.innerHTML =
      '<option value="">Tüm Eski Sınıflar</option>' +
      classNames
        .map(
          (oldClass) =>
            `<option value="${escapeHtml(oldClass)}" ${
              oldClass === requestOldClassFilter ? "selected" : ""
            }>${escapeHtml(oldClass)}</option>`
        )
        .join("");
  }

  function studentById(id) {
    return state.students.find((student) => student.id === id);
  }

  function renderRequests() {
    renderRequestFilterOptions();
    const analysis = getAnalysis();
    const outcomes = new Map(
      (analysis ? analysis.requestOutcomes : []).map((outcome) => [
        outcome.requestId,
        outcome,
      ])
    );
    const requestSearch = normalizeText(requestSearchQuery);
    const selectedOldClass = requestOldClassFilter;
    const visibleRequests = state.requests.filter((request) => {
      const involvedStudents = [
        studentById(request.studentA),
        ...request.choices.map((choiceId) => studentById(choiceId)),
      ].filter(Boolean);
      if (
        selectedOldClass &&
        !involvedStudents.some((student) => student.oldClass === selectedOldClass)
      ) {
        return false;
      }
      if (!requestSearch) return true;
      const people = involvedStudents
        .map((student) => `${student.name} ${student.oldClass}`)
        .join(" ");
      const typeLabel = request.type === "together" ? "Birlikte" : "Ayrı";
      return normalizeText(`${people} ${typeLabel} ${request.note}`).includes(
        requestSearch
      );
    });
    elements.requestSearch.value = requestSearchQuery;
    elements.requestOldClassFilter.value = requestOldClassFilter;
    elements.requestList.innerHTML = visibleRequests.length
      ? visibleRequests
      .map((request) => {
        const studentA = studentById(request.studentA);
        const choices = request.choices
          .map((choiceId) => studentById(choiceId))
          .filter(Boolean);
        if (!studentA || choices.length === 0) return "";
        const together = request.type === "together";
        const outcome = outcomes.get(request.id);
        return `
          <article
            class="request-item ${focusedRequestId === request.id ? "focused" : ""}"
            data-request-card="${escapeHtml(request.id)}"
          >
            <div>
              <div class="request-people">
                <strong>${studentNameChip(studentA)}</strong>
                <select
                  class="request-inline-select ${
                    together ? "together" : "apart"
                  }"
                  data-request-id="${escapeHtml(request.id)}"
                  data-request-field="type"
                  aria-label="İstek Türü"
                >
                  <option value="together" ${
                    together ? "selected" : ""
                  }>Birlikte</option>
                  <option value="apart" ${
                    together ? "" : "selected"
                  }>Ayrı</option>
                </select>
              </div>
              <ol class="preference-list">
                ${choices
                  .map(
                    (student, index) => `
                      <li
                        class="${
                        outcome &&
                        outcome.satisfied &&
                        outcome.satisfiedIds.includes(student.id)
                          ? "fulfilled"
                          : ""
                        }"
                        ${oldClassStyle(student.oldClass)}
                      >
                        <span class="preference-index">${index + 1}</span>
                        ${studentNameChip(student, "compact")}
                        ${
                          outcome &&
                          outcome.satisfied &&
                          outcome.satisfiedIds.includes(student.id)
                            ? "<b>Karşılandı</b>"
                            : ""
                        }
                        <button
                          class="preference-delete"
                          type="button"
                          data-delete-request-choice="${escapeHtml(request.id)}"
                          data-choice-id="${escapeHtml(student.id)}"
                          title="Bu tercihi sil"
                          aria-label="Bu tercihi sil"
                        >
                          ×
                        </button>
                      </li>
                    `
                  )
                  .join("")}
              </ol>
              <p>${escapeHtml(request.note || "Açıklama eklenmedi.")}</p>
            </div>
            <div class="request-actions">
              <button
                class="icon-button"
                type="button"
                data-edit-request="${escapeHtml(request.id)}"
              >
                Düzenle
              </button>
              <button class="icon-button danger" data-delete-request="${escapeHtml(
                request.id
              )}">Sil</button>
            </div>
          </article>
        `;
      })
      .join("")
      : state.requests.length
        ? '<div class="manual-empty">Bu aramayla eşleşen istek yok.</div>'
        : "";
    const conflicts = Engine.detectRequestConflicts(
      state.requests,
      state.students
    );
    elements.requestConflictPanel.hidden = conflicts.length === 0;
    elements.requestConflictPanel.innerHTML = conflicts.length
      ? `<strong>Çelişen istek bulundu</strong>${conflicts
          .map((conflict) => `<p>${richClassText(conflict.message)}</p>`)
          .join("")}`
      : "";
    elements.requestEmptyState.hidden = state.requests.length > 0;
    elements.requestList.hidden = state.requests.length === 0;
    elements.refreshRequestsButton.disabled = state.requests.length === 0;
    elements.checkRequestsButton.disabled = state.requests.length === 0;
    elements.clearRequestsButton.disabled = state.requests.length === 0;
    elements.requestListSummary.textContent = state.requests.length
      ? requestSearch || selectedOldClass
        ? `${visibleRequests.length}/${state.requests.length} istek gösteriliyor.`
        : `${state.requests.length} istek girildi.`
      : "Henüz istek girilmedi.";
  }

  function addRequest(event) {
    event.preventDefault();
    const studentA = elements.requestStudentA.value;
    const rawChoices = elements.requestChoices
      .map((select) => select.value)
      .filter(Boolean);
    const choices = [...new Set(rawChoices)];
    const type = elements.requestType.value;
    if (!studentA || choices.length === 0) {
      showToast("Tercihte bulunan öğrenciyi ve en az ilk tercihi seçin.");
      return;
    }
    if (choices.includes(studentA)) {
      showToast("Öğrenci kendisini tercih edemez.");
      return;
    }
    if (choices.length !== rawChoices.length) {
      showToast("Aynı öğrenci birden fazla tercih sırasına yazılamaz.");
      return;
    }
    const duplicate = state.requests.some(
      (request) =>
        request.id !== editingRequestId &&
        request.studentA === studentA &&
        request.type === type
    );
    if (duplicate) {
      showToast(
        `Bu öğrenci için zaten bir ${requestTypeProblemLabel(
          type
        )} isteği var. Mevcut isteği düzenleyin veya Hata Kontrol Et'i kullanın.`
      );
      return;
    }
    if (conflictingOppositeRequest(studentA, type, choices, editingRequestId)) {
      showToast(
        "Aynı öğrenci aynı arkadaşı için hem Birlikte hem Ayrı isteği giremez."
      );
      return;
    }
    const wasEditing = Boolean(editingRequestId);
    if (editingRequestId) {
      const request = state.requests.find((item) => item.id === editingRequestId);
      if (!request) {
        editingRequestId = "";
        elements.addRequestButton.textContent = "İsteği Ekle";
        showToast("Düzenlenecek istek bulunamadı.");
        return;
      }
      request.studentA = studentA;
      request.choices = choices;
      request.type = type;
      request.priority = "auto";
      request.note = elements.requestNote.value.trim();
    } else {
      state.requests.push({
        id: uid("istek"),
        studentA,
        choices,
        type,
        priority: "auto",
        note: elements.requestNote.value.trim(),
      });
    }
    elements.requestForm.reset();
    editingRequestId = "";
    elements.addRequestButton.textContent = "İsteği Ekle";
    invalidateResult();
    saveState();
    renderAll();
    state.activeView = "requests";
    navigate("requests");
    showToast(wasEditing ? "Veli isteği güncellendi." : "Veli isteği eklendi.");
  }

  function beginEditRequest(id) {
    const request = state.requests.find((item) => item.id === id);
    if (!request) return;
    editingRequestId = id;
    renderRequestSelectors();
    elements.requestStudentA.value = request.studentA;
    elements.requestType.value = request.type;
    elements.requestNote.value = request.note || "";
    elements.requestChoices.forEach((select, index) => {
      select.value = request.choices[index] || "";
    });
    elements.addRequestButton.textContent = "İsteği Güncelle";
    elements.requestForm.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => elements.requestStudentA.focus(), 180);
  }

  function deleteRequestChoice(requestId, choiceId) {
    const request = state.requests.find((item) => item.id === requestId);
    if (!request) return;
    request.choices = request.choices.filter((id) => id !== choiceId);
    if (!request.choices.length) {
      state.requests = state.requests.filter((item) => item.id !== requestId);
      if (editingRequestId === requestId) editingRequestId = "";
      showToast("Son tercih silindiği için istek kaldırıldı.");
    } else {
      showToast("Tercih silindi.");
    }
    invalidateResult();
    saveState();
    renderRequests();
    renderDistribution();
    renderResults();
  }

  function updateRequestField(id, field, value) {
    const request = state.requests.find((item) => item.id === id);
    if (!request || field !== "type") return;
    const duplicate = state.requests.some(
      (item) =>
        item.id !== id &&
        item.studentA === request.studentA &&
        item.type === value
    );
    if (duplicate) {
      showToast(
        `Bu öğrenci için zaten bir ${requestTypeProblemLabel(
          value
        )} isteği var.`
      );
      renderRequests();
      return;
    }
    if (
      conflictingOppositeRequest(
        request.studentA,
        value,
        request.choices || [],
        id
      )
    ) {
      showToast(
        "Bu değişiklik aynı iki öğrenciyi hem Birlikte hem Ayrı yapıyor."
      );
      renderRequests();
      return;
    }
    request[field] = value;
    invalidateResult();
    saveState();
    renderRequests();
    renderDistribution();
    renderResults();
    const conflicts = Engine.detectRequestConflicts(
      state.requests,
      state.students
    );
    showToast(
      conflicts.length
        ? "İstek güncellendi; çelişki uyarısını kontrol edin."
        : "İstek güncellendi."
    );
  }

  function deleteRequest(id) {
    state.requests = state.requests.filter((request) => request.id !== id);
    if (editingRequestId === id) {
      editingRequestId = "";
      elements.requestForm.reset();
      elements.addRequestButton.textContent = "İsteği Ekle";
    }
    invalidateResult();
    saveState();
    renderAll();
    state.activeView = "requests";
    navigate("requests");
    showToast("İstek silindi.");
  }

  function clearRequests() {
    if (!state.requests.length) return;
    const confirmed = window.confirm(
      `${state.requests.length} veli isteğinin tamamı silinsin mi?`
    );
    if (!confirmed) return;

    state.requests = [];
    invalidateResult();
    saveState();
    renderAll();
    state.activeView = "requests";
    navigate("requests");
    showToast("Tüm veli istekleri silindi.");
  }

  function manualStudentRow(student, classIndex) {
    const selected = selectedManualStudents.has(student.id);
    return `
      <label
        class="manual-student ${selected ? "selected" : ""}"
        draggable="true"
        data-manual-student="${escapeHtml(student.id)}"
        ${oldClassStyle(student.oldClass)}
      >
        <input
          type="checkbox"
          data-manual-select="${escapeHtml(student.id)}"
          ${selected ? "checked" : ""}
        />
        <span class="manual-student-main">
          <strong>${studentNameChip(student)}</strong>
          <small class="manual-student-meta">
            <span ${oldClassStyle(student.oldClass)}>${escapeHtml(student.oldClass)}</span>
            <span>${student.gender === "K" ? "Kız" : "Erkek"}</span>
            <span>${escapeHtml(Academic.format(student.academic))}</span>
            ${student.behavior ? "<span>Davranış işaretli</span>" : ""}
          </small>
        </span>
        ${
          classIndex === null
            ? '<em>Atanmamış</em>'
            : ""
        }
      </label>
    `;
  }

  function checkChip(label, status, detail) {
    return `
      <div class="check-chip ${status}">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
    `;
  }

  function displayCategory(category) {
    const labels = {
      "Eski şube": "Eski Şube",
      "Kendi sınıfından hemcinsi": "Kendi Sınıfından Hemcinsi",
      "Veli istekleri": "Veli İstekleri",
      "Veli isteği": "Veli İsteği",
      "Çelişen istek": "Çelişen İstek",
      "Kız - erkek": "Kız - Erkek",
      "Davranış desteği": "Davranış Desteği",
    };
    return labels[category] || category;
  }

  function requestFocusName(request) {
    const student = request ? studentById(request.studentA) : null;
    return student?.name || "";
  }

  function focusRequest(requestId) {
    const request = state.requests.find((item) => item.id === requestId);
    if (!request) return;
    focusedRequestId = requestId;
    requestSearchQuery = requestFocusName(request);
    renderRequests();
    navigate("requests");
    window.setTimeout(() => {
      const card = Array.from(
        document.querySelectorAll("[data-request-card]")
      ).find((item) => item.dataset.requestCard === requestId);
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("focused");
    }, 80);
  }

  function liveCheckWarnings(analysis) {
    if (!analysis) return [];
    return analysis.violations;
  }

  function warningKey(warning) {
    return [
      warning.category || "",
      warning.severity || "",
      warning.message || "",
      warning.requestId || "",
      ...(Array.isArray(warning.requestIds) ? warning.requestIds : []),
    ].join("|");
  }

  function isWarningIgnored(warning) {
    return state.ignoredWarningKeys.includes(warningKey(warning));
  }

  function toggleIgnoredWarning(key) {
    if (!key) return;
    const existingIndex = state.ignoredWarningKeys.indexOf(key);
    if (existingIndex >= 0) {
      state.ignoredWarningKeys.splice(existingIndex, 1);
    } else {
      state.ignoredWarningKeys.push(key);
    }
    saveState();
    renderLiveChecks(getAnalysis());
  }

  function warningRelatedOldClasses(warning) {
    const related = new Set();
    oldClassNames().forEach((oldClass) => {
      if (String(warning.message || "").includes(oldClass)) {
        related.add(oldClass);
      }
    });
    const requestIds = [
      warning.requestId,
      ...(Array.isArray(warning.requestIds) ? warning.requestIds : []),
    ].filter(Boolean);
    requestIds.forEach((requestId) => {
      const request = state.requests.find((item) => item.id === requestId);
      if (!request) return;
      [request.studentA, ...(request.choices || [])].forEach((studentId) => {
        const student = studentById(studentId);
        if (student?.oldClass) related.add(student.oldClass);
      });
    });
    if (warning.category === "Atama") {
      state.students
        .filter((student) => state.assignment?.[student.id] === undefined)
        .forEach((student) => related.add(student.oldClass));
    }
    return related;
  }

  function renderManualWarningFilterOptions() {
    const classNames = oldClassNames();
    if (
      manualWarningOldClassFilter &&
      !classNames.includes(manualWarningOldClassFilter)
    ) {
      manualWarningOldClassFilter = "";
    }
    elements.manualWarningOldClassFilter.innerHTML =
      '<option value="">Tüm Eski Sınıflar</option>' +
      classNames
        .map(
          (oldClass) =>
            `<option value="${escapeHtml(oldClass)}">${escapeHtml(oldClass)}</option>`
        )
        .join("");
    elements.manualWarningOldClassFilter.value = manualWarningOldClassFilter;
  }

  function renderManualStudentFilterOptions() {
    const classNames = oldClassNames();
    if (
      manualStudentOldClassFilter &&
      !classNames.includes(manualStudentOldClassFilter)
    ) {
      manualStudentOldClassFilter = "";
    }
    elements.manualStudentOldClassFilter.innerHTML =
      '<option value="">Tüm Eski Sınıflar</option>' +
      classNames
        .map(
          (oldClass) =>
            `<option value="${escapeHtml(oldClass)}">${escapeHtml(oldClass)}</option>`
        )
        .join("");
    elements.manualStudentOldClassFilter.value = manualStudentOldClassFilter;
  }

  function filteredLiveWarnings(analysis) {
    const query = normalizeText(manualWarningSearchQuery);
    const oldClass = manualWarningOldClassFilter;
    return liveCheckWarnings(analysis).filter((warning) => {
      const searchable = normalizeText(`${warning.category} ${warning.message}`);
      return (
        (!query || searchable.includes(query)) &&
        (!oldClass || warningRelatedOldClasses(warning).has(oldClass))
      );
    });
  }

  function renderLiveChecks(analysis) {
    renderManualWarningFilterOptions();
    if (!hasClassSetup()) {
      elements.manualCheckSummary.innerHTML = checkChip(
        "Sınıf Ayarı",
        "warn",
        "Sınıf sayısı ve başlangıcı bekleniyor"
      );
      elements.manualWarningList.innerHTML =
        '<div class="manual-empty">Sınıflar hazırlandığında canlı kontroller burada görünür.</div>';
      return;
    }
    if (!analysis) {
      elements.manualCheckSummary.innerHTML = "";
      elements.manualWarningList.innerHTML =
        '<div class="manual-empty">Henüz kontrol edilecek yerleşim yok.</div>';
      return;
    }

    const assignedCount = Object.keys(state.assignment || {}).length;
    const requestSatisfied = analysis.requestOutcomes.filter(
      (outcome) => outcome.satisfied
    ).length;
    const categoryCount = (category) =>
      analysis.violations.filter((item) => item.category === category).length;
    const capacityIssues = analysis.perClass.filter(
      (item) => item.size > MAX_CLASS_SIZE
    ).length;
    const chips = [
      checkChip(
        "Atama",
        assignedCount === state.students.length ? "good" : "warn",
        `${assignedCount}/${state.students.length} öğrenci yerleşti`
      ),
      checkChip(
        "Veli İstekleri",
        requestSatisfied === analysis.requestOutcomes.length ? "good" : "bad",
        `${requestSatisfied}/${analysis.requestOutcomes.length} karşılandı`
      ),
      checkChip(
        "Kız - Erkek",
        !analysis.criteria.gender
          ? "off"
          : analysis.metrics.femaleSpread <= 1
            ? "good"
            : "bad",
        !analysis.criteria.gender
          ? "Etkin Değil"
          : `Fark ${analysis.metrics.femaleSpread}`
      ),
      checkChip(
        "Akademik",
        !analysis.criteria.academic
          ? "off"
          : analysis.metrics.academicSpread <= 0.35
            ? "good"
            : "warn",
        !analysis.criteria.academic
          ? "Etkin Değil"
          : `Fark ${analysis.metrics.academicSpread.toFixed(2)}`
      ),
      checkChip(
        "Eski Şube",
        !analysis.criteria.oldClass
          ? "off"
          : categoryCount("Eski şube") === 0
            ? "good"
            : "warn",
        !analysis.criteria.oldClass
          ? "Etkin Değil"
          : categoryCount("Eski şube")
            ? `${categoryCount("Eski şube")} uyarı`
            : "Dengeli"
      ),
      checkChip(
        "Hemcins",
        !analysis.criteria.sameOldClassGender
          ? "off"
          : categoryCount("Kendi sınıfından hemcinsi") === 0
            ? "good"
            : "bad",
        !analysis.criteria.sameOldClassGender
          ? "Etkin Değil"
          : categoryCount("Kendi sınıfından hemcinsi")
            ? `${categoryCount("Kendi sınıfından hemcinsi")} uyarı`
            : "Karşılandı"
      ),
      checkChip(
        "Davranış",
        !analysis.criteria.behavior
          ? "off"
          : analysis.metrics.behaviorSpread <= 1
            ? "good"
            : "warn",
        !analysis.criteria.behavior
          ? "Etkin Değil"
          : `Fark ${analysis.metrics.behaviorSpread}`
      ),
      checkChip(
        "Kapasite",
        capacityIssues ? "bad" : "good",
        capacityIssues ? `${capacityIssues} sınıf dolu` : `En fazla ${MAX_CLASS_SIZE}`
      ),
    ];
    elements.manualCheckSummary.innerHTML = chips.join("");

    const allWarnings = liveCheckWarnings(analysis);
    const warnings = filteredLiveWarnings(analysis);
    const activeTotal = allWarnings.filter((warning) => !isWarningIgnored(warning)).length;
    const ignoredTotal = allWarnings.length - activeTotal;
    const activeShown = warnings.filter((warning) => !isWarningIgnored(warning)).length;
    const ignoredShown = warnings.length - activeShown;
    const filterActive =
      Boolean(manualWarningSearchQuery.trim()) ||
      Boolean(manualWarningOldClassFilter);
    elements.manualWarningList.innerHTML = warnings.length
      ? `<div class="manual-warning-count">${
          filterActive
            ? `${activeShown}/${activeTotal} uyarı gösteriliyor${
                ignoredShown ? ` | ${ignoredShown} gizlenen uyarı` : ""
              }`
            : `${activeTotal} uyarı${
                ignoredTotal ? ` | ${ignoredTotal} gizlenen uyarı` : ""
              }`
        }</div>` +
        warnings
          .map(
            (warning) => {
              const requestId =
                warning.requestId ||
                (Array.isArray(warning.requestIds) ? warning.requestIds[0] : "");
              const key = warningKey(warning);
              const ignored = isWarningIgnored(warning);
              return `
              <div
                class="manual-warning ${warning.severity} ${
                  requestId ? "clickable" : ""
                } ${ignored ? "ignored" : ""}"
                ${requestId ? `data-warning-request-id="${escapeHtml(requestId)}"` : ""}
                ${requestId ? 'title="İlgili veli isteğini göster"' : ""}
              >
                <button
                  class="warning-ignore-button"
                  type="button"
                  data-warning-ignore="${escapeHtml(key)}"
                  aria-pressed="${ignored ? "true" : "false"}"
                  title="${ignored ? "Uyarıyı tekrar dikkate al" : "Uyarıyı dikkate alma"}"
                >
                  ${ignored ? "✓" : "×"}
                </button>
                <strong>${escapeHtml(displayCategory(warning.category))}</strong>
                <span>${richClassText(warning.message)}</span>
              </div>
            `;
            }
          )
          .join("")
      : allWarnings.length
        ? '<div class="manual-empty">Bu arama ve filtreyle gösterilecek uyarı yok.</div>'
        : '<div class="all-good">Görünen kontroller şu an karşılanıyor.</div>';
  }

  function renderManualWorkspace() {
    const classNames = manualClassNames();
    const setupReady = hasClassSetup();
    renderManualStudentFilterOptions();
    if (!setupReady) {
      elements.manualTargetClass.innerHTML = "";
      elements.manualUnassignedCount.textContent = "0";
      elements.manualStudentSearch.value = manualStudentSearchQuery;
      elements.manualStudentOldClassFilter.value = manualStudentOldClassFilter;
      elements.manualUnassignedList.innerHTML =
        '<div class="manual-empty">Önce yeni sınıf sayısı ve sınıf adı başlangıcı girin.</div>';
      elements.manualClassGrid.innerHTML = "";
      elements.assignSelectedButton.disabled = true;
      elements.clearSelectionButton.disabled = true;
      elements.resetAssignmentButton.disabled = true;
      renderLiveChecks(null);
      return;
    }

    const groups = assignedStudentsByClass();
    const assignedIds = new Set(
      state.students
        .filter((student) => state.assignment?.[student.id] !== undefined)
        .map((student) => student.id)
    );
    const unassigned = state.students
      .filter((student) => !assignedIds.has(student.id))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
    const studentSearch = normalizeText(manualStudentSearchQuery);
    const visibleUnassigned = unassigned.filter((student) => {
      const matchesSearch =
        !studentSearch ||
        normalizeText(`${student.name} ${student.oldClass}`).includes(
          studentSearch
        );
      const matchesOldClass =
        !manualStudentOldClassFilter ||
        student.oldClass === manualStudentOldClassFilter;
      return matchesSearch && matchesOldClass;
    });
    elements.manualTargetClass.innerHTML = classNames
      .map((name, index) => `<option value="${index}">${escapeHtml(name)}</option>`)
      .join("");
    elements.assignSelectedButton.disabled =
      selectedManualStudents.size === 0 || !classNames.length;
    elements.clearSelectionButton.disabled = selectedManualStudents.size === 0;
    elements.resetAssignmentButton.disabled = assignedIds.size === 0;
    elements.manualStudentSearch.value = manualStudentSearchQuery;
    elements.manualStudentOldClassFilter.value = manualStudentOldClassFilter;
    const unassignedFilterActive =
      Boolean(studentSearch) || Boolean(manualStudentOldClassFilter);
    elements.manualUnassignedCount.textContent = unassignedFilterActive
      ? `${visibleUnassigned.length}/${unassigned.length}`
      : unassigned.length;
    elements.manualUnassignedList.innerHTML = visibleUnassigned.length
      ? visibleUnassigned.map((student) => manualStudentRow(student, null)).join("")
      : unassigned.length
        ? '<div class="manual-empty">Bu aramayla eşleşen atanmamış öğrenci yok.</div>'
        : '<div class="manual-empty">Tüm öğrenciler bir sınıfa yerleştirildi.</div>';
    elements.manualClassGrid.innerHTML = classNames
      .map((name, classIndex) => {
        const students = sortedClassStudents({
          index: classIndex,
          students: groups[classIndex],
        });
        const female = students.filter((student) => student.gender === "K").length;
        const academicAverage = students.length
          ? students.reduce((sum, student) => sum + student.academic, 0) /
            students.length
          : 0;
        const behavior = students.filter((student) => student.behavior).length;
        const oldDistribution = oldClassNames()
          .map((oldClass) => {
            const count = students.filter(
              (student) => student.oldClass === oldClass
            ).length;
            if (!count) return "";
            return `<span class="old-class-count" ${oldClassStyle(oldClass)}><span>${escapeHtml(
              oldClass
            )}</span><b>${count}</b></span>`;
          })
          .join("");
        const full = students.length >= MAX_CLASS_SIZE;
        return `
          <article
            class="manual-class-card ${full ? "full" : ""}"
            data-manual-drop-class="${classIndex}"
          >
            <header>
              <span class="class-letter">${escapeHtml(name)}</span>
              <div>
                <h3>${escapeHtml(name)} Sınıfı</h3>
                <small>${students.length}/${MAX_CLASS_SIZE} öğrenci</small>
              </div>
            </header>
            <div class="class-stats compact">
              <div><strong>${students.length}</strong><span>Mevcut</span></div>
              <div><strong>${female} / ${students.length - female}</strong><span>Kız / Erkek</span></div>
              <div><strong>${academicAverage.toFixed(2)}</strong><span>Başarı</span></div>
              <div><strong>${behavior}</strong><span>Davranış</span></div>
            </div>
            <div class="old-class-distribution">
              <strong>Eski Sınıf Dağılımı</strong>
              <div>
                ${
                  oldDistribution ||
                  '<span class="old-class-empty">Henüz öğrenci yok.</span>'
                }
              </div>
            </div>
            <div class="class-sort-bar manual-sort-bar">
              <span>Sırala:</span>
              <button
                type="button"
                class="${classSorts[classIndex] === "gender" ? "active" : ""}"
                data-sort-class="${classIndex}"
                data-sort-type="gender"
              >Kız / Erkek</button>
              <button
                type="button"
                class="${classSorts[classIndex] === "academic" ? "active" : ""}"
                data-sort-class="${classIndex}"
                data-sort-type="academic"
              >Akademik</button>
              <button
                type="button"
                class="${classSorts[classIndex] === "oldClass" ? "active" : ""}"
                data-sort-class="${classIndex}"
                data-sort-type="oldClass"
              >Eski Sınıf</button>
            </div>
            <div class="manual-student-list">
              ${
                students.length
                  ? students
                      .map((student) => manualStudentRow(student, classIndex))
                      .join("")
                  : '<div class="manual-empty">Bu sınıf boş.</div>'
              }
            </div>
          </article>
        `;
      })
      .join("");
    renderLiveChecks(getAnalysis());
  }


  function renderDistribution() {
    syncAssignmentWithSetup();
    elements.classCount.value = state.settings.classCount ?? "";
    elements.classPrefix.value = classPrefixValue();
    elements.criterionGender.value = String(
      state.settings.criteria.gender
    );
    elements.criterionAcademic.value = String(
      state.settings.criteria.academic
    );
    elements.criterionOldClass.value = String(
      state.settings.criteria.oldClass
    );
    elements.criterionSameOldClassGender.value = String(
      state.settings.criteria.sameOldClassGender
    );
    elements.criterionBehavior.value = String(
      state.settings.criteria.behavior
    );
    const classCount = validClassCount();
    const classPrefix = classPrefixValue();
    const setupReady = Boolean(classCount && classPrefix);
    elements.classNamePreview.innerHTML = setupReady
      ? manualClassNames()
          .map((name) => `<span>${escapeHtml(name)}</span>`)
          .join("")
      : '<span>Yeni sınıf sayısı ve sınıf adı başlangıcı girin.</span>';
    const oldClasses = new Set(state.students.map((student) => student.oldClass));
    elements.readyStudents.textContent = state.students.length;
    elements.readyRequests.textContent = state.requests.length;
    elements.readyOldClasses.textContent = oldClasses.size;
    elements.solveButton.disabled = !setupReady;
    elements.solveTitle.textContent = setupReady
      ? `${classCount} sınıf için otomatik karıştırma hazır`
      : "Otomatik karıştırma için sınıf bilgilerini girin";
    elements.solveReadiness.textContent =
      !setupReady
        ? "Yeni sınıf sayısı ve sınıf adı başlangıcı boş bırakılamaz."
        : `${state.students.length} öğrenci, ${state.requests.length} istek ve etkin denge ölçütleri birlikte değerlendirilecek.`;
    renderManualWorkspace();
  }

  function updateSettings() {
    const previousCount = state.settings.classCount;
    const previousPrefix = state.settings.classPrefix;
    state.settings.classCount = validClassCount(elements.classCount.value) || "";
    state.settings.classPrefix = classPrefixValue(elements.classPrefix.value);
    if (
      previousCount !== state.settings.classCount ||
      previousPrefix !== state.settings.classPrefix
    ) {
      delete state.settings.classNames;
    }
    state.settings.criteria = {
      gender: elements.criterionGender.value === "true",
      academic: elements.criterionAcademic.value === "true",
      oldClass: elements.criterionOldClass.value === "true",
      sameOldClassGender:
        elements.criterionSameOldClassGender.value === "true",
      behavior: elements.criterionBehavior.value === "true",
    };
    syncAssignmentWithSetup();
    saveState();
    renderDistribution();
    renderResults();
  }

  function solveClasses() {
    const classCount = validClassCount();
    const classPrefix = classPrefixValue();
    if (!classCount) {
      showToast("Yeni sınıf sayısını girin.");
      return;
    }
    if (!classPrefix) {
      showToast("Sınıf adı başlangıcını girin.");
      return;
    }
    if (!state.students.length) {
      showToast("Otomatik karıştırma için önce öğrenci ekleyin.");
      return;
    }
    const capacity = classCount * MAX_CLASS_SIZE;
    if (state.students.length > capacity) {
      showToast(
        `${state.students.length} öğrenci için en az ${Math.ceil(
          state.students.length / MAX_CLASS_SIZE
        )} sınıf gerekir.`
      );
      return;
    }
    try {
      elements.solvingOverlay.hidden = false;
      const solved = Engine.solve(
        state.students,
        state.requests.map((request) => ({ ...request, priority: "auto" })),
        {
          ...state.settings,
          classCount,
          classPrefix,
          maxClassSize: MAX_CLASS_SIZE,
          restarts: 4,
          iterations: Math.min(
            3600,
            Math.max(1200, state.students.length * 14)
          ),
        }
      );
      state.assignment = solved.assignment;
      state.settings.classNames = solved.classNames;
      selectedManualStudents.clear();
      saveState();
      renderDistribution();
      renderResults();
      navigate("results");
      showToast("Sınıflar istekler ve etkin ölçütlere göre otomatik karıştırıldı.");
    } catch (error) {
      showToast(error.message || "Otomatik karıştırma tamamlanamadı.");
    } finally {
      elements.solvingOverlay.hidden = true;
    }
  }

  function getAnalysis() {
    if (!state.assignment || !hasClassSetup()) return null;
    const classCount = validClassCount() || Number(state.settings.classCount) || 6;
    const classNames = Engine.buildClassNames(
      classCount,
      classPrefixValue(),
      state.settings.classNames
    );
    return Engine.analyze(
      state.students,
      state.requests,
      state.assignment,
      {
        ...state.settings,
        classNames,
        maxClassSize: MAX_CLASS_SIZE,
      }
    );
  }

  function sortedClassStudents(classInfo) {
    const sortType = classSorts[classInfo.index] || "name";
    return classInfo.students.slice().sort((a, b) => {
      if (sortType === "gender") {
        return (
          (a.gender === "K" ? 0 : 1) -
            (b.gender === "K" ? 0 : 1) ||
          a.name.localeCompare(b.name, "tr")
        );
      }
      if (sortType === "oldClass") {
        return (
          a.oldClass.localeCompare(b.oldClass, "tr", {
            numeric: true,
          }) || a.name.localeCompare(b.name, "tr")
        );
      }
      if (sortType === "academic") {
        return (
          b.academic - a.academic ||
          a.name.localeCompare(b.name, "tr")
        );
      }
      return a.name.localeCompare(b.name, "tr");
    });
  }

  function oldClassDistributionHtml(oldClasses) {
    return Object.entries(oldClasses)
      .sort(([a], [b]) => a.localeCompare(b, "tr", { numeric: true }))
      .map(
        ([name, count]) =>
          `<span class="old-class-chip"><b>${escapeHtml(
            name
          )}</b><em>${count}</em></span>`
      )
      .join("");
  }

  function renderResults() {
    const analysis = getAnalysis();
    elements.noResults.hidden = Boolean(analysis);
    elements.resultsContent.hidden = !analysis;
    if (!analysis) return;

    elements.resultMetrics.innerHTML = `
      <article class="metric-card">
        <span>Mevcut farkı</span>
        <strong>${analysis.metrics.sizeSpread}</strong>
        <small>${analysis.metrics.sizeSpread <= 1 ? "Dengeli" : "Kontrol gerekli"}</small>
      </article>
      <article class="metric-card">
        <span>Kız öğrenci farkı</span>
        <strong>${analysis.metrics.femaleSpread}</strong>
        <small>${
          analysis.criteria.gender
            ? analysis.metrics.femaleSpread <= 1
              ? "Dengeli"
              : "Kontrol gerekli"
            : "Kriter etkin değil"
        }</small>
      </article>
      <article class="metric-card">
        <span>Başarı ort. farkı</span>
        <strong>${analysis.metrics.academicSpread.toFixed(2)}</strong>
        <small>${
          analysis.criteria.academic
            ? analysis.metrics.academicSpread <= 0.35
              ? "Dengeli"
              : "Kontrol gerekli"
            : "Kriter etkin değil"
        }</small>
      </article>
      <article class="metric-card">
        <span>Davranış işareti farkı</span>
        <strong>${analysis.metrics.behaviorSpread}</strong>
        <small>${
          analysis.criteria.behavior
            ? analysis.metrics.behaviorSpread <= 1
              ? "Dengeli"
              : "Kontrol gerekli"
            : "Kriter etkin değil"
        }</small>
      </article>
    `;

  }

  function moveStudent(studentId, classIndex) {
    syncAssignmentWithSetup();
    if (!state.assignment) return;
    if (classIndex === "" || classIndex === null || classIndex === undefined) {
      delete state.assignment[studentId];
    } else {
      const targetClass = Number(classIndex);
      if (!Number.isInteger(targetClass)) return;
      if (Number(state.assignment[studentId]) === targetClass) return;
      if (classSize(targetClass, studentId) >= MAX_CLASS_SIZE) {
        showToast(`Bu sınıf en fazla ${MAX_CLASS_SIZE} öğrenci alabilir.`);
        renderDistribution();
        renderResults();
        return;
      }
      state.assignment[studentId] = targetClass;
    }
    selectedManualStudents.delete(studentId);
    saveState();
    renderDistribution();
    renderResults();
    showToast("Yerleşim güncellendi; kontroller yeniden hesaplandı.");
  }

  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob(["\ufeff", content], {
      type: type || "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    const rows = [
      [
        "Ad Soyad",
        "Cinsiyet",
        "Eski Sınıf",
        "Akademik Başarı",
        "Davranış Sorunu",
        "Not",
      ],
      ["Ahmet Yılmaz", "E", "4A", "Orta", "Hayır", ""],
      ["Ayşe Demir", "K", "4B", "İyi", "Evet", "Kısa not"],
    ];
    downloadFile(
      "ogrenci-sablonu.csv",
      rows.map((row) => row.map(csvCell).join(";")).join("\r\n")
    );
  }

  function exportStudentsCsv() {
    const rows = [
      [
        "Ad Soyad",
        "Cinsiyet",
        "Eski Sınıf",
        "Akademik Başarı",
        "Davranış Sorunu",
        "Not",
      ],
      ...state.students
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "tr"))
        .map((student) => [
          student.name,
          student.gender,
          student.oldClass,
          Academic.format(student.academic),
          student.behavior ? "Evet" : "Hayır",
          student.notes || "",
        ]),
    ];
    downloadFile(
      "karma-analiz-guncel-ogrenci-listesi.csv",
      rows.map((row) => row.map(csvCell).join(";")).join("\r\n")
    );
  }

  function downloadRequestTemplate() {
    const rows = [
      [
        "Birlikte - Ayrı",
        "Tercihte bulunan öğrenci ismi",
        "1. tercih",
        "2. tercih",
        "3. tercih",
        "4. tercih",
        "5. tercih",
      ],
      [
        "Birlikte",
        "Ahmet Yılmaz",
        "Ayşe Demir",
        "Ali Kaya",
        "",
        "",
        "",
      ],
      ["Ayrı", "Elif Çelik", "Mehmet Can", "", "", "", ""],
    ];
    downloadFile(
      "veli-istekleri-sablonu.csv",
      rows.map((row) => row.map(csvCell).join(";")).join("\r\n")
    );
  }

  function exportRequestsCsv() {
    const rows = [
      [
        "Birlikte - Ayrı",
        "Tercihte bulunan öğrenci ismi",
        "1. tercih",
        "2. tercih",
        "3. tercih",
        "4. tercih",
        "5. tercih",
      ],
      ...state.requests.map((request) => {
        const subject = studentById(request.studentA);
        const choices = request.choices.map((choiceId) => studentById(choiceId));
        return [
          request.type === "apart" ? "Ayrı" : "Birlikte",
          subject?.name || "",
          ...Array.from({ length: 5 }, (_, index) => choices[index]?.name || ""),
        ];
      }),
    ];
    downloadFile(
      "karma-analiz-guncel-veli-istekleri.csv",
      rows.map((row) => row.map(csvCell).join(";")).join("\r\n")
    );
  }

  function normalizedStudentMatches(name) {
    const normalized = Csv.normalizeHeader(name);
    if (!normalized) return [];
    return state.students.filter(
      (student) => Csv.normalizeHeader(student.name) === normalized
    );
  }

  function studentOptions(selectedId, originalName, allowNone) {
    let heading = "";
    if (!selectedId && originalName) {
      heading = `<option value="__unmatched__" disabled selected>Listede yok: ${escapeHtml(
        originalName
      )}</option>`;
      if (allowNone) {
        heading += '<option value="">Tercih yok</option>';
      }
    } else if (allowNone) {
      heading = '<option value="">Tercih yok</option>';
    } else {
      heading = '<option value="" disabled selected>Öğrenci seçin</option>';
    }
    return (
      heading +
      state.students
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "tr"))
        .map(
          (student) =>
            `<option value="${escapeHtml(student.id)}" ${
              student.id === selectedId ? "selected" : ""
            }>${escapeHtml(student.name)} (${escapeHtml(
              student.oldClass
            )})</option>`
        )
        .join("")
    );
  }

  function requestTypeLabel(type) {
    return type === "apart" ? "Ayrı" : "Birlikte";
  }

  function requestTypeProblemLabel(type) {
    return type === "apart" ? "ayrı" : "birlikte";
  }

  function requestPairKey(studentA, studentB) {
    return [studentA, studentB].filter(Boolean).sort().join("|");
  }

  function conflictingOppositeRequest(studentA, type, choiceIds, ignoredId = "") {
    const oppositeType = type === "together" ? "apart" : "together";
    const pairKeys = new Set(
      choiceIds
        .filter(Boolean)
        .map((choiceId) => requestPairKey(studentA, choiceId))
    );
    return state.requests.find(
      (request) =>
        request.id !== ignoredId &&
        request.type === oppositeType &&
        (request.choices || []).some((choiceId) =>
          pairKeys.has(requestPairKey(request.studentA, choiceId))
        )
    );
  }

  function paddedFive(values = []) {
    return Array.from({ length: 5 }, (_, index) => values[index] || "");
  }

  function normalizeRequestMatchRow(row, index = 0) {
    return {
      ...row,
      auditId: row.auditId || row.originalId || `pending-${index}`,
      type: row.type === "apart" ? "apart" : "together",
      subjectName: row.subjectName || "",
      subjectId: row.subjectId || "",
      choiceNames: paddedFive(row.choiceNames || []),
      choiceIds: paddedFive(row.choiceIds || []),
      issueMessages: Array.isArray(row.issueMessages)
        ? row.issueMessages
        : [],
    };
  }

  function requestRowHasIssue(row) {
    return Boolean(
      row.hasMismatch ||
        (Array.isArray(row.issueMessages) && row.issueMessages.length)
    );
  }

  function requestMatchRowText(row) {
    const subject = studentById(row.subjectId);
    const choices = row.choiceIds
      .map((choiceId) => studentById(choiceId))
      .filter(Boolean);
    return [
      row.subjectName,
      subject?.name,
      row.type === "apart" ? "Ayrı" : "Birlikte",
      ...row.choiceNames,
      ...choices.map((student) => `${student.name} ${student.oldClass}`),
      ...(row.issueMessages || []),
      row.note || "",
    ].join(" ");
  }

  function requestMatchRowMatchesSearch(row) {
    const query = normalizeText(requestMatchSearchQuery);
    return !query || normalizeText(requestMatchRowText(row)).includes(query);
  }

  function pendingRowSubjectKey(row) {
    return row.subjectId || Csv.normalizeHeader(row.subjectName);
  }

  function requestMatchSortKey(row) {
    const subjectKey = pendingRowSubjectKey(row) || row.auditId || "";
    const typeOrder = row.type === "together" ? "0" : "1";
    return `${subjectKey}|${typeOrder}|${row.auditId || row.originalId || ""}`;
  }

  function sortRequestMatchRows(rows) {
    return rows
      .slice()
      .sort((a, b) =>
        requestMatchSortKey(a).localeCompare(requestMatchSortKey(b), "tr")
      );
  }

  function refreshPendingRequestRows() {
    pendingRequestRows = sortRequestMatchRows(
      annotateRequestRows(pendingRequestRows, { includeConflicts: true })
    );
  }

  function requestRowsFromRequests(requests) {
    return requests.map((request, index) => {
      const subject = studentById(request.studentA);
      const choices = (request.choices || []).map((choiceId) =>
        studentById(choiceId)
      );
      return normalizeRequestMatchRow(
        {
          originalId: request.id,
          auditId: request.id || `existing-${index}`,
          source: "existing",
          type: request.type,
          subjectName: subject?.name || request.studentA || "",
          subjectId: subject?.id || "",
          choiceNames: paddedFive(choices.map((student) => student?.name || "")),
          choiceIds: paddedFive(choices.map((student) => student?.id || "")),
          hasMismatch:
            !subject ||
            (request.choices || []).some((choiceId) => !studentById(choiceId)),
          note: request.note || "",
        },
        index
      );
    });
  }

  function addRequestRowIssue(row, message) {
    if (!row.issueMessages.includes(message)) {
      row.issueMessages.push(message);
    }
  }

  function annotateRequestRows(rows, { includeConflicts = true } = {}) {
    const annotated = rows.map((row, index) =>
      normalizeRequestMatchRow(
        {
          ...row,
          issueMessages: [],
        },
        index
      )
    );

    annotated.forEach((row) => {
      const choiceIds = row.choiceIds.filter(Boolean);
      const unresolvedChoiceNames = row.choiceNames.filter(
        (name, index) => name && !row.choiceIds[index]
      );

      row.hasMismatch = Boolean(
        row.typeValid === false ||
          !row.subjectId ||
          (row.subjectName && !row.subjectId) ||
          unresolvedChoiceNames.length
      );
      if (row.typeValid === false) {
        addRequestRowIssue(
          row,
          "Birlikte / Ayrı alanı okunamadı; doğru istek türünü seçin."
        );
      }
      if (row.subjectName && !row.subjectId) {
        addRequestRowIssue(
          row,
          "Tercihte bulunan öğrenci listede yok veya eşleşmedi."
        );
      } else if (!row.subjectId) {
        addRequestRowIssue(
          row,
          "Tercihte bulunan öğrenci seçilmemiş."
        );
      }
      if (unresolvedChoiceNames.length) {
        addRequestRowIssue(
          row,
          "Tercihlerde listede olmayan öğrenci var; öğrenci seçin veya Tercih yok yapın."
        );
      }
      if (!choiceIds.length) {
        addRequestRowIssue(
          row,
          "Tercih yapılmamış; en az bir tercih seçin veya satırı silin."
        );
      }
      if (row.subjectId && choiceIds.includes(row.subjectId)) {
        addRequestRowIssue(row, "Öğrenci kendisini tercih edemez.");
      }
      if (new Set(choiceIds).size !== choiceIds.length) {
        addRequestRowIssue(row, "Aynı tercih aynı satırda tekrar yazılamaz.");
      }
      if (row.hasMismatch && !row.issueMessages.length) {
        addRequestRowIssue(
          row,
          "Bu satırda listede olmayan veya eksik bilgi var; satırı kontrol edin."
        );
      }
    });

    const grouped = new Map();
    annotated.forEach((row) => {
      const key = pendingRowSubjectKey(row);
      if (!key) return;
      const groupKey = `${key}|${row.type}`;
      if (!grouped.has(groupKey)) grouped.set(groupKey, []);
      grouped.get(groupKey).push(row);
    });
    grouped.forEach((group) => {
      if (group.length < 2) return;
      const type = group[0].type;
      const countText = group.length === 2 ? "2" : "birden fazla";
      const message = `Aynı isimdeki öğrenci ${countText} ${requestTypeProblemLabel(
        type
      )} girişi yapmaya çalışıyor. Hangi satır kalacaksa onu bırakın, diğerini silin.`;
      group.forEach((row) => addRequestRowIssue(row, message));
    });

    if (includeConflicts) {
      const validRows = annotated.filter(
        (row) => row.subjectId && row.choiceIds.some(Boolean)
      );
      const rowByAuditId = new Map(
        validRows.map((row) => [row.auditId, row])
      );
      const tempRequests = validRows.map((row) => ({
        id: row.auditId,
        studentA: row.subjectId,
        choices: row.choiceIds.filter(Boolean),
        type: row.type,
        priority: "auto",
      }));
      Engine.detectRequestConflicts(tempRequests, state.students).forEach(
        (conflict) => {
          (conflict.requestIds || []).forEach((requestId) => {
            const row = rowByAuditId.get(requestId);
            if (row) addRequestRowIssue(row, conflict.message);
          });
        }
      );
    }

    return annotated;
  }

  function requestFromImportRow(row) {
    return {
      id: row.originalId || uid("istek"),
      studentA: row.subjectId,
      choices: row.choiceIds.filter(Boolean),
      type: row.type,
      priority: "auto",
      note: Object.prototype.hasOwnProperty.call(row, "note")
        ? row.note
        : "CSV dosyasından aktarıldı.",
    };
  }

  function renderRequestMatchDialog() {
    clearRequestMatchNotice();
    const auditMode = pendingRequestMode === "audit";
    elements.requestMatchEyebrow.textContent = auditMode
      ? "Veli isteği hata kontrolü"
      : "CSV öğrenci eşleştirmesi";
    elements.requestMatchTitle.textContent = auditMode
      ? "Uygun olmayan istekleri düzeltin"
      : "Uyuşmayan girişleri düzeltin";
    elements.requestMatchIntro.textContent = auditMode
      ? "Aynı öğrenciye ait fazla girişleri, boş tercihleri veya çelişen istekleri düzeltin. Kullanılmayacak satırları silebilirsiniz."
      : "CSV'deki bazı isimler öğrenci listesiyle eşleşmedi. Doğru öğrencileri seçin. Kullanılmayacak tercihleri “Tercih yok” yapabilir veya istemediğiniz satırı silebilirsiniz.";
    elements.saveRequestMatchesButton.textContent = auditMode
      ? "Düzeltilen istekleri kaydet"
      : "Düzeltilen istekleri aktar";
    elements.requestMatchSearch.value = requestMatchSearchQuery;
    elements.requestMatchList.innerHTML = pendingRequestRows
      .map(
        (row, rowIndex) => {
          const matchesSearch = requestMatchRowMatchesSearch(row);
          return `
          <article
            class="match-row ${
              requestRowHasIssue(row) ? "match-row-error" : "match-row-ok"
            } ${matchesSearch ? "" : "match-row-hidden"}"
            data-match-row="${rowIndex}"
          >
            <button
              class="button button-danger-ghost match-delete-button"
              type="button"
              data-delete-match-row="${rowIndex}"
            >
              Satırı sil
            </button>
            ${
              row.issueMessages?.length
                ? `<div class="match-row-issues">${row.issueMessages
                    .map((message) => `<p>${escapeHtml(message)}</p>`)
                    .join("")}</div>`
                : ""
            }
            <label>
              Birlikte / Ayrı
              <select name="type-${rowIndex}">
                <option value="together" ${
                  row.type === "together" ? "selected" : ""
                }>Birlikte</option>
                <option value="apart" ${
                  row.type === "apart" ? "selected" : ""
                }>Ayrı</option>
              </select>
            </label>
            <label>
              Tercihte bulunan öğrenci
              <select
                name="subject-${rowIndex}"
                class="${
                  !row.subjectId && row.subjectName ? "match-unresolved" : ""
                }"
                required
              >
                ${studentOptions(
                  row.subjectId,
                  row.subjectName,
                  false
                )}
              </select>
            </label>
            <div class="match-choices">
              ${row.choiceNames
                .map(
                  (name, choiceIndex) => `
                    <label>
                      ${choiceIndex + 1}. tercih
                      <select
                        name="choice-${rowIndex}-${choiceIndex}"
                        class="${
                          name && !row.choiceIds[choiceIndex]
                            ? "match-unresolved"
                            : ""
                        }"
                      >
                        ${studentOptions(
                          row.choiceIds[choiceIndex],
                          name,
                          true
                        )}
                      </select>
                    </label>
                  `
                )
                .join("")}
            </div>
          </article>
        `;
        }
      )
      .join("");
    updateClearUnmatchedChoicesButton();
    if (!elements.requestMatchDialog.open) {
      elements.requestMatchDialog.showModal();
    }
  }

  function importRequestCsv(file) {
    if (!file) return;
    if (state.students.length < 2) {
      showToast("Önce öğrenci listesini ekleyin.");
      elements.requestCsvInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ""));
        if (rows.length < 2) {
          throw new Error("CSV dosyasında istek bulunamadı.");
        }
        const headers = rows[0].map(Csv.normalizeHeader);
        const findColumn = (...names) => Csv.findColumn(headers, ...names);
        const typeColumn = findColumn(
          "birlikte - ayri",
          "birlikte ayri",
          "istek turu"
        );
        const subjectColumn = findColumn(
          "tercihte bulunan ogrenci ismi",
          "tercihte bulunan ogrenci"
        );
        const choiceColumns = [1, 2, 3, 4, 5].map((number) =>
          findColumn(
            `${number}. tercih`,
            `${number} tercih`
          )
        );
        if (
          typeColumn < 0 ||
          subjectColumn < 0 ||
          choiceColumns[0] < 0
        ) {
          throw new Error(
            'CSV dosyasında "Birlikte - Ayrı", "Tercihte bulunan öğrenci ismi" ve "1. tercih" sütunları gereklidir.'
          );
        }
        const parsed = rows
          .slice(1)
          .map((cells) => {
            const typeText = Csv.normalizeHeader(
              cells[typeColumn] || ""
            );
            const typeValid =
              typeText.includes("birlikte") ||
              typeText.includes("ayri");
            const subjectName = String(
              cells[subjectColumn] || ""
            ).trim();
            const choiceNames = choiceColumns.map((column) =>
              column >= 0 ? String(cells[column] || "").trim() : ""
            );
            const subjectMatches = normalizedStudentMatches(subjectName);
            const choiceMatches = choiceNames.map((name) =>
              name ? normalizedStudentMatches(name) : []
            );
            return {
              type: typeText.includes("ayri") ? "apart" : "together",
              subjectName,
              typeValid,
              subjectId:
                subjectMatches.length === 1 ? subjectMatches[0].id : "",
              choiceNames,
              choiceIds: choiceMatches.map((matches) =>
                matches.length === 1 ? matches[0].id : ""
              ),
              hasMismatch:
                !typeValid ||
                subjectMatches.length !== 1 ||
                choiceNames.some(
                  (name, index) =>
                    name && choiceMatches[index].length !== 1
                ),
            };
          })
          .filter(
            (row) =>
              row.subjectName || row.choiceNames.some(Boolean)
          );
        if (!parsed.length) {
          throw new Error("Aktarılabilecek geçerli istek bulunamadı.");
        }

        const incomingRows = parsed.map((row, index) =>
          normalizeRequestMatchRow(
            {
              ...row,
              source: "import",
              auditId: `import-${Date.now()}-${index}`,
              note: "CSV dosyasından aktarıldı.",
            },
            index
          )
        );
        const checkedRows = annotateRequestRows(
          [...requestRowsFromRequests(state.requests), ...incomingRows],
          { includeConflicts: true }
        );
        const incomingCheckedRows = checkedRows.filter(
          (row) => row.source === "import"
        );
        pendingImportCleanRows = incomingCheckedRows.filter(
          (row) => !requestRowHasIssue(row)
        );
        pendingRequestRows = sortRequestMatchRows(
          checkedRows.filter(requestRowHasIssue)
        );
        pendingDeletedRequestIds.clear();
        if (pendingRequestRows.length) {
          pendingRequestMode = "import";
          renderRequestMatchDialog();
          showRequestMatchNotice(
            `${pendingRequestRows.length} satırda düzeltmeniz gereken durum var. Düzgün satırlar siz onaylayınca aktarılacak.`,
            "info"
          );
        } else {
          state.requests.push(...incomingCheckedRows.map(requestFromImportRow));
          invalidateResult();
          saveState();
          renderRequests();
          renderDistribution();
          renderResults();
          showToast(`${incomingCheckedRows.length} veli isteği aktarıldı.`);
          resetPendingRequestState();
        }
      } catch (error) {
        showToast(error.message || "Veli isteği CSV dosyası okunamadı.");
      } finally {
        elements.requestCsvInput.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function requestMatchValue(name) {
    const control = elements.requestMatchForm.elements.namedItem(name);
    return control ? String(control.value || "") : "";
  }

  function clearRequestMatchNotice() {
    elements.requestMatchNotice.hidden = true;
    elements.requestMatchNotice.textContent = "";
    elements.requestMatchNotice.dataset.tone = "";
    elements.requestMatchList
      .querySelectorAll(".match-row-error")
      .forEach((row) => row.classList.remove("match-row-error"));
  }

  function showRequestMatchNotice(message, tone = "error", control = null) {
    elements.requestMatchNotice.textContent = message;
    elements.requestMatchNotice.dataset.tone = tone;
    elements.requestMatchNotice.hidden = false;

    if (control) {
      control.classList.add("match-unresolved");
      control.closest(".match-row")?.classList.add("match-row-error");
      control.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => control.focus(), 180);
    }
  }

  function unresolvedRequestChoiceControls() {
    return Array.from(
      elements.requestMatchList.querySelectorAll(
        'select[name^="choice-"].match-unresolved'
      )
    ).filter((select) => select.value === "__unmatched__");
  }

  function updateClearUnmatchedChoicesButton() {
    const count = unresolvedRequestChoiceControls().length;
    elements.clearUnmatchedChoicesButton.disabled = count === 0;
    elements.clearUnmatchedChoicesButton.textContent = count
      ? `Hatalı tercihleri Tercih yok yap (${count})`
      : "Hatalı tercihleri Tercih yok yap";
  }

  function clearUnmatchedRequestChoices() {
    const controls = unresolvedRequestChoiceControls();
    if (!controls.length) {
      showRequestMatchNotice("Tercihlerde düzeltilmesi gereken hata kalmadı.", "info");
      return;
    }

    controls.forEach((select) => {
      select.value = "";
      select.classList.remove("match-unresolved");
    });
    capturePendingRequestEdits();
    refreshPendingRequestRows();
    renderRequestMatchDialog();
    showRequestMatchNotice(
      `${controls.length} hatalı tercih “Tercih yok” olarak ayarlandı.`,
      "success"
    );
  }

  function resetPendingRequestState() {
    pendingRequestRows = [];
    pendingImportCleanRows = [];
    pendingDeletedRequestIds.clear();
    pendingRequestMode = "import";
    requestMatchSearchQuery = "";
  }

  function commitRequestCorrections(correctedRows) {
    const idsToRemove = new Set([
      ...pendingDeletedRequestIds,
      ...pendingRequestRows
        .map((row) => row.originalId)
        .filter(Boolean),
    ]);
    const rowsToSave = [...pendingImportCleanRows, ...correctedRows];
    state.requests = state.requests.filter(
      (request) => !idsToRemove.has(request.id)
    );
    state.requests.push(...rowsToSave.map(requestFromImportRow));
    resetPendingRequestState();
    elements.requestMatchDialog.close();
    invalidateResult();
    saveState();
    renderRequests();
    renderDistribution();
    renderResults();
  }

  function duplicateInFinalRequests(correctedRows) {
    const idsToRemove = new Set([
      ...pendingDeletedRequestIds,
      ...pendingRequestRows
        .map((row) => row.originalId)
        .filter(Boolean),
    ]);
    const candidates = [
      ...state.requests
        .filter((request) => !idsToRemove.has(request.id))
        .map((request) => ({
          subjectId: request.studentA,
          type: request.type,
          rowIndex: null,
        })),
      ...pendingImportCleanRows.map((row) => ({
        subjectId: row.subjectId,
        type: row.type,
        rowIndex: null,
      })),
      ...correctedRows.map((row) => ({
        subjectId: row.subjectId,
        type: row.type,
        rowIndex: row.matchRowIndex,
      })),
    ].filter((item) => item.subjectId);
    const seen = new Map();
    for (const item of candidates) {
      const key = `${item.subjectId}|${item.type}`;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(item);
    }
    for (const group of seen.values()) {
      if (group.length < 2) continue;
      const editable = group.find((item) => item.rowIndex !== null);
      if (editable) return editable;
    }
    return null;
  }

  function finalRequestItems(correctedRows) {
    const idsToRemove = new Set([
      ...pendingDeletedRequestIds,
      ...pendingRequestRows
        .map((row) => row.originalId)
        .filter(Boolean),
    ]);
    return [
      ...state.requests
        .filter((request) => !idsToRemove.has(request.id))
        .map((request) => ({
          request,
          rowIndex: null,
        })),
      ...pendingImportCleanRows.map((row) => ({
        request: {
          id: row.auditId,
          studentA: row.subjectId,
          choices: row.choiceIds.filter(Boolean),
          type: row.type,
          priority: "auto",
        },
        rowIndex: null,
      })),
      ...correctedRows.map((row) => ({
        request: {
          id: row.auditId || row.originalId || `corrected-${row.matchRowIndex}`,
          studentA: row.subjectId,
          choices: row.choiceIds.filter(Boolean),
          type: row.type,
          priority: "auto",
        },
        rowIndex: row.matchRowIndex,
      })),
    ];
  }

  function conflictInFinalRequests(correctedRows) {
    const items = finalRequestItems(correctedRows);
    const byId = new Map(items.map((item) => [item.request.id, item]));
    const conflicts = Engine.detectRequestConflicts(
      items.map((item) => item.request),
      state.students
    );
    for (const conflict of conflicts) {
      const editable = (conflict.requestIds || [])
        .map((requestId) => byId.get(requestId))
        .find((item) => item && item.rowIndex !== null);
      if (editable) {
        return {
          rowIndex: editable.rowIndex,
          message: conflict.message,
        };
      }
    }
    return null;
  }

  function saveMatchedRequests(event) {
    event.preventDefault();
    clearRequestMatchNotice();
    const correctedRows = [];
    for (let rowIndex = 0; rowIndex < pendingRequestRows.length; rowIndex += 1) {
      const sourceRow = pendingRequestRows[rowIndex];
      const subjectId = requestMatchValue(`subject-${rowIndex}`);
      const choiceValues = [0, 1, 2, 3, 4].map((choiceIndex) =>
        requestMatchValue(`choice-${rowIndex}-${choiceIndex}`)
      );
      const unresolvedChoiceIndex = choiceValues.findIndex(
        (value) => value === "__unmatched__"
      );
      const choiceIds = choiceValues.filter(Boolean);
      if (!subjectId || subjectId === "__unmatched__") {
        showRequestMatchNotice(
          `${rowIndex + 1}. satır için tercihte bulunan öğrenciyi seçin.`,
          "error",
          elements.requestMatchForm.elements.namedItem(`subject-${rowIndex}`)
        );
        return;
      }
      if (unresolvedChoiceIndex >= 0) {
        showRequestMatchNotice(
          `${rowIndex + 1}. satırdaki ${
            unresolvedChoiceIndex + 1
          }. tercih listede yok. Öğrenci veya Tercih yok seçin.`,
          "error",
          elements.requestMatchForm.elements.namedItem(
            `choice-${rowIndex}-${unresolvedChoiceIndex}`
          )
        );
        return;
      }
      if (!choiceIds.length) {
        showRequestMatchNotice(
          `${rowIndex + 1}. satır için en az bir tercih seçin.`,
          "error",
          elements.requestMatchForm.elements.namedItem(`choice-${rowIndex}-0`)
        );
        return;
      }
      if (choiceIds.includes(subjectId)) {
        const choiceIndex = choiceValues.indexOf(subjectId);
        showRequestMatchNotice(
          `${rowIndex + 1}. satırda öğrenci kendisini tercih edemez.`,
          "error",
          elements.requestMatchForm.elements.namedItem(
            `choice-${rowIndex}-${choiceIndex}`
          )
        );
        return;
      }
      if (new Set(choiceIds).size !== choiceIds.length) {
        const duplicateIndex = choiceValues.findIndex(
          (value, index) => value && choiceValues.indexOf(value) !== index
        );
        showRequestMatchNotice(
          `${rowIndex + 1}. satırda aynı tercih tekrarlanamaz.`,
          "error",
          elements.requestMatchForm.elements.namedItem(
            `choice-${rowIndex}-${duplicateIndex}`
          )
        );
        return;
      }
      correctedRows.push(
        normalizeRequestMatchRow(
          {
            ...sourceRow,
            subjectId,
            choiceIds: paddedFive(choiceValues),
            subjectName: studentById(subjectId)?.name || sourceRow.subjectName,
            choiceNames: paddedFive(
              choiceValues.map((choiceId) => studentById(choiceId)?.name || "")
            ),
            hasMismatch: false,
            issueMessages: [],
            matchRowIndex: rowIndex,
            note:
              sourceRow.note ||
              (pendingRequestMode === "import"
                ? "CSV dosyasından düzeltilerek aktarıldı."
                : ""),
            type:
              requestMatchValue(`type-${rowIndex}`) === "apart"
                ? "apart"
                : "together",
          },
          rowIndex
        )
      );
    }
    const duplicate = duplicateInFinalRequests(correctedRows);
    if (duplicate) {
      showRequestMatchNotice(
        `Aynı öğrenci için birden fazla ${requestTypeProblemLabel(
          duplicate.type
        )} girişi kalıyor. Fazla satırı silin veya türünü değiştirin.`,
        "error",
        elements.requestMatchForm.elements.namedItem(
          `subject-${duplicate.rowIndex}`
        )
      );
      return;
    }
    const conflict = conflictInFinalRequests(correctedRows);
    if (conflict) {
      showRequestMatchNotice(
        conflict.message,
        "error",
        elements.requestMatchForm.elements.namedItem(
          `subject-${conflict.rowIndex}`
        )
      );
      return;
    }
    const completedMode = pendingRequestMode;
    const savedRowCount = pendingImportCleanRows.length + correctedRows.length;
    commitRequestCorrections(correctedRows);
    showToast(
      completedMode === "audit"
        ? `${correctedRows.length} veli isteği güncellendi.`
        : `${savedRowCount} veli isteği aktarıldı.`
    );
  }

  function capturePendingRequestEdits() {
    pendingRequestRows.forEach((row, rowIndex) => {
      const subjectId = requestMatchValue(`subject-${rowIndex}`);
      row.type =
        requestMatchValue(`type-${rowIndex}`) === "apart"
          ? "apart"
          : "together";
      row.typeValid = true;
      if (subjectId && subjectId !== "__unmatched__") {
        row.subjectId = subjectId;
      }
      row.choiceIds = [0, 1, 2, 3, 4].map((choiceIndex) => {
        const value = requestMatchValue(
          `choice-${rowIndex}-${choiceIndex}`
        );
        if (value === "__unmatched__") {
          return row.choiceIds[choiceIndex] || "";
        }
        if (!value) row.choiceNames[choiceIndex] = "";
        return value;
      });
    });
  }

  function deletePendingRequestRow(rowIndex) {
    if (
      !Number.isInteger(rowIndex) ||
      rowIndex < 0 ||
      rowIndex >= pendingRequestRows.length
    ) {
      return;
    }
    capturePendingRequestEdits();
    if (pendingRequestRows[rowIndex].originalId) {
      pendingDeletedRequestIds.add(pendingRequestRows[rowIndex].originalId);
    }
    pendingRequestRows.splice(rowIndex, 1);
    refreshPendingRequestRows();
    if (!pendingRequestRows.length) {
      commitRequestCorrections([]);
      showToast("Düzeltilecek istek satırı kalmadı.");
      return;
    }
    renderRequestMatchDialog();
    showToast("İstek satırı silindi.");
  }

  function auditRequests() {
    if (!state.requests.length) {
      showToast("Kontrol edilecek veli isteği yok.");
      return;
    }
    const checkedRows = annotateRequestRows(
      requestRowsFromRequests(state.requests),
      { includeConflicts: true }
    );
    pendingRequestRows = sortRequestMatchRows(
      checkedRows.filter(requestRowHasIssue)
    );
    pendingImportCleanRows = [];
    pendingDeletedRequestIds.clear();
    pendingRequestMode = "audit";
    if (!pendingRequestRows.length) {
      showToast("Dikkate değer istek hatası bulunmadı.");
      return;
    }
    renderRequestMatchDialog();
    showRequestMatchNotice(
      `${pendingRequestRows.length} istek satırında düzeltmeniz gereken durum var.`,
      "info"
    );
  }

  function exportResults() {
    const analysis = getAnalysis();
    if (!analysis) return;
    const rows = [
      [
        "Yeni Sınıf",
        "Ad Soyad",
        "Cinsiyet",
        "Eski Sınıf",
        "Akademik Başarı",
        "Davranış Sorunu",
        "Not",
      ],
    ];
    analysis.perClass.forEach((classInfo) => {
      classInfo.students.forEach((student) => {
        rows.push([
          classInfo.name,
          student.name,
          student.gender,
          student.oldClass,
          Academic.format(student.academic),
          student.behavior ? "Evet" : "Hayır",
          student.notes || "",
        ]);
      });
    });
    state.students
      .filter((student) => state.assignment?.[student.id] === undefined)
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .forEach((student) => {
        rows.push([
          "Atanmamış",
          student.name,
          student.gender,
          student.oldClass,
          Academic.format(student.academic),
          student.behavior ? "Evet" : "Hayır",
          student.notes || "",
        ]);
      });
    downloadFile(
      "yeni-sinif-dagitimi.csv",
      rows.map((row) => row.map(csvCell).join(";")).join("\r\n")
    );
  }

  function excelStyleForOldClass(oldClass) {
    const color = oldClassColor(oldClass);
    return `background:${color.bg};color:${color.fg};border:1px solid ${color.border};`;
  }

  function excelColumnName(index) {
    let column = "";
    let value = index;
    while (value > 0) {
      const remainder = (value - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      value = Math.floor((value - remainder) / 26);
    }
    return column;
  }

  function excelAcademicShort(value) {
    const normalized = Academic.normalize(value);
    if (normalized === 1) return "DESTEK";
    if (normalized === 3) return "İYİ";
    return "ORTA";
  }

  function htmlCell(content = "", style = "", attrs = "") {
    return `<td ${attrs} style="${style}">${content}</td>`;
  }

  function formulaCell(formula, value, style = "", attrs = "") {
    return htmlCell(value, style, `${attrs} x:fmla="${escapeHtml(formula)}"`);
  }

  function exportExcelResults() {
    const analysis = getAnalysis();
    if (!analysis) return;
    const generatedAt = new Date();
    const dateStamp = generatedAt
      .toISOString()
      .slice(0, 16)
      .replace("T", "-")
      .replace(":", "");
    const oldClasses = oldClassNames().slice(0, 6);
    while (oldClasses.length < 6) {
      oldClasses.push(`4${String.fromCharCode(65 + oldClasses.length)}`);
    }
    const baseCell =
      "padding:4px 6px;border:1px solid #cfd8e3;font-family:Calibri,Arial,sans-serif;font-size:11px;vertical-align:middle;";
    const blankCell = `${baseCell}background:#ffffff;border-color:#ffffff;`;
    const titleCell =
      `${baseCell}background:#1f4e79;color:#ffffff;font-size:18px;font-weight:700;text-align:center;`;
    const darkHeader =
      `${baseCell}background:#1f4e79;color:#ffffff;font-weight:700;text-align:center;`;
    const labelCell =
      `${baseCell}background:#d9eaf7;color:#17365d;font-weight:700;text-align:center;`;
    const countCell =
      `${baseCell}background:#edf5fb;color:#17365d;text-align:center;font-weight:700;`;
    const dataCell = `${baseCell}background:#ffffff;text-align:center;`;
    const nameCell = `${baseCell}background:#ffffff;text-align:left;font-weight:700;`;
    const noteCell =
      `${baseCell}background:#f4cccc;color:#7f1d1d;font-weight:700;text-align:center;`;
    const spacer = () => htmlCell("", blankCell, 'colspan="2"');
    const leading = () => htmlCell("", blankCell, 'colspan="3"');

    const blockCell = (classInfo, blockIndex, row) => {
      const startColumn = 4 + blockIndex * 13;
      const genderColumn = excelColumnName(startColumn + 5);
      const oldClassColumn = excelColumnName(startColumn + 6);
      const behaviorColumn = excelColumnName(startColumn + 8);
      const academicColumn = excelColumnName(startColumn + 9);
      const students = sortedClassStudents(classInfo);
      if (row === 1) {
        return htmlCell(`${escapeHtml(classInfo.name)}`, titleCell, 'colspan="11"');
      }
      const cells = [];
      const pushBlank = (count = 1) => {
        for (let i = 0; i < count; i += 1) cells.push(htmlCell("", blankCell));
      };
      pushBlank();
      if (row === 2) {
        cells.push(htmlCell("TOPLAM", labelCell));
      } else if (row === 4) {
        cells.push(
          formulaCell(
            `=${excelColumnName(startColumn + 1)}6+${excelColumnName(startColumn + 2)}6`,
            classInfo.size,
            countCell
          )
        );
      } else if (row === 5) {
        cells.push(htmlCell("KIZ", labelCell));
      } else if (row === 6) {
        cells.push(
          formulaCell(
            `=COUNTIF(${genderColumn}:${genderColumn}, "K")`,
            classInfo.female,
            countCell
          )
        );
      } else if (row >= 8 && row <= 13) {
        cells.push(htmlCell(escapeHtml(oldClasses[row - 8]), labelCell));
      } else if (row === 15) {
        cells.push(htmlCell("DAV. PROB.", labelCell));
      } else if (row === 16) {
        cells.push(
          formulaCell(
            `=COUNTIF(${behaviorColumn}3:${behaviorColumn}27,"DAVRANIŞ")`,
            classInfo.behavior,
            countCell
          )
        );
      } else if (row >= 18 && row <= 27) {
        cells.push(
          htmlCell(row === 18 ? "ÖZEL DURUM VE NOTLAR" : "", noteCell, 'colspan="2"')
        );
      } else {
        cells.push(htmlCell("", blankCell));
      }

      if (row >= 18 && row <= 27) {
        // The notes area already spans the two summary columns.
      } else if (row === 2) {
        cells.push(htmlCell("", blankCell));
      } else if (row === 5) {
        cells.push(htmlCell("ERKEK", labelCell));
      } else if (row === 6) {
        cells.push(
          formulaCell(
            `=COUNTIF(${genderColumn}:${genderColumn}, "E")`,
            classInfo.male,
            countCell
          )
        );
      } else if (row >= 8 && row <= 13) {
        const oldClass = oldClasses[row - 8];
        cells.push(
          formulaCell(
            `=COUNTIF(${oldClassColumn}:${oldClassColumn}, "${oldClass}")`,
            (classInfo.oldClasses || {})[oldClass] || 0,
            countCell
          )
        );
      } else if (row === 15) {
        cells.push(htmlCell("AKAD. ORT", labelCell));
      } else if (row === 16) {
        const percentage = classInfo.academicAverage
          ? `${Math.round((classInfo.academicAverage / 3) * 100)}%`
          : "";
        cells.push(
          formulaCell(
            `=IFERROR(TEXT((COUNTIF(${academicColumn}3:${academicColumn}27,"DESTEK")*1+COUNTIF(${academicColumn}3:${academicColumn}27,"ORTA")*2+COUNTIF(${academicColumn}3:${academicColumn}27,"İYİ")*3)/((COUNTIF(${academicColumn}3:${academicColumn}27,"DESTEK")+COUNTIF(${academicColumn}3:${academicColumn}27,"ORTA")+COUNTIF(${academicColumn}3:${academicColumn}27,"İYİ"))*3),"0%"),"")`,
            percentage,
            countCell
          )
        );
      } else {
        cells.push(htmlCell("", blankCell));
      }
      pushBlank(1);

      if (row === 2) {
        cells.push(
          htmlCell("ÖĞRENCİ", darkHeader),
          htmlCell("K/E", darkHeader),
          htmlCell("ŞUBE", darkHeader),
          htmlCell("ÖĞRENCİLER", darkHeader),
          htmlCell("DAVRANIŞ", darkHeader),
          htmlCell("AKADEMİK", darkHeader),
          htmlCell("", darkHeader)
        );
      } else if (row >= 3 && row <= 27) {
        const studentIndex = row - 3;
        const student = students[studentIndex];
        const oldStyle = student ? excelStyleForOldClass(student.oldClass) : "";
        cells.push(htmlCell(String(studentIndex + 1), dataCell));
        cells.push(htmlCell(student?.gender || "", dataCell));
        cells.push(
          htmlCell(
            student ? escapeHtml(student.oldClass) : "",
            student ? `${baseCell}${oldStyle}text-align:center;font-weight:700;` : dataCell
          )
        );
        cells.push(
          htmlCell(
            student ? escapeHtml(student.name) : "",
            student ? `${nameCell}${oldStyle}` : nameCell
          )
        );
        cells.push(htmlCell(student?.behavior ? "DAVRANIŞ" : "", dataCell));
        cells.push(htmlCell(student ? excelAcademicShort(student.academic) : "", dataCell));
        cells.push(htmlCell("", blankCell));
      } else {
        pushBlank(7);
      }
      return cells.join("");
    };

    const rows = [];
    for (let row = 1; row <= 27; row += 1) {
      rows.push(
        `<tr style="height:${row === 1 ? 38 : row <= 17 ? 23 : 19}px;">${leading()}${analysis.perClass
          .map((classInfo, index) => blockCell(classInfo, index, row) + spacer())
          .join("")}</tr>`
      );
    }

    const colgroup = [
      '<col style="width:42px;" />',
      '<col style="width:42px;" />',
      '<col style="width:26px;" />',
      ...analysis.perClass.flatMap(() => [
        '<col style="width:36px;" />',
        '<col style="width:88px;" />',
        '<col style="width:88px;" />',
        '<col style="width:28px;" />',
        '<col style="width:70px;" />',
        '<col style="width:70px;" />',
        '<col style="width:72px;" />',
        '<col style="width:190px;" />',
        '<col style="width:86px;" />',
        '<col style="width:86px;" />',
        '<col style="width:30px;" />',
        '<col style="width:22px;" />',
        '<col style="width:22px;" />',
      ]),
    ].join("");

    const workbook = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:x="urn:schemas-microsoft-com:office:excel"
        xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <style>
            table { border-collapse: collapse; }
          </style>
          <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>ŞUBELER</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        </head>
        <body>
          <table>
            <colgroup>${colgroup}</colgroup>
            ${rows.join("")}
          </table>
        </body>
      </html>
    `;
    downloadFile(
      `Karma-Analiz-subeler-${dateStamp}.xls`,
      workbook,
      "application/vnd.ms-excel;charset=utf-8"
    );
  }

  function importPreviousResult(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ""));
        if (rows.length < 2) {
          throw new Error("CSV dosyasında sonuç kaydı bulunamadı.");
        }
        const headers = rows[0].map(Csv.normalizeHeader);
        const findColumn = (...names) => Csv.findColumn(headers, ...names);
        const columns = {
          newClass: findColumn("yeni sinif"),
          name: findColumn("ad soyad", "ad", "isim"),
          gender: findColumn("cinsiyet"),
          oldClass: findColumn("eski sinif"),
          academic: findColumn("akademik basari", "akademik"),
          behavior: findColumn("davranis sorunu", "davranis"),
          notes: findColumn("not", "aciklama"),
        };
        if (
          columns.newClass < 0 ||
          columns.name < 0 ||
          columns.gender < 0 ||
          columns.oldClass < 0 ||
          columns.academic < 0
        ) {
          throw new Error(
            "Bu dosya Karma Analiz sonuç CSV biçimine uygun değil."
          );
        }

        const records = rows
          .slice(1)
          .map((cells) => ({
            newClass: String(cells[columns.newClass] || "").trim(),
            name: String(cells[columns.name] || "").trim(),
            gender: String(cells[columns.gender] || "")
              .trim()
              .toLocaleUpperCase("tr"),
            oldClass: String(cells[columns.oldClass] || "")
              .trim()
              .toLocaleUpperCase("tr"),
            academic: Academic.normalize(cells[columns.academic]),
            behavior:
              columns.behavior >= 0
                ? Csv.parseBehaviorToken(cells[columns.behavior]) === true
                : false,
            notes:
              columns.notes >= 0
                ? String(cells[columns.notes] || "").trim()
                : "",
          }))
          .filter((record) => record.newClass && record.name);
        if (!records.length) {
          throw new Error("CSV dosyasında geçerli öğrenci bulunamadı.");
        }
        const isUnassignedClass = (value) =>
          Csv.normalizeHeader(value) === "atanmamis" ||
          Csv.normalizeHeader(value) === "atanmamis ogrenciler";
        const assignedRecords = records.filter(
          (record) => !isUnassignedClass(record.newClass)
        );

        const normalizedNames = records.map((record) =>
          Csv.normalizeHeader(record.name)
        );
        if (new Set(normalizedNames).size !== normalizedNames.length) {
          throw new Error(
            "CSV dosyasında aynı isimle birden fazla öğrenci var."
          );
        }

        const existingMatches = records.map((record) =>
          normalizedStudentMatches(record.name)
        );
        const canUseExisting =
          state.students.length === records.length &&
          existingMatches.every((matches) => matches.length === 1);
        let importedStudents;
        if (canUseExisting) {
          importedStudents = existingMatches.map((matches) => matches[0]);
        } else {
          if (
            state.students.length &&
            !window.confirm(
              "CSV öğrenci listesi mevcut listeyle aynı değil. Öğrenciler CSV dosyasından yeniden oluşturulsun ve mevcut veli istekleri temizlensin mi?"
            )
          ) {
            return;
          }
          importedStudents = records.map((record) => ({
            id: uid("ogr"),
            name: record.name,
            gender:
              record.gender === "E" ||
              record.gender === "ERKEK"
                ? "E"
                : "K",
            oldClass: record.oldClass,
            academic: record.academic,
            behavior: record.behavior,
            notes: record.notes,
          }));
          state.students = importedStudents;
          state.requests = [];
        }

        const classNames = [
          ...new Set(assignedRecords.map((record) => record.newClass)),
        ];
        if (!classNames.length) {
          throw new Error("CSV dosyasında atanmış sınıf kaydı bulunamadı.");
        }
        const classIndexByName = Object.fromEntries(
          classNames.map((name, index) => [name, index])
        );
        const assignment = {};
        records.forEach((record, index) => {
          if (isUnassignedClass(record.newClass)) return;
          assignment[importedStudents[index].id] =
            classIndexByName[record.newClass];
        });

        state.settings.classCount = classNames.length;
        state.settings.classNames = classNames;
        const prefixMatch = classNames[0].match(/^(.*?)[A-Za-zÇĞİÖŞÜ]$/);
        if (prefixMatch && prefixMatch[1]) {
          state.settings.classPrefix = prefixMatch[1];
        }
        state.assignment = assignment;
        Object.keys(classSorts).forEach((key) => delete classSorts[key]);
        saveState();
        renderAll();
        navigate("results");
        showToast(
          `${assignedRecords.length} atanmış, ${
            records.length - assignedRecords.length
          } atanmamış öğrenci yüklendi.`
        );
      } catch (error) {
        showToast(
          error.message || "Önceki sonuç CSV dosyası okunamadı."
        );
      } finally {
        elements.resultCsvInput.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function parseCsv(text) {
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const delimiter =
      (firstLine.match(/;/g) || []).length >=
      (firstLine.match(/,/g) || []).length
        ? ";"
        : ",";
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === delimiter && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[index + 1] === "\n") index += 1;
        row.push(cell);
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    return rows;
  }

  function importCsv(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ""));
        if (rows.length < 2) throw new Error("CSV dosyasında veri bulunamadı.");
        const headers = rows[0].map(Csv.normalizeHeader);
        const findColumn = (...names) => Csv.findColumn(headers, ...names);
        const columns = {
          name: findColumn("ad soyad", "ad", "isim", "ogrenci"),
          gender: findColumn("cinsiyet"),
          oldClass: findColumn("eski sinif", "sinif", "sube", "eski sube"),
          academic: findColumn(
            "akademik basari",
            "akademik",
            "basari",
            "basari duzeyi"
          ),
          behavior: findColumn(
            "davranis",
            "davranis sorunu",
            "davranis destegi",
            "davranis durumu"
          ),
          notes: findColumn("not", "aciklama", "ogrenci notu"),
        };
        if (
          columns.name < 0 ||
          columns.gender < 0 ||
          columns.oldClass < 0 ||
          columns.academic < 0
        ) {
          throw new Error(
            "Ad Soyad, Cinsiyet, Eski Sınıf ve Akademik Başarı sütunları gereklidir."
          );
        }
        const imported = rows
          .slice(1)
          .map((cells) => {
            const genderRaw = String(cells[columns.gender] || "")
              .trim()
              .toLocaleLowerCase("tr");
            const behaviorRaw =
              columns.behavior >= 0
                ? String(cells[columns.behavior] || "")
                    .trim()
                    .toLocaleLowerCase("tr")
                : "";
            const notesRaw =
              columns.notes >= 0
                ? String(cells[columns.notes] || "").trim()
                : "";
            const behaviorFields = Csv.resolveBehaviorAndNotes(
              behaviorRaw,
              notesRaw
            );
            return {
              id: uid("ogr"),
              name: String(cells[columns.name] || "").trim(),
              gender:
                genderRaw === "e" ||
                genderRaw === "erkek" ||
                genderRaw === "male"
                  ? "E"
                  : "K",
              oldClass: String(cells[columns.oldClass] || "")
                .trim()
                .toLocaleUpperCase("tr"),
              academic: Academic.normalize(cells[columns.academic]),
              behavior: behaviorFields.behavior,
              notes: behaviorFields.notes,
            };
          })
          .filter((student) => student.name && student.oldClass);
        if (!imported.length) {
          throw new Error("Aktarılabilecek geçerli öğrenci bulunamadı.");
        }
        state.students.push(...imported);
        invalidateResult();
        saveState();
        renderAll();
        const behaviorCount = imported.filter(
          (student) => student.behavior
        ).length;
        showToast(
          `${imported.length} öğrenci aktarıldı; ${behaviorCount} öğrenci davranış işaretli.`
        );
      } catch (error) {
        showToast(error.message || "CSV dosyası okunamadı.");
      } finally {
        elements.csvInput.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function createSampleData() {
    const femaleNames = [
      "AYŞE",
      "ELİF",
      "ZEYNEP",
      "DEFNE",
      "EYLÜL",
      "AZRA",
      "NEHİR",
      "DURU",
      "İPEK",
      "YAĞMUR",
      "CEREN",
      "MELİS",
      "ADA",
      "İREM",
      "MİNA",
      "BEREN",
      "SELİN",
      "NAZ",
      "ELA",
      "SUDE",
      "LİNA",
      "ECE",
      "İLAYDA",
      "NİSA",
      "ALARA",
      "MİRAY",
      "DAMLA",
      "AYLİN",
      "ESRA",
      "GİZEM",
      "PELİN",
      "ASYA",
      "DERİN",
      "SENA",
      "MERVE",
      "İDİL",
      "DENİZ",
      "YAREN",
      "CEMRE",
      "MAYA",
      "LAL",
      "BENGİ",
      "İCLAL",
      "NİL",
      "SİMAY",
      "HİRA",
      "ECRİN",
      "ÖYKÜ",
      "TUANA",
      "BESTE",
    ];
    const maleNames = [
      "AHMET",
      "MEHMET",
      "ALİ",
      "ARDA",
      "EMİR",
      "MERT",
      "KEREM",
      "EGE",
      "BORA",
      "DORUK",
      "YİĞİT",
      "ÖMER",
      "KAAN",
      "DENİZ",
      "BURAK",
      "BARAN",
      "UMUT",
      "CAN",
      "OZAN",
      "EREN",
      "ATLAS",
      "TUNA",
      "ONUR",
      "BATUHAN",
      "EMRE",
      "FURKAN",
      "RÜZGAR",
      "ALP",
      "SİNAN",
      "CEM",
      "HAKAN",
      "METE",
      "TOLGA",
      "KUZEY",
      "SERKAN",
      "LEVENT",
      "MİRAN",
      "KORAY",
      "EFE",
      "ARAS",
      "POYRAZ",
      "ÇINAR",
      "TALHA",
      "MURAT",
      "BARIŞ",
      "SARP",
      "KIVANÇ",
      "KUZGUN",
      "YAMAN",
      "TİMUR",
    ];
    const surnameInitials = [
      "Y",
      "D",
      "K",
      "A",
      "Ş",
      "Ç",
      "Ö",
      "T",
      "B",
      "G",
      "S",
      "E",
      "P",
      "U",
      "I",
      "N",
      "M",
      "C",
      "H",
      "R",
    ];
    const students = [];
    const oldClasses = ["4A", "4B", "4C", "4D", "4E", "4F"];
    const oldClassSizes = [34, 34, 33, 33, 33, 33];
    const nameCounters = { K: 0, E: 0 };
    const shortName = (gender) => {
      const pool = gender === "K" ? femaleNames : maleNames;
      const index = nameCounters[gender];
      nameCounters[gender] += 1;
      return `${pool[index % pool.length]} ${
        surnameInitials[Math.floor(index / pool.length) % surnameInitials.length]
      }.`;
    };

    oldClasses.forEach((oldClass, classIndex) => {
      const size = oldClassSizes[classIndex];
      const femaleCount = Math.floor(size / 2) + (classIndex % 2 === 0 ? 1 : 0);
      for (let seat = 0; seat < size; seat += 1) {
        const female = seat < femaleCount;
        const studentIndex = students.length;
        students.push({
          id: `ornek-${String(studentIndex + 1).padStart(3, "0")}`,
          name: shortName(female ? "K" : "E"),
          gender: female ? "K" : "E",
          oldClass,
          academic: ((studentIndex + classIndex) % 3) + 1,
          behavior: studentIndex % 17 === 0 || studentIndex % 43 === 0,
          notes: "",
        });
      }
    });
    const requests = Array.from({ length: 100 }, (_, index) => {
      const subjectIndex = (index * 7) % students.length;
      const subject = students[subjectIndex];
      const type = index % 4 === 0 ? "apart" : "together";
      const targetCount = type === "apart" ? 2 : 5;
      const choices = [];
      for (let offset = 1; choices.length < targetCount; offset += 1) {
        const candidate =
          students[(subjectIndex + offset * 13 + index) % students.length];
        if (candidate.id !== subject.id && !choices.includes(candidate.id)) {
          choices.push(candidate.id);
        }
      }
      return {
        id: `ornek-istek-${index + 1}`,
        studentA: subject.id,
        choices,
        type,
        priority: "auto",
        note: "Örnek veli isteği.",
      };
    });
    return { students, requests };
  }

  function loadSample() {
    if (
      state.students.length &&
      !window.confirm(
        "Mevcut veriler örnek veriyle değiştirilecek. Devam edilsin mi?"
      )
    ) {
      return;
    }
    const sample = createSampleData();
    state = {
      ...defaultState(),
      students: sample.students,
      requests: sample.requests,
      activeView: "students",
    };
    resetManualFilters();
    saveState();
    renderAll();
    showToast("200 öğrencilik ve 100 istekli örnek veri yüklendi.");
  }

  function showStartupPrivacyDialog() {
    if (!elements.privacyDialog) return;
    elements.privacyDialog.showModal();
  }

  function clearData() {
    if (
      !window.confirm(
        "Tüm öğrenciler, veli istekleri ve oluşturulan sınıflar silinsin mi?"
      )
    ) {
      return;
    }
    state = defaultState();
    resetManualFilters();
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
    showToast("Tüm veriler temizlendi.");
  }

  function bindEvents() {
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.view));
    });
    document.querySelectorAll("[data-go]").forEach((button) => {
      button.addEventListener("click", () => navigate(button.dataset.go));
    });
    el("mobileMenu").addEventListener("click", () => {
      document.querySelector(".sidebar").classList.toggle("open");
    });
    el("addStudentButton").addEventListener("click", () =>
      openStudentDialog(null)
    );
    el("emptyAddButton").addEventListener("click", () =>
      openStudentDialog(null)
    );
    elements.studentForm.addEventListener("submit", saveStudent);
    document.querySelectorAll("[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => elements.studentDialog.close());
    });
    elements.studentAcademic.addEventListener("input", renderAcademicOutput);
    elements.studentSearch.addEventListener("input", renderStudents);
    elements.oldClassFilter.addEventListener("change", renderStudents);
    elements.studentTableBody.addEventListener("click", (event) => {
      const inlineButton = event.target.closest("[data-inline-edit]");
      const deleteButton = event.target.closest("[data-delete-student]");
      if (inlineButton) openInlineEditor(inlineButton);
      if (deleteButton) deleteStudent(deleteButton.dataset.deleteStudent);
    });
    elements.inlineEditor.addEventListener("submit", saveInlineEdit);
    el("cancelInlineEdit").addEventListener("click", closeInlineEditor);
    document.addEventListener("click", (event) => {
      if (
        !elements.inlineEditor.hidden &&
        !elements.inlineEditor.contains(event.target) &&
        !event.target.closest("[data-inline-edit]")
      ) {
        closeInlineEditor();
      }
    });
    window.addEventListener("resize", closeInlineEditor);
    window.addEventListener("scroll", closeInlineEditor, true);
    elements.requestForm.addEventListener("submit", addRequest);
    el("importRequestCsvButton").addEventListener("click", () =>
      elements.requestCsvInput.click()
    );
    elements.requestCsvInput.addEventListener("change", () =>
      importRequestCsv(elements.requestCsvInput.files[0])
    );
    el("downloadRequestTemplateButton").addEventListener(
      "click",
      downloadRequestTemplate
    );
    elements.requestMatchForm.addEventListener(
      "submit",
      saveMatchedRequests
    );
    elements.requestMatchList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-match-row]");
      if (!button) return;
      deletePendingRequestRow(
        Number(button.dataset.deleteMatchRow)
      );
    });
    elements.requestMatchList.addEventListener("change", (event) => {
      const select = event.target.closest("select");
      if (!select) return;
      if (
        select.classList.contains("match-unresolved") &&
        select.value !== "__unmatched__"
      ) {
        select.classList.remove("match-unresolved");
      }
      capturePendingRequestEdits();
      refreshPendingRequestRows();
      renderRequestMatchDialog();
    });
    elements.requestMatchSearch.addEventListener("input", (event) => {
      requestMatchSearchQuery = event.target.value;
      renderRequestMatchDialog();
    });
    elements.clearUnmatchedChoicesButton.addEventListener(
      "click",
      clearUnmatchedRequestChoices
    );
    el("closeRequestMatchDialog").addEventListener("click", () => {
      resetPendingRequestState();
      clearRequestMatchNotice();
      elements.requestMatchDialog.close();
    });
    el("cancelRequestMatch").addEventListener("click", () => {
      resetPendingRequestState();
      clearRequestMatchNotice();
      elements.requestMatchDialog.close();
    });
    elements.requestList.addEventListener("click", (event) => {
      const choiceButton = event.target.closest("[data-delete-request-choice]");
      if (choiceButton) {
        deleteRequestChoice(
          choiceButton.dataset.deleteRequestChoice,
          choiceButton.dataset.choiceId
        );
        return;
      }
      const editButton = event.target.closest("[data-edit-request]");
      if (editButton) {
        beginEditRequest(editButton.dataset.editRequest);
        return;
      }
      const button = event.target.closest("[data-delete-request]");
      if (button) deleteRequest(button.dataset.deleteRequest);
    });
    elements.requestSearch.addEventListener("input", (event) => {
      focusedRequestId = "";
      requestSearchQuery = event.target.value;
      renderRequests();
    });
    elements.requestOldClassFilter.addEventListener("change", (event) => {
      requestOldClassFilter = event.target.value;
      renderRequests();
    });
    elements.refreshRequestsButton.addEventListener("click", () => {
      renderRequests();
      renderDistribution();
      renderResults();
      showToast("Veli istekleri güncel yerleşime göre yenilendi.");
    });
    elements.checkRequestsButton.addEventListener("click", auditRequests);
    elements.clearRequestsButton.addEventListener("click", clearRequests);
    elements.requestList.addEventListener("change", (event) => {
      const select = event.target.closest("[data-request-field]");
      if (!select) return;
      updateRequestField(
        select.dataset.requestId,
        select.dataset.requestField,
        select.value
      );
    });
    elements.classCount.addEventListener("change", updateSettings);
    elements.classPrefix.addEventListener("input", updateSettings);
    [
      elements.criterionGender,
      elements.criterionAcademic,
      elements.criterionOldClass,
      elements.criterionSameOldClassGender,
      elements.criterionBehavior,
    ].forEach((select) => {
      select.addEventListener("change", updateSettings);
    });
    elements.solveButton.addEventListener("click", solveClasses);
    elements.assignSelectedButton.addEventListener("click", () => {
      syncAssignmentWithSetup();
      if (!state.assignment) return;
      const targetClass = Number(elements.manualTargetClass.value);
      if (!Number.isInteger(targetClass)) return;
      const selected = Array.from(selectedManualStudents);
      if (!selected.length) return;
      const available = MAX_CLASS_SIZE - classSize(targetClass);
      if (available <= 0) {
        showToast(`Bu sınıf en fazla ${MAX_CLASS_SIZE} öğrenci alabilir.`);
        return;
      }
      selected.slice(0, available).forEach((studentId) => {
        state.assignment[studentId] = targetClass;
        selectedManualStudents.delete(studentId);
      });
      if (selected.length > available) {
        showToast(
          `${available} öğrenci aktarıldı; sınıf kapasitesi dolduğu için kalanlar bekliyor.`
        );
      } else {
        showToast(`${selected.length} öğrenci aktarıldı.`);
      }
      saveState();
      renderDistribution();
      renderResults();
    });
    elements.clearSelectionButton.addEventListener("click", () => {
      selectedManualStudents.clear();
      renderDistribution();
    });
    elements.resetAssignmentButton.addEventListener("click", () => {
      syncAssignmentWithSetup();
      const assignedCount = Object.keys(state.assignment || {}).length;
      if (!assignedCount) return;
      state.assignment = {};
      selectedManualStudents.clear();
      Object.keys(classSorts).forEach((key) => delete classSorts[key]);
      saveState();
      renderDistribution();
      renderResults();
      showToast(`${assignedCount} öğrenci Atanmamış Öğrenciler sepetine döndü.`);
    });
    elements.manualStudentSearch.addEventListener("input", () => {
      manualStudentSearchQuery = elements.manualStudentSearch.value;
      renderManualWorkspace();
    });
    elements.manualStudentOldClassFilter.addEventListener("change", () => {
      manualStudentOldClassFilter =
        elements.manualStudentOldClassFilter.value;
      renderManualWorkspace();
    });
    elements.manualWarningSearch.addEventListener("input", () => {
      manualWarningSearchQuery = elements.manualWarningSearch.value;
      renderLiveChecks(getAnalysis());
    });
    elements.manualWarningOldClassFilter.addEventListener("change", () => {
      manualWarningOldClassFilter = elements.manualWarningOldClassFilter.value;
      renderLiveChecks(getAnalysis());
    });
    elements.manualWarningList.addEventListener("click", (event) => {
      const ignoreButton = event.target.closest("[data-warning-ignore]");
      if (ignoreButton) {
        event.stopPropagation();
        toggleIgnoredWarning(ignoreButton.dataset.warningIgnore);
        return;
      }
      const warning = event.target.closest("[data-warning-request-id]");
      if (!warning) return;
      focusRequest(warning.dataset.warningRequestId);
    });
    const manualDragStart = (event) => {
      const student = event.target.closest("[data-manual-student]");
      if (!student) return;
      draggedStudentId = student.dataset.manualStudent;
      student.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedStudentId);
    };
    const manualDragEnd = () => {
      draggedStudentId = null;
      stopDragAutoScroll();
      document
        .querySelectorAll(".dragging, .manual-drop-target")
        .forEach((item) =>
          item.classList.remove("dragging", "manual-drop-target")
        );
    };
    [elements.manualUnassignedList, elements.manualClassGrid].forEach(
      (container) => {
        container.addEventListener("change", (event) => {
          const checkbox = event.target.closest("[data-manual-select]");
          if (!checkbox) return;
          if (checkbox.checked) {
            selectedManualStudents.add(checkbox.dataset.manualSelect);
          } else {
            selectedManualStudents.delete(checkbox.dataset.manualSelect);
          }
          renderDistribution();
        });
        container.addEventListener("dragstart", manualDragStart);
        container.addEventListener("dragend", manualDragEnd);
      }
    );
    document.addEventListener("dragover", (event) => {
      if (!draggedStudentId) return;
      updateDragAutoScroll(event.clientY);
    });
    elements.manualClassGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sort-class]");
      if (!button) return;
      const classIndex = button.dataset.sortClass;
      classSorts[classIndex] =
        classSorts[classIndex] === button.dataset.sortType
          ? "name"
          : button.dataset.sortType;
      renderManualWorkspace();
    });
    elements.manualClassGrid.addEventListener("dragover", (event) => {
      const targetClass = event.target.closest("[data-manual-drop-class]");
      if (!targetClass || !draggedStudentId) return;
      event.preventDefault();
      updateDragAutoScroll(event.clientY);
      targetClass.classList.add("manual-drop-target");
    });
    elements.manualClassGrid.addEventListener("dragleave", (event) => {
      event.target
        .closest("[data-manual-drop-class]")
        ?.classList.remove("manual-drop-target");
    });
    elements.manualClassGrid.addEventListener("drop", (event) => {
      const targetClass = event.target.closest("[data-manual-drop-class]");
      if (!targetClass) return;
      event.preventDefault();
      const studentId =
        draggedStudentId || event.dataTransfer.getData("text/plain");
      draggedStudentId = null;
      stopDragAutoScroll();
      if (studentId) moveStudent(studentId, Number(targetClass.dataset.manualDropClass));
    });
    elements.manualUnassignedDrop.addEventListener("dragover", (event) => {
      if (!draggedStudentId) return;
      event.preventDefault();
      updateDragAutoScroll(event.clientY);
      elements.manualUnassignedDrop.classList.add("manual-drop-target");
    });
    elements.manualUnassignedDrop.addEventListener("dragleave", () => {
      elements.manualUnassignedDrop.classList.remove("manual-drop-target");
    });
    elements.manualUnassignedDrop.addEventListener("drop", (event) => {
      event.preventDefault();
      const studentId =
        draggedStudentId || event.dataTransfer.getData("text/plain");
      draggedStudentId = null;
      stopDragAutoScroll();
      elements.manualUnassignedDrop.classList.remove("manual-drop-target");
      if (studentId) moveStudent(studentId, "");
    });
    el("printButton").addEventListener("click", () => window.print());
    el("excelButton").addEventListener("click", exportExcelResults);
    el("exportButton").addEventListener("click", exportResults);
    el("importResultButton").addEventListener("click", () =>
      elements.resultCsvInput.click()
    );
    el("importResultEmptyButton").addEventListener("click", () =>
      elements.resultCsvInput.click()
    );
    elements.resultCsvInput.addEventListener("change", () =>
      importPreviousResult(elements.resultCsvInput.files[0])
    );
    el("importCsvButton").addEventListener("click", () =>
      elements.csvInput.click()
    );
    elements.csvInput.addEventListener("change", () =>
      importCsv(elements.csvInput.files[0])
    );
    el("downloadTemplateButton").addEventListener("click", downloadTemplate);
    elements.exportStudentsButton.addEventListener("click", exportStudentsCsv);
    elements.exportRequestsButton.addEventListener("click", exportRequestsCsv);
    el("loadSampleButton").addEventListener("click", loadSample);
    el("clearDataButton").addEventListener("click", clearData);
    elements.privacyDialog.addEventListener("cancel", (event) =>
      event.preventDefault()
    );
    elements.acceptPrivacyButton.addEventListener("click", () =>
      elements.privacyDialog.close()
    );
  }

  bindEvents();
  renderAll();
  showStartupPrivacyDialog();
})();
