-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "compactedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CompactionRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "originalMessageIds" TEXT[],
    "tokensBeforeCompaction" INTEGER NOT NULL,
    "tokensAfterCompaction" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompactionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompactionRecord_sessionId_idx" ON "CompactionRecord"("sessionId");

-- AddForeignKey
ALTER TABLE "CompactionRecord" ADD CONSTRAINT "CompactionRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
