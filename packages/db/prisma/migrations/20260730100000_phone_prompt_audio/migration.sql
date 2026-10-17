-- Recorded versions of the lines callers hear on the phone, uploaded by an admin. Kept in the
-- database so they survive redeploys. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "phone_prompt_audio" (
    "key" TEXT NOT NULL,
    "fileToken" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_prompt_audio_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX IF NOT EXISTS "phone_prompt_audio_fileToken_key" ON "phone_prompt_audio"("fileToken");
