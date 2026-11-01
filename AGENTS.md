# AGENTS.md — Coding Agent Operating Manual

> Give this file to your coding agent and check that it is using these instructions. Keep the stack, commands, and ground rules current.

## 1. Project Overview
- **What this repo builds:** [1–2 sentence summary]
- **Primary user & core workflow:** [See the living PRD in `docs/index.html`]
- **Tech stack:** [e.g., Python 3.12 / FastAPI / Next.js / SQLite / OpenRouter API]

## 2. Commands
- **Install dependencies:** None. The prototype is a single HTML file with no libraries or API keys.
- **Run locally:** Open `app/index.html` in a browser (Windows: `start app/index.html`; Mac: `open app/index.html`). Data is saved in that browser's localStorage.
- **Run deterministic tests:** None yet. Check manually: add, edit, and delete a deal, then reopen the page to confirm it was saved.
- **Run model evals:** None yet (no AI model in the prototype).

## 3. Non-Negotiable Engineering Rules
1. **Plan before coding:** Before touching multiple files, propose a brief plan and wait for approval.
2. **Small batches:** Make small, focused changes that can be reviewed and explained by a human in a single Pull Request.
3. **Explainability:** Avoid unnecessary abstractions or dependencies. Help the human builder understand the main components, what changed, why it matters, what could break, and how it was checked.
4. **Verify changes:** Run relevant checks. For a reproducible logic bug, use a failing test to demonstrate the fix when practical. Record manual checks and known limitations; follow the selected Build 4 evaluation track.
5. **Zero secrets in code:** Never hardcode API keys, tokens, or credentials. Always read from environment variables (`.env`) and update `.env.example` when new variables are needed.
6. **Stop when looping:** If a fix fails twice in a row, stop, summarize what failed, and ask the human before trying a third approach.
