"use strict";

const $ = (id) => document.getElementById(id);
const screens = ["setup-screen", "ready-screen", "play-screen", "turn-end-screen", "results-screen"];
const game = {
  phase: "setup",
  players: [],
  cards: [],
  remaining: [],
  currentPlayer: 0,
  currentCard: -1,
  turnNumber: 1,
  turnsCompleted: 0,
  roundCorrect: 0,
  roundPasses: 0,
  bestTurn: { player: -1, count: 0 },
  deadline: 0,
  timer: null,
  lastTick: -1,
  audio: null,
  deckFinished: false,
  holdTimer: null
};

function showScreen(id) {
  screens.forEach((screen) => { $(screen).hidden = screen !== id; });
  $("end-game").hidden = id === "setup-screen" || id === "results-screen";
  $("home-link").hidden = id !== "setup-screen" && id !== "results-screen";
  $("turn-chip").hidden = id === "setup-screen" || id === "results-screen";
  $("turn-chip").textContent = `TURN ${game.turnNumber}`;
}

function setError(message) {
  $("setup-error").textContent = message;
  $("setup-error").hidden = !message;
}

function renderPlayerFields(count) {
  const fields = $("player-fields");
  const previous = [...fields.querySelectorAll("input")].map((input) => input.value);
  fields.replaceChildren();
  for (let i = 0; i < count; i++) {
    const row = document.createElement("label");
    row.className = "player-field";
    const number = document.createElement("span");
    number.className = "player-number";
    number.textContent = String(i + 1);
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 24;
    input.placeholder = `Player ${i + 1}`;
    input.setAttribute("aria-label", `Player ${i + 1} name`);
    input.value = previous[i] || "";
    row.append(number, input);
    fields.append(row);
  }
  $("player-count").value = String(count);
  $("remove-player").disabled = count <= 2;
  $("add-player").disabled = count >= 8;
}

function validateDeck(data) {
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.cards) || data.cards.length < 2) {
    throw new Error('Cards must be a JSON object with a "cards" array containing at least two names.');
  }
  if (data.cards.some((card) => typeof card !== "string" || !card.trim())) {
    throw new Error("Every card must be a non-empty name or phrase.");
  }
  const cards = data.cards.map((card) => card.trim());
  if (cards.some((card) => card.length > 50)) {
    throw new Error("Keep each card to 50 characters or fewer so it fits on a phone.");
  }
  if (new Set(cards.map((card) => card.toLowerCase())).size !== cards.length) {
    throw new Error("Cards must be unique. Remove duplicate names from your deck.");
  }
  return cards;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function renderScores(targetId, activeIndex) {
  const target = $(targetId);
  target.replaceChildren();
  game.players.forEach((player, index) => {
    const item = document.createElement("div");
    item.className = "mini-score" + (index === activeIndex ? " current" : "");
    const name = document.createElement("span");
    name.textContent = player.name;
    const score = document.createElement("strong");
    score.textContent = String(player.score);
    item.append(name, score);
    target.append(item);
  });
}

function showReady() {
  game.phase = "ready";
  const player = game.players[game.currentPlayer];
  $("ready-eyebrow").textContent = game.turnNumber === 1 ? "FIRST UP" : "YOU'RE UP";
  $("ready-name").textContent = player.name;
  renderScores("ready-scores", game.currentPlayer);
  showScreen("ready-screen");
}

function drawCard() {
  if (game.remaining.length === 0) return false;
  game.currentCard = game.remaining.pop();
  $("current-card").textContent = game.cards[game.currentCard];
  return true;
}

function primeAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!game.audio) game.audio = new AudioContext();
    game.audio.resume();
    const oscillator = game.audio.createOscillator();
    const gain = game.audio.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain).connect(game.audio.destination);
    oscillator.start();
    oscillator.stop(game.audio.currentTime + 0.01);
  } catch (error) { /* The timer also has a visible end state. */ }
}

