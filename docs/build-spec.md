# SPOTLIT: Development Build Spec v2

> Get spotlit by agents.
> Qloo Agentic Hackathon entry. Deadline: **Oct 30, 2026, 11:45 pm ET = Oct 31, 9:45 am Bangladesh time**. Target submission: **Oct 30**.
> Hosting: Vercel (`getspotlit.vercel.app`). No custom domain.
> v2 (Oct 13): Firebase replaces Supabase, Google-only sign in, real accounts and venue claiming, 17 designed screens, Liquid Glass styling, and the "push to 1st place" items.

This file is the single source of truth for building Spotlit. Hand it to a coding agent section by section. Anything marked **VERIFY** must be checked against live docs before coding, because APIs change. The visual source of truth is the Spotlit App Screens design canvas (section 14).

**Copy rule:** all user-facing copy (UI text, README, Devpost text) uses plain English with **no em dashes and no hyphen-joined phrases**.

---

## 0. What changed from v1

| Area | v1 | v2 |
|---|---|---|
| Database | Supabase Postgres | **Firestore** (Firebase) |
| Auth | Supabase magic link | **Firebase Auth, Google sign-in only**. No passwords, no email verification, no reset flow |
| Realtime | Supabase Realtime | **Firestore `onSnapshot` listeners** |
| Email | Resend | **Removed.** Alerts are in-app notifications (bell in the top bar) |
| Accounts | Light | Real product: sign up, sign in, claim venue, my venues (several per account), settings, shareable read-only report link |
| Background jobs | Inngest | Inngest (unchanged; Cloud Functions need the paid Firebase plan) |
| Hosting | Vercel | Vercel (unchanged; Firebase App Hosting also needs the paid plan) |
| Styling | Tokens | Tokens plus a **Liquid Glass** `.lg` class for text over halftone imagery |
| Strategy | | Four "push to 1st" items (section 16) |

---

## 1. What we are building

Spotlit helps independent venues (restaurants, bars, cafes, small music venues) get chosen by AI agents.

Discovery is moving from search pages to AI assistants. A person asks an agent "find somewhere for Friday, my friend loves jazz and natural wine" and gets one or two answers. Venues cannot see whether agents pick them, who gets picked instead, or why.

Spotlit:

1. Builds a **Taste DNA** for a venue from Qloo.
2. Publishes a live **venue agent** (A2A agent card + JSON-RPC endpoint + MCP tools).
3. Runs an **Agent Arena**: dozens of persona agents (built from real Qloo taste data) ask a concierge agent for recommendations; the concierge queries venue agents over A2A and picks one.
4. Produces a **report**: Share of Agent Voice, segment wins and losses, which rival won, and why.
5. A **Growth Strategist** agent turns losses into evidence-backed actions, edits the agent card, and re-runs the arena to show the lift.

**Hard rule:** Qloo must be the reason it works. Taste decides at least 60% of every verdict, and every number in the UI links back to the Qloo query that produced it.

**Honesty rule:** no agent ever speaks as a real business that has not claimed itself. The demo venue is fictional. Real rival venues run as **proxy agents** clearly labelled "Unclaimed, public data only". Arena results are always called a simulation.

### Judging criteria (Qloo, equal weight) and how we hit them
- **Technological Implementation:** Qloo powers place search, Taste DNA, cross-domain affinities, heatmap, rivals, persona building and 60% of every score. Real A2A and MCP. Ties are broken on this criterion first.
- **Design:** full product journey, real accounts, distinctive brand, 17 screens.
- **Potential Impact:** venues already lose picks to agents; we show the number, the reason and a measured fix. Weakest criterion, see section 16.
- **Quality of the Idea:** flips Qloo from consumer recommendations to helping businesses get chosen by agents.
- Judging may include automated AI analysis, and judges may not test the app, so README, repo and video carry real weight.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict, React Server Components where natural |
| Styling | Tailwind CSS v4, shadcn/ui restyled to the Spotlit theme, Framer Motion |
| Agent framework | Vercel AI SDK (latest major), `generateText` / `streamText` / `generateObject` with zod typed tools |
| LLM | Google Gemini via `@ai-sdk/google`. Fast model for personas, venue and proxy replies. Smart model for concierge, analyst, strategist. **VERIFY** current model IDs and rate limits |
| Agent protocol | Official A2A JS SDK (`@a2a-js/sdk`). **VERIFY** spec version and well-known agent card path |
| MCP | `@modelcontextprotocol/sdk`, Streamable HTTP transport on a Next route (or `mcp-handler`) |
| Auth | **Firebase Auth**, Google provider only. Client SDK `firebase`, server `firebase-admin` |
| Database | **Cloud Firestore** (Spark free plan). All writes go through server routes with the Admin SDK |
| Realtime | Firestore `onSnapshot` in client components |
| Background jobs | Inngest (arena fan-out, retries, concurrency caps, weekly cron) |
| Maps | MapLibre GL + free tiles (OpenFreeMap) |
| Charts | Recharts (simple) + custom SVG for the gauge |
| Arena visual | Custom SVG + Framer Motion (React Flow only if needed) |
| Validation | zod at every boundary |
| Testing | Vitest (unit), Playwright (one happy path e2e) |
| Hosting | Vercel + Firebase (Auth, Firestore) + Inngest cloud |
| Repo | Public GitHub, MIT license visible in About |

Free plan limits to respect: Firestore Spark allows about 50k reads and 20k writes per day. Cache Qloo, never re-read whole runs on every render, paginate tickers.

