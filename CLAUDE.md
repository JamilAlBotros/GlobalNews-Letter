# Claude Code — MVP Speed-with-Guardrails (TypeScript/Next.js/Fastify)

> **How to use this file**  
> - Paste the **System Prompt** section into Claude Code (Cursor IDE) as your repo’s guiding prompt.  
> - Keep the rest of the file in your repo (e.g., `docs/CLAUDE-CODE-MVP.md`) so you and Claude share one source of truth for rules, examples, prompts, and checklists.

---

## 1) System Prompt (Paste into Claude in Cursor)

You are a senior TypeScript engineer building MVP backend and frontend code for a startup.
Optimize for speed, but enforce these minimal guardrails:

**GENERAL**
- Node.js 20 LTS, TypeScript strict. Next.js 14+ (App Router) or Vite for FE. Fastify for BE.
- ESLint + Prettier defaults; keep functions <50 LOC; prefer stdlib and lightweight deps.
- Monorepo with workspaces; single `@acme/contracts` package is the source of truth.

**SECURITY**
- Production: HTTPS required. Local dev may use http://localhost only.
- Validate all inputs/outputs at boundaries with Zod.
- No secrets in code; use dotenv-safe with .env.example.
- Parameterized queries only; escape/encode output in UI.
- CORS allowlist (no wildcard in prod); basic per-IP rate limiting.

**ARCHITECTURE**
- Start as a modular monolith. Split modules only when scaling or velocity requires it.
- Use **OpenAPI (default)**; auto-generate TS clients from `@acme/contracts`.
- SQLite for MVP with WAL; plan Postgres migration via Prisma/Drizzle.
- Provide `/healthz` and `/readyz`; implement graceful shutdown.

**CORRECTNESS & RELIABILITY**
- async/await; centralized error middleware returning `application/problem+json`.
- Structured JSON logs with requestId and latency.
- Retries with backoff + jitter; never retry non-idempotent ops.
- Support `Idempotency-Key` on POSTs that can be retried.

**TESTS & DOCS**
- Unit tests for core logic; 1–2 integration tests per service (DB + HTTP).
- One smoke E2E for the golden user flow (optional for API-only).
- Short README: run, config, test; document env vars and endpoints.

**OUTPUT FORMAT**
- Provide file tree, code, test stubs, run commands.
- End with a conventional commit message summarizing the change.

**MANDATORY AUTO-COMMIT:**
After every code generation, you MUST provide:
1. Unified diffs for changed files
2. One conventional commit message  
3. This exact auto-commit block (item number 17)

---

## 2) Instruction Playbook (Where rules apply & how to run the team)

### Goals & Non‑Goals
**Goals**
- Ship a working end-to-end MVP quickly.
- One source of truth for API contracts.
- Code is small, readable, and testable.
- Enough ops/observability to debug quickly.

**Non‑Goals**
- Perfect architecture or exhaustive tests.
- Deep observability early.
- Premature microservices/infrastructure.

### Stack Defaults
- **Monorepo** (pnpm or npm workspaces): `apps/api`, `apps/web`, `packages/contracts`, `packages/core`.
- **Backend:** Fastify (Node 20, TS strict).
- **Frontend:** Next.js 14+ (App Router), React 18.
- **Contracts:** **OpenAPI as default**, generated from Zod.
- **Validation:** Zod at all boundaries (requests & responses).
- **DB:** SQLite for MVP (Prisma/Drizzle) with WAL & FKs; plan Postgres migration.

