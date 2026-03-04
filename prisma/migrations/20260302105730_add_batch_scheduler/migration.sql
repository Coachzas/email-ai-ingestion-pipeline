-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('DAILY', 'HOURLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BatchRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "BatchScheduler" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "batchSize" INTEGER NOT NULL,
    "scheduleType" "ScheduleType" NOT NULL,
    "customHour" INTEGER,
    "customMinute" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchScheduler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchRun" (
    "id" TEXT NOT NULL,
    "schedulerId" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "status" "BatchRunStatus" NOT NULL DEFAULT 'PENDING',
    "emailsProcessed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchRun_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BatchRun" ADD CONSTRAINT "BatchRun_schedulerId_fkey" FOREIGN KEY ("schedulerId") REFERENCES "BatchScheduler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
