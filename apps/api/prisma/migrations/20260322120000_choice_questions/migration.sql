-- AlterEnum (must be outside some transactional constraints on older PG;
-- PG 16 accepts ADD VALUE in a transaction)
ALTER TYPE "QuestionType" ADD VALUE 'SINGLE_CHOICE';
ALTER TYPE "QuestionType" ADD VALUE 'MULTI_CHOICE';
ALTER TYPE "QuestionType" ADD VALUE 'YES_NO';

ALTER TABLE "Question" ADD COLUMN "choiceOptions" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Answer" ADD COLUMN "choiceIndexes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