### Guardrails & Where They Apply
| Guardrail | What it does | Where it applies |
|---|---|---|
| HTTPS policy | TLS in staging/prod; allow `http://localhost` in dev | API proxy/edge; runtime check in API |
| Contract-first (OpenAPI) | One source of truth → generated TS client | `packages/contracts`; FE data layer |
| Standard error shape | `application/problem+json` for all errors | API error handler; FE error handling |
| Health & readiness | `/healthz` (liveness), `/readyz` (DB ready) | API routes; CI smoke tests; deploy checks |
| Graceful shutdown | Drain requests; close DB on SIGTERM/SIGINT | API process lifecycle |
| CORS allowlist | No wildcard in prod; explicit origins via env | API CORS middleware |
| Rate limiting | Per-IP token bucket | API onRequest hook/middleware |
| JWT hardening | Verify `iss`, `aud`, `exp` (short expiry) | API auth util; FE token rules |
| SQLite pragmas | WAL, FKs, synchronous=NORMAL | API DB init step |
| Idempotency-Key | Prevent duplicate side-effects on retried POSTs | API write routes; FE sends header |
| Structured logs | JSON with reqId/status/latency | API request/response hooks |
| Edge validation | Zod for inputs & outputs | API routes; use schemas in FE as needed |

### Security Baseline (Minimal but Critical)
- Prod/staging: **HTTPS only**. Dev: `http://localhost` allowed.
- **No secrets in code**; `dotenv-safe` with `.env.example`.
- **CORS allowlist** (no wildcard in prod) & **rate limiting**.
- Parameterized queries only; sanitize output.
- Redact sensitive fields (`password`, `token`) in logs.

### Architecture & Contracts
- Start as a **modular monolith**; split only when a module measurably blocks scale/velocity.
- **OpenAPI (REST)** is default. Generate server & client types from contracts.
- Keep functions **< 50 LOC**; prefer stdlib and lightweight deps.

### Reliability & Operations
- Error handling → `application/problem+json` (`type`, `title`, `status`, `detail`, `instance`).
- One-line JSON logs per request with `reqId`, method, path, status, latency.
- Retries with backoff+jitter for outbound calls; retry only idempotent ops.
- Graceful shutdown; `/healthz` & `/readyz` for deploy/CI.

### Performance Practices
- Use async I/O; avoid blocking the event loop.
- Cache only if it materially improves demo UX (short-TTL in-memory LRU).
- Keep DB transactions short; move heavy writes off hot paths.

### Testing Rules (MVP)
- Unit tests for core business logic.
- 1–2 integration tests per service (DB + HTTP).
- One smoke E2E for golden flow (optional for API-only).
- Use an isolated test DB (SQLite file); seed data as needed.

### Git & CI Hygiene
- Pin **Node 20** (`.nvmrc`, `engines`).
- CI: **contracts gen → lint → typecheck → tests**.
- Dependabot/Renovate optional; fail CI on **high severity** vulns only.
- **Conventional Commits** for clarity.

### PR Review Checklist (copy into template)
- [ ] Runs locally; README updated  
- [ ] Types/lint/tests pass; clients re-generated  
- [ ] No secrets committed; `.env.example` updated  
- [ ] Contract changes reflected in `@acme/contracts`; clients rebuilt  
- [ ] Zod validation at boundaries; errors are `problem+json`  
- [ ] `/healthz` & `/readyz` pass; graceful shutdown verified  
- [ ] CORS allowlist (no wildcard); rate limiting present  
- [ ] DB migrations included; backward-compatible if possible  
- [ ] Conventional commit message included  

### Definition of Done (MVP)
- End-to-end golden path works; demo-ready.
- `/healthz` & `/readyz` green in target env.
- Security basics in place (TLS policy, validation, no secrets).
- Minimal tests pass; README explains run/config/test.
- Clear commit history (Conventional Commits).

### Rollout Strategy
1) Monorepo with `api`, `web`, `contracts`, `core`.  
2) CI with **lint/typecheck/tests/contracts**.  
3) Use AI scaffolding; contracts are source of truth.  
4) Ship MVP; gather feedback; harden security, scale DB, split modules if needed.

