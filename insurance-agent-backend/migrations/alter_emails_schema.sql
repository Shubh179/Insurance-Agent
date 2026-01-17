-- Supabase Migration: Update Emails Table Schema
-- Converts from old schema (message_id, from, to, body) 
-- to new schema (gmail_message_id, sender, raw_snippet)
-- Run in Supabase SQL Editor

-- Step 1: Drop existing indexes that depend on old columns
DROP INDEX IF EXISTS idx_emails_message_id;

-- Step 2: Add new columns
ALTER TABLE emails
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT,
ADD COLUMN IF NOT EXISTS sender TEXT,
ADD COLUMN IF NOT EXISTS raw_snippet TEXT;

-- Step 3: Migrate data from old columns to new columns
UPDATE emails
SET 
  gmail_message_id = message_id,
  sender = "from",
  raw_snippet = body
WHERE gmail_message_id IS NULL;

-- Step 4: Add NOT NULL constraints after data migration
ALTER TABLE emails
ALTER COLUMN gmail_message_id SET NOT NULL,
ALTER COLUMN sender SET NOT NULL;

-- Step 5: Create unique constraint on gmail_message_id
ALTER TABLE emails
ADD CONSTRAINT unique_gmail_message_id UNIQUE (gmail_message_id);

-- Step 6: Create new indexes
CREATE INDEX IF NOT EXISTS idx_emails_gmail_message_id ON emails(gmail_message_id);

-- Step 7: Drop old columns (only after verifying data migration)
ALTER TABLE emails
DROP COLUMN IF EXISTS message_id,
DROP COLUMN IF EXISTS "from",
DROP COLUMN IF EXISTS "to",
DROP COLUMN IF EXISTS body;

-- Verification: Check the updated schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'emails'
ORDER BY ordinal_position;
