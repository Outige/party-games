"use strict";

const $ = (id) => document.getElementById(id);
const screenIds = ["setup-screen", "intro-screen", "handoff-screen", "pick-screen", "vote-screen", "reveal-screen", "results-screen"];
const SWEAR_WORDS = /\b(fuck(?:ing|ed|er|s)?|shit(?:ty|s)?|damn|hell|crap|ass(?:hole)?|bitch(?:es)?|bastard|piss(?:ed|ing)?|bollocks)\b/gi;

const game = {
  phase: "setup",
  cards: null,
  players: [],
  judgeIndex: 0,
  blackRemaining: [],
  round: null,
  roundsPlayed: 0,
  holdTimer: null
};

function showScreen(id) {
  screenIds.forEach((screen) => { $(screen).hidden = screen !== id; });
  $("end-game").hidden = id === "setup-screen" || id === "results-screen";
  $("round-badge").hidden = id === "setup-screen" || id === "results-screen";
  $("home-link").hidden = id !== "setup-screen" && id !== "results-screen";
  if (game.round) $("round-badge").textContent = `R${game.round.number}`;
}

function setError(message) {
  $("setup-error").textContent = message;
  $("setup-error").hidden = !message;
}

function setPlayerCount(count) {
  $("player-count").value = String(count);
  $("minus-player").disabled = count <= 3;
  $("plus-player").disabled = count >= 10;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function validateDeck(data, playerCount) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error('JSON must be an object with "black_cards" and "white_cards" arrays.');
  }
  for (const key of ["black_cards", "white_cards"]) {
    if (!Array.isArray(data[key]) || data[key].length === 0) {
      throw new Error(`"${key}" must be a non-empty array of card text.`);
    }
    if (data[key].some((card) => typeof card !== "string" || !card.trim())) {
      throw new Error(`Every card in "${key}" must be non-empty text.`);
    }
    const maxLength = key === "black_cards" ? 100 : 75;
    if (data[key].some((card) => card.trim().length > maxLength)) {
      throw new Error(`Cards in "${key}" must be ${maxLength} characters or shorter so they fit on a phone.`);
    }
    const normalized = data[key].map((card) => card.trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      throw new Error(`"${key}" contains duplicate cards. Each card must be unique.`);
    }
  }
  if (data.white_cards.length < 3 * (playerCount - 1)) {
    throw new Error(`With ${playerCount} players, you need at least ${3 * (playerCount - 1)} unique white cards so everyone gets their own three.`);
  }
  return {
    black_cards: data.black_cards.map((card) => card.trim()),
    white_cards: data.white_cards.map((card) => card.trim())
  };
}

function playerName(index) { return `Player ${index + 1}`; }

function beginRound() {
  if (game.blackRemaining.length === 0) {
    showResults("ALL BLACK CARDS PLAYED");
    return;
  }
  const blackIndex = game.blackRemaining.pop();
  const pickerOrder = game.players.map((_, index) => index).filter((index) => index !== game.judgeIndex);
  const whiteOrder = shuffle(game.cards.white_cards.map((_, index) => index));
  const options = new Map();
  pickerOrder.forEach((playerIndex, index) => {
    options.set(playerIndex, whiteOrder.slice(index * 3, index * 3 + 3));
  });
  game.round = {
    number: game.roundsPlayed + 1,
    blackIndex,
    pickerOrder,
    pickerCursor: 0,
    options,
    submissions: [],
    candidates: [],
    candidateCursor: 0
  };
  game.phase = "intro";
  $("intro-round").textContent = String(game.round.number);
  $("judge-name").textContent = playerName(game.judgeIndex);
  $("intro-prompt").textContent = game.cards.black_cards[blackIndex];
  showScreen("intro-screen");
}

function showHandoff(role) {
  game.phase = role === "judge" ? "judge-handoff" : "picker-handoff";
  const playerIndex = role === "judge" ? game.judgeIndex : game.round.pickerOrder[game.round.pickerCursor];
  $("handoff-role").textContent = role === "judge" ? "TIME TO JUDGE" : `PICK ${game.round.pickerCursor + 1} OF ${game.round.pickerOrder.length}`;
  $("handoff-player").textContent = playerName(playerIndex);
  $("handoff-hint").textContent = role === "judge"
    ? "Only the judge should see the anonymous answers."
    : "Only this player should see their three answer cards.";
  showScreen("handoff-screen");
}

