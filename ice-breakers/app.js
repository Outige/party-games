const STORAGE_KEY = "party-starter:ice-breakers:asked:v1";
const HUES = [250, 20, 45, 155, 195, 305, 340, 95];

const elements = {
  category: document.querySelector("#category"),
  categoryLabel: document.querySelector("#category-label"),
  counter: document.querySelector("#counter"),
  drawButton: document.querySelector("#draw-button"),
  buttonLabel: document.querySelector("#button-label"),
  question: document.querySelector("#question"),
  card: document.querySelector("#question-card"),
  status: document.querySelector("#status"),
  newSession: document.querySelector("#new-session"),
  toast: document.querySelector("#toast"),
};

let decks = {};
let asked = readAskedQuestions();
let toastTimer;

function readAskedQuestions() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveAskedQuestions() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(asked));
  } catch {
    // The game still works when storage is unavailable; refreshes just start fresh.
  }
}

function cleanDecks(data) {
  if (!data || Array.isArray(data) || typeof data !== "object") return {};

  return Object.fromEntries(
    Object.entries(data).map(([name, questions]) => {
      const uniqueQuestions = Array.isArray(questions)
        ? [...new Set(questions.filter((question) => typeof question === "string").map((question) => question.trim()).filter(Boolean))]
        : [];
      return [name.trim() || "Untitled", uniqueQuestions];
    }),
  );
}

function remainingQuestions(category) {
  const seen = new Set(asked[category] || []);
  return (decks[category] || []).filter((question) => !seen.has(question));
}

function setDeckHue() {
  const categories = Object.keys(decks);
  const categoryIndex = Math.max(0, categories.indexOf(elements.category.value));
  document.documentElement.style.setProperty("--deck-hue", HUES[categoryIndex % HUES.length]);
}

function updateDeckState() {
  const category = elements.category.value;
  const total = (decks[category] || []).length;
  const remaining = remainingQuestions(category).length;
  const askedCount = total - remaining;

  setDeckHue();
  elements.categoryLabel.textContent = category || "No deck";
  elements.counter.textContent = total ? `${askedCount} / ${total}` : "0 / 0";
  elements.drawButton.disabled = remaining === 0;
  elements.buttonLabel.textContent = remaining === 0 ? "Deck complete!" : askedCount ? "Next question" : "Draw a question";

  if (!total) {
    elements.status.textContent = "This deck is empty. Pick another vibe.";
  } else if (!remaining) {
    elements.status.textContent = "You asked every question in this deck. Try another vibe!";
  } else {
    elements.status.textContent = `${remaining} question${remaining === 1 ? "" : "s"} left in this deck`;
  }
}

function populateCategorySelect() {
  const categories = Object.keys(decks);
  elements.category.replaceChildren();

  categories.forEach((category) => {
    const option = document.createElement("option");
    const count = decks[category].length;
    option.value = category;
    option.textContent = `${category} · ${count}`;
    option.disabled = count === 0;
    elements.category.append(option);
  });

  const firstPlayable = categories.find((category) => decks[category].length > 0);
  if (!firstPlayable) {
    const option = document.createElement("option");
    option.textContent = categories.length ? "No questions available" : "No decks found";
    option.value = "";
    elements.category.replaceChildren(option);
    elements.status.textContent = "Add at least one question to questions.js to play.";
    elements.categoryLabel.textContent = "No questions";
    elements.question.textContent = "The question decks are empty.";
    return;
  }

  elements.category.value = firstPlayable;
  elements.category.disabled = false;
  updateDeckState();
}

function drawQuestion() {
  const category = elements.category.value;
  const remaining = remainingQuestions(category);
  if (!remaining.length) return;

  const question = remaining[Math.floor(Math.random() * remaining.length)];
  asked[category] = [...(asked[category] || []), question];
  saveAskedQuestions();

  elements.card.classList.remove("is-changing");
  void elements.card.offsetWidth;
  elements.card.classList.add("is-changing");
  elements.question.textContent = question;
  updateDeckState();
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function startNewSession() {
  const hasAskedQuestions = Object.values(asked).some((questions) => questions.length);
  if (hasAskedQuestions && !window.confirm("Start a new session and put every question back in its deck?")) return;

  asked = {};
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else to clear when storage is unavailable.
  }
  elements.question.textContent = "Fresh decks! Draw a question when everyone is ready.";
  updateDeckState();
  showToast("New session started");
}

function loadQuestions() {
  decks = cleanDecks(window.QUESTION_DECKS);
  populateCategorySelect();
}

elements.drawButton.addEventListener("click", drawQuestion);
elements.category.addEventListener("change", () => {
  elements.question.textContent = "New vibe selected. Draw when you're ready.";
  updateDeckState();
});
elements.newSession.addEventListener("click", startNewSession);
elements.card.addEventListener("animationend", () => elements.card.classList.remove("is-changing"));

loadQuestions();
