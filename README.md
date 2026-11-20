# SearchDesk

> **One-line pitch:** SearchDesk turns a broker teaser into a lender-ready acquisition model in minutes, so first-time searchers can quickly tell whether a deal is affordable, financeable, and worth pursuing.

- **Builder:** Jordan Steinroeder (`@jns485-stern`)
- **Pod:** To be added
- **Product Page & Living PRD:** https://building-with-ai-f26.github.io/jns485-SearchDesk/
- **App:** https://searchdesk.onrender.com (Render free tier; the first visit after it sleeps takes about a minute). It also runs locally (see below).

## What it does

Core workflow: set your assumptions once → paste a teaser or upload a PDF → review the AI-extracted facts → run the model → see scenarios, max price, and returns → download the Excel model.

1. **Set My assumptions once:** financing (as % of total uses), deal costs, your salary, capex, tax, target DSCR, and target return. Defaults come from the approved Excel model.
2. **Paste a teaser or upload a PDF:** Claude reads it and pre-fills the deal facts (fields it filled are marked "AI" for you to check; anything the teaser doesn't state stays blank). Each read shows its tokens and estimated cost.
3. **Run the financial model:** your approved Excel template (`model/searchdesk-model-template.xlsx`) is filled with the deal and your assumptions and calculated on the server. You get total uses, your equity, and for 4 scenarios the lowest DSCR, max price at your target DSCR, price check, 5-year IRR, and MOIC. The AI never does the financial math; the template is the only source of numbers.
4. **Download the Excel model:** the filled template, named after the business, to keep adjusting (for example with CIM actuals).

Also included, but not being expanded: a buy box check (target industries, states, size, seller situation, growth) and a simple pipeline by stage with dated next steps.

**Not:** a CRM or deal tracker, a full-CIM reader (yet), or a valuation or substitute for diligence. Results are rough screening estimates, not investment or lending advice.

## Status

- **Build 1 (due Nov 9):** Done. PRD v1 and a local prototype.
- **Build 2 (due Nov 16):** Done. AI teaser reading (text or PDF) and PostHog analytics.
- **Build 3 (due Nov 23):** Done. Live app on Render, security review (`SECURITY.md`), and the approved Excel financial model connected to the app.
- **Builds 4–5:** Coming in Weeks 4–5. Progress is logged weekly on the Product Page.

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
