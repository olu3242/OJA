-- CreateTable
CREATE TABLE "dead_letters" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dead_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dead_letters_status_createdAt_idx" ON "dead_letters"("status", "createdAt");

-- CreateIndex
CREATE INDEX "dead_letters_source_eventKey_idx" ON "dead_letters"("source", "eventKey");