---

## 3. Repo structure

```
spotlit/
  app/
    (marketing)/page.tsx                  # Landing
    signin/page.tsx                       # Google only
    signup/page.tsx                       # Google only (same flow, different copy)
    demo/page.tsx                         # Redirects to the read-only demo report
    concierge/page.tsx                    # Public consumer concierge
    v/[slug]/page.tsx                     # Public venue page
    v/[slug]/.well-known/agent-card.json/route.ts   # A2A card (VERIFY path)
    v/[slug]/a2a/route.ts                 # A2A JSON-RPC endpoint
    r/[token]/page.tsx                    # Shared read-only report link
    (app)/app/
      layout.tsx                          # Auth guard + top bar (My venues, Concierge, bell, avatar)
      page.tsx                            # My venues
      settings/page.tsx                   # Account settings
      new/page.tsx                        # Find your venue (search + describe it)
      new/claim/[venueId]/page.tsx        # Claim venue
      v/[venueId]/
        layout.tsx                        # Venue sidebar (01 to 08, readiness meter, venue switcher)
        dna/page.tsx
        rivals/page.tsx
        card/page.tsx
        arena/page.tsx                    # Start a run
        arena/[runId]/page.tsx            # Live theatre / replay
        report/[runId]/page.tsx
        strategist/page.tsx
        compare/page.tsx                  # Before and after
        inbox/page.tsx
    api/
      session/route.ts                    # POST idToken -> session cookie, DELETE -> sign out
      venues/search/route.ts
      venues/route.ts                     # Create from Qloo match or description
      venues/[id]/claim/route.ts
      venues/[id]/profile/route.ts        # Taste DNA, rivals, heatmap (idempotent, cached)
      venues/[id]/card/route.ts
      arena/route.ts
      arena/[runId]/route.ts
      arena/[runId]/share/route.ts        # Create share token
      strategist/route.ts
      actions/[id]/apply/route.ts
      concierge/route.ts
      notifications/route.ts              # Mark read
      mcp/[transport]/route.ts            # MCP server
      inngest/route.ts
  lib/
    firebase/
      client.ts                           # initializeApp, getAuth, getFirestore (browser)
      admin.ts                            # firebase-admin app, auth, db (server only)
      session.ts                          # getSessionUser() for server components and routes
      paths.ts                            # Typed collection and doc path helpers
      converters.ts                       # zod based Firestore data converters
    qloo/{client.ts,endpoints.ts,types.ts,trace.ts}
    agents/{persona.ts,concierge.ts,venue.ts,proxy.ts,analyst.ts,strategist.ts,prompts/}
    a2a/{card.ts,server.ts,client.ts}
    arena/{segments.ts,personas.ts,scoring.ts,run.ts,whatif.ts}
    readiness.ts
    notifications.ts
    rng.ts                                # mulberry32
    llm.ts                                # Model instances + cache wrapper
  inngest/
    client.ts
    functions/{arenaRun.ts,arenaRound.ts,arenaComplete.ts,weekly.ts}
  components/
    ui/                                   # shadcn, restyled
    spotlit/                              # see section 13.4
  firestore.rules
  firestore.indexes.json
  firebase.json                           # rules + indexes deploy only
  scripts/
    qloo-smoke.ts                         # Day 1 endpoint test
    seed-demo.ts                          # Demo venue, demo owner, cached Qloo data, baseline run
  middleware.ts                           # Redirect /app/* to /signin when no session cookie
  public/                                 # brand kit: logo SVGs, halftone PNGs, favicon from the O mark
  .env.example
  LICENSE                                 # MIT
  README.md
```

---

## 4. Environment variables

```
# Qloo
QLOO_API_KEY=
QLOO_BASE_URL=https://hackathon.api.qloo.com   # VERIFY in developer guide

# LLM
GOOGLE_GENERATIVE_AI_API_KEY=
MODEL_FAST=                                    # VERIFY exact IDs
MODEL_SMART=

# Firebase (client, public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server only, from the service account JSON)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=                          # keep the \n escapes; replace(/\\n/g, "\n") at load

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# App
NEXT_PUBLIC_APP_URL=https://getspotlit.vercel.app
DEMO_CITY=New York
DEMO_VENUE_SLUG=halftone-house
DEMO_MODE=false        # true = serve cached Qloo responses only (judging safety net)
ARENA_MAX_PERSONAS_PUBLIC=24
ARENA_MAX_PERSONAS_DEMO=60
SESSION_COOKIE_DAYS=14
```

Never commit keys. Put them in `.env.local` and Vercel project settings.

---

## 5. Qloo integration

### 5.1 Client rules (`lib/qloo/client.ts`)
- Header: `X-Api-Key: ${QLOO_API_KEY}`. **VERIFY** header name and base URL.
- `qlooGet(path, params)` builds the query string with stable key ordering.
- Cache: sha256 of `path + sorted params` as the doc id in `qlooCache`. TTL 7 days. In `DEMO_MODE`, never call the network: a cache miss throws a typed `CacheMissError`.
- Retries: 3 attempts, exponential backoff with jitter, only on 429 and 5xx.
- Concurrency: module level limiter (p-limit, 4 concurrent).
- Trace: every call (cached or live) writes a `qlooCalls` doc `{runId?, venueId?, path, params, ms, cached, status, createdAt}`. The UI "Qloo trace" drawer reads these.
- Every function returns `{ data, evidence }` where `evidence = { callId, path, params }`. UI numbers render `<EvidenceLink evidence={...}/>`.

