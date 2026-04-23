<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0  (MINOR: substantive rewrite — full translation of
the constitution from Traditional Chinese to English, restating Principle I so
that it is expressed *in English* while still mandating Traditional Chinese for
all specifications, plans, and user-facing documentation; wording of
Principle II tightened to explicitly name OpenAPI 3.2 as the required version.)

Modified principles:
  - I. Traditional Chinese Documentation        (reworded, scope clarified)
  - II. OpenAPI 3.2 Contract-First              (reworded, version pinned)
  - III. TypeScript Strict Full-Stack           (reworded)
  - IV. Secure by Default                       (reworded)
  - V. Reproducible Containerised Deployment    (reworded)

Added sections: none (structure preserved)
Removed sections: none

Templates requiring updates:
  ⚠ .specify/templates/plan-template.md       — update "Constitution Check"
    block to reference v1.1.0 (body text of the checklist may remain in
    Traditional Chinese per Principle I, since plan.md outputs are
    user-facing documents).
  ✅ .specify/templates/spec-template.md       — structural, no change needed.
  ✅ .specify/templates/tasks-template.md      — structural, no change needed.
  ✅ .specify/templates/checklist-template.md  — structural, no change needed.
  ✅ .specify/templates/constitution-template.md — template placeholders
    unchanged.

Follow-up TODOs:
  - On next plan.md generation, reviewers MUST confirm the "依據
    `.specify/memory/constitution.md` v1.0.0" reference is bumped to v1.1.0.
-->

# VitaShelf Constitution

> **Language note.** This constitution is written in English by design. It
> governs a product and documentation stack whose user-facing deliverables are
> Traditional Chinese (see Principle I). The constitution itself is kept in
> English so that its normative language is unambiguous and independent of the
> zh-TW style decisions that apply to everything it governs.

## Core Principles

### I. Traditional Chinese Documentation (NON-NEGOTIABLE)

All **specifications**, **implementation plans**, **tasks**, **checklists**,
**quickstarts**, **research notes**, **changelogs**, **UI copy**,
`README.md`, `SRS.md`, API reference prose, and any other artefact that is
read by end users (including external developers and operators) **MUST** be
written in **Traditional Chinese (zh-TW)**.

The following are explicitly **out of scope** of this rule and MAY be written
in English:

- This constitution file itself.
- Source-code identifiers, type names, file names, and inline technical
  comments required by tooling (e.g. JSDoc tags, TypeScript type names).
- Test names and `describe` / `it` strings where English improves tooling
  legibility.
- Commit titles (Conventional Commits prefixes such as `feat:`, `fix:`).
  Commit bodies and PR titles / descriptions **SHOULD** still be zh-TW.

Translations to other languages are permitted as additional, clearly-marked
artefacts; they **MUST NOT** replace or precede the zh-TW source of truth.

*Rationale.* The primary user base is the Traditional Chinese-reading market.
Maintaining parallel English/zh-TW primary documentation has, in past
projects, caused translation drift and maintenance overhead without
corresponding benefit.

### II. OpenAPI 3.2 Contract-First (NON-NEGOTIABLE)

Every HTTP / REST interface **MUST** be defined as an **OpenAPI 3.2**
specification **before** implementation. Spec files **MUST** live under
`specs/[###-feature]/contracts/` for per-feature contracts, or under a
project-wide `openapi/` directory for shared interfaces.

- Adding a new endpoint, changing its path or signature, changing a status
  code, or adjusting a schema field **MUST** be reflected in the OpenAPI
  spec, and the spec update **MUST** ship in the **same pull request** as the
  implementation.
- An endpoint implementation **MUST NOT** be merged without a corresponding
  entry in the OpenAPI spec.
- The spec file's `openapi:` field **MUST** be exactly `3.2.x`. Lower
  versions (3.0.x / 3.1.x) are not permitted in this project.
- OpenAPI 3.2 features that are idiomatic (webhooks, strengthened
  `discriminator`, refined schema composition) **SHOULD** be preferred over
  ad-hoc extensions when they fit.

*Rationale.* A single contractual source of truth enables mechanical
validation of frontend and backend, generation of client / server stubs, and
lower-friction integration with third parties. OpenAPI 3.2 brings webhooks,
stronger discriminator semantics, and more precise schema composition, which
this project deliberately adopts.

### III. TypeScript Strict Full-Stack

Both frontend and backend **MUST** be written in TypeScript. Each
`tsconfig.json` **MUST** enable `strict: true` (which transitively enables
`noImplicitAny`, `strictNullChecks`, and related flags). `noUncheckedIndexedAccess`
is **RECOMMENDED**.

- Any use of `any` **MUST** carry an inline comment justifying why a precise
  type is not feasible.
- Types that cross a public boundary — HTTP request/response, Prisma model
  reads, cross-module function signatures — **MUST** be derived from
  generated sources (OpenAPI-generated types, Prisma Client types, or
  zod-inferred types) rather than hand-written `interface`s that duplicate
  the shape unilaterally.

*Rationale.* A shared language across the stack reduces boundary mistakes;
`strict` catches the null/undefined class of runtime crashes at compile time.

### IV. Secure by Default

Code that touches secrets, authentication, authorisation, rate-limiting, or
external input **MUST** obey the following baseline:

- **Secrets** are never hard-coded or committed. The container **MUST**
  refuse to start in production when required variables (e.g. `JWT_SECRET`)
  are missing or empty.
- **Rate limiting.** Every Express `Router` that handles external requests
  **MUST** apply `rateLimit` middleware. An inline `router.use(rateLimit(...))`
  declaration inside the router file is acceptable and satisfies CodeQL's
  `js/missing-rate-limiting` rule.