function showPick() {
  game.phase = "pick";
  const playerIndex = game.round.pickerOrder[game.round.pickerCursor];
  $("pick-title").textContent = `${playerName(playerIndex).toUpperCase()} · PICK YOUR FUNNIEST`;
  $("pick-prompt").textContent = game.cards.black_cards[game.round.blackIndex];
  const options = $("options");
  options.replaceChildren();
  game.round.options.get(playerIndex).forEach((cardIndex, optionIndex) => {
    const button = document.createElement("button");
    button.className = "option-card";
    button.type = "button";
    const number = document.createElement("span");
    number.className = "option-number";
    number.textContent = String(optionIndex + 1);
    const text = document.createElement("span");
    text.className = "option-text";
    text.textContent = game.cards.white_cards[cardIndex];
    button.append(number, text);
    button.addEventListener("click", () => submitChoice(cardIndex));
    options.append(button);
  });
  showScreen("pick-screen");
}

function submitChoice(cardIndex) {
  if (game.phase !== "pick") return;
  const playerIndex = game.round.pickerOrder[game.round.pickerCursor];
  if (!game.round.options.get(playerIndex).includes(cardIndex)) return;
  const answer = game.cards.white_cards[cardIndex];
  game.round.submissions.push({ playerIndex, cardIndex });
  game.players[playerIndex].submissions++;
  game.players[playerIndex].swears += (answer.match(SWEAR_WORDS) || []).length;
  if (answer.length > game.players[playerIndex].longestAnswer) game.players[playerIndex].longestAnswer = answer.length;
  game.round.pickerCursor++;
  if (game.round.pickerCursor < game.round.pickerOrder.length) {
    showHandoff("picker");
  } else {
    game.round.candidates = shuffle([...game.round.submissions]);
    game.round.candidateCursor = 0;
    showHandoff("judge");
  }
}

function renderCandidate() {
  const { candidates, candidateCursor } = game.round;
  $("candidate-count").textContent = `ANSWER ${candidateCursor + 1} OF ${candidates.length}`;
  $("candidate-card").textContent = game.cards.white_cards[candidates[candidateCursor].cardIndex];
}

function showVote() {
  game.phase = "vote";
  $("vote-prompt").textContent = game.cards.black_cards[game.round.blackIndex];
  renderCandidate();
  showScreen("vote-screen");
}

function moveCandidate(delta) {
  if (game.phase !== "vote") return;
  const count = game.round.candidates.length;
  game.round.candidateCursor = (game.round.candidateCursor + delta + count) % count;
  renderCandidate();
}

function voteForCandidate() {
  if (game.phase !== "vote") return;
  const winner = game.round.candidates[game.round.candidateCursor];
  game.players[winner.playerIndex].score++;
  game.round.submissions.forEach((submission) => {
    if (submission.playerIndex !== winner.playerIndex) game.players[submission.playerIndex].rejected++;
  });
  game.roundsPlayed++;
  game.phase = "reveal";
  $("winner-name").textContent = playerName(winner.playerIndex);
  $("reveal-prompt").textContent = game.cards.black_cards[game.round.blackIndex];
  $("reveal-answer").textContent = game.cards.white_cards[winner.cardIndex];
  $("reveal-score").textContent = `${playerName(winner.playerIndex)} now has ${game.players[winner.playerIndex].score} ${game.players[winner.playerIndex].score === 1 ? "point" : "points"}.`;
  $("next-round").firstChild.textContent = game.blackRemaining.length ? "NEXT ROUND " : "SEE RESULTS ";
  showScreen("reveal-screen");
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
  game.phase = "results";
  $("results-reason").textContent = reason;
  $("results-summary").textContent = `${game.roundsPlayed} ${game.roundsPlayed === 1 ? "round" : "rounds"} judged · ${game.players.reduce((total, player) => total + player.submissions, 0)} answers submitted`;
  const ranking = game.players.map((player, index) => ({ ...player, index })).sort((a, b) => b.score - a.score || a.index - b.index);
  const board = $("leaderboard");
  board.replaceChildren();
  board.classList.toggle("many", ranking.length > 6);
  ranking.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "leader-row";
    const rank = document.createElement("span");
    rank.className = "leader-rank";
    rank.textContent = `#${index + 1}`;
    const name = document.createElement("span");
    name.className = "leader-name";
    name.textContent = playerName(player.index);
    const score = document.createElement("strong");
    score.className = "leader-score";
    score.textContent = String(player.score);
    row.append(rank, name, score);
    board.append(row);
  });
  $("stats").replaceChildren();
  const sweary = ranking.reduce((best, player) => player.swears > best.swears ? player : best, ranking[0]);
  const rejected = ranking.reduce((best, player) => player.rejected > best.rejected ? player : best, ranking[0]);
  const wordy = ranking.reduce((best, player) => player.longestAnswer > best.longestAnswer ? player : best, ranking[0]);
  addStat("Most swear words", sweary.swears ? `${playerName(sweary.index)} · ${sweary.swears}` : "Too polite to count");
  addStat("Fan favourite", ranking[0].score ? `${playerName(ranking[0].index)} · ${ranking[0].score} wins` : "No votes yet");
  addStat("Robbed by the judge", rejected.rejected ? `${playerName(rejected.index)} · ${rejected.rejected} times` : "Everyone's still safe");
  addStat("Longest answer", wordy.longestAnswer ? `${playerName(wordy.index)} · ${wordy.longestAnswer} characters` : "No answers yet");
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

