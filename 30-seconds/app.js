"use strict";

const FINISH = 31;
const MARKER_COLOURS = ["#1745af", "#d94a3f", "#197a67", "#8b4ac8", "#db7a13", "#d13d83", "#5a638b", "#377b9f"];
const $ = (id) => document.getElementById(id);
const screens = ["setup-screen", "reveal-screen", "board-screen", "round-screen", "score-screen", "winner-screen"];

const game = {
  players: [],
  currentPlayer: 0,
  startingPlayer: 0,
  selectedColour: "blue",
  currentPositions: [],
  cards: [],
  remainingCards: [],
  lastCard: -1,
  currentCardIndex: -1,
  activeColour: "blue",
  timer: null,
  deadline: 0,
  lastCountdownSecond: -1,
  gameStarted: false,
  winner: null,
  turnNumber: 1,
  phase: "setup",
  audio: null
};

function showScreen(id) {
  screens.forEach((screen) => { $(screen).hidden = screen !== id; });
  document.body.classList.toggle("in-round", id === "round-screen");
  window.scrollTo(0, 0);
}

function renderPlayerFields(count) {
  const container = $("player-fields");
  const previous = [...container.querySelectorAll("input")].map((input) => input.value);
  container.replaceChildren();
  for (let i = 0; i < count; i++) {
    const row = document.createElement("label");
    row.className = "player-field";
    const badge = document.createElement("span");
    badge.className = "player-index";
    badge.style.setProperty("--marker", MARKER_COLOURS[i]);
    badge.textContent = String(i + 1);
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 24;
    input.placeholder = `Player ${i + 1}`;
    input.setAttribute("aria-label", `Player ${i + 1} name`);
    input.value = previous[i] || "";
    row.append(badge, input);
    container.append(row);
  }
  $("player-count").value = String(count);
  $("remove-player").disabled = count <= 2;
  $("add-player").disabled = count >= 8;
}

function setError(message) {
  const error = $("setup-error");
  error.textContent = message;
  error.hidden = !message;
  if (message) error.scrollIntoView({ block: "nearest" });
}

function validateCards(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.cards) || data.cards.length === 0) {
    throw new Error('Cards must be a JSON object with a non-empty "cards" array.');
  }
  data.cards.forEach((card, index) => {
    if (!card || typeof card !== "object" || Array.isArray(card)) {
      throw new Error(`Card ${index + 1} must be an object with "blue" and "yellow" arrays.`);
    }
    for (const colour of ["blue", "yellow"]) {
      if (!Array.isArray(card[colour]) || card[colour].length !== 5 || card[colour].some((prompt) => typeof prompt !== "string" || !prompt.trim())) {
        throw new Error(`Card ${index + 1} needs exactly five non-empty text prompts in its "${colour}" array.`);
      }
    }
  });
  return data.cards;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function refillDeck() {
  game.remainingCards = shuffle(game.cards.map((_, index) => index));
  if (game.remainingCards.length > 1 && game.remainingCards[game.remainingCards.length - 1] === game.lastCard) {
    [game.remainingCards[0], game.remainingCards[game.remainingCards.length - 1]] = [game.remainingCards[game.remainingCards.length - 1], game.remainingCards[0]];
  }
}

function colourAtPosition(position) {
  return position % 2 === 0 ? game.selectedColour : (game.selectedColour === "blue" ? "yellow" : "blue");
}

function drawCard() {
  if (game.remainingCards.length === 0) refillDeck();
  game.currentCardIndex = game.remainingCards.pop();
  game.lastCard = game.currentCardIndex;
}

function renderCardFace() {
  const prompts = game.cards[game.currentCardIndex][game.activeColour];
  const list = $("prompts");
  list.replaceChildren();
  prompts.forEach((prompt) => {
    const item = document.createElement("li");
    item.textContent = prompt;
    list.append(item);
  });
  $("card-colour").textContent = `${game.activeColour.toUpperCase()} SIDE`;
  $("game-card").classList.toggle("yellow", game.activeColour === "yellow");
  $("flip-card").textContent = `Flip to ${game.activeColour === "blue" ? "Yellow" : "Blue"} side ↻`;
}

function flipCard() {
  if (game.phase !== "round") return;
  if (performance.now() >= game.deadline) {
    endTurn();
    return;
  }
  game.activeColour = game.activeColour === "blue" ? "yellow" : "blue";
  renderCardFace();
}

function renderScoreReview() {
  const review = $("score-review");
  review.replaceChildren();
  for (const colour of ["blue", "yellow"]) {
    const face = document.createElement("section");
    face.className = `review-face ${colour}`;
    const heading = document.createElement("h2");
    heading.textContent = `${colour[0].toUpperCase()}${colour.slice(1)} side`;
    const list = document.createElement("ol");
    game.cards[game.currentCardIndex][colour].forEach((prompt) => {
      const item = document.createElement("li");
      item.textContent = prompt;
      list.append(item);
    });
    face.append(heading, list);
    review.append(face);
  }
}

