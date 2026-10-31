"use strict";

const $ = (id) => document.getElementById(id);
const COOKIE_NAME = "blnk_highscores";
const FLASHES_PER_MATCH = 10;
const screens = ["setup-screen", "solo-screen", "solo-result-screen", "duel-screen", "duel-result-screen"];

const game = {
  phase: "setup",
  timer: null,
  settleTimer: null,
  frame: null,
  flashAt: 0,
  pendingMs: null,
  scores: [],
  duelScores: [0, 0],
  flashesShown: 0
};

function showScreen(id) {
  screens.forEach((screen) => { $(screen).hidden = screen !== id; });
}

function clearTimers() {
  window.clearTimeout(game.timer);
  window.clearTimeout(game.settleTimer);
  window.cancelAnimationFrame(game.frame);
  game.timer = null;
  game.settleTimer = null;
  game.frame = null;
}

function randomDelay() {
  return 1500 + Math.floor(Math.random() * 3000);
}

function readScores() {
  try {
    const entry = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!entry) return [];
    const parsed = JSON.parse(decodeURIComponent(entry.slice(COOKIE_NAME.length + 1)));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((score) => score && typeof score.name === "string" && score.name.length > 0 && score.name.length <= 10 && Number.isFinite(score.ms) && score.ms >= 0)
      .sort((a, b) => a.ms - b.ms)
      .slice(0, 10);
  } catch (error) {
    return [];
  }
}

function writeScores(scores) {
  try {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(scores))}; Max-Age=31536000; Path=/; SameSite=Lax`;
    return JSON.stringify(readScores()) === JSON.stringify(scores);
  } catch (error) {
    return false;
  }
}

function renderBest() {
  const best = game.scores[0];
  $("setup-best").textContent = best ? `${best.name} · ${best.ms} ms` : "No time yet";
}

function renderLeaderboard() {
  const list = $("leaderboard");
  list.replaceChildren();
  if (game.scores.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-row";
    empty.textContent = "No scores yet. Be the first.";
    list.append(empty);
    return;
  }
  game.scores.forEach((score, index) => {
    const row = document.createElement("li");
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `#${index + 1}`;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = score.name;
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = `${score.ms} ms`;
    row.append(rank, name, time);
    list.append(row);
  });
}

function showSetup() {
  clearTimers();
  game.phase = "setup";
  const storedScores = readScores();
  if (storedScores.length) game.scores = storedScores;
  renderBest();
  showScreen("setup-screen");
}

function showSolo() {
  clearTimers();
  game.phase = "solo-idle";
  const target = $("solo-target");
  target.className = "solo-target";
  $("solo-icon").textContent = "◎";
  $("solo-message").textContent = "Tap Start, then wait for the flash.";
  $("solo-submessage").textContent = "Tap anywhere in this panel when it lights up.";
  $("solo-start").hidden = false;
  $("solo-start").firstChild.textContent = "START ROUND ";
  $("solo-footnote").textContent = "Too early? That attempt won't count.";
  showScreen("solo-screen");
}

function startSolo() {
  if (game.phase !== "solo-idle" && game.phase !== "solo-false") return;
  clearTimers();
  game.phase = "solo-wait";
  $("solo-target").className = "solo-target waiting";
  $("solo-icon").textContent = "◌";
  $("solo-message").textContent = "WAIT...";
  $("solo-submessage").textContent = "Don't tap until the whole panel flashes.";
  $("solo-start").hidden = true;
  game.timer = window.setTimeout(() => {
    game.frame = window.requestAnimationFrame(() => {
      if (game.phase !== "solo-wait") return;
      game.phase = "solo-flash";
      $("solo-target").className = "solo-target flashing";
      $("solo-icon").textContent = "!";
      $("solo-message").textContent = "TAP!";
      $("solo-submessage").textContent = "Now!";
      game.flashAt = performance.now();
    });
  }, randomDelay());
}