### Environment & Config Policy
- **TLS:** Enforced at edge in prod/staging; backend rejects non-HTTPS when not in dev.
- **CORS:** Allowlist via env (`CORS_ORIGINS`). No wildcard in prod.
- **Rate limit:** Per-IP token bucket, configurable RPS.
- **JWT:** Verify `iss`, `aud`, `exp`; short `exp`; rotate keys per env; cookies (if used) `HttpOnly`, `Secure`, `SameSite=Lax`.
- **SQLite:** Apply `WAL`, `foreign_keys=ON`, `synchronous=NORMAL` at startup.
- **Idempotency:** Accept `Idempotency-Key` on retriable POSTs; short TTL cache of response.

---

## 3) Using this file with Claude in Cursor (How & What to feed)

**A. Load the rules & confirm understanding**
```
Use the rules in CLAUDE-CODE-MVP.md (System Prompt section) for all future changes.
Repository context loaded. Confirm with a short summary of the rules.
```

**B. Give concrete tasks with repo context (paths & outcomes)**
```
TASK: Implement a /projects resource mirroring /users.
- Contract-first: add schemas and path to @packages/contracts/src and src/openapi.ts
- Regenerate openapi.json and openapi.gen.ts
- Add Fastify routes in @apps/api/src/routes/projects.ts with Zod validation, Idempotency-Key, JWT auth
- Add typed calls in @apps/web/src/lib/api.ts and a Next.js page listing projects
- Include 1 integration test and update README
Output only changed files as unified diffs. Then propose a single Conventional Commit message.
```

**C. Ask for narrow diffs + commit message**
```
Output only changed files as unified diffs. Then propose a single Conventional Commit.
```

**D. Enforce guardrails during review**
```
Validate changes against the checklist in docs/CLAUDE-CODE-MVP.md.
Point out any gaps (CORS, rate limit, healthz/readyz, problem+json, etc.).
```

**E. Build/Run gates**
- contracts gen → lint → typecheck → tests → (optional) preview deploy.

---

## 4) Prompt Templates (Ready-to-paste)

**Scaffold new endpoint quickly**
```
Build a Fastify route for POST /widgets:
- Validate input with Zod (contracts package)
- Use Idempotency-Key and short 201 response
- Add one Vitest integration test with supertest
- Update OpenAPI in @acme/contracts and regenerate client
Output diffs + one Conventional Commit.
```

**Add logging & retries to an external call**
```
Wrap outbound call in @acme/core/src/retry.retry with 3 tries, base 200ms, jitter.
Log one JSON line with reqId, status, and latency.
Only retry on 5xx or network errors.
Output diffs + one Conventional Commit.
```

**Review vs PR checklist**
```
Validate against the PR checklist and list any missing items.
```

**Example Diff Ask**
```
Make the minimal changes needed to add a /projects resource.
Output only unified diffs for changed files. Then propose a single Conventional Commit.
```

---

## 5) Run Commands (Dev & Demo)
```bash
pnpm i
pnpm contracts:gen
pnpm --filter @acme/api prisma generate

# Dev servers
pnpm --filter @acme/api dev     # http://localhost:3333
pnpm --filter @acme/web dev     # http://localhost:3000

# Tests
pnpm -r test
```

---

## 6) CI Workflow (example)
```yaml
name: ci
on:
  push:
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
      - run: pnpm i --frozen-lockfile
      - run: pnpm contracts:gen
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm -r test
```

---

## 7) `.env.example` (example)
```bash
# Shared
NODE_ENV=development

# API
PORT=3333
DATABASE_URL="file:./dev.db"
JWT_SECRET="replace-me"
JWT_ISSUER="acme-auth"
JWT_AUDIENCE="acme-app"
CORS_ORIGINS="http://localhost:3000"
RATE_LIMIT_RPS=10

# Web
API_BASE_URL="http://localhost:3333"
NEXT_PUBLIC_DEMO_JWT="<optional dev token>"
```

---

## 8) Contracts (OpenAPI from Zod) — Examples