function sound(frequency, volume, duration) {
  try {
    if (!game.audio) return;
    const now = game.audio.currentTime;
    const oscillator = game.audio.createOscillator();
    const gain = game.audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(game.audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  } catch (error) { /* Audio is optional on unsupported devices. */ }
}

function timeUpSound() {
  sound(840, 0.16, 0.22);
  window.setTimeout(() => sound(620, 0.16, 0.32), 180);
  if (navigator.vibrate) navigator.vibrate([140, 80, 140]);
}

function updateTimer() {
  if (game.phase !== "play") return;
  const remaining = Math.max(0, game.deadline - performance.now());
  const seconds = Math.ceil(remaining / 1000);
  $("timer").textContent = String(seconds);
  $("timer").classList.toggle("urgent", remaining <= 10000);
  $("timer-progress").style.width = `${remaining / 60000 * 100}%`;
  if (remaining <= 0) {
    finishTurn("time");
  } else if (seconds <= 3 && seconds !== game.lastTick) {
    game.lastTick = seconds;
    sound(650, 0.04, 0.09);
  }
}

function startRound() {
  if (game.phase !== "ready") return;
  if (game.remaining.length === 0) { showResults("DECK COMPLETE"); return; }
  primeAudio();
  game.phase = "play";
  game.roundCorrect = 0;
  game.roundPasses = 0;
  game.deadline = performance.now() + 60000;
  game.lastTick = -1;
  $("play-title").textContent = game.players[game.currentPlayer].name;
  $("round-score").textContent = "0";
  $("timer").classList.remove("urgent");
  $("correct-card").disabled = false;
  $("pass-card").disabled = false;
  drawCard();
  updateTimer();
  showScreen("play-screen");
  game.timer = window.setInterval(updateTimer, 100);
}

function answer(correct) {
  if (game.phase !== "play") return;
  if (performance.now() >= game.deadline) { finishTurn("time"); return; }
  if (correct) {
    game.roundCorrect++;
    game.players[game.currentPlayer].score++;
    $("round-score").textContent = String(game.roundCorrect);
  } else {
    game.roundPasses++;
    game.players[game.currentPlayer].passes++;
  }
  if (!drawCard()) finishTurn("deck");
}

function finishTurn(reason) {
  if (game.phase !== "play") return;
  game.phase = "turn-end";
  window.clearInterval(game.timer);
  game.timer = null;
  $("correct-card").disabled = true;
  $("pass-card").disabled = true;
  $("current-card").textContent = "";
  game.turnsCompleted++;
  if (game.roundCorrect > game.bestTurn.count) game.bestTurn = { player: game.currentPlayer, count: game.roundCorrect };
  game.deckFinished = reason === "deck";
  if (reason === "time") timeUpSound();
  $("turn-end-label").textContent = reason === "deck" ? "DECK COMPLETE!" : "TIME'S UP!";
  $("turn-end-name").textContent = game.players[game.currentPlayer].name;
  $("turn-end-score").textContent = `${game.roundCorrect} ${game.roundCorrect === 1 ? "card" : "cards"} guessed!`;
  renderScores("turn-end-scores", game.currentPlayer);
  const nextIndex = (game.currentPlayer + 1) % game.players.length;
  $("next-player-note").textContent = game.deckFinished ? "Every card has been played. See who won!" : `${game.players[nextIndex].name} is up next.`;
  $("next-turn").firstChild.textContent = game.deckFinished ? "SEE RESULTS " : "PASS THE PHONE ";
  showScreen("turn-end-screen");
}

function addStat(label, value) {
  const item = document.createElement("div");
  item.className = "stat";
  const title = document.createElement("span");
  title.className = "stat-label";
  title.textContent = label;
  const detail = document.createElement("strong");
  detail.className = "stat-value";
  detail.textContent = value;
  item.append(title, detail);
  $("stats").append(item);
}

function showResults(reason) {
  cancelEndHold();
  window.clearInterval(game.timer);
  game.timer = null;
  game.phase = "results";
  $("results-reason").textContent = reason;
  $("results-summary").textContent = `${game.turnsCompleted} ${game.turnsCompleted === 1 ? "turn" : "turns"} completed · ${game.players.reduce((total, player) => total + player.score, 0)} names guessed`;
  const ranking = game.players.map((player, index) => ({ ...player, index })).sort((a, b) => b.score - a.score || a.index - b.index);
  const board = $("leaderboard");
  board.replaceChildren();
  board.classList.toggle("many", ranking.length > 5);
  ranking.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "leader-row";
    const rank = document.createElement("span");
    rank.className = "leader-rank";
    rank.textContent = `#${index + 1}`;
    const name = document.createElement("span");
    name.className = "leader-name";
    name.textContent = player.name;
    const score = document.createElement("strong");
    score.className = "leader-score";
    score.textContent = String(player.score);
    row.append(rank, name, score);
    board.append(row);
  });
  $("stats").replaceChildren();
  const mostPasses = ranking.reduce((best, player) => player.passes > best.passes ? player : best, ranking[0]);
  addStat("Best turn", game.bestTurn.count ? `${game.players[game.bestTurn.player].name} · ${game.bestTurn.count} guessed` : "No guesses yet");
  addStat("Most passes", mostPasses.passes ? `${mostPasses.name} · ${mostPasses.passes} passes` : "Everyone was brave");
  showScreen("results-screen");
}

