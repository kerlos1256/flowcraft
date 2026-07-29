-- Adds the ai_edits usage ledger for the AI Workflow Assistant.
-- Run once against the Neon database (SQL editor, or `psql "$DATABASE_URL" -f this`).
-- Matches the Prisma AiEdit model exactly; ids are generated client-side by Prisma,
-- so no DB-side default / pgcrypto is needed.

CREATE TABLE "ai_edits" (
  "id"           UUID           NOT NULL,
  "user_id"      UUID           NOT NULL,
  "workflow_id"  UUID           NOT NULL,
  "model"        TEXT           NOT NULL,
  "token_cost"   INTEGER        NOT NULL,
  "prompt_chars" INTEGER        NOT NULL,
  "tokens_in"    INTEGER,
  "tokens_out"   INTEGER,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "ai_edits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_edits_user_id_created_at_idx"  ON "ai_edits" ("user_id", "created_at");
CREATE INDEX "ai_edits_user_id_workflow_id_idx" ON "ai_edits" ("user_id", "workflow_id");

ALTER TABLE "ai_edits"
  ADD CONSTRAINT "ai_edits_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_edits"
  ADD CONSTRAINT "ai_edits_workflow_id_fkey"
  FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