**`user.ts`**
```ts
import { z } from "zod";
export const User = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export const CreateUserInput = z.object({
  email: z.string().email(),
  name: z.string().min(1)
});
```

**`openapi.ts`** (register paths & generate `openapi.json`)
```ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { writeFileSync } from "node:fs";
import { User, CreateUserInput } from "./schemas/user.js";

const registry = new OpenAPIRegistry();
registry.register("User", User);
registry.register("CreateUserInput", CreateUserInput);

registry.registerPath({
  method: "get",
  path: "/users",
  responses: { 200: { description: "OK", content: { "application/json": { schema: { type: "array", items: User } } } } }
});

registry.registerPath({
  method: "post",
  path: "/users",
  request: { body: { content: { "application/json": { schema: CreateUserInput } } } },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: User } } },
    409: { description: "Conflict" }
  },
  security: [{ bearerAuth: [] }]
});

const generator = new OpenApiGeneratorV3(registry.definitions);
const doc = generator.generateDocument({
  openapi: "3.0.3",
  info: { title: "ACME MVP API", version: "0.1.0" },
  servers: [{ url: "https://api.example.com" }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } }
});

writeFileSync(new URL("../openapi.json", import.meta.url), JSON.stringify(doc, null, 2));
console.log("Generated openapi.json");
```

---

## 9) API Server Snippets (Fastify)

**A. Structured logging + reqId & latency**
```ts
app.addHook("onRequest", async (req, reply) => {
  (req as any).reqId = crypto.randomUUID();
  (reply as any).start = performance.now();
});
app.addHook("onResponse", async (req, reply) => {
  const ms = Math.round(performance.now() - (reply as any).start);
  console.log(JSON.stringify({
    ts: new Date().toISOString(), level: "info", msg: "req",
    reqId: (req as any).reqId, method: req.method, url: req.url, status: reply.statusCode, ms
  }));
});
```

**B. Error handler → `application/problem+json`**
```ts
app.setErrorHandler(async (err, req, reply) => {
  const status = (err as any).status ?? 500;
  const problem = { type: "about:blank", title: status >= 500 ? "Internal Server Error" : err.message, status, detail: (err as any).detail, instance: req.url };
  reply.code(status).type("application/problem+json").send(problem);
});
```

**C. CORS allowlist**
```ts
await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-side/curl
    const allowed = process.env.CORS_ORIGINS!.split(",").some((o) => origin.startsWith(o.trim()));
    cb(allowed ? null : new Error("CORS not allowed"), allowed);
  },
  credentials: true
});
```

**D. Simple per‑IP rate limiter**
```ts
const buckets = new Map<string, { tokens: number; ts: number }>();
const RPS = Number(process.env.RATE_LIMIT_RPS ?? 10);
app.addHook("onRequest", async (req) => {
  const now = Date.now();
  const capacity = RPS;
  const ip = req.ip || "unknown";
  const refillRate = RPS; // tokens/sec
  let b = buckets.get(ip) ?? { tokens: capacity, ts: now };
  const elapsed = (now - b.ts) / 1000;
  b.tokens = Math.min(capacity, b.tokens + elapsed * refillRate);
  b.ts = now;
  if (b.tokens < 1) throw Object.assign(new Error("Too Many Requests"), { status: 429 });
  b.tokens -= 1;
  buckets.set(ip, b);
});
```

**E. Health & readiness endpoints**
```ts
app.get("/healthz", async () => ({ ok: true }));
app.get("/readyz", async () => { await prisma.$queryRaw`SELECT 1;`; return { ready: true }; });
```

**F. Graceful shutdown**
```ts
const shutdown = async (sig: string) => { await app.close(); await prisma.$disconnect(); process.exit(0); };
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
```

**G. JWT verification (iss/aud/exp)**
```ts
import * as jose from "jose";
export async function verifyJwt(authz?: string) {
  if (!authz?.startsWith("Bearer ")) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const token = authz.slice(7);
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const { payload } = await jose.jwtVerify(token, secret, { issuer: process.env.JWT_ISSUER!, audience: process.env.JWT_AUDIENCE! });
  return payload;
}
```

