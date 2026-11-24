# AGENTS.md — Coding Agent Operating Manual

> Give this file to your coding agent and check that it is using these instructions. Keep the stack, commands, and ground rules current.

## 1. Project Overview
- **What this repo builds:** SearchDesk turns a broker teaser into a lender-ready acquisition model in minutes, so first-time searchers can quickly tell whether a deal is affordable, financeable, and worth pursuing. Claude reads the teaser (text or PDF) and extracts the deal facts only; the approved Excel model (`model/searchdesk-model-template.xlsx`) does all the financial math.
- **Primary user & core workflow:** First-time ETA searchers screening broker teasers, starting with the builder. Set My assumptions once (financing, costs, target DSCR and return) → paste a teaser or upload a PDF → review the AI-extracted facts → run the model → see scenarios, max price, and returns → download the Excel model. Full details in the living PRD (`docs/index.html`).
- **Non-goals (keep scope tight):** Not a CRM or deal tracker (the simple pipeline and buy box check stay but aren't expanded). No AI reading of full CIMs yet. Not a valuation or a substitute for diligence: rough screening estimates, not investment or lending advice. Put new work into the core workflow.
- **Tech stack:** Plain HTML/CSS/JavaScript front end (no framework) · Node.js 21.7+ server using built-in modules plus the official `@anthropic-ai/sdk`, `hyperformula` (spreadsheet formula engine, GPL-3.0 license), and `fflate` (zip) · Claude Haiku 5.5 with structured output · browser localStorage for data · PostHog for analytics · GitHub Pages for the Product Page.

### Project structure
| Path | What it is |
| --- | --- |
| `app/index.html` | The SearchDesk app: one self-contained page with a top nav and three views picked by the address: `#/analyze` (home: 1. Add teaser, 2. Review facts + buy box check, 3. Run model, 4. Save to pipeline), `#/pipeline`, and `#/settings` (My assumptions + buy box; opens first on a first visit). Navy (#14213D) + gold (#C9A227) brand; green/red only for pass/fail. Saves deals, buy box, and My assumptions in the browser's localStorage. Contains no financial math (pass/fail colors only compare template outputs with your targets). |
| `server.js` | Local server: serves `app/index.html` at http://localhost:3000 and handles `POST /api/extract` (sends the teaser to Claude, returns structured fields plus tokens and cost), `GET /api/model/defaults`, and `POST /api/model` (see `model.js`). The only file that reads the API key. |
| `model.js` | The financial model connection. Reads the approved template, writes the deal + My assumptions into its input cells only, calculates it with HyperFormula, and builds the filled `.xlsx` in memory. No hand-written financial math. |
| `tests/` | Automated tests (`npm test`): the template's sample deal must match its own results, every formula must match Excel's saved results, the filled file must keep every formula and format. |
| `docs/` | Public Product Page and living PRD (`docs/index.html`), published with GitHub Pages; screenshots in `docs/images/`. |
| `test-data/` | Fictional sample teasers (text and PDF) and the fields each should produce (`test-data/README.md`). |
| `model/` | The approved financial model template (`model/searchdesk-model-template.xlsx`, v1.0). Read-only: ask before changing it (see "Ask me first"). |
| `package.json` | `npm start` and `npm test` scripts and the three dependencies. |
| `.env.example` | Template for `.env`: placeholder names only, safe to commit. `.env` itself is git-ignored. |

## 2. Local Setup & Commands
1. **Install dependencies:** `npm install` (Node 21.7+; three dependencies: `@anthropic-ai/sdk`, `hyperformula`, `fflate`).
2. **Create `.env`:** copy `.env.example` to `.env` (Git Bash / Mac: `cp .env.example .env`; Windows Command Prompt: `copy .env.example .env`), then replace `paste-your-key-here` with your Anthropic API key (`ANTHROPIC_API_KEY=sk-ant-...`, no quotes or spaces). `.env` is git-ignored. Only `server.js` reads it; the key is never logged or sent to the browser.
3. **Start the server:** `npm start`. It prints whether AI teaser reading is on (key found) or off. Restart it after changing `.env`.
4. **Open the app:** http://localhost:3000. AI teaser reading, My assumptions, and the financial model only work this way; opening `app/index.html` directly still works for the buy box and pipeline. Deals are saved in the browser's localStorage.
- **Run deterministic tests:** `npm test` (no API key needed, costs nothing). Checks the financial model against the template's sample deal (total uses ≈ $2,989,242; Flat/Base/Upside/Cost improvement lowest DSCR 1.06/1.17/1.28/1.16x; IRR 43.2/66.4/104.6/62.0%), all 877 formulas, the filled file, input validation, and the /api/model rate limit. Also check manually: add, edit, and delete a deal, then reopen the page to confirm it was saved.

### Financial model rules
- `model/searchdesk-model-template.xlsx` (v1.0, approved by the builder) is the **only source of financial math**. Never re-implement its calculations in JavaScript; if the formula engine can't evaluate a formula, report it.
- The AI only extracts teaser facts; the user sets My assumptions.
- SearchDesk writes only these cells on the Assumptions sheet: deal inputs B5 business name, B6 earnings type, B7 revenue, B8 earnings, B9 asking price, B10 offer price, B18 subtract salary from EBITDA; assumptions B17, B22–B24, B27–B34, B38–B40, B64 (Investor 1), B76. All formulas, formats, dropdowns, and conditional formatting are preserved, and the file is set to fully recalculate in Excel.
- **Run model evals:** None yet. Manual check: read the teasers in `test-data/` and compare with the expected fields in `test-data/README.md` (each run costs well under 1¢).

## 2a. Analytics (PostHog, US cloud)
- Installed in `docs/index.html` and `app/index.html`: pageviews, click autocapture, and session replay. The `phc_` project key is PostHog's public write-only key, so it lives in the HTML (not `.env`).
- Custom app events (sent through `track()` in `app/index.html`): `teaser_read` (success, source, error_code, fields_filled, duration_ms, tokens, cost_usd), `deal_saved` (is_edit, channel, earnings_type, stage, ai_filled), `stage_changed` (from_stage, to_stage, via), `model_run` (success, error_code, duration_ms), `model_downloaded` (success).
- Privacy rules: never send business names, contacts, teaser text, notes, or dollar amounts as event properties. Session replay masks all inputs and any element with class `ph-mask` (instant screen and financial model panel, pipeline, buy box and My assumptions summaries). Autocapture does not send element text in the app. Keep `ph-mask` on new elements that show deal details.

## 2b. Shipping (Render free web service)
1. **Push to GitHub:** Render deploys from the `main` branch of `building-with-ai-f26/jns485-SearchDesk`. Check that `.env` is not committed.
2. **Create the service:** in the Render dashboard, New → Web Service → connect the GitHub repo (grant Render access to the `building-with-ai-f26` organization if asked).
3. **Settings:** Language **Node** · Branch **main** · Root Directory blank · Build Command **`npm ci`** · Start Command **`npm start`** · Instance Type **Free**.
4. **Environment variables:** add `ANTHROPIC_API_KEY` with your key (Render → your service → Environment). Do not set `PORT`; Render sets it. Optional: `ALLOWED_HOSTS` (comma-separated) if you add a custom domain.
5. **Deploy and check the logs:** they should say "SearchDesk is running on Render" and "AI teaser reading is on". The key itself is never printed.
6. **Smoke test:** open `https://<your-service>.onrender.com`, read a teaser from `test-data/`, save a deal, and reload to confirm it stays.

How the server behaves on Render (it detects the `RENDER` variable that Render sets):
- Listens on `0.0.0.0` and Render's `PORT`. Locally it still listens only on `127.0.0.1:3000`.
- `POST /api/extract` and `POST /api/model` accept calls only from localhost and your onrender.com address (`RENDER_EXTERNAL_HOSTNAME`, set by Render) plus any `ALLOWED_HOSTS`.
- Rate limits (per visitor IP, per 15 minutes, counted separately): 10 teaser reads and 60 financial model runs/downloads. Past the limit, the server returns HTTP 429 with a message the app shows. The visitor IP comes from Cloudflare's `True-Client-IP` / `CF-Connecting-IP` headers, falling back to `X-Forwarded-For`. The counts are kept in memory, so they reset when the service restarts or sleeps.
- Upload cap: PDFs of 5 MB or less (request bodies of 7 MB or less); `/api/model` bodies 32 KB or less. Anything larger gets a clear "too large" message. Filled Excel files are built in memory and never saved on the server.
- Public error messages: key, access, and billing problems show visitors a general "unavailable right now" message; the detailed fix-it message only appears when running locally.
- Security review and what is left to do: see `SECURITY.md`.
- Known limits of the free tier: the service sleeps after about 15 minutes idle, and the first visit after that takes about a minute. Deals are still saved only in each visitor's own browser (localStorage). Consider setting a monthly spend limit in the Anthropic Console.
- Auto-deploy: every push to `main` redeploys. Follow the rules in section 3 before pushing.

## 3. Non-Negotiable Engineering Rules
1. **Plan before coding:** Before touching multiple files, propose a brief plan and wait for approval.
2. **Small batches:** Make small, focused changes that can be reviewed and explained by a human in a single Pull Request.
3. **Explainability:** Avoid unnecessary abstractions or dependencies. Help the human builder understand the main components, what changed, why it matters, what could break, and how it was checked.
4. **Verify changes:** Run relevant checks. For a reproducible logic bug, use a failing test to demonstrate the fix when practical. Record manual checks and known limitations; follow the selected Build 4 evaluation track.
5. **Zero secrets in code:** Never hardcode API keys, tokens, or credentials. Always read from environment variables (`.env`) and update `.env.example` when new variables are needed.
6. **Stop when looping:** If a fix fails twice in a row, stop, summarize what failed, and ask the human before trying a third approach.

### Ask me first
Get explicit approval from the human builder before:
- Deleting data (deals, files, branches, artifacts, or anything else that can't be easily recovered).
- Anything involving keys, secrets, or permissions (creating, changing, moving, or granting access).
- Anything that costs money: live API calls beyond the tests we agreed on, or Render plan changes.
- Changing the approved financial model template (model/searchdesk-model-template.xlsx) or any formula that calculates financials.
- Deploying (pushing to `main` deploys to Render automatically, so a push counts as a deploy).

### Rules from real mistakes
- **Do not claim a live AI test passed when only mocked tests have run.** (Happened in Build 2.) Say which tests used a mock and which made a real call to Claude.
- **The server reads `.env` only at startup; restart it after changing keys.** (Happened in Build 2.) On Render, changing an environment variable redeploys the service.
