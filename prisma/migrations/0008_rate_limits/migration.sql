-- Shared rate limiting (login, sign-up, password reset, checkout) that works across serverless instances.
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);