**H. SQLite pragmas (stability)**
```ts
await prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;");
await prisma.$executeRawUnsafe("PRAGMA foreign_keys=ON;");
await prisma.$executeRawUnsafe("PRAGMA synchronous=NORMAL;");
```

---

## 10) Route Example with Idempotency-Key (POST /users)
```ts
app.post("/users", async (req, reply) => {
  await verifyJwt(req.headers.authorization);

  const idemKey = req.headers["idempotency-key"];
  if (typeof idemKey === "string") {
    const cached = getIdempotentResponse(idemKey);
    if (cached) return reply.code(cached.status).send(cached.body);
  }

  const body = CreateUserInput.safeParse(req.body);
  if (!body.success) throw Object.assign(new Error("Invalid input"), { status: 400, detail: body.error.message });

  const created = await prisma.user.create({ data: body.data });
  const response = { ...created, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() };

  if (typeof idemKey === "string") setIdempotentResponse(idemKey, 201, response);
  return reply.code(201).send(User.parse(response));
});
```

---

## 11) Next.js Client Examples

**A. Typed client from OpenAPI**
```ts
import createClient from "openapi-fetch";
import type { paths } from "@acme/contracts/openapi.gen";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3333";
if (typeof window === "undefined" && process.env.NODE_ENV !== "development" && !baseUrl.startsWith("https://")) {
  throw new Error("In non-dev, API_BASE_URL must be HTTPS.");
}

export const api = createClient<paths>({ baseUrl });
```

**B. React Query + Zod on form input**
```tsx
const createUser = useMutation({
  mutationFn: async (form: { email: string; name: string }) => {
    const parsed = CreateUserInput.parse(form);
    const idemKey = crypto.randomUUID();
    const { data, error } = await api.POST("/users", {
      body: parsed,
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_DEMO_JWT ?? ""}`,
        "Idempotency-Key": idemKey
      }
    });
    if (error) throw new Error("Failed to create user");
    return data;
  },
  onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] })
});
```

---

## 12) Vitest Examples

**API Integration Test (happy path)**
```ts
import { test, expect } from "vitest";
import Fastify from "fastify";
import { userRoutes } from "../src/routes/users.js";

const app = Fastify();
app.register(userRoutes);