### 5.2 Endpoint map (`lib/qloo/endpoints.ts`)
Parameter names come from public docs and community tools. **VERIFY each one in `scripts/qloo-smoke.ts` on Day 1.**

| Function | Endpoint | Key params | Used by |
|---|---|---|---|
| `searchPlaces(q, city)` | `GET /search` | `query`, `types=urn:entity:place`, location hint, `take` | Venue finder |
| `getEntities(ids)` | `GET /entities` | `entity_ids` | Venue details |
| `searchTags(q)` | `GET /v2/tags` | `filter.query` | Describe it, segments |
| `listAudiences()` | `GET /v2/audiences` | audience type | Segments |
| `venueTags(venueId)` | `GET /v2/insights` | `filter.type=urn:tag`, `signal.interests.entities` | Taste DNA |
| `venueDemographics(venueId)` | `GET /v2/insights` | `filter.type=urn:demographics`, `signal.interests.entities` | Crowd skew |
| `crossDomain(signal, type)` | `GET /v2/insights` | `filter.type=urn:entity:{artist,movie,brand,tv_show,podcast}`, `signal.interests.entities` and/or `signal.interests.tags` | Taste DNA, personas, strategist |
| `tasteRivals(venueId, city, categoryTags)` | `GET /v2/insights` | `filter.type=urn:entity:place`, `filter.location.query`, `signal.interests.entities`, `filter.tags`, `filter.exclude.entities` | Rivals |
| `cityTags(city)` | `GET /v2/insights` | `filter.type=urn:tag`, `signal.location.query` | Segments |
| `scoreCandidates(seeds, candidateIds, city)` | `GET /v2/insights` | `filter.type=urn:entity:place`, `signal.interests.entities=<seeds>`, `filter.results.entities=<candidates>` | Arena scoring (one call scores all candidates) |
| `heatmap(signal, city)` | `GET /v2/insights` | `filter.type=urn:heatmap`, `filter.location.query` | Heatmap |
| `trending(...)` | `GET /v2/insights` | base query + `bias.trends=high` | Trend radar |

### 5.3 Day 1 smoke test (`scripts/qloo-smoke.ts`)
Run with `pnpm tsx scripts/qloo-smoke.ts`. For each row: one real call, print status, latency, result count, and the shape of the first result (affinity field name, entity id field, tags shape). Write results to `docs/qloo-capabilities.md`. Test New York, London and Austin for place coverage and pick the richest.

**Fallbacks:**
- No `urn:heatmap`: plot rival and segment matched places on the map instead.
- No `urn:demographics`: derive crowd skew from age band signals on cross domain queries.
- No `/v2/audiences`: build segments from `cityTags` only.
- No `filter.results.entities`: run place insights with persona seeds in the city and read candidate positions from the returned list; unlisted candidates get affinity 0.

**Key validity:** ask Qloo whether hackathon keys stay valid through judging (Nov 2 to 16). Either way, warm the cache so `DEMO_MODE=true` keeps the demo alive.

---

## 6. Data model (Firestore)

All writes happen on the server through the Admin SDK after verifying the session. Clients only read (and only what rules allow). Validate every document with zod converters (`lib/firebase/converters.ts`). Timestamps use `FieldValue.serverTimestamp()`.

```
users/{uid}
  name, email, photoURL, role ('owner'|'manager'|'marketing'), createdAt
  notificationPrefs: { lostRequests: bool, weeklyReport: bool, runFinished: bool }
  users/{uid}/notifications/{id}
    kind ('lost_request'|'run_finished'|'weekly'), title, body, link, read: bool, createdAt

slugs/{slug}                       # uniqueness guard, created in a transaction with the venue
  venueId

venues/{venueId}                   # PUBLIC fields only (rules allow public read)
  slug, name, city, category ('restaurant'|'bar'|'cafe'|'music_venue')
  qlooEntityId | null              # null for described or fictional venues
  ownerId | null, isClaimed, isFictional, isProxy
  descriptionTags: string[]        # Qloo tag ids for described venues
  lat, lng
  latestCardVersion, readiness     # denormalised for My venues cards
  latestRunId | null, latestSoav | null
  createdAt

  venues/{id}/cards/{version}      # PUBLIC read (the agent card is public anyway)
    version, facts: { hours, priceBand, partyMax, booking, dishes[], drinks[], music, vibe, rules[], events[] }
    voice, readiness, createdAt

  venues/{id}/taste/profile        # PUBLIC read (shown on public venue page)
    tags, demographics, affinities, heatmap, trends, evidence, computedAt

  venues/{id}/rivals/{rivalVenueId}   # owner read
    overlapScore, evidence, name, lat, lng

  venues/{id}/actions/{actionId}      # owner read
    runId, kind ('card_fact'|'pitch'|'event'|'menu'|'collab'), title, detail, evidence
    status ('proposed'|'accepted'|'dismissed'), estLift, liftType ('measured'|'estimated'), rank

  venues/{id}/inbox/{msgId}           # owner read; live external A2A and MCP requests
    protocol ('a2a'|'mcp'), fromAgent, request, response, outcome ('recommended'|'top3'|'answered'|'unknown'|'lost'), createdAt

segments/{city}__{segmentId}
  city, name, tagIds[], weight, evidence

runs/{runId}
  venueId, ownerId, cardVersion, seed, personaCount
  status ('queued'|'running'|'complete'|'failed'), label ('baseline'|'what-if'|'weekly'), parentRunId | null
  progress: { done, total }
  isPublicDemo: bool                  # true only for the seeded demo runs
  summary: {                          # written once at completion, computed in code
    soav, wins, bySegment: [{segmentId, name, n, wins}], lostTo: [{venueId, name, losses, mainReason, topSegment}],
    reasonCodes: {TASTE_GAP, INFO_GAP, PITCH_GAP, CLOSED}, weights: {A:0.6, C:0.25, Q:0.15}
  }
  analyst: { narrative, patterns[] }
  startedAt, finishedAt

  runs/{id}/personas/{personaId}
    segmentId, displayName, ageBand, occasion, budget, slot, partySize, seeds[{qlooId,name,type}], requestText
  runs/{id}/rounds/{personaId}        # one per persona, doc id = personaId
    candidates[{venueId, affinity, normAffinity, C, Q, score, reply}], winnerVenueId, reason, reasonCodes[], createdAt
  runs/{id}/messages/{msgId}          # A2A messages during the run
    fromAgent, toAgent, direction, payload, createdAt

shares/{token}                        # read-only report links
  runId, venueId, createdBy, createdAt

qlooCache/{hash}                      # server only
  path, params, response, fetchedAt
qlooCalls/{id}                        # server only (trace drawer reads via API route)
  runId?, venueId?, path, params, ms, cached, status, createdAt
llmCache/{hash}                       # server only, optional
```

