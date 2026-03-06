-- AlterTable
ALTER TABLE "BatchRun" ADD COLUMN     "schedulerConfig" TEXT,
ADD COLUMN     "schedulerName" TEXT,
ADD COLUMN     "schedulerType" TEXT;
