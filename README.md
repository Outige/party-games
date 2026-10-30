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
- **30 Seconds** — Race along a blue and yellow board. Each turn uses one card with five clues per face; flip between faces during the 30-second round, then score 0–10 correct answers. Open it at `30-seconds/index.html`.

Each game lives in its own directory. Ice Breakers reads 1–4 categories and their questions from `ice-breakers/questions.js`, so category names and deck sizes can be changed without touching the game logic. 30 Seconds reads its default deck from `30-seconds/cards.json` and also accepts custom cards pasted during setup.

Players can also choose **Custom game** and paste JSON in this shape:

```json
{
  "Warm up": ["What made you smile today?"],
  "Go deep": ["What matters most to you?"]
}
```
