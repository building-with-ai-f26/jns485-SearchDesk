# SearchDesk

> **One-line pitch:** SearchDesk is the home base for first-time acquisition searchers: every deal, from brokers or direct outreach, captured, screened, and moved forward in one pipeline.

- **Builder:** Jordan Steinroeder (`@jns485-stern`)
- **Pod:** To be added
- **Product Page & Living PRD:** https://building-with-ai-f26.github.io/jns485-SearchDesk/
- **App:** https://searchdesk.onrender.com (Render free tier; the first visit after it sleeps takes about a minute). It also runs locally (see below).

## What it does

- Set your buy box once: target industries, states, SDE or EBITDA range, seller situation, and growth.
- Add a deal from a broker or from direct outreach, using SDE or EBITDA.
- Set **My assumptions** once (financing as % of total uses, deal costs, salary, capex, tax, target DSCR and IRR). Defaults come from the approved Excel model.
- See an instant buy box check, then run the **financial model**: your approved Excel template (`model/searchdesk-model-template.xlsx`) is filled with the deal and your assumptions and calculated on the server. You get total uses, buyer equity, and for 4 scenarios the lowest DSCR, max price at your target DSCR, price check, 5-year IRR, and MOIC, plus a **Download Excel model** button for the filled file. The template is the only source of financial numbers; these are screening estimates, not advice.
- Save the deal to a pipeline grouped by stage, with a dated next step. Overdue items are flagged.
- Paste a teaser or upload a PDF, and Claude pre-fills the deal form (fields it filled are marked "AI" for you to check). Each run shows its tokens and estimated cost.

## Status

- **Build 1 (due Nov 9):** Done. PRD v1, local prototype, and screenshots are on the Product Page.
- **Builds 2–5:** Coming in Weeks 2–5. Progress is logged weekly on the Product Page.

## Repository map

| File / folder | Purpose |
| --- | --- |
| [`app/index.html`](./app/index.html) | The SearchDesk prototype: one web page (no libraries). |
| [`server.js`](./server.js) | Small server: serves the app, handles AI teaser reading with Claude (key read from `.env`), and the financial model routes. |
| [`model.js`](./model.js) | Fills and calculates the approved Excel template (no hand-written financial math). |
| [`model/`](./model/) | The approved financial model template, v1.0. Read-only. |
| [`test-data/`](./test-data/) | Fictional sample teasers (text and PDF) for trying AI teaser reading. |
| [`docs/index.html`](./docs/index.html) | Public Product Page, living PRD, and weekly build log (published with GitHub Pages). |
| [`docs/images/`](./docs/images/) | Prototype screenshots used on the Product Page. |
| [`AGENTS.md`](./AGENTS.md) | Run commands and rules for the coding agent. |
| [`SECURITY.md`](./SECURITY.md) | Security review: what was checked, found, fixed, and what is left. |
| [`Intent.md`](./Intent.md), [`Plan.md`](./Plan.md), [`journal/`](./journal/) | Optional drafting notes. |
| [`tests/`](./tests/) | Automated tests for the financial model (`npm test`) and verification guidance. |
| [`SPONSOR_MEMO.md`](./SPONSOR_MEMO.md) | Final sponsor recommendation, due December 14. |

## Local setup

```bash
git clone https://github.com/building-with-ai-f26/jns485-SearchDesk.git
cd jns485-SearchDesk
```

**Run the SearchDesk prototype** (needs [Node.js](https://nodejs.org) 21.7 or newer):

```bash
npm install          # first time only
npm start            # then open http://localhost:3000
npm test             # optional: checks the financial model against the template (free, no API key)
```

Deals are saved in your browser, and 3 fictional sample deals load the first time you open it.

**AI teaser reading:** copy `.env.example` to `.env` and replace `paste-your-key-here` with your Anthropic API key. `.env` is ignored by Git, and the key stays on the server: it is never sent to the browser. Paste a teaser (or upload a PDF) on the Add a deal screen and click **Read teaser**. Claude Haiku 5.5 fills in the fields it finds, marks them "AI", and leaves anything it can't find blank. Each run shows its token count and estimated cost (usually well under 1¢). Fictional teasers to try are in [`test-data/`](./test-data/).

You can still open `app/index.html` directly without the server; the buy box and pipeline work, but AI teaser reading, My assumptions, and the financial model need the server.
