# SearchDesk

> **One-line pitch:** SearchDesk is the home base for first-time acquisition searchers: every deal, from brokers or direct outreach, captured, screened, and moved forward in one pipeline.

- **Builder:** Jordan Steinroeder (`@jns485-stern`)
- **Pod:** To be added
- **Product Page & Living PRD:** https://building-with-ai-f26.github.io/jns485-SearchDesk/
- **App:** runs locally for now (see below). A cloud URL is coming in Build 5.

## What it does (Build 1 prototype)

- Set your buy box once: target industries, states, SDE or EBITDA range, high-multiple flags, and seller situation.
- Add a deal from a broker or from direct outreach, using SDE or EBITDA.
- Get an instant screen: buy box checklist, price multiple, capital stack (SBA loan, seller note, buyer and investor equity), rough debt service and DSCR, and a suggested "Dig deeper" or "Pass" verdict with reasons. These are rough estimates, not advice.
- Save the deal to a pipeline grouped by stage, with a dated next step. Overdue items are flagged.
- Paste a teaser or upload a PDF, and Claude pre-fills the deal form (fields it filled are marked "AI" for you to check). Each run shows its tokens and estimated cost.

## Status

- **Build 1 (due Nov 9):** Done. PRD v1, local prototype, and screenshots are on the Product Page.
- **Builds 2–5:** Coming in Weeks 2–5. Progress is logged weekly on the Product Page.

## Repository map

| File / folder | Purpose |
| --- | --- |
| [`app/index.html`](./app/index.html) | The SearchDesk prototype: one web page (no libraries). |
| [`server.js`](./server.js) | Small local server: serves the app and handles AI teaser reading with Claude (key read from `.env`). |
| [`test-data/`](./test-data/) | Fictional sample teasers (text and PDF) for trying AI teaser reading. |
| [`docs/index.html`](./docs/index.html) | Public Product Page, living PRD, and weekly build log (published with GitHub Pages). |
| [`docs/images/`](./docs/images/) | Prototype screenshots used on the Product Page. |
| [`AGENTS.md`](./AGENTS.md) | Run commands and rules for the coding agent. |
| [`Intent.md`](./Intent.md), [`Plan.md`](./Plan.md), [`journal/`](./journal/) | Optional drafting notes. |
| [`tests/`](./tests/) | Verification guidance. Tests are coming in Build 4. |
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
```

Deals are saved in your browser, and 3 fictional sample deals load the first time you open it.

**AI teaser reading:** copy `.env.example` to `.env` and replace `paste-your-key-here` with your Anthropic API key. `.env` is ignored by Git, and the key stays on the server: it is never sent to the browser. Paste a teaser (or upload a PDF) on the Add a deal screen and click **Read teaser**. Claude Haiku 5.5 fills in the fields it finds, marks them "AI", and leaves anything it can't find blank. Each run shows its token count and estimated cost (usually well under 1¢). Fictional teasers to try are in [`test-data/`](./test-data/).

You can still open `app/index.html` directly without the server; everything works except AI teaser reading.
