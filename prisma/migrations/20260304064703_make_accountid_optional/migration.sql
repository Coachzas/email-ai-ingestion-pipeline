-- DropForeignKey
ALTER TABLE "Email" DROP CONSTRAINT "Email_accountId_fkey";

-- AlterTable
ALTER TABLE "Email" ALTER COLUMN "accountId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
