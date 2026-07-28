# PR Review Engine — Technical Design

**Status:** Draft · **Owner:** @Mayank820 · **Scope:** Phase 3 (the core product) + the indexing/data changes it depends on.

> **The one hypothesis this validates:** a developer opens a PR and gets a comment they'd have upvoted.
> Everything here is in service of that single moment. Build the thin vertical slice end-to-end first, then harden each layer using review quality as the test harness.

---

## Table of contents

1. [System flow](#1-system-flow)
2. [Data model](#2-data-model-prisma)
3. [Webhook layer](#3-webhook-layer)
4. [Inngest workflow: `reviewPullRequest`](#4-inngest-workflow-reviewpullrequest)
5. [Diff & token strategy](#5-diff--token-strategy)
6. [The review prompt & structured output](#6-the-review-prompt--structured-output)
7. [Posting comments to GitHub](#7-posting-comments-to-github)
8. [Repository health scoring](#8-repository-health-scoring)
9. [Indexing changes this depends on](#9-indexing-changes-this-depends-on)
10. [Idempotency & reliability](#10-idempotency--reliability)
11. [Observability](#11-observability)
12. [Build order (milestones)](#12-build-order-milestones)
13. [Open decisions](#13-open-decisions)

---

## 1. System flow

```
GitHub PR (opened / synchronize / reopened)
        │
        ▼
POST /api/webhooks/github        ← verify HMAC signature, dedup by delivery id, fast-ack (202)
        │
        ▼
inngest.send("pull_request.review_requested")
        │
        ▼
reviewPullRequest  (Inngest fn)
  1. resolve repo + GitHub token
  2. fetch PR diff (changed files only)
  3. filter files (skip binary / generated / ignored)
  4. per file: retrieve context from Pinecone → build prompt → Gemini generateObject
  5. persist Review + Findings (Postgres)
  6. post a PR review with inline comments (GitHub)
  7. recompute RepositoryHealth snapshot
        │
        ▼
Developer sees inline comments on the PR
```

Two things in the current codebase block this today:
- [`app/api/webhooks/github/route.ts`](../app/api/webhooks/github/route.ts) is a stub — no signature check, no `pull_request` handling, no Inngest trigger.
- [`createWebHook`](../module/github/lib/github.ts) registers the hook **without a `secret`**, so signatures can't be verified. Fix both together.

---

## 2. Data model (Prisma)

New models + enums. Extends the existing `Repository`. Naming/`@@map` style matches [`prisma/schema.prisma`](../prisma/schema.prisma).

```prisma
enum IndexStatus   { PENDING INDEXING INDEXED FAILED }
enum ReviewStatus  { QUEUED RUNNING COMPLETED FAILED }
enum Severity      { CRITICAL HIGH MEDIUM LOW INFO }
enum Category      { PERFORMANCE SECURITY ARCHITECTURE MAINTAINABILITY TESTING READABILITY NAMING DOCUMENTATION }

model Review {
  id             String       @id @default(cuid())
  repositoryId   String
  repository     Repository   @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  prNumber       Int
  prTitle        String
  headSha        String       // commit reviewed — the idempotency anchor
  baseSha        String
  status         ReviewStatus @default(QUEUED)
  summary        String?      // AI overview, posted as the review body
  score          Int?         // 0–100 for this PR
  filesReviewed  Int          @default(0)
  tokensUsed     Int          @default(0)
  githubReviewId BigInt?      // the review we posted, so we can update on re-review
  deliveryId     String?      // X-GitHub-Delivery, for idempotency
  error          String?
  findings       Finding[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([repositoryId, prNumber, headSha]) // one review per commit — dedup
  @@index([repositoryId])
  @@map("review")
}

model Finding {
  id              String   @id @default(cuid())
  reviewId        String
  review          Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  category        Category
  severity        Severity
  confidence      Float    // 0–1; below threshold → not posted, only stored
  path            String
  startLine       Int
  endLine         Int
  title           String
  reason          String
  impact          String
  suggestion      String
  fixedExample    String?
  githubCommentId BigInt?
  createdAt       DateTime @default(now())

  @@index([reviewId])
  @@map("finding")
}

model RepositoryHealth {
  id              String     @id @default(cuid())
  repositoryId    String
  repository      Repository @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  overall         Int
  performance     Int
  security        Int
  architecture    Int
  maintainability Int
  testing         Int
  snapshotAt      DateTime   @default(now())

  @@index([repositoryId, snapshotAt])
  @@map("repository_health")
}

// Idempotency ledger for webhook deliveries (belt-and-suspenders alongside Review's unique key)
model WebhookEvent {
  id         String   @id @default(cuid())
  deliveryId String   @unique          // X-GitHub-Delivery
  event      String
  action     String?
  receivedAt DateTime @default(now())

  @@map("webhook_event")
}
```

**Additions to `Repository`** (from the vision's metadata list):

```prisma
// add to model Repository
branch        String?      // default branch, e.g. "main"
language      String?
private       Boolean      @default(false)
stars         Int          @default(0)
forks         Int          @default(0)
size          Int          @default(0)
webhookSecret String?      // per-repo secret used to verify signatures
status        IndexStatus  @default(PENDING)
lastIndexedAt DateTime?
reviews       Review[]
health        RepositoryHealth[]
```

> Also delete the leftover `test` model while you're in here.

---

## 3. Webhook layer

Replace the stub with: **verify → dedup → fast-ack → enqueue.** Never do work inline in the request handler — GitHub times out at 10s and retries, which causes duplicate reviews.

```ts
// app/api/webhooks/github/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { inngest } from "@/inngest/client";

export async function POST(req: NextRequest) {
  const raw = await req.text();                 // must verify against the RAW body
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const event = req.headers.get("x-github-event");
  const deliveryId = req.headers.get("x-github-delivery")!;

  if (event === "ping") return NextResponse.json({ message: "pong" });
  if (event !== "pull_request") return NextResponse.json({ ok: true }); // ignore the rest for now

  const payload = JSON.parse(raw);
  const repo = await prisma.repository.findUnique({
    where: { githubID: BigInt(payload.repository.id) },
  });
  if (!repo?.webhookSecret || !verify(raw, sig, repo.webhookSecret)) {
    return NextResponse.json({ message: "invalid signature" }, { status: 401 });
  }

  // Only review meaningful actions
  if (!["opened", "synchronize", "reopened"].includes(payload.action)) {
    return NextResponse.json({ ok: true });
  }

  // Idempotency: swallow duplicate deliveries
  try {
    await prisma.webhookEvent.create({
      data: { deliveryId, event, action: payload.action },
    });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true }); // unique violation
  }

  await inngest.send({
    name: "pull_request.review_requested",
    data: {
      repositoryId: repo.id,
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      prNumber: payload.pull_request.number,
      headSha: payload.pull_request.head.sha,
      baseSha: payload.pull_request.base.sha,
      title: payload.pull_request.title,
      installationUserId: repo.userId,
    },
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}

function verify(body: string, sig: string, secret: string): boolean {
  const digest = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  return sig.length === digest.length &&
         crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
}
```

**`createWebHook` change:** generate a random secret per repo, store it on `Repository.webhookSecret`, and pass it in `config.secret`.

```ts
const secret = crypto.randomBytes(32).toString("hex");
await octokit.rest.repos.createWebhook({
  owner, repo,
  config: { url: webHookUrl, content_type: "json", secret },
  events: ["pull_request"],
});
// return secret so connectRepository can persist it on the Repository row
```

---

## 4. Inngest workflow: `reviewPullRequest`

Register alongside `indexRepository` in [`app/api/inngest/route.ts`](../app/api/inngest/route.ts). Each `step.run` is memoized on retry — lean on that for idempotency.

```ts
export const reviewPullRequest = inngest.createFunction(
  {
    id: "review-pull-request",
    concurrency: { limit: 3 },                          // cap parallel AI cost
    throttle: { limit: 20, period: "1m" },              // stay under GitHub/AI limits
    retries: 3,                                          // exponential backoff (Inngest default)
    idempotency: "event.data.repositoryId + '-' + event.data.headSha", // dedup re-deliveries
  },
  { event: "pull_request.review_requested" },
  async ({ event, step }) => {
    const { repositoryId, owner, repo, prNumber, headSha, baseSha, title } = event.data;

    const review = await step.run("create-review-row", () =>
      upsertQueuedReview({ repositoryId, prNumber, headSha, baseSha, title }));

    const token = await step.run("get-token", () => getRepoToken(repositoryId));

    // 1. changed files only
    const files = await step.run("fetch-diff", () =>
      getChangedFiles(token, owner, repo, baseSha, headSha)); // -> {path, patch, additions,...}[]

    const reviewable = files.filter(isReviewable); // skip binary/generated/lockfiles/deleted

    // 2. per-file review, bounded concurrency
    const findings = [];
    for (const file of reviewable) {
      const perFile = await step.run(`review-${file.path}`, async () => {
        const context = await reteriveContext(file.path + "\n" + file.patch, repositoryId, 5);
        return runFileReview({ file, context, prTitle: title }); // Gemini generateObject
      });
      findings.push(...perFile);
    }

    // 3. persist
    await step.run("persist", () => persistFindings(review.id, findings));

    // 4. post to GitHub
    await step.run("comment", () =>
      postReview(token, owner, repo, prNumber, headSha, review.id, findings));

    // 5. health snapshot
    await step.run("health", () => recomputeHealth(repositoryId));

    return { reviewId: review.id, findings: findings.length };
  },
);
```

Note the reuse of the existing [`reteriveContext`](../module/ai/lib/rag.ts) from `rag.ts` — the RAG layer you already built is the review engine's memory.

---

## 5. Diff & token strategy

The single biggest cost/quality lever. Rules:

- **Only changed files.** Fetch via `octokit.rest.pulls.listFiles` (gives `patch` per file) or `repos.compareCommits(base...head)`. Never embed or re-read the whole repo per PR.
- **Per-file (or per-hunk-group) model calls**, not one giant prompt. Keeps each call small, lets findings anchor precisely, and parallelizes.
- **Retrieve K≈5 similar chunks** per file from Pinecone to ground the review in repo conventions (auth patterns, error handling, naming). This is what makes the review feel like it *knows the codebase*.
- **Caps:** skip files with `patch` missing (binary), `> ~1,500` changed lines (summarize instead), or matching the ignore list. Cap total files per PR (e.g. 40) and note truncation in the summary — never silently drop.
- **Line anchoring gotcha:** GitHub only accepts inline comments on lines that appear in the diff hunks. Parse each hunk's `@@ -a,b +c,d @@` header, build the set of valid `(path, line, side)` targets, and **clamp every finding to the nearest valid line**. Findings that can't be anchored fold into the summary body instead of failing the whole review.

---

## 6. The review prompt & structured output

Use the AI SDK's `generateObject` with a zod schema so the model is forced into typed findings — no fragile parsing. Provider is already wired (`@ai-sdk/google` in [`rag.ts`](../module/ai/lib/rag.ts)); use a current Gemini model — e.g. `gemini-2.5-pro` for review quality, or `flash` for a cheaper first pass.

```ts
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const Finding = z.object({
  category: z.enum(["PERFORMANCE","SECURITY","ARCHITECTURE","MAINTAINABILITY",
                    "TESTING","READABILITY","NAMING","DOCUMENTATION"]),
  severity: z.enum(["CRITICAL","HIGH","MEDIUM","LOW","INFO"]),
  confidence: z.number().min(0).max(1),
  path: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int(),
  title: z.string(),
  reason: z.string(),        // why it's a problem
  impact: z.string(),        // what breaks / degrades
  suggestion: z.string(),    // what to do
  fixedExample: z.string().optional(), // corrected snippet
});

const ReviewResult = z.object({
  summary: z.string(),
  findings: z.array(Finding),
});

const { object, usage } = await generateObject({
  model: google("gemini-2.5-pro"),
  schema: ReviewResult,
  system: REVIEW_SYSTEM_PROMPT,
  prompt: buildPrompt({ file, context, prTitle }),
});
```

**Prompt principles that keep it from being noisy slop:**
- Give it the **diff with line numbers**, the **retrieved repo context**, and the **PR title** as intent.
- Instruct: *only comment on the changed lines*; *skip nitpicks the linter already catches*; *prefer fewer, high-signal findings*; *cite a concrete failure scenario, not vibes*.
- Require a **confidence** on every finding. **Only post `confidence ≥ 0.7 && severity ≥ LOW` inline**; store the rest for the dashboard. This threshold is your noise dial.
- Ask for a `fixedExample` only when a concrete fix is obvious — empty is better than hallucinated.

---

## 7. Posting comments to GitHub

One **PR review** with batched inline comments (not N separate comment calls — cleaner, one notification, atomic).

```ts
await octokit.rest.pulls.createReview({
  owner, repo, pull_number: prNumber, commit_id: headSha,
  event: "COMMENT",                       // never auto-approve/request-changes in v0
  body: summary,                          // the AI overview + score
  comments: postable.map(f => ({
    path: f.path,
    line: f.endLine,                      // or start_line/line for multi-line
    side: "RIGHT",
    body: renderComment(f),               // severity badge + reason + suggestion + fix
  })),
});
```

**Re-reviews on `synchronize`** (new commits pushed): the `@@unique([repositoryId, prNumber, headSha])` key means each commit gets its own review row — no duplicates for the same commit. Post a fresh review per new head SHA; optionally minimize the prior review's outdated comments. Keep v0 simple: new commit → new review.

---

## 8. Repository health scoring

Health is repo-level and rolls up recent review findings. Simple, explainable formula (avoid a black box):

```
per category:  score = clamp(100 - Σ (severityWeight × confidence × recencyDecay), 0, 100)

severityWeight:  CRITICAL 25 · HIGH 12 · MEDIUM 6 · LOW 2 · INFO 0
recencyDecay:    findings from older reviews count less (half-life ~30 days)
overall:         weighted avg (security & architecture weighted higher)
```

Snapshot into `RepositoryHealth` after each review → the timeline chart in Phase 4 is just `ORDER BY snapshotAt`. Wiring this now means the dashboard's faked `totalReview = 44` / `generateSampleReview()` in [`module/dashboard/actions`](../module/dashboard/actions/index.ts) get replaced with real queries.

---

## 9. Indexing changes this depends on

The review is only as good as retrieval. These upgrade the existing [`indexRepository`](../inngest/functions/index.ts) / [`rag.ts`](../module/ai/lib/rag.ts) — do them **after** the vertical slice works, driven by observed review quality:

1. **Git Trees API** instead of recursive `getContent` — one call gets the whole file list (`GET /repos/{o}/{r}/git/trees/{sha}?recursive=1`), then fetch blobs only for kept paths. Replaces the double-`getContent` walk.
2. **Ignore filter:** `node_modules`, `.next`, `dist`, `build`, `coverage`, `vendor`, `*.lock`, and binary extensions.
3. **Chunk by symbol, not whole file.** Parse into functions / classes / interfaces; embed each chunk with metadata `{ repo, branch, path, language, symbol, startLine, endLine, hash }`. Whole-file truncation at 10k chars (today's behavior) throws away large files and blurs retrieval.
4. **Incremental re-index on push:** store each chunk's content `hash`; on a push event, re-embed only chunks whose hash changed. Set `Repository.status`/`lastIndexedAt` as it runs so the UI can show progress.

---

## 10. Idempotency & reliability

| Concern | Mechanism |
|---|---|
| Duplicate webhook deliveries | `WebhookEvent.deliveryId` unique + `Review` unique `(repo, pr, headSha)` |
| Re-delivery mid-job | Inngest `idempotency` key on `repositoryId + headSha` |
| Partial failure | Each stage is a memoized `step.run` — retries resume, don't restart |
| GitHub / AI 5xx & rate limits | Inngest `retries: 3` w/ exponential backoff; `throttle` + `concurrency` caps |
| Token/secret missing | Fail the review row with `status: FAILED` + `error`, surface in UI (don't throw silently) |

---

## 11. Observability

Structured logging (Pino) with a consistent shape per job — this is a recruiter-visible differentiator:

```
{ userId, repositoryId, reviewId, prNumber, step, durationMs, tokensUsed, model, error? }
```

- Persist `tokensUsed` on `Review` (from `generateObject`'s `usage`) → cost dashboard later.
- Surface `ReviewStatus` (QUEUED→RUNNING→COMPLETED/FAILED) to the UI so users never wonder what's happening — pairs with the "Reviews" page the sidebar already links to but doesn't have yet.

---

## 12. Build order (milestones)

**Vertical slice first — one real review on this repo — then harden.**

- [ ] **M0 — Schema:** add models/enums above, migrate, drop `test`.
- [ ] **M1 — Webhook:** signature verify + secret on `createWebHook` + dedup + enqueue. Test with a real PR (GitHub redelivery UI).
- [ ] **M2 — Slice:** `reviewPullRequest` fetches diff → single Gemini call over changed files (naive retrieval) → posts one inline comment. **This is the milestone that proves the product.**
- [ ] **M3 — Structured findings:** zod schema, categories, severity, confidence threshold, persist `Review`+`Finding`.
- [ ] **M4 — Grounding:** per-file retrieval from Pinecone, line-anchoring, re-review on `synchronize`.
- [ ] **M5 — Health + Reviews page:** real dashboard numbers, health snapshots, review history.
- [ ] **M6 — Indexing hardening:** Git Trees, ignore filter, symbol chunking, incremental re-index.

Ship M2 before touching M6. You'll learn what chunking you actually need by watching M2's reviews be wrong.

---

## 13. Open decisions

- **Model:** `gemini-2.5-pro` (quality) vs `flash` (cost) for review — or flash for a first pass + pro for CRITICAL confirmation? Measure cost/review at M2.
- **Non-code PRs** (docs-only, config): review or skip? Suggest: skip inline, post a one-line summary.
- **Large PRs** (>40 files / >1,500 lines): summarize-only mode vs. per-file with a cap. Decide the UX.
- **Private repos & token scope:** current OAuth `repo` scope covers it; revisit a GitHub **App** (finer-grained, per-repo install, higher rate limits) before multi-tenant/team features (Phase 8).
- **Auto-verdict:** keep `event: "COMMENT"` in v0. Only consider `REQUEST_CHANGES` once false-positive rate is measured and low.