function renderLegend(targetId, activeIndex) {
  const target = $(targetId);
  target.replaceChildren();
  game.players.forEach((name, index) => {
    const item = document.createElement("div");
    item.className = "legend-item" + (index === activeIndex ? " current" : "");
    const badge = document.createElement("span");
    badge.className = "player-index";
    badge.style.setProperty("--marker", MARKER_COLOURS[index]);
    badge.textContent = String(index + 1);
    const label = document.createElement("strong");
    label.textContent = name;
    item.append(badge, label);
    target.append(item);
  });
}

function renderBoard(targetId, activeIndex) {
  const target = $(targetId);
  target.replaceChildren();
  for (let position = 0; position <= FINISH; position++) {
    const space = document.createElement("div");
    space.className = `space ${colourAtPosition(position)}` + (position === 0 ? " start" : "") + (position === FINISH ? " finish" : "");
    const label = document.createElement("span");
    label.className = "space-label";
    label.textContent = position === 0 ? "START" : position === FINISH ? "FINISH" : String(position);
    const markers = document.createElement("div");
    markers.className = "markers";
    game.currentPositions.forEach((playerPosition, index) => {
      if (playerPosition !== position) return;
      const marker = document.createElement("span");
      marker.className = "marker" + (index === activeIndex ? " active" : "");
      marker.style.setProperty("--marker", MARKER_COLOURS[index]);
      marker.textContent = String(index + 1);
      marker.title = game.players[index];
      markers.append(marker);
    });
    space.append(label, markers);
    target.append(space);
  }
  target.setAttribute("aria-label", game.players.map((name, i) => `${name}: ${game.currentPositions[i] === FINISH ? "Finish" : game.currentPositions[i]}`).join("; "));
}

function showTurnBoard(afterScore = false, scoredPlayer = 0, points = 0) {
  game.phase = afterScore ? "afterScore" : "ready";
  const active = afterScore ? scoredPlayer : game.currentPlayer;
  renderLegend("player-legend", active);
  renderBoard("board", active);
  $("turn-counter").textContent = `TURN ${game.turnNumber}`;
  $("turn-label").textContent = afterScore ? "SCORE ADDED" : "UP NEXT";
  $("turn-player").textContent = game.players[active];
  $("turn-detail").textContent = afterScore
    ? `+${points} ${points === 1 ? "space" : "spaces"} · Now at ${game.currentPositions[active] === FINISH ? "Finish" : game.currentPositions[active]}`
    : `${colourAtPosition(game.currentPositions[active]).toUpperCase()} side first · Position ${game.currentPositions[active] === 0 ? "Start" : game.currentPositions[active]}`;
  $("board-action").innerHTML = afterScore ? 'Pass to next player <span aria-hidden="true">→</span>' : 'Start turn <span aria-hidden="true">↗</span>';
  showScreen("board-screen");
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
  } catch (error) { /* Audio is optional on unsupported devices. */ }
}

function playTimeUpSound() {
  try {
    if (!game.audio) return;
    game.audio.resume();
    const now = game.audio.currentTime;
    [0, 0.18, 0.36].forEach((offset, index) => {
      const oscillator = game.audio.createOscillator();
      const gain = game.audio.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = index === 2 ? 620 : 780;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);
      oscillator.connect(gain).connect(game.audio.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.15);
    });
  } catch (error) { /* Visual time-up state still works. */ }
  if (navigator.vibrate) navigator.vibrate([150, 90, 150]);
}