function touchSolo() {
  if (game.phase === "solo-wait") {
    clearTimers();
    game.phase = "solo-false";
    $("solo-target").className = "solo-target too-soon";
    $("solo-icon").textContent = "×";
    $("solo-message").textContent = "TOO SOON";
    $("solo-submessage").textContent = "Wait for the flash next time.";
    $("solo-start").firstChild.textContent = "TRY AGAIN ";
    $("solo-start").hidden = false;
  } else if (game.phase === "solo-flash") {
    game.pendingMs = Math.max(0, Math.round(performance.now() - game.flashAt));
    game.phase = "solo-result";
    showSoloResult();
  }
}

function showSoloResult() {
  const storedScores = readScores();
  if (storedScores.length) game.scores = storedScores;
  $("solo-time").textContent = String(game.pendingMs);
  const qualifies = game.scores.length < 10 || game.pendingMs < game.scores[game.scores.length - 1].ms;
  $("name-form").hidden = !qualifies;
  $("player-name").value = "";
  $("name-error").hidden = true;
  $("solo-result-note").textContent = qualifies ? "Fast enough for the board. Claim your spot!" : "That one missed the top 10. Go again!";
  renderLeaderboard();
  showScreen("solo-result-screen");
}

function saveSoloName(event) {
  event.preventDefault();
  if (game.phase !== "solo-result" || $("name-form").hidden) return;
  const name = $("player-name").value.trim().toUpperCase().slice(0, 10);
  if (!name) {
    $("name-error").textContent = "Enter a name, up to 10 characters.";
    $("name-error").hidden = false;
    return;
  }
  game.scores.push({ name, ms: game.pendingMs });
  game.scores.sort((a, b) => a.ms - b.ms);
  game.scores = game.scores.slice(0, 10);
  const saved = writeScores(game.scores);
  $("name-form").hidden = true;
  $("solo-result-note").textContent = saved ? `${name} is on the board!` : "Cookies are blocked; this score will last only until you leave.";
  renderLeaderboard();
  renderBest();
}

function renderDuelScores() {
  $("score-one").textContent = String(game.duelScores[0]);
  $("score-two").textContent = String(game.duelScores[1]);
}

function showDuel() {
  clearTimers();
  game.phase = "duel-idle";
  game.duelScores = [0, 0];
  game.flashesShown = 0;
  renderDuelScores();
  $("duel-round").textContent = `FLASH 1 / ${FLASHES_PER_MATCH}`;
  $("duel-status").textContent = "Tap Start to begin.";
  $("cue-one").textContent = "WAIT FOR IT";
  $("cue-two").textContent = "WAIT FOR IT";
  $("duel-arena").classList.remove("flashing");
  $("player-one").classList.remove("winner");
  $("player-two").classList.remove("winner");
  $("duel-start").hidden = false;
  $("duel-start").firstChild.textContent = "START 10 FLASHES ";
  showScreen("duel-screen");
}

function scheduleDuelFlash() {
  game.phase = "duel-wait";
  $("duel-round").textContent = `FLASH ${game.flashesShown + 1} / ${FLASHES_PER_MATCH}`;
  $("duel-status").textContent = "Wait for the flash...";
  $("cue-one").textContent = "WAIT FOR IT";
  $("cue-two").textContent = "WAIT FOR IT";
  $("player-one").classList.remove("winner");
  $("player-two").classList.remove("winner");
  game.timer = window.setTimeout(() => {
    game.frame = window.requestAnimationFrame(() => {
      if (game.phase !== "duel-wait") return;
      game.flashesShown++;
      game.phase = "duel-flash";
      $("duel-arena").classList.add("flashing");
      $("duel-status").textContent = "GO! FIRST TOUCH WINS!";
      $("cue-one").textContent = "TAP NOW";
      $("cue-two").textContent = "TAP NOW";
      game.flashAt = performance.now();
    });
  }, randomDelay());
}

function startDuel() {
  if (game.phase !== "duel-idle") return;
  $("duel-start").hidden = true;
  scheduleDuelFlash();
}