function cancelEndHold() {
  window.clearTimeout(game.holdTimer);
  game.holdTimer = null;
  $("end-game").classList.remove("holding");
}

function beginEndHold(event) {
  if (game.phase === "setup" || game.phase === "results" || game.holdTimer) return;
  event.preventDefault();
  $("end-game").classList.add("holding");
  game.holdTimer = window.setTimeout(() => showResults("ENDED BY THE GROUP"), 3000);
}

function resetGame() {
  window.clearInterval(game.timer);
  game.timer = null;
  game.players.forEach((player) => { player.score = 0; player.passes = 0; });
  game.remaining = shuffle(game.cards.map((_, index) => index));
  game.currentPlayer = Math.floor(Math.random() * game.players.length);
  game.currentCard = -1;
  game.turnNumber = 1;
  game.turnsCompleted = 0;
  game.bestTurn = { player: -1, count: 0 };
  game.deckFinished = false;
  showReady();
}

async function startGame(event) {
  event.preventDefault();
  if (game.phase !== "setup") return;
  setError("");
  $("start-game").disabled = true;
  try {
    const names = [...$("player-fields").querySelectorAll("input")].map((input, index) => input.value.trim() || `Player ${index + 1}`);
    if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) throw new Error("Give each player a different name.");
    const source = document.querySelector('input[name="deck"]:checked').value;
    let data;
    if (source === "custom") {
      const raw = $("custom-json").value.trim();
      if (!raw) throw new Error("Paste your custom cards JSON first.");
      try { data = JSON.parse(raw); }
      catch (error) { throw new Error("That JSON is invalid. Check quotes, commas, and brackets."); }
    } else {
      let response;
      try { response = await fetch("cards.json", { cache: "no-store" }); }
      catch (error) { throw new Error("Could not load cards.json. Use a local HTTP server or static host."); }
      if (!response.ok) throw new Error(`Could not load cards.json (HTTP ${response.status}).`);
      try { data = await response.json(); }
      catch (error) { throw new Error("cards.json contains invalid JSON."); }
    }
    game.cards = validateDeck(data);
    game.players = names.map((name) => ({ name, score: 0, passes: 0 }));
    resetGame();
  } catch (error) {
    setError(error.message || "Could not start the game.");
  } finally {
    $("start-game").disabled = false;
  }
}

$("setup-form").addEventListener("submit", startGame);
$("remove-player").addEventListener("click", () => renderPlayerFields(Math.max(2, Number($("player-count").value) - 1)));
$("add-player").addEventListener("click", () => renderPlayerFields(Math.min(8, Number($("player-count").value) + 1)));
document.querySelectorAll('input[name="deck"]').forEach((input) => input.addEventListener("change", () => {
  $("custom-wrap").hidden = document.querySelector('input[name="deck"]:checked').value !== "custom";
  setError("");
}));
$("start-round").addEventListener("click", startRound);
$("correct-card").addEventListener("click", () => answer(true));
$("pass-card").addEventListener("click", () => answer(false));
$("next-turn").addEventListener("click", () => {
  if (game.phase !== "turn-end") return;
  if (game.deckFinished) { showResults("DECK COMPLETE"); return; }
  game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
  game.turnNumber++;
  showReady();
});
$("play-again").addEventListener("click", () => { if (game.phase === "results") resetGame(); });
$("new-game").addEventListener("click", () => { if (game.phase === "results") { game.phase = "setup"; showScreen("setup-screen"); } });

const endButton = $("end-game");
endButton.addEventListener("pointerdown", beginEndHold);
for (const type of ["pointerup", "pointercancel", "pointerleave"]) endButton.addEventListener(type, cancelEndHold);
endButton.addEventListener("contextmenu", (event) => event.preventDefault());
endButton.addEventListener("keydown", (event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) beginEndHold(event); });
endButton.addEventListener("keyup", (event) => { if (event.key === " " || event.key === "Enter") cancelEndHold(); });
renderPlayerFields(2);
