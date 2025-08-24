
# VS Code Hybrid Coding Playbook — Premium + Local LLM (TypeScript, Microservices)

**Audience:** Startups shipping fast (MVP) with a path to production scale.  
**Editor/Stack:** VS Code • TypeScript (Node 20 + React/Next.js) • Microservices • SQLite (MVP) → Postgres (scale).  
**Models:** Premium = Claude (Senior). Local = CoderLlama‑7B (Junior) via **Ollama**.  
**Goal:** Speed with guardrails. Senior writes precise specs; Junior implements diffs. Commits + README updates are generated automatically per slice.

---

## 0) Quick Start

1. **Install** VS Code + extensions you prefer (LLM chat, Git, testing).  
2. **Run Local Model (Ollama):**
   ```bash
   # Install Ollama first, then pull a 7B coder model
   ollama pull codellama:7b
   # Start serving (Ollama runs a local server on 11434)
   # No extra step typically required; your client/extension connects to Ollama.
   ```
3. **Premium Model:** Use Claude in the web/app or an IDE plugin.
4. **Monorepo (recommended):** `apps/backend`, `apps/frontend`, `packages/contracts`, `packages/tsconfig`.
5. **Workflow Loop:** Ask Senior (Claude) for a *JuniorSpec* → paste to Junior (CoderLlama) → apply diffs → run tests → commit + README update.

---

## 1) Senior & Junior Roles (Two‑Model Loop)

### Senior (Premium — Claude): System Prompt (Paste once per session)
> Acts as **Tech Lead**: decomposes work into small, testable tasks for the Junior. Produces **one** YAML `JuniorSpec` per slice, with minimal context and exact acceptance criteria.

```yaml
# Senior Engineer (Premium) — System Prompt
role: "Senior Tech Lead"
objectives:
  - Ship small slices quickly and safely.
  - Provide precise, testable instructions to a local 7B "Junior" with a short context window.
rules:
  - Do NOT implement the whole feature; produce a single JuniorSpec per request.
  - Constrain context: include only trimmed code around anchors.
  - Always define acceptance criteria and a micro test plan.
  - Target ≤2 files, ≤150 changed lines, ≤1 new dependency per slice.
  - Use exact file paths, function signatures, types, and step-by-step plan.
output_format: "Return exactly one YAML block named JuniorSpec. No extra prose."
JuniorSpec_schema:
  title: "<short task name>"
  rationale:
    - "<1–3 bullets why this change is needed>"
  files:
    - path: "<relative/path.ext>"
      intent: "<create|edit|delete>"
      anchors:
        - "<unique comment or line to locate insertion point>"
      outline: |
        "<very short outline of the change in this file>"
      code_context: |
        "<only the essential surrounding code (trimmed)>"
  functions:
    - name: "<func or class>"
      signature: "<signature>"
      description: "<what it does>"
      inputs:
        - name: "<param>"  type: "<type>"  notes: "<validation/edge cases>"
      outputs: "<type/shape>"
      edge_cases:
        - "<case>"
        - "<case>"
      examples:
        - input: "<...>"
          output: "<...>"
  acceptance_criteria:
    - "<criterion 1>"
    - "<criterion 2>"
  test_plan:
    unit_tests:
      - name: "<test name>"
        steps:
          - "<setup>"
          - "<act>"
          - "<assert>"
    notes: "<fixtures/mocks>"
  standards:
    language: "TypeScript (strict)"
    style: "ESLint + Prettier"
    error_handling: "No silent failures; typed errors"
    performance: "Avoid O(n^2) on large inputs"
  constraints:
    max_changed_lines: 150
    avoid:
      - "breaking public API"
      - "editing more than 2 files"
  step_by_step_for_junior:
    - "<step 1>"
    - "<step 2>"
    - "<step 3>"
  expected_output_from_junior:
    format: "unified diff (git-style) + NEW FILE contents"
    notes: "No prose outside code/diff blocks"
clarifications_needed: []
```