- **External input validation.** All query params, request bodies, uploaded
  files, and parsed CSV rows **MUST** be validated for structure, type, and
  size limits. CSV parsers **MUST** bound their iteration (row cap, cell
  cap) to prevent denial-of-service via crafted input.
- **Static analysis.** High- and critical-severity CodeQL findings,
  dependency-audit findings, and secret-scan findings **MUST** be resolved
  before merge, or explicitly waived with a documented risk statement.
- **Application-layer encryption.** Sensitive fields **SHOULD** be encrypted
  using `DB_ENCRYPTION_KEY` where available.

*Rationale.* PRs #15–#19 retrofitted rate limiting and a CSV parser loop
bound after CodeQL surfaced the gaps. This principle promotes those fixes
from one-off patches into a standing gate.

### V. Reproducible Containerised Deployment

All environments — local development, CI, and production — **MUST** be
launched via `docker compose` with the appropriate compose file. The project
keeps a **single image** (Nginx + Node.js) and relies on
`docker-entrypoint.sh` to run migrations before starting the server.

- Any change to infrastructure behaviour **MUST** be reflected synchronously
  across the compose files, `docker-entrypoint.sh`, `.env.example`,
  `nginx.conf`, and the startup instructions in `README.md`.
- Steps that must be executed *outside* the container by a human operator
  in order for the system to function **MUST NOT** be introduced; if such a
  step is unavoidable, it **MUST** be documented in `README.md` and
  justified in the accompanying plan.

*Rationale.* Single-image + compose is the deployed topology. Splitting the
image, or externalising migrations, breaks the "GitHub Actions → Docker Hub
/ GHCR → production" chain and its single-step deploy guarantee.

## Technical Constraints

- **Runtime.** Node.js ≥ 20; Vite 6 builds the frontend; Nginx is the
  reverse proxy.
- **Data access.** Prisma ORM. The current datastore is **SQLite**, persisted
  via a Docker volume at `/app/data/vitashelf.db` (see commits 651c456 and
  the v2.4.0 migration). PostgreSQL is no longer supported as a target;
  re-adopting it would require a constitution amendment. Schema changes
  **MUST** produce a Prisma migration and be applied by
  `docker-entrypoint.sh` on container start.
- **API tooling.** OpenAPI **3.2**. Recommended validators:
  `@redocly/cli` or `swagger-cli`. Recommended type generator:
  `openapi-typescript` (or an equivalent that supports OpenAPI 3.2). Spec
  linting **MUST** run in CI.
- **Frontend stack.** React 19 + React Router 7 + Tailwind CSS 4 +
  Recharts 3. The PWA manifest **MUST** be updated when user-visible
  identity (name, icons, theme colour) changes.
- **Audit and observability.** Login events **MUST** be written to the
  audit table (`LoginLog`). Frontend errors **MUST** be caught by a React
  Error Boundary. Backend errors **MUST** be logged in a structured format.
- **Versioning.** Application version is tracked in `VERSION` and
  `changelog.json`. The constitution version is independent of the
  application version.

## Development Workflow

1. **Spec-driven flow.** New features pass through
   `/speckit.specify` → `/speckit.clarify` (when needed) →
   `/speckit.plan` → `/speckit.tasks` →
   (optionally `/speckit.analyze` / `/speckit.checklist`) →
   `/speckit.implement`.
2. **Branch naming.** Feature branches use `###-feature-name`, created by
   `/speckit.specify`.
3. **Merge gates** (ALL **MUST** pass before merge):
   - CI green (lint, typecheck, build, test).
   - No high- or critical-severity CodeQL findings (or explicit waiver).
   - OpenAPI spec lint passes.
   - For any new or changed endpoint, the OpenAPI document, contract test,
     and implementation **MUST** all appear in the same PR.
   - All new or modified user-facing documentation is in Traditional
     Chinese per Principle I.
4. **Commit and PR messages.** Commit titles use Conventional Commits
   prefixes (`feat:`, `fix:`, `docs:`, …). Commit bodies and PR titles /
   descriptions are in Traditional Chinese and explain the *why*, not just
   the *what*.
5. **Documentation sync.** Any change that alters user-visible behaviour
   **MUST** update `README.md`, `SRS.md`, and `changelog.json`, and bump the
   application version per semantic versioning.

## Governance

This constitution supersedes other development conventions and project
documents. When any template (plan, spec, tasks, checklist) or agent prompt
conflicts with this constitution, the constitution wins; the conflicting
document **MUST** be updated in the next amendment cycle.

**Amendment procedure.** A constitution amendment PR **MUST** include:

1. The reason for the change.
2. The version-bump classification and its justification.
3. Synchronised updates to downstream templates and prompts.
4. An updated "Sync Impact Report" block at the top of this file.

**Versioning rules** (semantic versioning applied to governance):

- **MAJOR.** Removal or backwards-incompatible redefinition of an existing
  principle; changes that rewrite the governance core (e.g. dropping the
  NON-NEGOTIABLE marker on a principle).
- **MINOR.** Addition of a new principle, addition of a new section, or
  substantive expansion / structural rewrite of an existing principle.
- **PATCH.** Wording clarification, typo fixes, and non-semantic edits.

**Compliance review.** PR reviewers **MUST** determine whether a change
affects a constitutional principle. If it does and the constitution has not
been updated accordingly, the PR **MUST** be blocked until the amendment
procedure is followed.

**Runtime guidance.** Day-to-day developer guidance (tooling, scripts,
environment variables, operational notes) lives in `README.md`, `SRS.md`,
and `CLAUDE.md`. This constitution defines only the non-negotiable
principles and the merge gates.

**Version**: 1.1.0 | **Ratified**: 2026-04-23 | **Last Amended**: 2026-04-23