async function startGame(event) {
  event.preventDefault();
  if (game.phase !== "setup") return;
  setError("");
  $("start-game").disabled = true;
  try {
    const playerCount = Number($("player-count").value);
    const source = document.querySelector('input[name="deck"]:checked').value;
    let data;
    if (source === "custom") {
      const raw = $("custom-json").value.trim();
      if (!raw) throw new Error("Paste your custom cards JSON first.");
      try { data = JSON.parse(raw); }
      catch (error) { throw new Error("That JSON is invalid. Check its quotes, commas, and brackets."); }
    } else {
      let response;
      try { response = await fetch("cards.json", { cache: "no-store" }); }
      catch (error) { throw new Error("Could not load cards.json. Use a local HTTP server or static host."); }
      if (!response.ok) throw new Error(`Could not load cards.json (HTTP ${response.status}).`);
      try { data = await response.json(); }
      catch (error) { throw new Error("cards.json contains invalid JSON."); }
    }
    game.cards = validateDeck(data, playerCount);
    game.players = Array.from({ length: playerCount }, () => ({ score: 0, submissions: 0, rejected: 0, swears: 0, longestAnswer: 0 }));
    game.judgeIndex = Math.floor(Math.random() * playerCount);
    game.blackRemaining = shuffle(game.cards.black_cards.map((_, index) => index));
    game.roundsPlayed = 0;
    beginRound();
  } catch (error) {
    setError(error.message || "Could not start the game.");
  } finally {
    $("start-game").disabled = false;
  }
}

$("minus-player").addEventListener("click", () => setPlayerCount(Math.max(3, Number($("player-count").value) - 1)));
$("plus-player").addEventListener("click", () => setPlayerCount(Math.min(10, Number($("player-count").value) + 1)));
document.querySelectorAll('input[name="deck"]').forEach((input) => input.addEventListener("change", () => {
  const custom = document.querySelector('input[name="deck"]:checked').value === "custom";
  $("custom-wrap").hidden = !custom;
  $("setup-screen").classList.toggle("custom-mode", custom);
  setError("");
}));
$("setup-form").addEventListener("submit", startGame);
$("begin-picks").addEventListener("click", () => { if (game.phase === "intro") showHandoff("picker"); });
$("handoff-action").addEventListener("click", () => {
  if (game.phase === "picker-handoff") showPick();
  else if (game.phase === "judge-handoff") showVote();
});
$("previous-candidate").addEventListener("click", () => moveCandidate(-1));
$("next-candidate").addEventListener("click", () => moveCandidate(1));
$("vote-candidate").addEventListener("click", voteForCandidate);
$("next-round").addEventListener("click", () => {
  if (game.phase !== "reveal") return;
  game.judgeIndex = (game.judgeIndex + 1) % game.players.length;
  beginRound();
});
$("play-again").addEventListener("click", () => {
  if (game.phase !== "results") return;
  game.players.forEach((player) => Object.assign(player, { score: 0, submissions: 0, rejected: 0, swears: 0, longestAnswer: 0 }));
  game.judgeIndex = Math.floor(Math.random() * game.players.length);
  game.blackRemaining = shuffle(game.cards.black_cards.map((_, index) => index));
  game.roundsPlayed = 0;
  beginRound();
});
$("new-game").addEventListener("click", () => { if (game.phase === "results") { game.phase = "setup"; game.round = null; showScreen("setup-screen"); } });

const endButton = $("end-game");
endButton.addEventListener("pointerdown", beginEndHold);
for (const type of ["pointerup", "pointercancel", "pointerleave"]) endButton.addEventListener(type, cancelEndHold);
endButton.addEventListener("contextmenu", (event) => event.preventDefault());
endButton.addEventListener("keydown", (event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) beginEndHold(event); });
endButton.addEventListener("keyup", (event) => { if (event.key === " " || event.key === "Enter") cancelEndHold(); });
setPlayerCount(3);