Keep docs well under the 1 MB limit. Store large Qloo responses trimmed to the fields we use.

### 6.1 Security rules (`firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }
    function ownsVenue(venueId) {
      return signedIn() && get(/databases/$(db)/documents/venues/$(venueId)).data.ownerId == request.auth.uid;
    }

    match /users/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow write: if false;                       // server only
      match /notifications/{id} { allow read: if signedIn() && request.auth.uid == uid; allow write: if false; }
    }

    match /venues/{venueId} {
      allow read: if true;                         // public fields only live here
      allow write: if false;
      match /cards/{v}      { allow read: if true; allow write: if false; }
      match /taste/{d}      { allow read: if true; allow write: if false; }
      match /rivals/{r}     { allow read: if ownsVenue(venueId); allow write: if false; }
      match /actions/{a}    { allow read: if ownsVenue(venueId); allow write: if false; }
      match /inbox/{m}      { allow read: if ownsVenue(venueId); allow write: if false; }
    }

    match /runs/{runId} {
      allow read: if resource.data.isPublicDemo == true
                  || (signedIn() && resource.data.ownerId == request.auth.uid);
      allow write: if false;
      match /{sub=**} {
        allow read: if get(/databases/$(db)/documents/runs/$(runId)).data.isPublicDemo == true
                    || (signedIn() && get(/databases/$(db)/documents/runs/$(runId)).data.ownerId == request.auth.uid);
        allow write: if false;
      }
    }

    match /segments/{id} { allow read: if true; allow write: if false; }
    match /{document=**}  { allow read, write: if false; }   // qlooCache, qlooCalls, llmCache, shares, slugs
  }
}
```

Shared report pages (`/r/[token]`) render on the server with the Admin SDK, so they need no client rule. Deploy rules and indexes with `firebase deploy --only firestore`.

---

## 7. Accounts and auth (Firebase, Google only)

### 7.1 Sign in flow
1. `/signin` and `/signup` both show one **Continue with Google** button (`signInWithPopup` with `GoogleAuthProvider`). Popup, not redirect, because redirect is unreliable on non-Firebase hosting.
2. On success, the client gets an ID token and POSTs it to `/api/session`.
3. The server verifies it with the Admin SDK, creates a **session cookie** (`createSessionCookie`, 14 days, `httpOnly`, `secure`, `sameSite=lax`), and upserts `users/{uid}` from the Google profile.
4. New users (no venues) go to `/app/new`. Returning users go to `/app` (My venues).
5. `middleware.ts` redirects `/app/*` to `/signin` when the cookie is missing. Server layouts call `getSessionUser()` (`verifySessionCookie`, Node runtime) for the real check. API routes do the same.
6. Sign out: `DELETE /api/session` clears the cookie, then client `signOut()`.

Firebase console: enable the Google provider, add `localhost` and `getspotlit.vercel.app` to Authorized domains.

### 7.2 Claiming a venue
- `POST /api/venues/[id]/claim { role }` runs a Firestore transaction: if `ownerId` is null, set `ownerId = uid`, `isClaimed = true`, `isProxy = false`; else return `409 already_claimed`.
- First claim wins for the hackathon. Real ownership checks (Google Business Profile, phone call) go on the roadmap in the README.
- Already claimed: show "Request access" (creates a notification for the owner; no email).
- A claimed venue's agent switches from proxy mode to venue agent mode and reads its own card.

### 7.3 Account features
- **My venues:** one account owns several venues. Card per venue with SoAV, readiness, asks this week, latest run, and "Finish setup" for incomplete ones. Recent activity list.
- **Settings:** profile (name and photo from Google, role editable), "Signed in with Google" with a link to the Google account, notification switches (in-app), delete account (releases venues, deletes user data).
- **Notifications:** bell in the top bar reading `users/{uid}/notifications` live. Created for: arena run finished, a lost external request in the Inbox, weekly report ready. No email.
- **Share report:** `POST /api/arena/[runId]/share` creates `shares/{token}`; `/r/[token]` renders the report read-only for anyone with the link.

### 7.4 Demo and judges
- **No-login path:** "Try the demo venue" opens `/demo`, which renders the seeded Halftone House report (`isPublicDemo=true`) read-only, with an invite to sign in and scan a real venue.
- **Logged-in path:** any Google account gets its own workspace. Seed script also gives every new account a read-only copy link to the demo.
- Devpost testing instructions: "Sign in with any Google account, or open the demo with no login."

---

## 8. Agents

All agents are AI SDK calls with zod typed outputs. System prompts live in `lib/agents/prompts/`. Cache LLM calls by input hash in `llmCache` (optional but recommended).

### 8.1 Persona agent (fast model)
Input: persona record (seeds with names, age band, occasion, budget, slot, party size, city).
Output: `{ requestText }`, one natural sentence a real person would type to an assistant. Mentions 1 or 2 seed names naturally. No venue names.

### 8.2 Concierge agent (smart model)
Tools: `scoreCandidates(seeds, candidateIds)` (Qloo), `askVenue(venueId, message)` (A2A client).
Flow per persona: shortlist = target + rivals (max 6). One Qloo call scores all. Send A2A requests to the top 4 by affinity plus always the target. Rate each reply for constraint fit C and answer quality Q (structured output). Final scores computed in code (`lib/arena/scoring.ts`). Write a one line reason.
Output: `{ ratings: [{venueId, C, Q, notes}], reason }`. The winner is computed in code.

### 8.3 Venue agent (fast model)
Context: latest card facts + voice + Taste DNA summary. Answers fit, availability for the slot (from hours), price fit, a short pitch. Never invents facts not in the card. Unknown means it says so (creates INFO_GAP, which the strategist fixes).
Output: `{ fits: boolean, availability: 'open'|'closed'|'unknown', priceFit: 'yes'|'no'|'unknown', pitch: string, factsUsed: string[] }`.

### 8.4 Proxy agent (fast model)
Same schema, but context is only public Qloo data. Hours and prices are `unknown` unless Qloo provides them. UI label: "Unclaimed, public data only".

### 8.5 Analyst agent (smart model)
Input: all rounds + taste profiles. Output: narrative plus top 3 loss patterns tied to reason codes and Qloo evidence. Numbers come from code; the analyst only writes words.

### 8.6 Growth Strategist (smart model, streaming chat)
Tools: `getReport(runId)`, `qlooEvidence(segmentId)`, `proposeAction(action)`, `applyCardEdit(patch)`, `runWhatIf(actionIds)`.
Rules: every action cites Qloo evidence. Max 5 actions per run. Lift labelled `measured` for card and pitch fixes, `estimated` for event and menu ideas.

---

## 9. A2A

### 9.1 Agent card (`/v/[slug]/.well-known/agent-card.json`)
Built by `lib/a2a/card.ts` from the venue + latest card: name, description, url (`/v/[slug]/a2a`), version, capabilities, skills `check_fit`, `check_availability`, `get_menu_highlights`, `request_booking` (returns the booking link only, never books). Extension field `spotlit: { claimed, tasteTags: [top 8 names] }`. **VERIFY** field names and path with the SDK; keep protocol code inside `lib/a2a/`.

### 9.2 Endpoint (`/v/[slug]/a2a`)
JSON-RPC 2.0 via the SDK helpers, `message/send` (non-streaming). During a run, log to `runs/{id}/messages`. Outside a run, log to `venues/{id}/inbox` (this powers the live Inbox) and, if the outcome is a loss, create a notification. Simple in-memory rate limit per IP.

### 9.3 Client (`lib/a2a/client.ts`)
The concierge resolves URLs from agent cards and sends real HTTP JSON-RPC calls, even for venues in the same app. In-process shortcut only behind `A2A_INPROCESS=true` for local speed.

---

## 10. MCP server (`/api/mcp`)

Tools:
- `find_venue_for_taste({ city, likes: string[], occasion, budget })`: top 3 Spotlit venues with Qloo backed reasons
- `ask_venue({ slug, question })`: proxies to the venue agent over A2A
- `get_taste_dna({ slug })`

**Every MCP call is logged to the venue's `inbox`** (protocol `mcp`), so a call from Claude shows up live in the Inbox. README includes copy-paste config for Claude Desktop and Claude Code (`claude mcp add --transport http spotlit https://getspotlit.vercel.app/api/mcp`). **VERIFY** the current command syntax.

---

## 11. Arena engine

### 11.1 Segments (`lib/arena/segments.ts`)
1. `cityTags(city)` gives about 40 tags with affinity.
2. Smart model clusters tag names into 6 to 10 named segments (structured output); store tag ids per segment. Cache per city in `segments`.
3. Weight = sum of member tag affinities, normalised to 1.

### 11.2 Personas (`lib/arena/personas.ts`)
Deterministic with `mulberry32(seed)`. Allocate persona count across segments by weight (largest remainder, minimum 1 per segment). Per persona: age band from segment demographics (or uniform), occasion from `['date night','group dinner','solo drink','live music','after work','brunch']`, budget `['$','$$','$$$']`, slot (day + time), party size 1 to 6. Seeds: `crossDomain(segmentTags, artist|movie|brand)`, pick 3 to 5 entities by seeded weighted sampling. Display name: seeded first name + age band (fictional people only).

### 11.3 Scoring (`lib/arena/scoring.ts`)
```
score = 0.60 * A + 0.25 * C + 0.15 * Q
A = Qloo affinity, min-max normalised within this persona's candidate set (0..1)
C = constraint fit 0..1 (open at slot, price band, party size, occasion), from venue reply + card
Q = answer quality 0..1 (specific, honest, bookable), rated by the concierge
```
Weights live in one exported constant and are shown in the report UI.

Reason codes when the target loses (all that apply, ordered by gap):
- `TASTE_GAP`: winner A minus target A > 0.15
- `INFO_GAP`: target reply had `unknown` availability or price
- `PITCH_GAP`: winner Q minus target Q > 0.2
- `CLOSED`: target closed at the slot

Share of Agent Voice = target wins / personas (overall and per segment).

### 11.4 Run orchestration (Inngest)
- `arena/run.requested`: create `runs/{id}`, build personas, emit one `arena/round` event per persona.
- `arena/round`: persona text, concierge flow, write `rounds/{personaId}` and `messages`, increment `progress.done` (FieldValue.increment). Concurrency limit 6 per run, retries 2.
- When `progress.done == total`: `arena/run.completed` computes `summary` in code, runs the analyst, sets `status=complete`, sets `venues/{id}.latestRunId/latestSoav`, creates a "run finished" notification.
- UI listens with `onSnapshot` to `runs/{id}` (progress) and `runs/{id}/rounds` ordered by `createdAt` (ticker, limit 50).

### 11.5 What-if (`lib/arena/whatif.ts`)
- Accepted `card_fact` / `pitch` actions: new card version, re-run with the **same seed and personas**, measured lift.
- `event` / `menu` / `collab` actions: estimated lift from tag affinity heuristics, labelled "estimated" everywhere and never added to the measured SoAV.

---

## 12. Agent Readiness Score (`lib/readiness.ts`)
Out of 100, computed in code: hours (15), price band (10), party max (5), booking link (15), at least 3 dishes or drinks (15), music or vibe (10), voice notes (5), at least 1 event (10), taste tags on card (15). Missing items show as a checklist with one-click jump to the card editor.

---

## 13. Design system

Reference feel: Oracus AI (editorial, halftone imagery, white cards on black) + ALTA wordmark (orange, spaced mono labels). Not a generic SaaS dashboard. **Brand kit** files (logo SVGs and PNGs, halftone images, guidelines PDF) go in `public/brand/`.

### 13.1 Tokens (`app/globals.css`, Tailwind v4 `@theme`)
```css
@theme {
  --color-signal: #F26A3F;        /* the one accent */
  --color-signal-ink: #1A0D08;    /* text on orange */
  --color-signal-text: #C9502A;   /* orange text on light backgrounds (contrast) */
  --color-stone: #EDECE7;         /* light page background */
  --color-paper: #FFFFFF;         /* cards */
  --color-ink: #0B0B0C;           /* dark sections, text */
  --color-ash: #6B6A66;           /* secondary text */
  --color-line: #D9D7D0;          /* borders on light */
  --color-line-dark: #232325;     /* borders on dark */
  --font-display: "Instrument Serif", serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --radius-card: 14px;
}
```
Load fonts with `next/font/google`.

### 13.2 Liquid Glass (`.lg`)
Used for any text that sits over halftone imagery (landing hero, sign in panels) and for glass buttons. Recreation of Apple's Liquid Glass: refraction, bright rim, sheen, light tint.

```css
.lg{position:relative;isolation:isolate;background:rgba(20,20,22,.30);
  backdrop-filter:blur(10px) saturate(180%) brightness(.82);
  -webkit-backdrop-filter:blur(10px) saturate(180%) brightness(.82);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.40),inset 0 -1px 0 rgba(255,255,255,.06),
             inset 0 0 28px rgba(255,255,255,.05),0 24px 70px rgba(0,0,0,.45)}
