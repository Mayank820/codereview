# CLAUDE.md

## Project

**Name:** CodeReview (working title: ReviewForge)

AI-powered GitHub engineering platform that analyzes repositories and pull requests using Retrieval-Augmented Generation (RAG), vector search, and LLMs.

The goal is **not** to build another ChatGPT wrapper. The goal is to build an engineering productivity platform similar to GitHub Copilot Reviews, SonarQube, and CodeRabbit.

---

# Primary Objectives

1. Connect GitHub repositories.
2. Index repositories into Pinecone.
3. Automatically analyze pull requests.
4. Persist review history.
5. Track repository health over time.
6. Provide actionable engineering insights.

Always optimize for maintainability, scalability, and clean architecture.

---

# Tech Stack

* Next.js 16 (App Router)
* React 19
* TypeScript
* Tailwind CSS v4
* shadcn/ui
* Prisma 7
* PostgreSQL
* Better Auth
* Octokit
* Pinecone
* Google Gemini
* Vercel AI SDK
* Inngest
* TanStack Query
* pnpm

---

# Architecture Rules

## Business logic

Business logic belongs inside `module/`.

Never place business logic inside pages.

---

## UI

UI components should remain presentation-only.

Avoid database calls inside React components.

---

## Server Actions

Server Actions are the primary API.

Prefer Server Actions over REST endpoints unless webhooks or third-party integrations require HTTP routes.

---

## Async Work

Any expensive task must run through Inngest.

Examples:

* repository indexing
* embedding generation
* AI reviews
* report generation
* repository synchronization

Never execute long-running work inside a request lifecycle.

---

## Database

Prisma is the single source of truth.

Never bypass Prisma.

Use transactions when modifying multiple related models.

---

## AI

LLM calls should never directly consume an entire repository.

Preferred pipeline:

Repository → File Extraction → Chunking → Embeddings → Pinecone → Context Retrieval → LLM

Always retrieve relevant context before prompting.

---

## GitHub

GitHub is the source of repository state.

Store only metadata and generated artifacts.

Never duplicate repository contents unnecessarily.

---

# Coding Standards

* Strict TypeScript
* Avoid `any`
* Prefer functional composition
* Keep functions small
* Prefer dependency injection where appropriate
* Never silently swallow errors
* Validate all external input
* Use Zod for runtime validation
* Keep files focused on one responsibility

---

# Performance Rules

* Cache GitHub API responses where possible
* Avoid duplicate API requests
* Use Git Trees API instead of recursive content fetching when feasible
* Exclude generated directories (`node_modules`, `.next`, `dist`, `coverage`, build artifacts)
* Batch embedding requests
* Minimize LLM token usage

---

# Security Rules

Mandatory:

* Verify GitHub webhook signatures
* Never expose API keys
* Never trust webhook payloads without verification
* Validate repository ownership
* Enforce authentication on protected actions

---

# Feature Priorities

## Phase 1

* Repository connection
* GitHub OAuth
* Repository indexing
* Pull Request reviews
* Dashboard
* Review persistence

## Phase 2

* Repository health score
* Review history
* Metrics
* Technical debt detection
* Dependency analysis

## Phase 3

* AI documentation
* Architecture diagrams
* Team collaboration
* Weekly reports
* Billing and subscriptions

---

# Repository Structure

* `app/` — routing only
* `module/` — domain logic
* `lib/` — shared infrastructure
* `components/` — reusable UI
* `prisma/` — schema and migrations
* `inngest/` — background jobs

Keep domain boundaries clear.

---

# Code Review Principles

Every AI review should evaluate:

* Performance
* Security
* Maintainability
* Readability
* Architecture
* Best Practices
* Testing
* Documentation

Each finding should include:

* Severity
* Explanation
* Suggested fix
* Confidence score

---

# Definition of Done

A feature is complete only when it includes:

* Type-safe implementation
* Error handling
* Loading and empty states
* Tests where appropriate
* Documentation updates
* No unused code
* No `TODO` placeholders without linked issues

Prioritize production-quality engineering over shipping incomplete features.
