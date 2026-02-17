/*
  Warnings:

  - The `ocrStatus` column on the `Attachment` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Attachment" DROP COLUMN "ocrStatus",
ADD COLUMN     "ocrStatus" "OcrStatus";
