"use strict";

const $ = (id) => document.getElementById(id);
const SAVE_KEY = "sounds-fishy-game-v1";
const HISTORY_KEY = "sounds-fishy-played-v1";
const COOKIE_PREFIX = "sf_answer_";
const PROMPT = `Create an engaging Sounds Fishy question deck as VALID JSON only. Return a JSON array of 30 objects, each with exactly two string fields: "question" and "answer". Example: [{"question":"What is the name for a group of flamingos?","answer":"A flamboyance"}]. Make every question unique and every answer factually correct, short, surprising, and easy to say aloud. Prefer verifiable general knowledge and avoid ambiguous answers, opinion questions, spoilers, and trick wording. Do not include markdown, comments, or extra fields.`;
const state = { phase: "setup", players: [], cards: [], source: "default", guesser: 0, round: null, roundsPlayed: 0 };
let defaultCards = [];
let holdTimer = null;

function safe(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) { /* Storage can be disabled. */ } }
function hash(text) {
  let value = 2166136261;
  for (const char of text) { value ^= char.charCodeAt(0); value = Math.imul(value, 16777619); }
  return (value >>> 0).toString(36);
}
function cardId(card) { return hash(card.question.trim().toLowerCase()); }
function cookieIds() {
  return document.cookie.split(";").map((part) => part.trim().split("=")[0]).filter((name) => name.startsWith(COOKIE_PREFIX)).map((name) => name.slice(COOKIE_PREFIX.length));
}
function history() {
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch (_) { /* Ignore bad stored data. */ }
  return new Set([...Array.isArray(stored) ? stored : [], ...cookieIds()]);
}
function markPlayed(card) {
  const id = cardId(card);
  const ids = history();
  ids.add(id);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([...ids])); } catch (_) { /* Cookies still work. */ }
  document.cookie = `${COOKIE_PREFIX}${id}=${encodeURIComponent(card.answer)}; Max-Age=157680000; Path=/; SameSite=Lax`;
}
function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch (_) { /* Cookies may still be available. */ }
  for (const id of cookieIds()) document.cookie = `${COOKIE_PREFIX}${id}=; Max-Age=0; Path=/; SameSite=Lax`;
}
function validateCards(data) {
  const list = Array.isArray(data) ? data : data && data.cards;
  if (!Array.isArray(list) || !list.length) throw Error('Use an array of {"question":"...","answer":"..."} cards.');
  const cards = list.map((card) => {
    if (!card || typeof card.question !== "string" || typeof card.answer !== "string" || !card.question.trim() || !card.answer.trim()) throw Error("Every card needs a non-empty question and answer.");
    const question = card.question.trim();
    const answer = card.answer.trim();
    if (question.length > 240 || answer.length > 180) throw Error("Keep questions under 240 and answers under 180 characters.");
    return { question, answer };
  });
  if (new Set(cards.map(cardId)).size !== cards.length || new Set(cards.map((card) => card.question.toLowerCase())).size !== cards.length) throw Error("Questions must be unique.");
  return cards;
}
function setScreen(html) {
  $("screen").innerHTML = html;
  $("end-game").hidden = state.phase === "setup" || state.phase === "ended";
  window.scrollTo(0, 0);
}
function countAvailable() { const used = history(); return state.cards.filter((card) => !used.has(cardId(card))).length; }
function scoreRows() { return state.players.map((player) => `<div class="score-row"><span>${safe(player.name)}</span><strong>${player.score}</strong></div>`).join(""); }
function renderSetup(error = "", previous = null) {
  state.phase = "setup";
  const count = previous?.count || 4;
  const names = previous?.names || [];
  const source = previous?.source || "default";
  const json = previous?.json || "";
  setScreen(`<p class="eyebrow">Pass the phone · Bluff the table</p><h1>Sounds<br><em>Fishy.</em></h1><p class="lede">One true answer. A sea of convincing lies. Can the guesser catch the red fish without flipping blue?</p>
    <form id="setup-form" class="screen" novalidate><div class="panel"><h2>Players <small class="muted">4–10</small></h2><div class="stepper"><button type="button" id="minus" aria-label="Remove player">−</button><output id="count">${count}</output><button type="button" id="plus" aria-label="Add player">+</button></div><div id="names" class="names"></div></div>
    <div class="panel"><h2>Question deck</h2><div class="choice-row"><label><input type="radio" name="source" value="default" ${source === "default" ? "checked" : ""}> Included cards</label><label><input type="radio" name="source" value="custom" ${source === "custom" ? "checked" : ""}> Custom JSON</label></div><div id="custom-box" ${source === "custom" ? "" : "hidden"}><p class="muted">Copy this prompt into ChatGPT to make a deck:</p><textarea id="generator-prompt" class="prompt" readonly aria-label="Prompt to generate cards">${safe(PROMPT)}</textarea><button type="button" id="copy-prompt" class="button secondary">Copy prompt</button><p class="muted">Paste the generated JSON below. It stays on this device.</p><textarea id="custom-json" spellcheck="false" autocapitalize="off" placeholder='[{"question":"What is a group of flamingos called?","answer":"A flamboyance"}]'>${safe(json)}</textarea></div></div>
    ${error ? `<p class="error" role="alert">${safe(error)}</p>` : ""}<button class="button" type="submit">Start game →</button></form>`);
  const fields = $("names");
  names.length = count;
  for (let i = 0; i < count; i++) fields.insertAdjacentHTML("beforeend", `<label><span>${i + 1}</span><input maxlength="24" aria-label="Player ${i + 1} name" placeholder="Player ${i + 1}" value="${safe(names[i] || "")}"></label>`);
  $("minus").disabled = count <= 4; $("plus").disabled = count >= 10;
  const snapshot = () => ({ count: Number($("count").value), names: [...fields.querySelectorAll("input")].map((input) => input.value), source: document.querySelector('input[name="source"]:checked').value, json: $("custom-json")?.value || "" });
  $("minus").onclick = () => { const data = snapshot(); data.count--; renderSetup("", data); };
  $("plus").onclick = () => { const data = snapshot(); data.count++; renderSetup("", data); };
  document.querySelectorAll('input[name="source"]').forEach((input) => input.onchange = () => { $("custom-box").hidden = input.value !== "custom"; });
  $("copy-prompt").onclick = async () => { try { await navigator.clipboard.writeText(PROMPT); $("copy-prompt").textContent = "Copied!"; } catch (_) { $("generator-prompt").select(); } };
  $("setup-form").onsubmit = (event) => {
    event.preventDefault();
    const data = snapshot();
    const playerNames = data.names.map((name, i) => name.trim() || `Player ${i + 1}`);
    if (new Set(playerNames.map((name) => name.toLowerCase())).size !== playerNames.length) return renderSetup("Player names must be different.", data);
    let cards;
    try { cards = data.source === "custom" ? validateCards(JSON.parse(data.json)) : validateCards(defaultCards); }
    catch (error) { return renderSetup(data.source === "custom" && error instanceof SyntaxError ? "That JSON could not be read. Check its formatting." : error.message, data); }
    if (!cards.some((card) => !history().has(cardId(card)))) return renderSetup("All cards in this deck have been played. Wipe question history in Settings or load a new deck.", data);
    state.players = playerNames.map((name) => ({ name, score: 0 }));
    state.cards = cards; state.source = data.source; state.guesser = Math.floor(Math.random() * playerNames.length); state.round = null; state.roundsPlayed = 0;
    beginRound();
  };
}
function beginRound() {
  const available = state.cards.filter((card) => !history().has(cardId(card)));
  if (!available.length) { state.phase = "exhausted"; save(); return render(); }
  const card = available[Math.floor(Math.random() * available.length)];
  markPlayed(card);
  const fish = state.players.map((_, i) => i).filter((i) => i !== state.guesser);
  state.round = { card, blue: fish[Math.floor(Math.random() * fish.length)], flipped: [], outcome: null, awards: null };
  state.phase = "ready"; save(); render();
}
function render() {
  const round = state.round;
  const guesser = state.players[state.guesser];
  if (state.phase === "setup") return renderSetup();
  if (state.phase === "ready") {
    setScreen(`<p class="eyebrow">Round ${state.roundsPlayed + 1}</p><h1>${safe(guesser.name)},<br><em>look away!</em></h1><p class="instruction">The guesser hands the phone to the fish. Only the fish should tap the next button.</p><div class="panel"><h2>How to play</h2><p>One blue fish knows the truth. Red fish invent answers. The guesser catches reds and may bank points at any time.</p><p class="muted">Suggested length: ${state.players.length <= 5 ? "each player guesses twice" : "each player guesses once"}. You choose when to end.</p></div><button id="show-fish" class="button">Fish: reveal roles & answer →</button><div class="scores">${scoreRows()}</div>`);
    $("show-fish").onclick = () => { state.phase = "fish"; save(); render(); };
  } else if (state.phase === "fish") {
    const roles = state.players.map((player, i) => i === state.guesser ? "" : `<div class="role ${i === round.blue ? "blue" : "red"}"><span>${safe(player.name)}</span><strong>${i === round.blue ? "BLUE · tell truth" : "RED · invent a lie"}</strong></div>`).join("");
    setScreen(`<p class="eyebrow">Fish only · keep this secret</p><h1>Know your<br><em>fish.</em></h1><div class="role-list">${roles}</div><div class="card answer"><span class="badge">THE CARD</span><h2>${safe(round.card.question)}</h2><p><strong>True answer:</strong> ${safe(round.card.answer)}</p></div><p class="instruction warning">Fish: take a photo of this screen so you can check the answer later. Then pass the phone to ${safe(guesser.name)}.</p><button id="hide-answer" class="button">Hide answer & pass phone →</button>`);
    $("hide-answer").onclick = () => { state.phase = "handoff"; save(); render(); };
  } else if (state.phase === "handoff") {
    setScreen(`<p class="eyebrow">Answer hidden</p><h1>Pass to<br><em>${safe(guesser.name)}.</em></h1><p class="instruction">Fish: make sure the answer is off screen. Guesser: tap below, read the question aloud quickly, then ask each fish for an answer.</p><button id="show-question" class="button">I'm the guesser · show question →</button>`);
    $("show-question").onclick = () => { state.phase = "question"; save(); render(); };
  } else if (state.phase === "question") {
    setScreen(`<p class="eyebrow">${safe(guesser.name)} is guessing</p><div class="card question"><span class="badge">READ ALOUD</span><h2>${safe(round.card.question)}</h2></div><p class="instruction">Ask each fish for their answer. The blue fish must say the true answer while trying to sound suspicious.</p><button id="start-elimination" class="button">Hear answers · start flipping →</button>`);
    $("start-elimination").onclick = () => { state.phase = "eliminate"; save(); render(); };
  } else if (state.phase === "eliminate") {
    const fish = state.players.map((player, i) => i === state.guesser ? "" : `<button type="button" class="fish" data-fish="${i}" ${round.flipped.includes(i) ? "disabled" : ""}><span>${safe(player.name)}</span><span>${round.flipped.includes(i) ? "Caught red ✓" : "Flip fish →"}</span></button>`).join("");
    setScreen(`<p class="eyebrow">${safe(guesser.name)} · ${round.flipped.length} red caught</p><h1>Who sounds<br><em>fishy?</em></h1><div class="card question"><span class="badge">QUESTION</span><h2>${safe(round.card.question)}</h2></div><p class="instruction">Tap a name to flip one fish. You can stop and bank ${round.flipped.length} point${round.flipped.length === 1 ? "" : "s"} now.</p><div class="fish-list">${fish}</div><button id="bank" class="button secondary">Stop & bank ${round.flipped.length} point${round.flipped.length === 1 ? "" : "s"}</button>`);
    document.querySelectorAll("[data-fish]").forEach((button) => button.onclick = () => flip(Number(button.dataset.fish)));
    $("bank").onclick = () => finishRound("bank");
  } else if (state.phase === "round-end") {
    const outcome = round.outcome === "blue" ? "Blue fish flipped!" : round.outcome === "all-red" ? "All reds caught!" : "Points banked!";
    const rows = state.players.map((player, i) => `<div class="breakdown-row"><span>${safe(player.name)} ${i === state.guesser ? "(Guesser)" : i === round.blue ? "(Blue)" : "(Red)"}</span><strong>+${round.awards[i]}</strong></div>`).join("");
    setScreen(`<p class="eyebrow">Round ${state.roundsPlayed} complete</p><h1>${safe(outcome)}</h1><div class="result"><p>${safe(guesser.name)} earned</p><strong>+${round.awards[state.guesser]}</strong></div><div class="card"><p><strong>True answer:</strong> ${safe(round.card.answer)}</p><p><strong>Blue fish:</strong> ${safe(state.players[round.blue].name)}</p></div><div class="breakdown">${rows}</div><button id="next-round" class="button">Next round →</button>`);
    $("next-round").onclick = () => { state.guesser = (state.guesser + 1) % state.players.length; beginRound(); };
  } else if (state.phase === "exhausted") {
    setScreen(`<p class="eyebrow">No unseen cards left</p><h1>Deck<br><em>finished.</em></h1><p class="lede">Scores stay in play. Paste a new custom deck, or wipe question history in Settings and continue.</p><div class="scores">${scoreRows()}</div><div class="panel"><h2>Add more cards</h2><p class="muted">Paste the same question and answer JSON format used at setup.</p><textarea id="more-cards" spellcheck="false" autocapitalize="off" placeholder='[{"question":"...","answer":"..."}]'></textarea><p id="more-error" class="error" role="alert" hidden></p><button id="load-more" class="button">Load cards & continue</button></div><button id="retry-deck" class="button secondary">Continue with current deck</button>`);
    $("load-more").onclick = () => { try { const cards = validateCards(JSON.parse($("more-cards").value)); if (!cards.some((card) => !history().has(cardId(card)))) throw Error("Every card in this deck has already been played."); state.cards = cards; state.source = "custom"; beginRound(); } catch (error) { $("more-error").textContent = error instanceof SyntaxError ? "That JSON could not be read." : error.message; $("more-error").hidden = false; } };
    $("retry-deck").onclick = () => beginRound();
  } else if (state.phase === "ended") {
    const high = Math.max(...state.players.map((player) => player.score));
    const winners = state.players.filter((player) => player.score === high).map((player) => player.name);
    const title = winners.length === 1 ? `${winners[0]} wins!` : `${winners.join(" & ")} tie!`;
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    setScreen(`<p class="eyebrow">Final scores · ${state.roundsPlayed} completed rounds</p><h1>${safe(title)}</h1><div class="scores">${sorted.map((player) => `<div class="score-row"><span>${safe(player.name)}</span><strong>${player.score}</strong></div>`).join("")}</div><button id="play-again" class="button">Play again with same players</button><button id="new-game" class="button secondary">New game</button>`);
    $("play-again").onclick = () => { state.players.forEach((player) => player.score = 0); state.guesser = Math.floor(Math.random() * state.players.length); state.roundsPlayed = 0; beginRound(); };
    $("new-game").onclick = () => { const previous = { count: state.players.length, names: state.players.map((p) => p.name), source: state.source, json: state.source === "custom" ? JSON.stringify(state.cards, null, 2) : "" }; state.phase = "setup"; state.round = null; save(); renderSetup("", previous); };
  }
}
function flip(index) {
  if (state.phase !== "eliminate" || index === state.guesser || state.round.flipped.includes(index)) return;
  if (index === state.round.blue) return finishRound("blue");
  state.round.flipped.push(index);
  if (state.round.flipped.length === state.players.length - 2) return finishRound("all-red");
  save(); render();
}
function finishRound(outcome) {
  if (state.phase !== "eliminate") return;
  const round = state.round;
  const redsCaught = round.flipped.length;
  const awards = state.players.map(() => 0);
  awards[state.guesser] = outcome === "blue" ? 0 : redsCaught + (outcome === "all-red" ? 1 : 0);
  state.players.forEach((_, i) => {
    if (i !== state.guesser && i !== round.blue && !round.flipped.includes(i)) awards[i] = redsCaught;
  });
  if (outcome === "blue") awards[round.blue] = state.players.length - 2 - redsCaught;
  awards.forEach((points, i) => state.players[i].score += points);
  round.outcome = outcome; round.awards = awards; state.roundsPlayed++; state.phase = "round-end"; save(); render();
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    const phases = ["ready", "fish", "handoff", "question", "eliminate", "round-end", "exhausted", "ended"];
    if (!saved || !phases.includes(saved.phase) || !Array.isArray(saved.players) || saved.players.length < 4 || saved.players.length > 10 || !Number.isInteger(saved.guesser) || saved.guesser < 0 || saved.guesser >= saved.players.length || !saved.players.every((p) => typeof p.name === "string" && Number.isFinite(p.score))) return false;
    const cards = validateCards(saved.cards);
    if (saved.phase !== "exhausted" && saved.phase !== "ended" && (!saved.round || !cards.some((card) => cardId(card) === cardId(saved.round.card)) || !Number.isInteger(saved.round.blue) || saved.round.blue === saved.guesser || !Array.isArray(saved.round.flipped))) return false;
    Object.assign(state, saved, { cards }); return true;
  } catch (_) { return false; }
}
$("settings-button").onclick = () => { $("history-count").textContent = `${history().size} played answer${history().size === 1 ? "" : "s"} saved.`; $("settings-message").textContent = ""; $("settings-dialog").showModal(); };
$("close-settings").onclick = () => $("settings-dialog").close();
$("clear-history").onclick = () => { clearHistory(); $("history-count").textContent = "0 played answers saved."; $("settings-message").textContent = "Question history wiped. Current round stays in play."; };
function cancelHold() { clearTimeout(holdTimer); holdTimer = null; $("end-game").classList.remove("holding"); }
$("end-game").addEventListener("pointerdown", (event) => { event.preventDefault(); if (holdTimer) return; $("end-game").setPointerCapture(event.pointerId); $("end-game").classList.add("holding"); holdTimer = setTimeout(() => { holdTimer = null; state.phase = "ended"; state.round = null; save(); render(); }, 3000); });
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) $("end-game").addEventListener(type, cancelHold);
$("end-game").addEventListener("keydown", (event) => { if (event.key !== " " && event.key !== "Enter") return; event.preventDefault(); if (holdTimer) return; $("end-game").classList.add("holding"); holdTimer = setTimeout(() => { holdTimer = null; state.phase = "ended"; state.round = null; save(); render(); }, 3000); });
$("end-game").addEventListener("keyup", cancelHold);

fetch("cards.json").then((response) => { if (!response.ok) throw Error("Could not load included cards."); return response.json(); }).then((data) => { defaultCards = validateCards(data); if (!restore()) renderSetup(); else render(); }).catch((error) => { if (!restore()) renderSetup(error.message); else render(); });
