import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getDatabase, ref, get, onValue, set } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";

const status = document.querySelector("#status");
const start = document.querySelector("#start");
const game = document.querySelector("#game");
const choice = document.querySelector("#choice");
const buttons = [...document.querySelectorAll("[data-move]")];
const roomId = new URLSearchParams(location.search).get("game");

if (!window.firebaseConfig?.databaseURL) {
  status.textContent = "Add your Realtime Database URL to firebase-config.js. See README.md.";
} else {
  try {
    const app = initializeApp(window.firebaseConfig);
    const db = getDatabase(app);
    const { user } = await signInAnonymously(getAuth(app));

    if (roomId) {
      await openGame(roomId, user.uid, db);
    } else {
      status.textContent = "Create a game, then send the link to a friend.";
      start.hidden = false;
      document.querySelector("#create").onclick = async () => {
        const id = crypto.randomUUID();
        try {
          await set(ref(db, `rooms/${id}/player1`), user.uid);
          location.search = `?game=${id}`;
        } catch (error) {
          status.textContent = `Could not create game: ${error.message}`;
        }
      };
    }
  } catch (error) {
    status.textContent = `Could not connect to Firebase: ${error.message}`;
  }
}

async function openGame(id, uid, db) {
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    status.textContent = "Invalid game link.";
    return;
  }

  const room = ref(db, `rooms/${id}`);
  const first = (await get(room)).val();
  if (!first?.player1) {
    status.textContent = "Game not found.";
    return;
  }

  if (first.player1 !== uid && first.player2 !== uid) {
    if (first.player2) {
      status.textContent = "This game already has two players.";
      return;
    }
    try {
      await set(ref(db, `rooms/${id}/player2`), uid);
    } catch {
      status.textContent = "Someone else joined first. This game is full.";
      return;
    }
  }

  start.hidden = true;
  game.style.display = "block";
  document.querySelector("#link").value = location.href;
  document.querySelector("#copy").onclick = async () => {
    await navigator.clipboard.writeText(location.href);
    document.querySelector("#copy").textContent = "Copied!";
  };

  buttons.forEach(button => {
    button.onclick = async () => {
      buttons.forEach(item => item.disabled = true);
      try {
        await set(ref(db, `rooms/${id}/moves/${uid}`), button.dataset.move);
      } catch (error) {
        status.textContent = `Could not submit move: ${error.message}`;
        buttons.forEach(item => item.disabled = false);
      }
    };
  });

  onValue(room, snapshot => {
    const data = snapshot.val();
    const mine = data?.moves?.[uid];
    const opponentId = data?.player1 === uid ? data.player2 : data?.player1;
    const theirs = data?.moves?.[opponentId];
    buttons.forEach(button => button.disabled = Boolean(mine));
    choice.textContent = mine ? `You picked ${mine}.` : "Pick your move.";

    if (mine && theirs) {
      const beats = { rock: "scissors", paper: "rock", scissors: "paper" };
      status.textContent = mine === theirs ? `Tie! You both picked ${mine}.`
        : beats[mine] === theirs ? `You win! ${mine} beats ${theirs}.`
        : `You lose! ${theirs} beats ${mine}.`;
    } else if (mine) {
      status.textContent = "Waiting for your opponent's move…";
    } else {
      status.textContent = data?.player2 ? "Both players are here. Pick a move!" : "Waiting for a friend to join…";
    }
  }, error => { status.textContent = `Connection lost: ${error.message}`; });
}