### Junior (Local — CoderLlama‑7B via Ollama): System Prompt (Paste once per session)
> Acts as **Mid/Junior implementer**. Receives a single `JuniorSpec` YAML, outputs only diffs & new files. Keeps patches tiny and focused. Runs a self‑check mentally before output.

```yaml
# Mid/Junior Engineer (Local 7B) — System Prompt
role: "Mid-Level Implementer"
input: "Exactly one YAML block named JuniorSpec."
rules:
  - Follow the JuniorSpec precisely. If ambiguous, choose the smallest reasonable option and mark TODO.
  - Keep the patch minimal; no refactors beyond the spec.
  - Maintain style/lint rules from the spec.
  - Add/modify tests per test_plan.
  - Output strictly: diffs for edits, '=== NEW FILE: <path> ===' + contents for new files. No extra prose.
self_checklist:
  - "All paths exist/created"
  - "All functions/signatures implemented"
  - "Imports and tests compile"
  - "No placeholders left"
  - "Acceptance criteria appear satisfied"
  - "Patch applies around anchors"
output:
  edits: "Unified diff (git-style)"
  new_files_header: "=== NEW FILE: <relative/path.ext> ==="
```

### Handoff Message (What you paste into the local model each slice)
```text
You are the junior implementer. Implement the following spec exactly and return ONLY diffs and any NEW FILE contents.

<PASTE THE YAML JuniorSpec FROM SENIOR HERE>

Remember:
- Keep changes minimal and focused on this spec.
- Output unified diffs for edits.
- For new files, print:
  === NEW FILE: <path> ===
  <file contents>
No prose outside code/diff blocks.
```

---

## 2) VS Code Flow (Per Slice)

1) **Ask Senior** for a `JuniorSpec` for the next tiny slice.  
2) **Paste** that YAML into the **Junior** model (Ollama → CoderLlama‑7B).  
3) **Apply** diffs/new files in VS Code.  
4) **Run** `pnpm lint && pnpm typecheck && pnpm test`.  
5) **Commit + README update (who does what):**
   - **Junior** generates: a short **Conventional Commit** message (`feat|fix|chore|docs|test|refactor|perf`) + a minimal README delta for the change (e.g., usage snippet or endpoint note).
   - You apply the message and README edit locally:
     ```bash
     git add -A
     git commit -m "feat(scope): short description"
     git push
     ```
   - **Senior** reviews in the next slice if needed (no extra git automation required).

---

## 3) Model Settings (Local 7B via Ollama)

- **Model:** `codellama:7b` (or other 7B code model you trust).
- **Hardware:** 16 GB RAM + ~8 GB NVIDIA GPU (adjust if you have more).
- **Context Window:** Start with **8k–12k** tokens for the local 7B to keep latency/memory sane. (You can try 16k if stable.)
- **Prompting Tips:**
  - Keep `JuniorSpec` compact; include only trimmed code around anchors.
  - Avoid pasting huge files; link to file paths and include the 20–60 lines that matter.
  - If the patch gets too large, split into another slice.

---

## 4) Project Mode — MVP vs Scale‑Up

### MVP Track (move fast)
- **Backend:** Fastify (or NestJS if you want scaffolding). SQLite via Prisma/Drizzle. JWT auth (short expiry). Simple error middleware.  
- **Frontend:** Next.js (app router). React Query/RTK Query. Zod validation. Minimal CSP (nonces if you render untrusted HTML).  
- **Security (minimum viable):** HTTPS only, input validation, parameterized queries, no secrets in repo, `npm audit` check.  
- **Tests:** Core unit tests + 1–2 integration tests. Smoke e2e for the critical flow.  
- **CI:** Lint, type‑check, unit tests. Optional preview deploys (Vercel/Heroku).  
- **SQLite Policy:** Allowed for MVP persistence. Maintain a **migration note** to Postgres (connection string, schema, and migration steps).

