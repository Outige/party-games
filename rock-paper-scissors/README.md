# Rock Paper Scissors

Two people open the same game link, pick a move, and see the result once both have picked. Firebase Realtime Database carries the moves between browsers. Each link is for one round; use **New game** to play again.

## Finish Firebase setup

The web app values from `foo.html` and the Realtime Database URL are already in `firebase-config.js`. **No GitHub environment variables or secrets are needed.**

1. In the [Firebase console](https://console.firebase.google.com/), open your **party-games** project. Under **Build → Authentication → Sign-in method**, enable **Anonymous**.
2. Under **Build → Realtime Database → Rules**, paste and publish these rules:

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": "auth != null",
        "player1": {
          ".write": "auth != null && !data.parent().exists() && newData.val() === auth.uid"
        },
        "player2": {
          ".write": "auth != null && !data.exists() && data.parent().child('player1').exists() && data.parent().child('player1').val() !== auth.uid && newData.val() === auth.uid"
        },
        "moves": {
          "$uid": {
            ".write": "auth != null && auth.uid === $uid && !data.exists() && (data.parent().parent().child('player1').val() === auth.uid || data.parent().parent().child('player2').val() === auth.uid) && (newData.val() === 'rock' || newData.val() === 'paper' || newData.val() === 'scissors')"
          }
        }
      }
    }
  }
}
```

The Firebase web API key is [safe to include in browser code](https://firebase.google.com/docs/projects/api-keys); these database rules control who can write. Anyone with a game link and an anonymous Firebase login can read that game's moves, so don't use it for private information.

## Publish on GitHub Pages

Open your GitHub repository's **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. Push to the default branch, or run **Actions → Publish Pages → Run workflow**. The [Pages workflow](../.github/workflows/pages.yml) publishes this site with the config file already included. The game URL is usually `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/rock-paper-scissors/`.

## Run locally

From the repository root, run `python3 -m http.server 8000`, then open `http://localhost:8000/rock-paper-scissors/`. Use a different browser or private window for the second player; two tabs in the same browser share an anonymous Firebase identity.
