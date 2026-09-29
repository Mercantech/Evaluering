-- AlterTable
ALTER TABLE "Section" ADD COLUMN "stableKey" TEXT;
ALTER TABLE "Section" ADD COLUMN "showWhen" JSONB;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "stableKey" TEXT;
ALTER TABLE "Question" ADD COLUMN "showWhen" JSONB;

-- Backfill stable keys from existing ids
UPDATE "Section" SET "stableKey" = 'sec-' || "id" WHERE "stableKey" IS NULL;
UPDATE "Question" SET "stableKey" = 'q-' || "id" WHERE "stableKey" IS NULL;

-- Make required
ALTER TABLE "Section" ALTER COLUMN "stableKey" SET NOT NULL;
ALTER TABLE "Question" ALTER COLUMN "stableKey" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Section_evaluationId_stableKey_key" ON "Section"("evaluationId", "stableKey");
CREATE UNIQUE INDEX "Question_evaluationId_stableKey_key" ON "Question"("evaluationId", "stableKey");
