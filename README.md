# Grounded Listings Assistant

A chat assistant that recommends from **one fixed dataset of ~18 local listings
and nothing else**. It never invents listings, never answers from the open web or
pretrained knowledge, and refuses or gracefully redirects anything out of scope.
Responses stream the conversational text plus **structured listing references**
so a frontend can render cards.

Built with **Next.js 16 (App Router) · React 19 · TypeScript (strict) · Vercel AI
SDK (`streamText`)**. Provider is swappable; this build defaults to **OpenAI**.

## How grounding works

- **The dataset is never put in the prompt.** The model reaches data *only*
  through typed tools — `searchListings`, `getListingById`.
- **Per-turn approved set.** Every listing a tool returns is recorded in a
  request-scoped set of IDs/URLs — "the approved tool-result set for this turn."
- **Model-sourced references, then validated.** To recommend, the model calls
  `presentListings({ ids })`. That tool keeps only IDs in the approved set;
  anything invented or unsearched is **stripped and logged**, and the validated
  set becomes the cards. (Because references originate from the model, the
  validation gate can actually fail — that's the point.)
- **Defense-in-depth on prose.** After generation we scan the completed text for
  any listing ID/URL not in the approved set. Streamed tokens can't be retracted,
  so we **log** the attempt and emit an `integrity` warning rather than rewrite.
- **System-prompt guardrails** enforce: recommend only from tool results; never
  invent; links only via each listing's `externalUrl`; refuse bookings,
  availability, off-topic, and "ignore your rules" attempts.

## Setup

> Requires **Node 20+** (Node 22 recommended).

```bash
npm install
cp .env.example .env.local      # then add your own OPENAI_API_KEY
```

`.env.local`:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini        # optional; this is the default
```

## Run

```bash
npm run dev      # http://localhost:3000  (chat UI)
npm run build    # production build + typecheck
npm run lint     # ESLint
npm test         # deterministic unit tests (no API key needed)
npm run eval     # 5 behavioral evals against the live model (needs OPENAI_API_KEY)
```

## API & response contract

`POST /api/chat` — body `{ messages: UIMessage[] }` (the Vercel AI SDK chat
shape). Returns a streamed **UI message stream** (SSE). Alongside the assistant's
text deltas it emits these custom **data parts**:

| Part            | `data` shape                                                       | Purpose                                  |
| --------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `data-disclaimer` | `{ text: string }`                                              | "AI can be wrong" notice (every turn)    |
| `data-listings`   | `{ listings: ListingRef[] }`                                   | Validated recommendations → render cards |
| `data-integrity`  | `{ strippedIds: string[]; strippedUrls: string[]; message }`  | Emitted only if prose referenced something unapproved |

```ts
type ListingRef = {
  id: string;            // e.g. "din-001"
  name: string;
  category: "dining" | "lodging" | "attraction" | "venue";
  city: string;
  priceTier: "free" | "$" | "$$" | "$$$" | "$$$$";
  externalUrl: string | null;
};
```

The frontend (`/`) consumes this with `useChat`, reading `message.parts` to render
streamed text, cards, the disclaimer, and any integrity warning.

Errors: `400` for a malformed body, `500` if `OPENAI_API_KEY` is missing.

## Tests / evals

- `npm test` — deterministic unit tests for the dataset filters, the
  reference-validation gate, the prose scan, and the tools (proves an invented ID
  is stripped and logged). Always green, no key required.
- `npm run eval` — the five cases from the brief, driven through the real route:
  normal recommendation · out-of-scope request · prompt-injection · invented
  listing · link handling. Each asserts the invariant that **cards only ever
  contain real dataset listings**. Skipped automatically without an API key.

## Project layout

```
data/sample-listings.json     # the single source of truth (validated with Zod)
src/lib/listings.ts           # load/validate dataset; search + getById
src/lib/tools.ts              # the 3 typed tools + per-turn approved set
src/lib/validate.ts           # reference gate + prose scan
src/lib/system-prompt.ts      # grounding guardrails + disclaimer
src/lib/model.ts              # provider factory (swap providers here)
src/app/api/chat/route.ts     # streaming route + validation + logging
src/app/page.tsx              # minimal chat UI with cards
src/eval/grounding.test.ts    # 5 behavioral evals
```

---

## Production hardening & tools used

**Would harden:** auth + per-user rate limiting on `/api/chat`, ship guardrail
logs to a real sink with alerting on strip events, add input size/abuse limits
and an output content check, and move the dataset behind a versioned store so it
can be updated without a redeploy.

**AI coding tools used:** Claude Code (Anthropic) for design, implementation, and
test scaffolding.
