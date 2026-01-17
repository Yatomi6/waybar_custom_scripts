const elements = {
  lastUpdated: document.getElementById("last-updated"),
  refresh: document.getElementById("refresh"),
  search: document.getElementById("search"),
  onlyErrors: document.getElementById("only-errors"),
  wordSection: document.getElementById("word-section"),
  letterSection: document.getElementById("letter-section"),
  wordOnly: Array.from(document.querySelectorAll(".word-only")),
  letterOnly: Array.from(document.querySelectorAll(".letter-only")),
  viewButtons: Array.from(document.querySelectorAll("#view-toggle .seg-btn")),
  wordCount: document.getElementById("word-count"),
  wordsBody: document.getElementById("words-body"),
  empty: document.getElementById("empty"),
  sortButtons: Array.from(document.querySelectorAll(".row.head .sort")),
  letterSearch: document.getElementById("letter-search"),
  letterCount: document.getElementById("letter-count"),
  lettersBody: document.getElementById("letters-body"),
  lettersEmpty: document.getElementById("letters-empty"),
  letterSortButtons: Array.from(document.querySelectorAll(".row.letter-head .sort-letter")),
  stats: {
    tests: document.getElementById("stat-tests"),
    typed: document.getElementById("stat-typed"),
    correct: document.getElementById("stat-correct"),
    withErrors: document.getElementById("stat-with-errors"),
    incorrect: document.getElementById("stat-incorrect"),
    errorKeys: document.getElementById("stat-error-keys"),
    accuracy: document.getElementById("stat-accuracy"),
  },
};

let currentData = null;
const headerSort = { key: null, order: "none" };
const letterSort = { key: null, order: "none" };
let currentView = "words";
const defaultSort = "typed";

function fmtNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function fmtPercent(numerator, denominator) {
  if (!denominator) {
    return "0%";
  }
  const value = (numerator / denominator) * 100;
  return `${value.toFixed(1)}%`;
}

function normalizeText(text) {
  return (text || "").toLowerCase();
}

function buildWordList(words) {
  return Object.entries(words || {}).map(([word, stat]) => {
    const typed = Number(stat.typed || 0);
    const correct = Number(stat.correct || 0);
    const withErrors = Number(stat.with_errors || 0);
    const incorrect = Number(stat.incorrect || 0);
    const errorKeys = Number(stat.error_keystrokes || 0);
    const accuracy = typed ? correct / typed : 0;
    return {
      word,
      typed,
      correct,
      withErrors,
      incorrect,
      errorKeys,
      accuracy,
    };
  });
}

function buildLetterList(letters) {
  return Object.entries(letters || {}).map(([letter, count]) => ({
    letter,
    errors: Number(count || 0),
  }));
}

function setView(view) {
  currentView = view;
  elements.viewButtons.forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  elements.wordOnly.forEach((node) => {
    node.classList.toggle("hidden", view !== "words");
  });
  elements.letterOnly.forEach((node) => {
    node.classList.toggle("hidden", view !== "letters");
  });
  if (elements.wordSection) {
    elements.wordSection.classList.toggle("hidden", view !== "words");
  }
  if (elements.letterSection) {
    elements.letterSection.classList.toggle("hidden", view !== "letters");
  }
}

function setHeaderSort(key, order) {
  headerSort.key = key;
  headerSort.order = order;

  elements.sortButtons.forEach((btn) => {
    const isActive = key && btn.dataset.sort === key && order !== "none";
    btn.dataset.order = isActive ? order : "none";
    btn.classList.toggle("active", isActive);
    btn.setAttribute(
      "aria-sort",
      isActive ? (order === "asc" ? "ascending" : "descending") : "none"
    );
  });
}

function setLetterSort(key, order) {
  letterSort.key = key;
  letterSort.order = order;

  elements.letterSortButtons.forEach((btn) => {
    const isActive = key && btn.dataset.sort === key && order !== "none";
    btn.dataset.order = isActive ? order : "none";
    btn.classList.toggle("active", isActive);
    btn.setAttribute(
      "aria-sort",
      isActive ? (order === "asc" ? "ascending" : "descending") : "none"
    );
  });
}

function compareByKey(a, b, key, order) {
  const dir = order === "asc" ? 1 : -1;
  if (key === "word") {
    return dir * a.word.localeCompare(b.word);
  }
  const aVal = key === "accuracy" ? a.accuracy : a[key];
  const bVal = key === "accuracy" ? b.accuracy : b[key];
  if (aVal === bVal) {
    return a.word.localeCompare(b.word);
  }
  return dir * (aVal - bVal);
}

function compareLetters(a, b, key, order) {
  const dir = order === "asc" ? 1 : -1;
  if (key === "letter") {
    return dir * a.letter.localeCompare(b.letter);
  }
  if (a.errors === b.errors) {
    return a.letter.localeCompare(b.letter);
  }
  return dir * (a.errors - b.errors);
}

function applyFilters(wordList) {
  const query = normalizeText(elements.search.value);
  const onlyErrors = elements.onlyErrors.checked;

  let filtered = wordList.filter((item) => {
    if (query && !normalizeText(item.word).includes(query)) {
      return false;
    }
    if (onlyErrors && item.withErrors === 0 && item.incorrect === 0) {
      return false;
    }
    return true;
  });

  if (headerSort.key && headerSort.order !== "none") {
    filtered.sort((a, b) => compareByKey(a, b, headerSort.key, headerSort.order));
    return filtered;
  }

  switch (defaultSort) {
    case "errors":
      filtered.sort((a, b) => b.errorKeys - a.errorKeys || b.typed - a.typed);
      break;
    case "incorrect":
      filtered.sort((a, b) => b.incorrect - a.incorrect || b.typed - a.typed);
      break;
    case "accuracy":
      filtered.sort((a, b) => a.accuracy - b.accuracy || b.typed - a.typed);
      break;
    case "word":
      filtered.sort((a, b) => a.word.localeCompare(b.word));
      break;
    case "typed":
    default:
      filtered.sort((a, b) => b.typed - a.typed || a.word.localeCompare(b.word));
      break;
  }

  return filtered;
}

