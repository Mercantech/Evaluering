-- AlterTable
ALTER TABLE "Question" ADD COLUMN "matrixItems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN "matrixItemIndex" INTEGER;
