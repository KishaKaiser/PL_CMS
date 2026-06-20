CREATE TABLE IF NOT EXISTS "account_addresses" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'US',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "account_addresses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "account_addresses_userId_idx" ON "account_addresses"("userId");

CREATE TABLE IF NOT EXISTS "saved_payment_methods" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "brand" TEXT,
  "last4" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "saved_payment_methods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_payment_methods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "saved_payment_methods_userId_idx" ON "saved_payment_methods"("userId");

CREATE TABLE IF NOT EXISTS "advisor_payout_methods" (
  "id" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "methodType" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "advisor_payout_methods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "advisor_payout_methods_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "advisor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "advisor_payout_methods_advisorId_idx" ON "advisor_payout_methods"("advisorId");
