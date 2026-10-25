const STORAGE_KEY = "party-starter:ice-breakers:asked:v2";
const HUES = [250, 20, 155, 305];

const elements = {
  categoryButtons: document.querySelector("#category-buttons"),
  categoryLabel: document.querySelector("#category-label"),
  counter: document.querySelector("#counter"),
  question: document.querySelector("#question"),
  card: document.querySelector("#question-card"),
  status: document.querySelector("#status"),
  newSession: document.querySelector("#new-session"),
  customGame: document.querySelector("#custom-game"),
  customDialog: document.querySelector("#custom-dialog"),
  customForm: document.querySelector("#custom-form"),
  customJson: document.querySelector("#custom-json"),
  customError: document.querySelector("#custom-error"),
  closeDialog: document.querySelector("#close-dialog"),
  toast: document.querySelector("#toast"),
};

let decks = {};
let asked = readAskedQuestions();
let activeCategory = "";
let toastTimer;

function readAskedQuestions() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return saved && !Array.isArray(saved) && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveAskedQuestions() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(asked));
  } catch {
    // The game still works when storage is unavailable.
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

function setDeckHue(category) {
  const index = Math.max(0, Object.keys(decks).indexOf(category));
  document.documentElement.style.setProperty("--deck-hue", HUES[index % HUES.length]);
}

function updateGameState() {
  const categories = Object.keys(decks);
  let totalRemaining = 0;

  categories.forEach((category, index) => {
    const button = elements.categoryButtons.querySelector(`[data-category-index="${index}"]`);
    if (!button) return;

    const remaining = remainingQuestions(category).length;
    totalRemaining += remaining;
    button.disabled = remaining === 0;
    button.querySelector(".category-count").textContent = remaining ? `${remaining} left` : "Complete";
  });

  if (activeCategory && decks[activeCategory]) {
    const total = decks[activeCategory].length;
    const askedCount = total - remainingQuestions(activeCategory).length;
    elements.categoryLabel.textContent = activeCategory;
    elements.counter.textContent = `${askedCount} / ${total}`;
  }

  if (!categories.length) {
    elements.status.textContent = "No playable categories were found.";
  } else if (!totalRemaining) {
    elements.status.textContent = "Every question is complete. Start a new session to play again!";
  } else {
    elements.status.textContent = `${totalRemaining} question${totalRemaining === 1 ? "" : "s"} left across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}`;
  }
}

function renderCategoryButtons() {
  const categories = Object.keys(decks);
  elements.categoryButtons.replaceChildren();
  elements.categoryButtons.dataset.count = String(categories.length);

  categories.forEach((category, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-button";
    button.dataset.categoryIndex = String(index);
    button.style.setProperty("--category-hue", HUES[index % HUES.length]);

    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = category;

    const meta = document.createElement("span");
    meta.className = "category-meta";
    const count = document.createElement("span");
    count.className = "category-count";
    const icon = document.createElement("span");
    icon.className = "button-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✦";
    meta.append(count, icon);
    button.append(name, meta);
    button.addEventListener("click", () => drawQuestion(category));
    elements.categoryButtons.append(button);
  });

  updateGameState();
}

function drawQuestion(category) {
  const remaining = remainingQuestions(category);
  if (!remaining.length) return;

  const question = remaining[Math.floor(Math.random() * remaining.length)];
  asked[category] = [...(asked[category] || []), question];
  activeCategory = category;
  saveAskedQuestions();
  setDeckHue(category);

  elements.card.classList.remove("is-changing");
  void elements.card.offsetWidth;
  elements.card.classList.add("is-changing");
  elements.question.textContent = question;
  updateGameState();
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function clearAskedQuestions() {
  asked = {};
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else to clear when storage is unavailable.
  }
}

function startNewSession() {
  const hasAskedQuestions = Object.values(asked).some((questions) => questions.length);
  if (hasAskedQuestions && !window.confirm("Start a new session and put every question back in its category?")) return;

  clearAskedQuestions();
  activeCategory = "";
  elements.categoryLabel.textContent = "Ready?";
  elements.counter.textContent = "—";
  elements.question.textContent = "Fresh decks! Choose any category when everyone is ready.";
  updateGameState();
  showToast("New session started");
}

function validateCustomGame(rawJson) {
  let data;
  try {
    data = JSON.parse(rawJson);
  } catch {
    throw new Error("That is not valid JSON. Check commas, quotes, and brackets.");
  }

  if (!data || Array.isArray(data) || typeof data !== "object") {
    throw new Error("Use a JSON object whose keys are category names.");
  }

  const entries = Object.entries(data);
  if (entries.length < 1 || entries.length > 4) {
    throw new Error("Add between 1 and 4 categories.");
  }

  const normalized = {};
  for (const [rawName, questions] of entries) {
    const name = rawName.trim();
    if (!name) throw new Error("Every category needs a name.");
    if (Object.hasOwn(normalized, name)) throw new Error(`Category names must be unique: “${name}” appears twice.`);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error(`“${name}” needs at least one question in an array.`);
    }
    if (questions.some((question) => typeof question !== "string" || !question.trim())) {
      throw new Error(`Every question in “${name}” must be non-empty text.`);
    }

    normalized[name] = [...new Set(questions.map((question) => question.trim()))];
  }

  return normalized;
}

function openCustomGame() {
  elements.customError.textContent = "";
  elements.customDialog.showModal();
  window.setTimeout(() => elements.customJson.focus(), 0);
}

function createCustomGame(event) {
  event.preventDefault();

  try {
    const customDecks = validateCustomGame(elements.customJson.value);
    decks = customDecks;
    clearAskedQuestions();
    activeCategory = "";
    elements.categoryLabel.textContent = "Custom game";
    elements.counter.textContent = "—";
    elements.question.textContent = "Your custom game is ready. Choose a category to begin.";
    renderCategoryButtons();
    elements.customDialog.close();
    elements.customForm.reset();
    showToast("Custom game created");
  } catch (error) {
    elements.customError.textContent = error.message;
    elements.customJson.focus();
  }
}

function loadQuestions() {
  decks = cleanDecks(window.QUESTION_DECKS);
  renderCategoryButtons();
}

elements.newSession.addEventListener("click", startNewSession);
elements.customGame.addEventListener("click", openCustomGame);
elements.closeDialog.addEventListener("click", () => elements.customDialog.close());
elements.customForm.addEventListener("submit", createCustomGame);
elements.customDialog.addEventListener("click", (event) => {
  if (event.target === elements.customDialog) elements.customDialog.close();
});
elements.card.addEventListener("animationend", () => elements.card.classList.remove("is-changing"));

loadQuestions();
