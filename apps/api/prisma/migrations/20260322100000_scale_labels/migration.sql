-- AlterTable
ALTER TABLE "Question" ADD COLUMN "scaleLabels" TEXT[] DEFAULT ARRAY[]::TEXT[];