function touchDuel(playerIndex) {
  if (game.phase === "duel-wait") {
    game.duelScores[playerIndex]--;
    renderDuelScores();
    $("duel-status").textContent = `Player ${playerIndex + 1} jumped early: -1`;
    $(playerIndex === 0 ? "cue-one" : "cue-two").textContent = "TOO SOON -1";
    return;
  }
  if (game.phase !== "duel-flash") return;
  game.phase = "duel-settle";
  game.duelScores[playerIndex]++;
  renderDuelScores();
  $("duel-arena").classList.remove("flashing");
  $(playerIndex === 0 ? "player-one" : "player-two").classList.add("winner");
  $("duel-status").textContent = `Player ${playerIndex + 1} wins the flash!`;
  $(playerIndex === 0 ? "cue-one" : "cue-two").textContent = "+1 POINT";
  $(playerIndex === 0 ? "cue-two" : "cue-one").textContent = "NEXT FLASH SOON";
  game.settleTimer = window.setTimeout(() => {
    if (game.flashesShown >= FLASHES_PER_MATCH) showDuelResult();
    else scheduleDuelFlash();
  }, 950);
}

function showDuelResult() {
  clearTimers();
  game.phase = "duel-result";
  const [one, two] = game.duelScores;
  $("duel-result-title").textContent = one === two ? "It's a tie!" : `Player ${one > two ? 1 : 2} wins!`;
  $("duel-result-note").textContent = one === two ? "Two very fast fingers. Run it back?" : "Ten flashes. One quick winner.";
  $("final-one").textContent = String(one);
  $("final-two").textContent = String(two);
  showScreen("duel-result-screen");
}

function pauseIfHidden() {
  if (!document.hidden) return;
  if (game.phase === "solo-wait" || game.phase === "solo-flash") {
    clearTimers();
    game.phase = "solo-false";
    $("solo-target").className = "solo-target";
    $("solo-icon").textContent = "◎";
    $("solo-message").textContent = "ROUND PAUSED";
    $("solo-submessage").textContent = "Come back and start a fresh attempt.";
    $("solo-start").firstChild.textContent = "TRY AGAIN ";
    $("solo-start").hidden = false;
  } else if (game.phase === "duel-wait" || game.phase === "duel-flash" || game.phase === "duel-settle") {
    const wasFlashing = game.phase === "duel-flash";
    const matchFinished = game.phase === "duel-settle" && game.flashesShown === FLASHES_PER_MATCH;
    clearTimers();
    if (wasFlashing) game.flashesShown--;
    if (matchFinished) { showDuelResult(); return; }
    game.phase = "duel-idle";
    $("duel-arena").classList.remove("flashing");
    $("duel-status").textContent = "Match paused. Resume when both players are ready.";
    $("duel-start").firstChild.textContent = "RESUME MATCH ";
    $("duel-start").hidden = false;
  }
}

$("choose-solo").addEventListener("click", showSolo);
$("choose-duel").addEventListener("click", showDuel);
$("solo-start").addEventListener("click", startSolo);
$("solo-target").addEventListener("pointerdown", (event) => { event.preventDefault(); touchSolo(); });
$("solo-target").addEventListener("keydown", (event) => { if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); touchSolo(); } });
$("name-form").addEventListener("submit", saveSoloName);
$("solo-again").addEventListener("click", showSolo);
$("solo-modes").addEventListener("click", showSetup);
$("duel-start").addEventListener("click", startDuel);
$("player-one").addEventListener("pointerdown", (event) => { event.preventDefault(); touchDuel(0); });
$("player-two").addEventListener("pointerdown", (event) => { event.preventDefault(); touchDuel(1); });
document.addEventListener("keydown", (event) => {
  if (event.repeat || $("duel-screen").hidden) return;
  if (event.key === "1") { event.preventDefault(); touchDuel(0); }
  if (event.key === "2") { event.preventDefault(); touchDuel(1); }
});
$("duel-again").addEventListener("click", showDuel);
$("duel-modes").addEventListener("click", showSetup);
document.addEventListener("visibilitychange", pauseIfHidden);
showSetup();