### Scale‑Up Track (harden & grow)
- **Architecture:** True microservices with a gateway. Each service owns its DB (Postgres). No cross‑service DB access. Contracts‑first (OpenAPI/gRPC).  
- **Security:** mTLS for internal calls + short‑lived JWTs with `iss/aud/exp/kid` validated via JWKs; OIDC for users; strict CORS; CSP nonces; CSRF for cookie flows; secrets from vault.  
- **Resilience:** Timeouts, retries with jitter (idempotent only), circuit breakers, bulkheads.  
- **Observability:** OpenTelemetry for traces/metrics/logs; correlation IDs; RED/USE dashboards.  
- **Data:** Schema evolution via expand‑and‑contract; event versioning; Testcontainers in CI.  
- **CI Gates:** SAST (CodeQL), dependency audit, SBOM, commit message lint. SQLite limited to tests/dev only.

---

## 5) Repo Skeleton (Monorepo)

```
.
├─ apps/
│  ├─ backend/                 # Fastify/NestJS service (MVP: SQLite; Scale: Postgres)
│  └─ frontend/                # Next.js app (React Query, generated client)
├─ packages/
│  ├─ contracts/               # OpenAPI/Protobuf + codegen
│  └─ tsconfig/                # Shared tsconfig
├─ .github/
│  └─ pull_request_template.md # Uses the checklist below
├─ package.json                # pnpm workspaces + scripts
└─ README.md                   # Updated each slice by the Junior
```

**Workspace Scripts**
```json
{
  "scripts": {
    "lint": "pnpm -r eslint .",
    "typecheck": "pnpm -r tsc -b",
    "test": "pnpm -r vitest run",
    "build": "pnpm -r build"
  }
}
```

---

## 6) PR Checklist (Copy into `.github/pull_request_template.md`)

- [ ] API contract defined/updated (if applicable) and client regenerated
- [ ] Inputs validated (Zod)
- [ ] No hardcoded secrets; HTTPS enforced
- [ ] SQLite acceptable for MVP (migration plan noted) / Postgres for scale
- [ ] Minimal tests added/updated (unit + integration)
- [ ] README updated with user/dev facing notes
- [ ] CI checks green
- [ ] **Commits follow Conventional Commits (feat|fix|chore|docs|test|refactor|perf)**

---

## 7) Ready‑to‑Paste Prompts (for day‑to‑day use)

### Ask Senior to produce a spec
```text
I want to: <describe change>. Produce ONE JuniorSpec YAML per your format. Keep it to ≤2 files and ≤150 changed lines. Include anchors and a minimal test plan.
```

### Ask Junior to implement (paste the YAML spec)
```text
Implement the spec below and return ONLY diffs and NEW FILE contents, no prose:

<JuniorSpec YAML here>
```

### Commit message & README delta (generated by Junior)
```text
Generate a short Conventional Commit message for the patch you just produced, and a minimal README snippet (1–5 lines) reflecting the change (usage, endpoint, or config). Do not suggest other git actions.
```

---

## 8) Appendix — Security & Data (Cheat Sheet)

- **Transport:** TLS 1.2+ (ideally 1.3). HSTS on public hosts.  
- **Auth:** OIDC for users (scale), JWT for services; refresh tokens as httpOnly cookies (frontend).  
- **CORS:** Deny by default; allowlist env-specific origins.  
- **CSP:** Nonces for inline; no unsanitized `dangerouslySetInnerHTML`.  
- **Secret Management:** `.env` in dev only; secrets in vault for prod.  
- **SQLite → Postgres Migration (high level):** Create Postgres schema; dual‑write if needed; backfill; cut traffic; retire SQLite.

---

## 9) FAQ

- **Why two models?** Senior (premium) excels at decomposition and standards; Junior (local) implements quickly with privacy and zero cost per token.  
- **What if the patch is too big?** Ask Senior to slice thinner.  
- **Who commits?** The **Junior** generates the commit message + README delta; you run the `git` commands locally and push.  
- **Context too long?** Trim `code_context` aggressively; aim for ≤12k tokens to fit 7B memory/latency constraints.

---

## 10) Definition of Done (Per Slice)

- JuniorSpec delivered and implemented
- Lint/type/tests pass locally
- README updated minimally
- Conventional commit created and pushed
- MVP: feature demoable • Scale: contracts & telemetry in place
