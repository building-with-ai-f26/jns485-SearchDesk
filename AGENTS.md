# AGENTS.md — Coding Agent Operating Manual

> Give this file to your coding agent and check that it is using these instructions. Keep the stack, commands, and ground rules current.

## 1. Project Overview
- **What this repo builds:** SearchDesk, the home base for first-time acquisition searchers: every deal, from brokers or direct outreach, captured, screened, and moved forward in one pipeline. Build 2 adds AI teaser reading (paste a teaser or upload a PDF, and Claude pre-fills the deal form for review).
- **Primary user & core workflow:** First-time ETA searchers. Add a deal (teaser or direct outreach) → review its key facts → see buy box fit and a quick financial read → save it to the pipeline with a stage and next step. Full details in the living PRD (`docs/index.html`).
- **Tech stack:** Plain HTML/CSS/JavaScript front end (no framework) · Node.js 21.7+ server using only built-in modules plus the official `@anthropic-ai/sdk` · Claude Haiku 5.5 with structured output · browser localStorage for data · PostHog for analytics · GitHub Pages for the Product Page.

### Project structure
| Path | What it is |
| --- | --- |
| `app/index.html` | The SearchDesk app: one self-contained page (buy box, add deal + teaser reader, instant screen, capital stack, pipeline). Saves deals in the browser's localStorage. |
| `server.js` | Local server: serves `app/index.html` at http://localhost:3000 and handles `POST /api/extract` (sends the teaser to Claude, returns structured fields plus tokens and cost). The only file that reads the API key. |
| `docs/` | Public Product Page and living PRD (`docs/index.html`), published with GitHub Pages; screenshots in `docs/images/`. |
| `test-data/` | Fictional sample teasers (text and PDF) and the fields each should produce (`test-data/README.md`). |
| `model/` | The approved financial model template (`model/searchdesk-model-template.xlsx`, v1.0). Read-only: ask before changing it (see "Ask me first"). |
| `package.json` | `npm start` script and the one dependency. |
| `.env.example` | Template for `.env`: placeholder names only, safe to commit. `.env` itself is git-ignored. |

## 2. Local Setup & Commands
1. **Install dependencies:** `npm install` (Node 21.7+; one dependency, the official `@anthropic-ai/sdk`).
2. **Create `.env`:** copy `.env.example` to `.env` (Git Bash / Mac: `cp .env.example .env`; Windows Command Prompt: `copy .env.example .env`), then replace `paste-your-key-here` with your Anthropic API key (`ANTHROPIC_API_KEY=sk-ant-...`, no quotes or spaces). `.env` is git-ignored. Only `server.js` reads it; the key is never logged or sent to the browser.
3. **Start the server:** `npm start`. It prints whether AI teaser reading is on (key found) or off. Restart it after changing `.env`.
4. **Open the app:** http://localhost:3000. AI teaser reading only works this way; opening `app/index.html` directly still works for everything else. Deals are saved in the browser's localStorage.
- **Run deterministic tests:** None yet. Check manually: add, edit, and delete a deal, then reopen the page to confirm it was saved.
- **Run model evals:** None yet. Manual check: read the teasers in `test-data/` and compare with the expected fields in `test-data/README.md` (each run costs well under 1¢).

## 2a. Analytics (PostHog, US cloud)
- Installed in `docs/index.html` and `app/index.html`: pageviews, click autocapture, and session replay. The `phc_` project key is PostHog's public write-only key, so it lives in the HTML (not `.env`).
- Custom app events (sent through `track()` in `app/index.html`): `teaser_read` (success, source, error_code, fields_filled, duration_ms, tokens, cost_usd), `deal_saved` (is_edit, channel, earnings_type, stage, verdict, ai_filled), `stage_changed` (from_stage, to_stage, via).
- Privacy rules: never send business names, contacts, teaser text, notes, or dollar amounts as event properties. Session replay masks all inputs and any element with class `ph-mask` (instant screen, pipeline, buy box summary). Autocapture does not send element text in the app. Keep `ph-mask` on new elements that show deal details.

## 3. Non-Negotiable Engineering Rules
1. **Plan before coding:** Before touching multiple files, propose a brief plan and wait for approval.
2. **Small batches:** Make small, focused changes that can be reviewed and explained by a human in a single Pull Request.
3. **Explainability:** Avoid unnecessary abstractions or dependencies. Help the human builder understand the main components, what changed, why it matters, what could break, and how it was checked.
4. **Verify changes:** Run relevant checks. For a reproducible logic bug, use a failing test to demonstrate the fix when practical. Record manual checks and known limitations; follow the selected Build 4 evaluation track.
5. **Zero secrets in code:** Never hardcode API keys, tokens, or credentials. Always read from environment variables (`.env`) and update `.env.example` when new variables are needed.
6. **Stop when looping:** If a fix fails twice in a row, stop, summarize what failed, and ask the human before trying a third approach.

### Ask me first
Get explicit approval from the human builder before:
- Changing the approved financial model template (model/searchdesk-model-template.xlsx) or any formula that calculates financials.