function playCountdownTick() {
  try {
    if (!game.audio) return;
    const now = game.audio.currentTime;
    const oscillator = game.audio.createOscillator();
    const gain = game.audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    oscillator.connect(gain).connect(game.audio.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } catch (error) { /* The visible countdown still works without audio. */ }
}

function updateTimer() {
  if (game.phase !== "round") return;
  const remaining = Math.max(0, game.deadline - performance.now());
  const seconds = Math.ceil(remaining / 1000);
  $("timer").textContent = String(seconds);
  $("timer").classList.toggle("urgent", remaining <= 10000);
  $("timer-progress").style.width = `${remaining / 30000 * 100}%`;
  if (remaining <= 0) {
    endTurn();
  } else if (seconds <= 3 && seconds !== game.lastCountdownSecond) {
    game.lastCountdownSecond = seconds;
    playCountdownTick();
  }
}

function startTurn() {
  if (game.phase !== "ready") return;
  primeAudio();
  game.phase = "round";
  game.deadline = performance.now() + 30000;
  game.lastCountdownSecond = -1;
  game.activeColour = colourAtPosition(game.currentPositions[game.currentPlayer]);
  drawCard();
  $("round-title").textContent = game.players[game.currentPlayer];
  $("timer").classList.remove("urgent");
  $("flip-card").disabled = false;
  renderCardFace();
  updateTimer();
  showScreen("round-screen");
  game.timer = window.setInterval(updateTimer, 100);
}

function endTurn() {
  if (game.phase !== "round") return;
  game.phase = "score";
  window.clearInterval(game.timer);
  game.timer = null;
  $("timer").textContent = "0";
  $("flip-card").disabled = true;
  playTimeUpSound();
  $("score-player-label").textContent = game.players[game.currentPlayer].toUpperCase();
  renderScoreReview();
  showScreen("score-screen");
}

function scoreTurn(points) {
  if (game.phase !== "score" || !Number.isInteger(points) || points < 0 || points > 10) return;
  const player = game.currentPlayer;
  game.currentPositions[player] = Math.min(FINISH, game.currentPositions[player] + points);
  if (game.currentPositions[player] === FINISH) {
    game.winner = player;
    game.phase = "winner";
    $("winner-name").textContent = game.players[player];
    renderLegend("final-legend", player);
    renderBoard("final-board", player);
    showScreen("winner-screen");
    return;
  }
  showTurnBoard(true, player, points);
}

function resetGame() {
  window.clearInterval(game.timer);
  game.timer = null;
  game.currentPositions = game.players.map(() => 0);
  game.startingPlayer = Math.floor(Math.random() * game.players.length);
  game.currentPlayer = game.startingPlayer;
  game.remainingCards = [];
  game.lastCard = -1;
  game.currentCardIndex = -1;
  game.winner = null;
  game.turnNumber = 1;
  game.gameStarted = true;
  game.phase = "reveal";
  $("starter-name").textContent = game.players[game.startingPlayer];
  showScreen("reveal-screen");
}

async function startGame(event) {
  event.preventDefault();
  if (game.phase !== "setup") return;
  setError("");
  const button = $("start-game");
  button.disabled = true;
  try {
    const players = [...$("player-fields").querySelectorAll("input")].map((input, index) => input.value.trim() || `Player ${index + 1}`);
    const colour = document.querySelector('input[name="colour"]:checked').value;
    const source = document.querySelector('input[name="card-source"]:checked').value;
    let data;
    if (source === "custom") {
      const raw = $("custom-cards").value.trim();
      if (!raw) throw new Error("Paste your cards JSON before starting.");
      try { data = JSON.parse(raw); }
      catch (error) { throw new Error("That is not valid JSON. Check quotes, commas, and brackets, then try again."); }
    } else {
      let response;
      try { response = await fetch("cards.json", { cache: "no-store" }); }
      catch (error) { throw new Error("Could not load cards.json. Open the game through a local HTTP server or static host."); }
      if (!response.ok) throw new Error(`Could not load cards.json (HTTP ${response.status}).`);
      try { data = await response.json(); }
      catch (error) { throw new Error("cards.json contains invalid JSON."); }
    }
    game.cards = validateCards(data);
    game.players = players;
    game.selectedColour = colour;
    resetGame();
  } catch (error) {
    setError(error.message || "Could not start the game.");
  } finally {
    button.disabled = false;
  }
}

$("setup-form").addEventListener("submit", startGame);
$("remove-player").addEventListener("click", () => renderPlayerFields(Math.max(2, Number($("player-count").value) - 1)));
$("add-player").addEventListener("click", () => renderPlayerFields(Math.min(8, Number($("player-count").value) + 1)));
document.querySelectorAll('input[name="card-source"]').forEach((input) => input.addEventListener("change", () => { $("custom-cards-wrap").hidden = document.querySelector('input[name="card-source"]:checked').value !== "custom"; setError(""); }));
$("show-board").addEventListener("click", () => { if (game.phase === "reveal") showTurnBoard(); });
$("board-action").addEventListener("click", () => {
  if (game.phase === "ready") startTurn();
  else if (game.phase === "afterScore") {
    game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
    game.turnNumber++;
    showTurnBoard();
  }
});
$("flip-card").addEventListener("click", flipCard);
for (let points = 0; points <= 10; points++) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = String(points);
  button.setAttribute("aria-label", `${points} correct`);
  button.addEventListener("click", () => scoreTurn(points));
  $("score-buttons").append(button);
}
$("play-again").addEventListener("click", () => { if (game.phase === "winner") resetGame(); });
$("new-game").addEventListener("click", () => {
  if (game.phase !== "winner") return;
  game.phase = "setup";
  game.gameStarted = false;
  game.winner = null;
  showScreen("setup-screen");
});
renderPlayerFields(2);
