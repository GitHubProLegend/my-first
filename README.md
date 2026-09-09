# Key2Chat

A single-page chat site where **the API key you paste picks the AI**. No backend, no build step —
open `index.html` and go.

## How it works

You paste a key; the key's shape decides the provider:

| Key prefix | Provider | Models offered |
|---|---|---|
| `sk-ant-…` | Anthropic (Claude) | Fable 5.1, Opus 5, Sonnet 5, Haiku 4.5 |
| `AIza…` | Google (Gemini) | Gemini 2.5 Flash / Pro, 2.0 Flash |
| `sk-…` | OpenAI (GPT) | GPT-4o, GPT-4o mini, GPT-4.1, o4-mini |

Any model id not in the list can be typed by hand via **Other (type a model id)…** — useful for
models newer than this page.

Replies stream token-by-token; the whole conversation is sent on each turn, so follow-ups keep context.

## Running it

Open `index.html` directly, or serve it:

```
python3 -m http.server 8000
```

then visit http://localhost:8000.

## Files

- `index.html` — layout
- `providers.js` — key detection, model lists, per-provider request + stream parsing
- `app.js` — UI wiring, conversation state, streaming fetch loop
- `styles.css` — styling

## Adding a provider

Add an entry to `PROVIDERS` in `providers.js` with `matches`, `models`, `request()`, and `parse()`,
then list its name in `DETECT_ORDER` (most specific prefix first).

## A note on keys

The key lives only in your browser and is sent straight to the provider's API — there is no server
in between. "Remember key in this browser" stores it in `localStorage`; leave it off on a shared
machine. Because calls go browser → provider, the provider must allow browser (CORS) requests:
OpenAI and Google do, and Anthropic requires the opt-in header this page already sends.
