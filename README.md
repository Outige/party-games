# Party Games

A collection of small, phone-friendly games built with plain HTML, CSS, and JavaScript.

## Run locally

From this directory, start a local server with Python's standard library:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Games

- **Ice Breakers** — Select a question category and pass the phone around. Asked questions are kept out of the deck for the rest of the browser session.

Each game lives in its own directory. Ice Breakers reads its categories and questions from `ice-breakers/questions.js`, so category names and deck sizes can be changed without touching the game logic.
