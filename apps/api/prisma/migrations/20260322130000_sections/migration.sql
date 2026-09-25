-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Section_evaluationId_idx" ON "Section"("evaluationId");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add nullable sectionId first
ALTER TABLE "Question" ADD COLUMN "sectionId" TEXT;

-- Backfill: one default section per evaluation that has questions (or all evaluations)
INSERT INTO "Section" ("id", "evaluationId", "title", "order", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || e."id"),
  e."id",
  'Sektion 1',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Evaluation" e
WHERE NOT EXISTS (
  SELECT 1 FROM "Section" s WHERE s."evaluationId" = e."id"
);

-- Assign questions to first section of their evaluation
UPDATE "Question" q
SET "sectionId" = (
  SELECT s."id"
  FROM "Section" s
  WHERE s."evaluationId" = q."evaluationId"
  ORDER BY s."order" ASC
  LIMIT 1
)
WHERE q."sectionId" IS NULL;

-- Enforce NOT NULL
ALTER TABLE "Question" ALTER COLUMN "sectionId" SET NOT NULL;

CREATE INDEX "Question_sectionId_idx" ON "Question"("sectionId");

ALTER TABLE "Question" ADD CONSTRAINT "Question_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