.lg{backdrop-filter:url(#lg-refract) blur(10px) saturate(180%) brightness(.82)}  /* Chromium refraction; others keep the line above */
.lg::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.2px;
  background:linear-gradient(135deg,rgba(255,255,255,.75),rgba(255,255,255,.10) 30%,rgba(255,255,255,.02) 55%,rgba(255,255,255,.35));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
  mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);pointer-events:none;z-index:-1}
.lg::after{content:"";position:absolute;inset:0;border-radius:inherit;
  background:radial-gradient(120% 60% at 15% 0%,rgba(255,255,255,.16),transparent 55%),
             radial-gradient(80% 50% at 90% 110%,rgba(242,106,63,.10),transparent 60%);pointer-events:none;z-index:-1}
```
Render once in the root layout (component `<LiquidGlassFilter/>`):
```html
<svg width="0" height="0" aria-hidden="true" style="position:absolute">
  <filter id="lg-refract" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="11" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="3" result="soft"/>
    <feDisplacementMap in="SourceGraphic" in2="soft" scale="70" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>
```
Respect `prefers-reduced-transparency` by falling back to a solid `rgba(11,11,12,.85)` background.

### 13.3 Rules
- Headlines: display serif, large, tight leading; one italic orange word for emphasis. UI: Inter. Labels: mono, uppercase, letter-spacing 0.14em.
- Orange is rare (under 10% of a screen), except the live arena.
- Imagery: orange halftone only (spotlight cone hero, lit orb on step cards, dotted city heatmap). No stock photos.
- Numbered outlined mono pills (`01`, `02`, `03`).
- Dark (`ink`) for public pages, the arena theatre, auth panels and the venue sidebar; light (`stone`) for owner content.
- Footer: giant SPOTLIT wordmark over the halftone heatmap glow.
- Every number has an `EvidenceLink` (mono "Qloo ↗" chip opening the trace drawer).
- Mobile works everywhere: sidebar stacks above content, tables scroll inside a box.
- Accessibility: 4.5:1 contrast, orange focus rings, real buttons and labels, reduced motion variants.

### 13.4 Brand and components
- Wordmark: SPOTLIT cut from Inter Bold; the O is a spotlight seen from above (ring with a gap at the upper right plus a centre dot), the only orange letter. The O mark alone is the favicon, app icon and concierge glyph.
- Agent glyphs: persona = small circle, concierge = O mark, venue = filled orange square, proxy = dashed square.
- `components/spotlit/`: `Wordmark`, `OMark`, `LiquidGlassFilter`, `GlassPanel`, `SoavGauge` (60 radial rays, display serif number), `AgentGlyph`, `EvidenceLink` + `QlooTraceDrawer`, `HalftoneImage`, `StepCard`, `ArenaTheatre`, `VerdictTicker`, `ReasonCodeBadge`, `LiftBadge` (measured solid, estimated dashed), `ReadinessMeter`, `VenueSidebar`, `TopBar`, `NotificationBell`.

---

## 14. Screens (17)

Visual source of truth: the **Spotlit App Screens** design canvas (Claude design artifact). Match layout, copy and data shape.

| # | Screen | Route | Must show |
|---|---|---|---|
| 01 | Landing | `/` | Glass hero "Get spotlit by agents.", 3 example cards, problem statement, 3 step cards with halftone orbs, live arena preview, gauge + reason codes preview, A2A/MCP section with config snippet, footer wordmark. Buttons: Try the demo venue (no login), Scan your venue, Sign in |
| 02 | Public venue page | `/v/[slug]` | Hero, claimed badge, hours, price, groups, address, Taste DNA tags and cross-domain lists, events, agent card path |
| 03 | Public concierge | `/concierge` | Chat, recommendation card with booking link, agents consulted panel with scores, weights note. Rate limited |
| 04 | Find your venue | `/app/new` | Qloo search results, "Not listed? Describe it" form mapped to Qloo tags, step pills 01 Find to 05 Arena |
| 05 | Taste DNA | `/app/v/[id]/dna` | Tag cloud by affinity, crowd skew bars, cross-domain affinities (artists, films, brands, dining), heatmap, readiness checklist |
| 06 | Rivals | `/app/v/[id]/rivals` | Map with pins, ranked list with overlap bars, proxy label on each |
| 07 | Agent card | `/app/v/[id]/card` | Facts form with missing fields highlighted, voice, live JSON card preview, test chat |
| 08 | Arena live | `/app/v/[id]/arena/[runId]` | Dark theatre (personas, concierge, venue agents, message lines), progress bar, verdict ticker with reason codes |
| 09 | Report | `/app/v/[id]/report/[runId]` | SoAV ray gauge, segment win bars, lost-to table, reason codes, analyst summary, scoring weights, Share report |
| 10 | Strategist | `/app/v/[id]/strategist` | Streaming chat with Qloo evidence chips, up to 5 ranked action cards with measured/estimated lift, accept toggles, re-run button |
| 11 | Before and after | `/app/v/[id]/compare` | Two gauges, delta, segment bars (run 1 vs run 2), lifts list; estimated lifts excluded from the total |
| 12 | Agent inbox | `/app/v/[id]/inbox` | Stats, live A2A/MCP requests with outcomes, weekly line chart, top asks, in-app alert toggle |
| 13 | Sign up | `/signup` | Glass panel over halftone, Continue with Google only, demo link |
| 14 | Sign in | `/signin` | Same, plus "For hackathon judges" note |
| 15 | Claim venue | `/app/new/claim/[id]` | Venue card, role choice, authorization checkbox, what happens next, Claim and build Taste DNA, Request access |
| 16 | My venues | `/app` | Venue cards with SoAV/readiness/asks, setup in progress card, add venue card, recent activity |
| 17 | Account settings | `/app/settings` | Profile from Google, signed in with Google, in-app notification switches, delete account |

Change from the canvas: notification switches say "Notify me" (in-app), not "Email me".

---

## 15. Demo setup

- Demo city chosen on Day 1 from the smoke test (default New York).
- **Demo venue (fictional): "Halftone House"**, a 40 seat listening bar in Brooklyn (natural wine, vinyl sets, small plates). Built via describe it (Qloo tags), `isFictional=true`, owned by a demo owner account (Dana Park in the designs).
- Rivals: 6 to 8 real nearby venues from `tasteRivals`, all proxies. (The designs use placeholder names; real names come from Qloo.)
- `scripts/seed-demo.ts`: creates the venue, card v1 (deliberately missing hours, booking link and events so the first report shows INFO_GAP), Taste DNA, a 60 persona baseline run, then applies the 3 measured fixes and runs the what-if, marks both runs `isPublicDemo=true`, and warms the Qloo cache so `DEMO_MODE=true` works offline.
- Target story numbers (if the real run lands near them, great; never fake them): baseline about 11 of 60 (18%), after fixes about 22 of 60 (37%), readiness 60 to 90.

---

## 16. Push to 1st place (do these)

1. **Live external agent call in the video.** Connect Claude Code or Claude Desktop to `/api/mcp`, ask for a listening bar, and show the request landing live in the Inbox (split screen). Proves real agent traffic, not just simulation. (About 1 day.)
2. **One real venue next to Halftone House.** Scan a real Brooklyn listening or wine bar from public Qloo data only: Taste DNA, rivals and a run, labelled "Unclaimed, public data only" and "simulation". Never invent facts or edit its card. Stretch: DM 5 to 10 Brooklyn bars on Instagram with their free report; one owner quote helps Impact a lot. (Half a day.)
3. **Repo polish for AI judges.** MIT license in About, README with "Try it in 60 seconds" (demo link, no login), architecture diagram, table of every Qloo endpoint and what it powers, scoring formula, MCP connect steps, clean commits, strict TS, Vitest on scoring and personas. (1 day, Oct 28.)
4. **Scope discipline.** On the Oct 20 checkpoint, if the core loop (Taste DNA, Arena, Report, Strategist, Before and after) is not solid, apply the cut list in section 17.

**Impact framing for the Devpost text (answer these before judges ask):**
- Evidence that assistants already recommend and book venues today (research current examples near submission; cite them).
- The circular scoring question: Qloo affinity is 60% of the concierge score and real assistants may not use Qloo. Answer: three of four loss reasons (INFO_GAP, PITCH_GAP, CLOSED) apply to any agent; the arena models a taste-aware agent, which is where recommendation is heading; weights are shown openly.

---

## 17. Build plan (from Oct 13)

Spotlit and the GitLab project (Crosstalk, separate chat, deadline Oct 27) compete for time. The split is not final. This plan assumes Spotlit is the priority; if Crosstalk takes Oct 21 to 27, phases 5 and 6 move to Oct 28 to 29 and the cut list applies.

| Dates | Phase | Done when |
|---|---|---|
| Oct 13 to 14 | 1. Setup | Repo, MIT, Next app, tokens, fonts, brand kit in `public/`, Firebase project, Google sign in end to end with session cookie, rules deployed, Qloo client with cache and trace, smoke test results committed, demo city chosen |
| Oct 15 to 16 | 2. Venue + DNA | My venues, find (search + describe it), claim, Taste DNA with evidence, rivals map and list |
| Oct 17 to 18 | 3. Agents | Agent card editor, venue and proxy agents, A2A card + endpoint, persona factory, concierge working for 1 persona end to end |
| Oct 19 to 20 | 4. Arena + report | Inngest fan-out, live theatre with onSnapshot, report page, demo seed. **Gate: core demo-ready Oct 20** |
| Oct 21 to 23 | 5. Growth loop | Strategist chat, actions, what-if re-run, before and after, notifications bell, share link |
| Oct 24 to 26 | 6. Proof | MCP server tested with a real Claude client, Inbox live, public concierge, public venue page, real venue scan |
| Oct 27 | (Crosstalk deadline) | Light Spotlit work only |
| Oct 28 to 29 | 7. Polish | Landing animation, Liquid Glass pass, mobile pass, Lighthouse, README, video, Devpost text, `DEMO_MODE` cache warm |
| Oct 30 | Submit | Submit by evening Bangladesh time (deadline is Oct 31, 9:45 am) |

**Cut list (in this order, never cut arena or report quality):** trend radar, weekly cron, heatmap (use pins), describe it form, public venue page polish, Inbox reduced to the live list, share link, notifications bell.

---

## 18. Quality bar
- TypeScript strict, no `any` at boundaries; zod on every route input, Firestore converter and LLM output.
- Unit tests: scoring, reason codes, persona determinism (same seed gives same personas), readiness score, claim transaction.
- One Playwright e2e: landing, demo report (no login), strategist accept, before and after renders.
- Lighthouse 90+ on landing (performance, accessibility).
- No console errors. Loading, empty and error states on every screen.
- LLM output fails validation: retry once, then a graceful fallback.

---

## 19. Submission checklist
- [ ] Live demo at `https://getspotlit.vercel.app`, demo venue works without login
- [ ] Google sign in works for any account (test with a fresh Google account)
- [ ] Public GitHub repo, MIT `LICENSE` visible in About
- [ ] README per section 16 item 3, plus `.env.example` and testing instructions
- [ ] Devpost text: problem, what it does, why Qloo is essential, impact framing, startup angle (market, pricing, moat)
- [ ] Video (about 2 minutes): demo report, live arena, strategist fix, before and after, the live Claude MCP call into the Inbox
- [ ] `DEMO_MODE` cache warmed so the demo survives through judging (Nov 2 to 16)
- [ ] Asked Qloo whether hackathon keys stay valid through judging
- [ ] Submitted Oct 30

---

## 20. Setup checklist (Rejuan, before or on Day 1)
1. Qloo hackathon API key (most important)
2. Gemini API key (Google AI Studio)
3. GitHub: public `spotlit` repo with MIT license
4. Firebase: create project, enable Google sign-in, create Firestore database, register a web app (client config), download a service account key (server env vars)
5. Vercel: connect the repo, add env vars, add `getspotlit.vercel.app` to Firebase Authorized domains
6. Inngest: free account, keys into env

---

## 21. Open questions (resolve on Day 1)
1. Qloo base URL, auth header, which endpoints the hackathon key allows.
2. Affinity field name and scale in insights responses.
3. Whether `filter.results.entities` scores arbitrary candidates.
4. A2A spec version and agent card path in `@a2a-js/sdk`.
5. Current Gemini model IDs and rate limits.
6. Demo city with the best place coverage.
7. Final time split with the GitLab project.