test("GET /users empty", async () => {
  const res = await app.inject({ method: "GET", url: "/users" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual([]);
});
```

---

## 13) Health/Readiness Smoke Check (curl)
```bash
curl -sSf http://localhost:3333/healthz
curl -sSf http://localhost:3333/readyz
```

---

## 14) Conventional Commit Examples
```
feat(api): add users POST with idempotency, zod validation, and problem+json errors
chore(ci): run contracts generation before typecheck
fix(web): enforce https API_BASE_URL in non-dev to prevent mixed content
```

---

## 15) Versioning & Migration Policy
- Bump API `info.version` on breaking contract changes.
- Prefer additive migrations first; remove deprecated fields only after clients migrate.
- Maintain a short **CHANGELOG** at repo root.

---

## 16) Appendix: Terminology
- **Problem+JSON:** RFC 7807 error response format.
- **Idempotency key:** Client-provided token ensuring a retried request produces the same result once.
- **WAL (Write-Ahead Logging):** Improves SQLite concurrency and durability.


17) Git


```bash
#!/bin/bash
set -e
git add -A
[[ $(git diff --cached --name-only | grep -E "contracts/.*schemas|openapi\.ts") ]] && pnpm contracts:gen && git add contracts/
pnpm lint && pnpm typecheck && pnpm -r test
git commit -m "[YOUR_COMMIT_MESSAGE_HERE]"
echo "✅ Committed: $(git log -1 --oneline)"
```

Replace [YOUR_COMMIT_MESSAGE_HERE] with your conventional commit message.
Never generate code without this auto-commit block.
```

---

## Usage

**Claude generates code like this:**
````
## Changes
[unified diffs here]

## Auto-Commit
```bash
#!/bin/bash
set -e
git add -A
[[ $(git diff --cached --name-only | grep -E "contracts/.*schemas|openapi\.ts") ]] && pnpm contracts:gen && git add contracts/
pnpm lint && pnpm typecheck && pnpm -r test
git commit -m "feat(api): add user authentication with JWT middleware"
echo "✅ Committed: $(git log -1 --oneline)"
```
````

**You copy-paste and run the script to commit.**

---

## Setup (One-time)

**1. Make auto-commit executable:**
```bash
# Save this as scripts/auto-commit.sh
chmod +x scripts/auto-commit.sh
```

**2. Add to package.json:**
```json
{
  "scripts": {
    "commit": "./scripts/auto-commit.sh"
  }
}
```

**3. Update .gitignore:**
```
# Auto-commit logs
/tmp/*.log
```

---

## Script Template (`scripts/auto-commit.sh`)

```bash
#!/bin/bash
set -e

echo "🤖 Auto-committing Claude changes..."

# Add all changes
git add -A

# Regenerate contracts if schemas changed
if git diff --cached --name-only | grep -qE "contracts/.*schemas|openapi\.ts"; then
  echo "📋 Regenerating contracts..."
  pnpm contracts:gen
  git add packages/contracts/openapi.json packages/contracts/openapi.gen.ts
fi

# Validation gates
echo "🔍 Validating..."
pnpm lint || { echo "❌ Lint failed"; exit 1; }
pnpm typecheck || { echo "❌ TypeScript failed"; exit 1; }
pnpm -r test || { echo "❌ Tests failed"; exit 1; }

# Get commit message from argument or prompt
if [ -n "$1" ]; then
  commit_msg="$1"
else
  echo "Enter commit message:"
  read -r commit_msg
fi

# Commit
git commit -m "$commit_msg"
echo "✅ Committed: $(git log -1 --oneline)"

# Optional auto-push
[ "$AUTO_PUSH" = "true" ] && git push origin $(git branch --show-current)
```

---

## Examples

**Prompt Claude:**
```
Add POST /projects endpoint with Zod validation and JWT auth.
Include auto-commit block.
```

**Claude responds with code + this block:**
```bash
#!/bin/bash
set -e
git add -A
[[ $(git diff --cached --name-only | grep -E "contracts/.*schemas|openapi\.ts") ]] && pnpm contracts:gen && git add contracts/
pnpm lint && pnpm typecheck && pnpm -r test
git commit -m "feat(api): add projects POST endpoint with auth and validation"
echo "✅ Committed: $(git log -1 --oneline)"
```

**You run it:**
```bash
# Copy-paste Claude's script and run it
bash -c "[paste script here]"

# OR use the reusable script
./scripts/auto-commit.sh "feat(api): add projects POST endpoint with auth and validation"
```

---

## Safety

- **Validation gates**: Won't commit if lint/typecheck/tests fail
- **Local only**: No auto-push unless `AUTO_PUSH=true`
- **Easy rollback**: `git reset HEAD~1` if needed
- **Contract sync**: Auto-regenerates OpenAPI files

---

## Integration Tips

**Enable auto-push (optional):**
```bash
export AUTO_PUSH=true
./scripts/auto-commit.sh "feat: add new feature"
```

**Cursor command:**
```json
{
  "cursor.chat.customCommands": [
    {
      "name": "Code + Auto-Commit",
      "template": "Generate code for: {selection}\nInclude auto-commit block following MVP rules."
    }
  ]
}
```

**Validation only:**
```bash
# Check if current changes would pass validation
pnpm lint && pnpm typecheck && pnpm -r test && echo "✅ Ready to commit"
```
