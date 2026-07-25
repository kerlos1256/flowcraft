# Deploying Flowcraft ($0, no card)

Three free services: **Neon** (Postgres), **Inngest Cloud** (durable execution),
and hosting on **Render** (API) + **Vercel** (web). No Kafka/AWS here — Flowcraft
never needed them.

## 0. Prerequisites
- Push this repo to **GitHub** (Render + Vercel deploy from Git).

## 1. Neon (Postgres)
1. Create a project at neon.tech → copy the **connection string**.
2. It becomes `DATABASE_URL`. Migrations run automatically on API boot
   (`prisma migrate deploy` in the Dockerfile CMD).

## 2. Inngest Cloud (durable execution)
1. Create an app at inngest.com (free tier).
2. Copy the **Event Key** and **Signing Key** → `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`.
3. After the API is deployed (step 3), register the serve endpoint in Inngest:
   **App URL = `https://<render-api>.onrender.com/api/inngest`** → Inngest syncs
   the `execute-workflow` + cron functions and will invoke them over HTTPS.

## 3. Render (API)
- New → **Blueprint** → select this repo (uses `render.yaml`).
- Set the dashboard secrets: `DATABASE_URL`, `INNGEST_EVENT_KEY`,
  `INNGEST_SIGNING_KEY`, and `WEB_ORIGIN` (the Vercel URL from step 4).
- Health check: `/api/health`. Free instances cold-start when idle — Inngest
  retries, so step execution still lands.

## 4. Vercel (web)
- New Project → this repo → **Root Directory: `apps/web`**.
- Framework: Next.js. Because it's a pnpm/Turbo monorepo, set:
  - **Install Command:** `pnpm install` (run at repo root)
  - **Build Command:** `pnpm turbo build --filter=@flowcraft/web...`
    (Turbo builds `@flowcraft/shared-types` first via its `^build` dep.)
- Env var: `NEXT_PUBLIC_API_URL = https://<render-api>.onrender.com`
- Redeploy. Then set the Render service's `WEB_ORIGIN` to the Vercel URL.

## Verify
- Open the Vercel URL → create/open a workflow → **Run Now** → the run history
  shows steps executing (delay, retries on the flaky node, condition branch).
