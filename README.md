# Flowcraft — Visual Workflow Builder with Durable Execution

Flowcraft is a lightweight, no-code workflow builder (think a tiny Zapier/n8n):
drag nodes onto a canvas, wire them into a flow (**trigger → action → condition →
action**), save it, and Flowcraft runs it **durably** — surviving restarts,
retrying failed steps, and sleeping through multi-hour delays without holding a
worker — with a run-history UI showing exactly what happened at each step.

> Portfolio focus: real canvas/drag-and-drop engineering (**React Flow**) paired
> with a genuine durable-execution backend (**Inngest**).

---

## The core idea: compiling a graph into an Inngest function

The interesting architecture is how a saved visual graph becomes durable
execution ([apps/api/src/inngest/graph-interpreter.ts](apps/api/src/inngest/graph-interpreter.ts)):

1. A workflow is stored as React Flow's serialized `{ nodes, edges }` JSON.
2. On trigger, **one Inngest function** (`execute-workflow`) loads that graph and
   walks it from the trigger node.
3. Each node is compiled to an Inngest **step**:
   - **action** → `step.run("node-<id>", …)` — durable, retried on failure. The
     body records the `run_steps` row and, on error, records the failed attempt
     and rethrows so Inngest retries. Retries increment `attempts` in place.
   - **delay** → `step.sleep("sleep-<id>", "5m")` — the whole reason to reach for
     Inngest: it survives process restarts and holds no worker for hours.
   - **condition** → `step.run(...)` evaluates the comparison; only the matching
     `true`/`false` branch is walked, so the untaken branch's nodes are marked
     `skipped`.
4. Every step writes to `run_steps` **inside the step body**, so Inngest's replay
   never double-writes — that history powers the run-timeline UI.

Because delays are `step.sleep` and failures are step retries, the durability is
real, not a `setTimeout` + `try/catch` imitation.

---

## Stack

| Concern | Choice |
|---|---|
| Canvas | **React Flow** (`@xyflow/react`) — node/edge graph editing |
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind |
| Backend | NestJS, TypeScript |
| Durable execution | **Inngest** — steps, `step.sleep`, retries, cron |
| Database | PostgreSQL (Prisma) — workflow defs + run history |
| Types | `@flowcraft/shared-types` — one graph/node contract shared by web + api |

## Monorepo

```
flowcraft/
  apps/
    web/    # canvas editor + run history (Next.js)
    api/    # NestJS: workflow CRUD, run history, and the Inngest engine
      src/inngest/{client,functions,graph-interpreter}.ts
  packages/
    shared-types/   # node/graph/run types + the node-template registry
  docker-compose.yml  # Postgres on :5435
```

## Run locally ($0, fully offline)

Prereqs: Node 20+, pnpm 10+, Docker Desktop.

```bash
pnpm install
pnpm infra:up                                   # Postgres on :5435
cp .env.example .env
pnpm --filter @flowcraft/api prisma:migrate     # create schema
pnpm --filter @flowcraft/api prisma:seed        # node templates + a demo flow

# three terminals:
npx inngest-cli@latest dev -u http://localhost:3002/api/inngest   # Inngest dev server
pnpm --filter @flowcraft/api dev                # API on :3002
pnpm --filter @flowcraft/web dev                # web on :3003
```

Open `http://localhost:3003`, open **Demo: Flaky API check**, hit **Run Now**, and
watch the run history: the delay sleeps durably, the flaky HTTP node **retries**
(attempt count climbs), the condition takes one branch, and the other branch's
node is **skipped**.

- API: `http://localhost:3002/api` · Inngest dev UI: `http://localhost:8288`
- Actions (Slack/email/HTTP) are **mocked** in dev — the durability is the point.

## Triggers

- **Manual** — the “Run Now” button.
- **Webhook** — `POST /api/workflows/:id/trigger` runs the same durable function.
- **Cron** — set a workflow to `active`; `scheduled-workflow-runner` fires it every
  15 min (Inngest native cron).

## Reliability demo

The `http_request` node has a **simulated fail rate**. Set it to `0.4` and each
attempt fails 40% of the time — the run history shows multiple attempts and
Inngest's automatic retry until success (or final failure after retries are
exhausted). That's the proof Inngest is doing real work.