function applyLetterFilters(letterList) {
  const query = normalizeText(elements.letterSearch.value);
  let filtered = letterList.filter((item) => {
    if (!query) {
      return true;
    }
    return normalizeText(item.letter).includes(query);
  });

  if (letterSort.key && letterSort.order !== "none") {
    filtered.sort((a, b) => compareLetters(a, b, letterSort.key, letterSort.order));
    return filtered;
  }

  filtered.sort((a, b) => b.errors - a.errors || a.letter.localeCompare(b.letter));
  return filtered;
}

function renderSummary(data) {
  const totals = data.totals || {};
  elements.stats.tests.textContent = fmtNumber(totals.tests);
  elements.stats.typed.textContent = fmtNumber(totals.words_typed);
  elements.stats.correct.textContent = fmtNumber(totals.words_correct);
  elements.stats.withErrors.textContent = fmtNumber(totals.words_with_errors);
  elements.stats.incorrect.textContent = fmtNumber(totals.words_incorrect);
  elements.stats.errorKeys.textContent = fmtNumber(totals.error_keystrokes);
  elements.stats.accuracy.textContent = fmtPercent(
    totals.words_correct || 0,
    totals.words_typed || 0
  );

  if (data.updated_at) {
    const ts = new Date(data.updated_at * 1000);
    elements.lastUpdated.textContent = `Last update: ${ts.toLocaleString()}`;
  } else {
    elements.lastUpdated.textContent = "Last update: -";
  }
}

function renderTable(wordList) {
  elements.wordsBody.innerHTML = "";
  elements.wordCount.textContent = `${wordList.length} words`;

  if (!wordList.length) {
    elements.empty.style.display = "block";
    return;
  }
  elements.empty.style.display = "none";

  const fragment = document.createDocumentFragment();
  wordList.forEach((item) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div>${item.word}</div>
      <div class="num">${fmtNumber(item.typed)}</div>
      <div class="num">${fmtNumber(item.correct)}</div>
      <div class="num">${fmtNumber(item.withErrors)}</div>
      <div class="num">${fmtNumber(item.incorrect)}</div>
      <div class="num">${fmtNumber(item.errorKeys)}</div>
      <div class="num">${fmtPercent(item.correct, item.typed)}</div>
    `;
    fragment.appendChild(row);
  });

  elements.wordsBody.appendChild(fragment);
}

function renderLetters(letterList) {
  elements.lettersBody.innerHTML = "";
  elements.letterCount.textContent = `${letterList.length} letters`;

  if (!letterList.length) {
    elements.lettersEmpty.style.display = "block";
    return;
  }
  elements.lettersEmpty.style.display = "none";

  const fragment = document.createDocumentFragment();
  letterList.forEach((item) => {
    const row = document.createElement("div");
    row.className = "row letter-row";
    row.innerHTML = `
      <div>${item.letter}</div>
      <div class="num">${fmtNumber(item.errors)}</div>
    `;
    fragment.appendChild(row);
  });
  elements.lettersBody.appendChild(fragment);
}

function render() {
  if (!currentData) {
    renderSummary({ totals: {} });
    renderTable([]);
    renderLetters([]);
    return;
  }

  renderSummary(currentData);
  const wordList = buildWordList(currentData.words);
  const filtered = applyFilters(wordList);
  renderTable(filtered);

  const letterList = buildLetterList(currentData.letters);
  const filteredLetters = applyLetterFilters(letterList);
  renderLetters(filteredLetters);
}

async function loadStats() {
  try {
    const response = await fetch("/stats.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load stats");
    }
    currentData = await response.json();
  } catch (err) {
    currentData = { totals: {}, words: {} };
  }
  render();
}

function init() {
  elements.refresh.addEventListener("click", loadStats);
  elements.search.addEventListener("input", render);
  elements.onlyErrors.addEventListener("change", render);
  elements.viewButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      setView(view);
    });
  });
  elements.sortButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.sort;
      let nextOrder = "asc";
      if (headerSort.key === key) {
        if (headerSort.order === "asc") {
          nextOrder = "desc";
        } else if (headerSort.order === "desc") {
          nextOrder = "none";
        }
      }
      if (nextOrder === "none") {
        setHeaderSort(null, "none");
      } else {
        setHeaderSort(key, nextOrder);
      }
      render();
    });
  });

  setHeaderSort(null, "none");
  setLetterSort(null, "none");
  elements.letterSearch.addEventListener("input", render);
  elements.letterSortButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.sort;
      let nextOrder = "asc";
      if (letterSort.key === key) {
        if (letterSort.order === "asc") {
          nextOrder = "desc";
        } else if (letterSort.order === "desc") {
          nextOrder = "none";
        }
      }
      if (nextOrder === "none") {
        setLetterSort(null, "none");
      } else {
        setLetterSort(key, nextOrder);
      }
      render();
    });
  });

  setView(currentView);
  loadStats();
  setInterval(loadStats, 5000);
}

init();
