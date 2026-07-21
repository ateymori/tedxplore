-- CreateTable
CREATE TABLE "rate_limit_window" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_window_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_window_key_key" ON "rate_limit_window"("key");

-- CreateIndex
CREATE INDEX "rate_limit_window_expiresAt_idx" ON "rate_limit_window"("expiresAt");
