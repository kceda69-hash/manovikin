-- Migration: 20260509114517_c71b559c-bc67-4aa2-881f-9fba4cca7115.sql

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Threads
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.threads enable row level security;
create policy "own threads select" on public.threads for select using (auth.uid() = user_id);
create policy "own threads insert" on public.threads for insert with check (auth.uid() = user_id);
create policy "own threads update" on public.threads for update using (auth.uid() = user_id);
create policy "own threads delete" on public.threads for delete using (auth.uid() = user_id);
create index threads_user_idx on public.threads(user_id, updated_at desc);

-- Messages: store full UIMessage as JSONB
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  message jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "own messages select" on public.messages for select using (auth.uid() = user_id);
create policy "own messages insert" on public.messages for insert with check (auth.uid() = user_id);
create policy "own messages delete" on public.messages for delete using (auth.uid() = user_id);
create index messages_thread_idx on public.messages(thread_id, created_at);

-- Migration: 20260509114537_45a42f7d-9908-4da3-ac5e-591dd44ecea6.sql
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Migration: 20260509120618_b1c87566-e14b-45df-b5af-54001231a652.sql
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid REFERENCES public.threads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  summary text,
  ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own audit select" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own audit insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);
-- Migration: 20260512032144_4ebaa0e0-159d-4980-92e7-54847056a006.sql
DROP POLICY IF EXISTS "own audit insert" ON public.audit_logs;
-- Migration: 20260530075332_7699a142-0020-42c5-903b-3d0ccc3400b2.sql
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  receipt_no TEXT,
  email TEXT,
  name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX purchases_order_idx ON public.purchases(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX purchases_user_idx ON public.purchases(user_id, created_at DESC);

GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own purchases select" ON public.purchases FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER purchases_touch BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Migration: 20260530082657_email_infra.sql
-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase no longer grants public-schema access to service_role by default;
-- emit the grant explicitly so edge functions can reach the table via PostgREST.
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

GRANT ALL ON public.email_send_state TO service_role;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT ALL ON public.suppressed_emails TO service_role;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');

-- Migration: 20260530082717_email_infra.sql
-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase no longer grants public-schema access to service_role by default;
-- emit the grant explicitly so edge functions can reach the table via PostgREST.
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

GRANT ALL ON public.email_send_state TO service_role;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT ALL ON public.suppressed_emails TO service_role;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');

-- Migration: 20260530082905_email_infra.sql
-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase no longer grants public-schema access to service_role by default;
-- emit the grant explicitly so edge functions can reach the table via PostgREST.
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

GRANT ALL ON public.email_send_state TO service_role;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT ALL ON public.suppressed_emails TO service_role;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');

-- Migration: 20260530112025_email_infra.sql
-- Email infrastructure
-- Creates the queue system, send log, send state, suppression, and unsubscribe
-- tables used by both auth and transactional emails.

-- Extensions required for queue processing
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create email queues (auth = high priority, transactional = normal)
-- Wrapped in DO blocks to handle "queue already exists" errors idempotently.
DO $$ BEGIN PERFORM pgmq.create('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Dead-letter queues for messages that exceed max retries
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Email send log table (audit trail for all send attempts)
-- UPDATE is allowed for the service role so the suppression edge function
-- can update a log record's status when a bounce/complaint/unsubscribe occurs.
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT,
  template_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase no longer grants public-schema access to service_role by default;
-- emit the grant explicitly so edge functions can reach the table via PostgREST.
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read send log"
    ON public.email_send_log FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert send log"
    ON public.email_send_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can update send log"
    ON public.email_send_log FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_created ON public.email_send_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log(recipient_email);

-- Backfill: add message_id column to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_log ADD COLUMN message_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log(message_id);

-- Prevent duplicate sends: only one 'sent' row per message_id.
-- If VT expires and another worker picks up the same message, the pre-send
-- check catches it. This index is a DB-level safety net for race conditions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_send_log_message_sent_unique
  ON public.email_send_log(message_id) WHERE status = 'sent';

-- Backfill: update status CHECK constraint for existing tables that predate new statuses
DO $$ BEGIN
  ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
  ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'));
END $$;

-- Rate-limit state and queue config (single row, tracks Retry-After cooldown + throughput settings)
CREATE TABLE IF NOT EXISTS public.email_send_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until TIMESTAMPTZ,
  batch_size INTEGER NOT NULL DEFAULT 10,
  send_delay_ms INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Backfill: add config columns to existing tables that predate this migration
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 10;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN send_delay_ms INTEGER NOT NULL DEFAULT 200;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.email_send_state ADD COLUMN transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

GRANT ALL ON public.email_send_state TO service_role;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can manage send state"
    ON public.email_send_state FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC wrappers so Edge Functions can interact with pgmq via supabase.rpc()
-- (PostgREST only exposes functions in the public schema; pgmq functions are in the pgmq schema)
-- All wrappers auto-create the queue on undefined_table (42P01) so emails
-- are never lost if the queue was dropped (extension upgrade, restore, etc.).
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$$;

-- Restrict queue RPC wrappers to service_role only (SECURITY DEFINER runs as owner,
-- so without this any authenticated user could manipulate the email queues)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;

-- Suppressed emails table (tracks unsubscribes, bounces, complaints)
-- Append-only: no DELETE or UPDATE policies to prevent bypassing suppression.
CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT ALL ON public.suppressed_emails TO service_role;

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read suppressed emails"
    ON public.suppressed_emails FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert suppressed emails"
    ON public.suppressed_emails FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppressed_emails_email ON public.suppressed_emails(email);

-- Email unsubscribe tokens table (one token per email address for unsubscribe links)
-- No DELETE policy to prevent removing tokens. UPDATE allowed only to mark tokens as used.
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role can read tokens"
    ON public.email_unsubscribe_tokens FOR SELECT
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can insert tokens"
    ON public.email_unsubscribe_tokens FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role can mark tokens as used"
    ON public.email_unsubscribe_tokens FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens(token);

-- ============================================================
-- POST-MIGRATION STEPS (applied dynamically by setup_email_infra)
-- These steps contain project-specific secrets and URLs and
-- cannot be expressed as static SQL. They are applied via the
-- Supabase Management API (ExecuteSQL) each time the tool runs.
-- ============================================================
--
-- 1. VAULT SECRET
--    Stores (or updates) the Supabase service_role key in
--    vault as 'email_queue_service_role_key'.
--    Uses vault.create_secret / vault.update_secret (upsert).
--    To revert: DELETE FROM vault.secrets WHERE name = 'email_queue_service_role_key';
--
-- 2. CRON JOB (pg_cron)
--    Creates job 'process-email-queue' with a 5-second interval.
--    The job checks:
--      a) rate-limit cooldown (email_send_state.retry_after_until)
--      b) whether auth_emails or transactional_emails queues have messages
--    If conditions are met, it calls the process-email-queue Edge Function
--    via net.http_post using the vault-stored service_role key.
--    To revert: SELECT cron.unschedule('process-email-queue');

-- Migration: 20260531134252_bba4e62d-0fd8-4988-b833-fea332abacc0.sql

-- 1. Harden messages INSERT to require thread ownership
DROP POLICY IF EXISTS "own messages insert" ON public.messages;
CREATE POLICY "own messages insert"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = thread_id AND t.user_id = auth.uid()
  )
);

-- 2. Lock down SECURITY DEFINER email queue functions: set search_path and
-- restrict EXECUTE to service_role only (these are internal helpers used by
-- server-side admin code via supabaseAdmin).

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;

REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;

-- Migration: 20260602064314_01aedec8-8cfd-4ccc-b088-f88abf79c73d.sql

CREATE TABLE public.security_self_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid NOT NULL,
  check_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass','warn','fail','fixed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_fix_applied boolean NOT NULL DEFAULT false
);

CREATE INDEX security_self_checks_ran_at_idx ON public.security_self_checks (ran_at DESC);
CREATE INDEX security_self_checks_run_id_idx ON public.security_self_checks (run_id);

GRANT SELECT ON public.security_self_checks TO authenticated;
GRANT ALL ON public.security_self_checks TO service_role;

ALTER TABLE public.security_self_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read security scan results"
ON public.security_self_checks FOR SELECT
TO authenticated
USING (true);

-- Migration: 20260602064527_5ac746c9-dd04-4ce7-894f-b1cb986bba24.sql

CREATE OR REPLACE FUNCTION public.get_security_scan_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'security_scan_token' LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_security_scan_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_security_scan_token() TO service_role;

-- Migration: 20260604054622_e97bd848-6a9b-4271-92d7-40ce3e586f01.sql
DROP POLICY IF EXISTS "Authenticated users can read security scan results" ON public.security_self_checks;
CREATE POLICY "Service role can read security scan results"
  ON public.security_self_checks FOR SELECT
  USING (auth.role() = 'service_role');
-- Migration: 20260607075116_a94206fd-fe74-48b5-83ae-cce3796e0bb2.sql

CREATE TABLE public.language_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  language_code text NOT NULL,
  terminology jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, language_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.language_memory TO authenticated;
GRANT ALL ON public.language_memory TO service_role;
ALTER TABLE public.language_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own language_memory all" ON public.language_memory
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.manovik_brain_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manovik_brain_updates TO authenticated, anon;
GRANT ALL ON public.manovik_brain_updates TO service_role;
ALTER TABLE public.manovik_brain_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read brain updates" ON public.manovik_brain_updates
  FOR SELECT USING (true);

-- Migration: 20260607075755_f7a6a71f-1173-440a-8deb-423fecebfcf1.sql

CREATE TABLE public.ai_balance (
  user_id uuid PRIMARY KEY,
  credits integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_balance TO authenticated;
GRANT ALL ON public.ai_balance TO service_role;
ALTER TABLE public.ai_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own balance read" ON public.ai_balance
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.ai_balance_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_balance_ledger_user_idx ON public.ai_balance_ledger(user_id, created_at DESC);
GRANT SELECT ON public.ai_balance_ledger TO authenticated;
GRANT ALL ON public.ai_balance_ledger TO service_role;
ALTER TABLE public.ai_balance_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger read" ON public.ai_balance_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- Atomic spend: deducts credits and writes ledger row in one shot.
CREATE OR REPLACE FUNCTION public.manovik_spend_credit(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE remaining integer;
BEGIN
  INSERT INTO public.ai_balance(user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.ai_balance
    SET credits = credits - _amount, updated_at = now()
    WHERE user_id = _user_id AND credits >= _amount
    RETURNING credits INTO remaining;

  IF remaining IS NULL THEN
    RETURN -1;
  END IF;

  INSERT INTO public.ai_balance_ledger(user_id, delta, reason)
    VALUES (_user_id, -_amount, _reason);
  RETURN remaining;
END;
$$;

CREATE OR REPLACE FUNCTION public.manovik_topup_credit(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE remaining integer;
BEGIN
  INSERT INTO public.ai_balance(user_id, credits) VALUES (_user_id, _amount)
    ON CONFLICT (user_id) DO UPDATE
      SET credits = ai_balance.credits + EXCLUDED.credits, updated_at = now()
    RETURNING credits INTO remaining;
  INSERT INTO public.ai_balance_ledger(user_id, delta, reason)
    VALUES (_user_id, _amount, _reason);
  RETURN remaining;
END;
$$;

-- Migration: 20260607075821_df9b3210-49be-4d82-9d2d-a136957fdf94.sql

REVOKE EXECUTE ON FUNCTION public.manovik_spend_credit(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manovik_topup_credit(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manovik_spend_credit(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.manovik_topup_credit(uuid, integer, text) TO service_role;

-- Migration: 20260701065103_5e39b99b-77cf-4dea-a816-c1b154594eaa.sql
-- Revoke public EXECUTE on SECURITY DEFINER functions; keep service_role only.
-- All callers use server-side admin client or triggers/cron.
DO $$
DECLARE
  fn text;
  sig text;
BEGIN
  FOR fn, sig IN
    SELECT n.nspname || '.' || p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'handle_new_user','read_email_batch','enqueue_email','move_to_dlq',
        'get_security_scan_token','manovik_spend_credit','delete_email',
        'manovik_topup_credit','email_queue_dispatch','email_queue_wake'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s(%s) FROM PUBLIC, anon, authenticated', fn, sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s(%s) TO service_role', fn, sig);
  END LOOP;
END $$;
-- Migration: 20260707111534_cebe2db3-9a2a-4efa-9aee-63781a07d7d7.sql

CREATE TABLE public.magic_link_requests (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX magic_link_requests_email_created_idx
  ON public.magic_link_requests (lower(email), created_at DESC);
CREATE INDEX magic_link_requests_ip_created_idx
  ON public.magic_link_requests (ip, created_at DESC);

-- No grants to anon/authenticated: only service_role (used from server functions)
-- and the SECURITY DEFINER function below may touch this table.
GRANT ALL ON public.magic_link_requests TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.magic_link_requests_id_seq TO service_role;
ALTER TABLE public.magic_link_requests ENABLE ROW LEVEL SECURITY;
-- No policies -> locked to everyone except service_role/definers.

CREATE OR REPLACE FUNCTION public.magic_link_check_and_record(_email TEXT, _ip TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_count INT;
  ip_count INT;
  oldest_email TIMESTAMPTZ;
  oldest_ip TIMESTAMPTZ;
  retry_after INT;
BEGIN
  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_email', 'retry_after_sec', 0);
  END IF;

  SELECT count(*), min(created_at) INTO email_count, oldest_email
    FROM public.magic_link_requests
    WHERE lower(email) = lower(_email)
      AND created_at > now() - interval '15 minutes';

  IF email_count >= 3 THEN
    retry_after := GREATEST(1, EXTRACT(EPOCH FROM (oldest_email + interval '15 minutes' - now()))::INT);
    RETURN jsonb_build_object('allowed', false, 'reason', 'email_rate_limited', 'retry_after_sec', retry_after);
  END IF;

  SELECT count(*), min(created_at) INTO ip_count, oldest_ip
    FROM public.magic_link_requests
    WHERE ip = _ip
      AND created_at > now() - interval '1 hour';

  IF ip_count >= 20 THEN
    retry_after := GREATEST(1, EXTRACT(EPOCH FROM (oldest_ip + interval '1 hour' - now()))::INT);
    RETURN jsonb_build_object('allowed', false, 'reason', 'ip_rate_limited', 'retry_after_sec', retry_after);
  END IF;

  INSERT INTO public.magic_link_requests (email, ip) VALUES (_email, _ip);

  -- Opportunistic cleanup: purge rows older than 24h (small table, fast).
  DELETE FROM public.magic_link_requests WHERE created_at < now() - interval '24 hours';

  RETURN jsonb_build_object('allowed', true, 'retry_after_sec', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.magic_link_check_and_record(TEXT, TEXT) TO service_role;

-- Migration: 20260707111601_ba6cb294-564e-42c1-b6a8-e230e53f55dd.sql

REVOKE EXECUTE ON FUNCTION public.magic_link_check_and_record(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE POLICY "magic_link_requests deny all"
  ON public.magic_link_requests
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Migration: 20260709051144_da063409-410d-4205-8947-c7b7f90fb004.sql

-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own roles only
CREATE POLICY "Users read own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No client-side inserts/updates/deletes. Only service_role (server functions) may write.

-- 3. has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 4. Seed initial admin (kchaudharyofficial26@gmail.com)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('kchaudharyofficial26@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Migration: 20260709051222_83ee524d-25bd-4290-8ce9-2f08ecdf43b4.sql

CREATE OR REPLACE FUNCTION public.grant_owner_admin_on_verify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND lower(NEW.email) = lower('kchaudharyofficial26@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_owner_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_owner_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_owner_admin_on_verify();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_owner_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_owner_admin
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.grant_owner_admin_on_verify();

-- Migration: 20260709051248_6d8e3658-e63d-48fd-a183-f554c8177b61.sql

REVOKE EXECUTE ON FUNCTION public.grant_owner_admin_on_verify() FROM PUBLIC, anon, authenticated;

-- Migration: 20260710053920_79a7e97b-d6da-4194-99bc-59ace60b7239.sql

-- Revoke EXECUTE from PUBLIC/anon/authenticated on SECURITY DEFINER functions
-- that should never be invoked directly via the Data API. service_role and the
-- functions' own owner still retain access (revokes below do not affect owner).

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.move_to_dlq(text, text, bigint, jsonb)',
    'public.get_security_scan_token()',
    'public.manovik_spend_credit(uuid, integer, text)',
    'public.delete_email(text, bigint)',
    'public.manovik_topup_credit(uuid, integer, text)',
    'public.email_queue_wake()',
    'public.enqueue_email(text, jsonb)',
    'public.read_email_batch(text, integer, integer)',
    'public.email_queue_dispatch()',
    'public.grant_owner_admin_on_verify()',
    'public.magic_link_check_and_record(text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    -- Skip functions that were never created (e.g. provisioned out-of-band on
    -- older projects). REVOKE on a missing function raises 42883 and aborts.
    IF to_regprocedure(fn) IS NULL THEN
      RAISE NOTICE 'Skipping missing function %', fn;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- has_role is called inside RLS policies evaluated as the requesting user, so
-- authenticated users must retain EXECUTE. Remove PUBLIC/anon exposure.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- touch_updated_at is SECURITY INVOKER (trigger); still tighten exposure.
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM authenticated;

-- Migration: 20260710070420_806dda8f-a8cd-4b0b-929e-c96e1bf7b5ea.sql
-- Switch public.has_role to SECURITY INVOKER so it is no longer a
-- SECURITY DEFINER function executable by signed-in users. authenticated
-- already has SELECT on public.user_roles, so RLS policies calling
-- has_role() continue to work under the caller's role.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;
-- Migration: 20260711035849_647ff3e3-c456-4e8c-af25-eb75bce0287f.sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'manovik-security-self-scan') THEN
    PERFORM cron.unschedule('manovik-security-self-scan');
  END IF;
END $$;

SELECT cron.schedule(
  'manovik-security-self-scan',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--9e140ba8-6acc-42f5-8e24-1a6609f849b5.lovable.app/api/public/hooks/security-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_security_scan_token()
    ),
    body := '{}'::jsonb
  );
  $cron$
);

CREATE OR REPLACE FUNCTION public.security_scan_new_findings(_run_id uuid)
RETURNS TABLE (check_name text, status text, details jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH prev AS (
    SELECT run_id
    FROM public.security_self_checks
    WHERE run_id <> _run_id
      AND ran_at <= (
        SELECT max(ran_at) FROM public.security_self_checks WHERE run_id = _run_id
      )
    ORDER BY ran_at DESC
    LIMIT 1
  ),
  prev_fails AS (
    SELECT s.check_name
    FROM public.security_self_checks s
    JOIN prev p ON p.run_id = s.run_id
    WHERE s.status IN ('fail','warn')
  ),
  curr_fails AS (
    SELECT check_name, status, details
    FROM public.security_self_checks
    WHERE run_id = _run_id
      AND status IN ('fail','warn')
  )
  SELECT c.check_name, c.status, c.details
  FROM curr_fails c
  WHERE NOT EXISTS (SELECT 1 FROM prev_fails p WHERE p.check_name = c.check_name);
$$;

REVOKE ALL ON FUNCTION public.security_scan_new_findings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_scan_new_findings(uuid) TO service_role;
-- Migration: 20260716042521_7647274f-3f57-40e4-806a-5e8caca7bf08.sql
GRANT INSERT ON public.manovik_brain_updates TO authenticated;
CREATE POLICY "admins insert brain updates" ON public.manovik_brain_updates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Migration: 20260717120219_6f04468e-1613-4013-b1ec-953f2f47c871.sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('kchaudharyofficial26@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
-- Migration: 20260717120249_fb3d34e2-9d9e-4519-82a2-44445d2c3a42.sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
-- Migration: 20260720160849_3ca61185-8b67-4139-99ca-c05da07c4da0.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Migration: 20260727072124_1540b431-1a13-4f90-8df9-9dedac9adaae.sql
CREATE TABLE IF NOT EXISTS public.manovik_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  pair_code TEXT UNIQUE,
  pair_code_expires_at TIMESTAMPTZ,
  token_hash TEXT,
  paired_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_devices TO authenticated;
GRANT ALL ON public.manovik_devices TO service_role;
ALTER TABLE public.manovik_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own devices" ON public.manovik_devices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.manovik_device_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.manovik_devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'shell',
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_device_commands TO authenticated;
GRANT ALL ON public.manovik_device_commands TO service_role;
ALTER TABLE public.manovik_device_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own device commands" ON public.manovik_device_commands FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS manovik_device_commands_device_idx ON public.manovik_device_commands(device_id, status, created_at);
-- Migration: 20260803060958_425c5d18-ac88-4e21-ac02-b0c428b6a85a.sql
-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.workspace_role AS ENUM ('owner','admin','editor','viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_visibility AS ENUM ('private','link','public'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.build_status AS ENUM ('queued','running','success','failed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ WORKSPACES ============
CREATE TABLE IF NOT EXISTS public.manovik_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_workspaces TO authenticated;
GRANT ALL ON public.manovik_workspaces TO service_role;
ALTER TABLE public.manovik_workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.manovik_workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.manovik_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_workspace_members TO authenticated;
GRANT ALL ON public.manovik_workspace_members TO service_role;
ALTER TABLE public.manovik_workspace_members ENABLE ROW LEVEL SECURITY;

-- security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.manovik_workspace_members m
                 WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.workspace_role_of(_workspace_id uuid, _user_id uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.manovik_workspace_members m
  WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.workspace_role_of(_workspace_id, _user_id) IN ('owner','admin','editor')
$$;

CREATE POLICY "workspaces readable by members" ON public.manovik_workspaces
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_workspace_member(id, auth.uid()));
CREATE POLICY "workspaces insert own" ON public.manovik_workspaces
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces update by owner" ON public.manovik_workspaces
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces delete by owner" ON public.manovik_workspaces
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "members readable by members" ON public.manovik_workspace_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "members managed by admins" ON public.manovik_workspace_members
  FOR ALL TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
         OR EXISTS (SELECT 1 FROM public.manovik_workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
         OR EXISTS (SELECT 1 FROM public.manovik_workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.manovik_workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.manovik_workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_workspace_invites TO authenticated;
GRANT ALL ON public.manovik_workspace_invites TO service_role;
ALTER TABLE public.manovik_workspace_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites managed by admins" ON public.manovik_workspace_invites
  FOR ALL TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'));

-- ============ PROJECTS ============
CREATE TABLE IF NOT EXISTS public.manovik_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.manovik_workspaces(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  framework text NOT NULL DEFAULT 'react',
  visibility public.project_visibility NOT NULL DEFAULT 'private',
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  entry_path text NOT NULL DEFAULT 'src/App.tsx',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_projects TO authenticated;
GRANT SELECT ON public.manovik_projects TO anon;
GRANT ALL ON public.manovik_projects TO service_role;
ALTER TABLE public.manovik_projects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manovik_projects p
    WHERE p.id = _project_id
      AND (p.owner_id = _user_id
           OR p.visibility IN ('link','public')
           OR (p.workspace_id IS NOT NULL AND public.is_workspace_member(p.workspace_id, _user_id)))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manovik_projects p
    WHERE p.id = _project_id
      AND (p.owner_id = _user_id
           OR (p.workspace_id IS NOT NULL AND public.can_write_workspace(p.workspace_id, _user_id)))
  )
$$;

CREATE POLICY "projects select" ON public.manovik_projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR visibility IN ('link','public')
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );
CREATE POLICY "projects insert own" ON public.manovik_projects
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projects update" ON public.manovik_projects
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR (workspace_id IS NOT NULL AND public.can_write_workspace(workspace_id, auth.uid())))
  WITH CHECK (owner_id = auth.uid() OR (workspace_id IS NOT NULL AND public.can_write_workspace(workspace_id, auth.uid())));
CREATE POLICY "projects delete own" ON public.manovik_projects
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.manovik_project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.manovik_projects(id) ON DELETE CASCADE,
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  language text,
  size_bytes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, path)
);
CREATE INDEX IF NOT EXISTS manovik_project_files_project_idx ON public.manovik_project_files(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_project_files TO authenticated;
GRANT SELECT ON public.manovik_project_files TO anon;
GRANT ALL ON public.manovik_project_files TO service_role;
ALTER TABLE public.manovik_project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "files select" ON public.manovik_project_files
  FOR SELECT USING (public.can_read_project(project_id, auth.uid()));
CREATE POLICY "files write" ON public.manovik_project_files
  FOR ALL TO authenticated
  USING (public.can_write_project(project_id, auth.uid()))
  WITH CHECK (public.can_write_project(project_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.manovik_project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.manovik_projects(id) ON DELETE CASCADE,
  version integer NOT NULL,
  label text,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);
GRANT SELECT, INSERT, DELETE ON public.manovik_project_versions TO authenticated;
GRANT ALL ON public.manovik_project_versions TO service_role;
ALTER TABLE public.manovik_project_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions select" ON public.manovik_project_versions
  FOR SELECT TO authenticated USING (public.can_read_project(project_id, auth.uid()));
CREATE POLICY "versions insert" ON public.manovik_project_versions
  FOR INSERT TO authenticated WITH CHECK (public.can_write_project(project_id, auth.uid()));
CREATE POLICY "versions delete" ON public.manovik_project_versions
  FOR DELETE TO authenticated USING (public.can_write_project(project_id, auth.uid()));

-- ============ BUILDS / RUNS ============
CREATE TABLE IF NOT EXISTS public.manovik_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.manovik_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command text NOT NULL DEFAULT 'build',
  status public.build_status NOT NULL DEFAULT 'queued',
  exit_code integer,
  logs text NOT NULL DEFAULT '',
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS manovik_builds_project_idx ON public.manovik_builds(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.manovik_builds TO authenticated;
GRANT ALL ON public.manovik_builds TO service_role;
ALTER TABLE public.manovik_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "builds select" ON public.manovik_builds
  FOR SELECT TO authenticated USING (public.can_read_project(project_id, auth.uid()));
CREATE POLICY "builds insert" ON public.manovik_builds
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_write_project(project_id, auth.uid()));
CREATE POLICY "builds update" ON public.manovik_builds
  FOR UPDATE TO authenticated USING (public.can_write_project(project_id, auth.uid()))
  WITH CHECK (public.can_write_project(project_id, auth.uid()));

-- ============ USAGE + SUBSCRIPTIONS ============
CREATE TABLE IF NOT EXISTS public.manovik_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.manovik_projects(id) ON DELETE SET NULL,
  kind text NOT NULL,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 0,
  cost_micros integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manovik_usage_events_user_idx ON public.manovik_usage_events(user_id, created_at DESC);
GRANT SELECT ON public.manovik_usage_events TO authenticated;
GRANT ALL ON public.manovik_usage_events TO service_role;
ALTER TABLE public.manovik_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage own select" ON public.manovik_usage_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.manovik_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  monthly_credit_limit integer NOT NULL DEFAULT 100,
  period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  renews_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manovik_subscriptions TO authenticated;
GRANT ALL ON public.manovik_subscriptions TO service_role;
ALTER TABLE public.manovik_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription own select" ON public.manovik_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ updated_at triggers ============
CREATE TRIGGER trg_manovik_workspaces_updated BEFORE UPDATE ON public.manovik_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_manovik_projects_updated BEFORE UPDATE ON public.manovik_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_manovik_project_files_updated BEFORE UPDATE ON public.manovik_project_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_manovik_subscriptions_updated BEFORE UPDATE ON public.manovik_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
-- Migration: 20260803061055_5574a526-8ddb-4b27-97f0-3c6072afd6d1.sql
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_workspace(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_workspace(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_project(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.can_read_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_project(uuid, uuid) TO anon, authenticated, service_role;
-- Migration: 20260805053428_d1146af2-a015-41aa-a130-654b46f2cee3.sql
-- 1) Workspace injection: require membership when attaching a project to a workspace
DROP POLICY IF EXISTS "projects insert own" ON public.manovik_projects;
CREATE POLICY "projects insert own"
  ON public.manovik_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR public.can_write_workspace(workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "projects update" ON public.manovik_projects;
CREATE POLICY "projects update"
  ON public.manovik_projects
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.can_write_workspace(workspace_id, auth.uid()))
  )
  WITH CHECK (
    (
      owner_id = auth.uid()
      OR (workspace_id IS NOT NULL AND public.can_write_workspace(workspace_id, auth.uid()))
    )
    AND (
      workspace_id IS NULL
      OR public.can_write_workspace(workspace_id, auth.uid())
    )
  );

-- 2) SECURITY DEFINER functions must not be directly callable from the Data API.
--    These helpers exist only to support RLS policy evaluation and internal jobs.
REVOKE EXECUTE ON FUNCTION public.can_read_project(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_write_project(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_write_workspace(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_security_scan_token() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.magic_link_check_and_record(text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.manovik_spend_credit(uuid, integer, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.manovik_topup_credit(uuid, integer, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.security_scan_new_findings(uuid) FROM anon, authenticated, public;
-- Migration: 20260806095357_f110d164-c4a4-49ed-8ee3-c71d35e3e478.sql
CREATE TABLE public.seo_monitor_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  site_url text NOT NULL,
  sitemap_errors integer NOT NULL DEFAULT 0,
  sitemap_warnings integer NOT NULL DEFAULT 0,
  indexed_urls integer,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  avg_position numeric,
  ok boolean NOT NULL DEFAULT true,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.seo_monitor_snapshots TO authenticated;
GRANT ALL ON public.seo_monitor_snapshots TO service_role;
ALTER TABLE public.seo_monitor_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view seo snapshots"
  ON public.seo_monitor_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX seo_monitor_snapshots_captured_at_idx
  ON public.seo_monitor_snapshots (captured_at DESC);

CREATE TABLE public.seo_monitor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_id uuid REFERENCES public.seo_monitor_snapshots(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  notified_at timestamptz
);

GRANT SELECT, UPDATE ON public.seo_monitor_alerts TO authenticated;
GRANT ALL ON public.seo_monitor_alerts TO service_role;
ALTER TABLE public.seo_monitor_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view seo alerts"
  ON public.seo_monitor_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can acknowledge seo alerts"
  ON public.seo_monitor_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX seo_monitor_alerts_open_idx
  ON public.seo_monitor_alerts (created_at DESC) WHERE acknowledged_at IS NULL;
-- Migration: 20260806095848_889a1b96-4311-4722-aec7-f579064bf034.sql
CREATE OR REPLACE FUNCTION public.get_seo_monitor_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seo_monitor_token' LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_seo_monitor_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seo_monitor_token() TO service_role;
-- Migration: 20260808092945_be643744-5ed3-4d04-84e9-a7c3ce80f018.sql
CREATE EXTENSION IF NOT EXISTS vector;

-- ============ KNOWLEDGE MEMORY ============
CREATE TABLE public.manovik_memory_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.manovik_workspaces(id) ON DELETE SET NULL,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'paste',
  status text NOT NULL DEFAULT 'ready',
  chars integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_memory_docs TO authenticated;
GRANT ALL ON public.manovik_memory_docs TO service_role;
ALTER TABLE public.manovik_memory_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory docs owner all" ON public.manovik_memory_docs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_manovik_memory_docs_updated BEFORE UPDATE ON public.manovik_memory_docs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_memory_docs_user ON public.manovik_memory_docs(user_id, created_at DESC);

CREATE TABLE public.manovik_memory_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES public.manovik_memory_docs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_memory_chunks TO authenticated;
GRANT ALL ON public.manovik_memory_chunks TO service_role;
ALTER TABLE public.manovik_memory_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory chunks owner all" ON public.manovik_memory_chunks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_memory_chunks_doc ON public.manovik_memory_chunks(doc_id, chunk_index);
CREATE INDEX idx_memory_chunks_embedding ON public.manovik_memory_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.manovik_match_memory(
  _user_id uuid,
  query_embedding vector(1536),
  match_count integer DEFAULT 6
)
RETURNS TABLE (id uuid, doc_id uuid, title text, content text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.doc_id, d.title, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.manovik_memory_chunks c
  JOIN public.manovik_memory_docs d ON d.id = c.doc_id
  WHERE c.user_id = _user_id AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 24)
$$;
REVOKE ALL ON FUNCTION public.manovik_match_memory(uuid, vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manovik_match_memory(uuid, vector, integer) TO service_role;

-- ============ SCHEDULED AGENTS ============
CREATE TABLE public.manovik_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text NOT NULL,
  mode text NOT NULL DEFAULT 'research',
  cadence text NOT NULL DEFAULT 'daily',
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_schedules TO authenticated;
GRANT ALL ON public.manovik_schedules TO service_role;
ALTER TABLE public.manovik_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules owner all" ON public.manovik_schedules
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_manovik_schedules_updated BEFORE UPDATE ON public.manovik_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_schedules_due ON public.manovik_schedules(enabled, next_run_at);

CREATE TABLE public.manovik_schedule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.manovik_schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  result text,
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manovik_schedule_runs TO authenticated;
GRANT ALL ON public.manovik_schedule_runs TO service_role;
ALTER TABLE public.manovik_schedule_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule runs owner read" ON public.manovik_schedule_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_schedule_runs_sched ON public.manovik_schedule_runs(schedule_id, created_at DESC);

-- ============ API KEYS ============
CREATE TABLE public.manovik_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['ask']::text[],
  revoked_at timestamptz,
  expires_at timestamptz,
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_api_keys TO authenticated;
GRANT ALL ON public.manovik_api_keys TO service_role;
ALTER TABLE public.manovik_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api keys owner all" ON public.manovik_api_keys
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_api_keys_user ON public.manovik_api_keys(user_id, created_at DESC);
-- Migration: 20260808093026_10ec7c17-b325-435b-bcfe-3f15dec0d1d3.sql
REVOKE ALL ON FUNCTION public.manovik_match_memory(uuid, vector, integer) FROM authenticated;
-- Migration: 20260808093538_1e62321a-f05a-4a02-ba60-2d02a82acc6f.sql
SELECT vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'schedules_run_token', 'Token for the scheduled agents cron hook')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'schedules_run_token');

CREATE OR REPLACE FUNCTION public.get_schedules_run_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'schedules_run_token' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_schedules_run_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_schedules_run_token() TO service_role;
-- Migration: 20260811152503_d4cbd0cf-0e9a-449a-8b24-d251c755da96.sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.manovik_force_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective text NOT NULL,
  mode text NOT NULL DEFAULT 'build',
  status text NOT NULL DEFAULT 'running',
  answer text,
  score numeric,
  proof jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  parent_run_id uuid REFERENCES public.manovik_force_runs(id) ON DELETE SET NULL,
  fork_from_step integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_force_runs TO authenticated;
GRANT ALL ON public.manovik_force_runs TO service_role;
ALTER TABLE public.manovik_force_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own force runs"
  ON public.manovik_force_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.manovik_force_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.manovik_force_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  model text NOT NULL,
  output text NOT NULL DEFAULT '',
  critique text,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_force_agents TO authenticated;
GRANT ALL ON public.manovik_force_agents TO service_role;
ALTER TABLE public.manovik_force_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own force agents"
  ON public.manovik_force_agents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.manovik_force_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.manovik_force_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idx integer NOT NULL,
  phase text NOT NULL,
  label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_force_steps TO authenticated;
GRANT ALL ON public.manovik_force_steps TO service_role;
ALTER TABLE public.manovik_force_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own force steps"
  ON public.manovik_force_steps FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_force_runs_user_created ON public.manovik_force_runs (user_id, created_at DESC);
CREATE INDEX idx_force_agents_run ON public.manovik_force_agents (run_id);
CREATE INDEX idx_force_steps_run_idx ON public.manovik_force_steps (run_id, idx);

CREATE TRIGGER update_manovik_force_runs_updated_at
  BEFORE UPDATE ON public.manovik_force_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Migration: 20260921073000_enable_rls_agi_tables.sql
-- Fix critical finding: AGI mission/lesson/doctrine tables had no row-level security.
--
-- manovik_agi_runs, manovik_agi_steps, manovik_agi_lessons and manovik_agi_doctrine
-- are queried by user-scoped server functions (see src/lib/mano/agi.functions.ts and
-- src/lib/mano/training.server.ts) but, unlike every other user table in the app, no
-- migration ever enabled RLS on them. This migration:
--   1. Creates the tables IF NOT EXISTS (they were originally created via the
--      dashboard, so this is a no-op in production but makes fresh self-hosted
--      databases work), and
--   2. Enables RLS and adds owner-only policies matching the convention used by
--      the other user tables (e.g. audit_logs): a user can only touch rows whose
--      user_id equals auth.uid().
--
-- Safe to apply on production: server functions query with the service-role key
-- (which bypasses RLS) and always scope by user_id; the policies only restrict
-- direct anon/authenticated-key access to a user's own rows.

-- ---------------------------------------------------------------------------
-- Tables (created only if missing)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.manovik_agi_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  answer text,
  steps_used integer NOT NULL DEFAULT 0,
  score double precision,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.manovik_agi_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.manovik_agi_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  idx integer NOT NULL,
  thought text,
  tool text,
  tool_input text,
  observation text,
  ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manovik_agi_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  lesson text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manovik_agi_doctrine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doctrine text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  runs_used integer NOT NULL DEFAULT 0,
  lessons_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agi_runs_user_created
  ON public.manovik_agi_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agi_steps_run
  ON public.manovik_agi_steps(run_id, idx);
CREATE INDEX IF NOT EXISTS idx_agi_lessons_user_created
  ON public.manovik_agi_lessons(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agi_doctrine_user_active
  ON public.manovik_agi_doctrine(user_id, active, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-level security: owner-only access, same convention as other user tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.manovik_agi_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manovik_agi_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manovik_agi_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manovik_agi_doctrine ENABLE ROW LEVEL SECURITY;

-- manovik_agi_runs
DROP POLICY IF EXISTS "own agi_runs select" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs select" ON public.manovik_agi_runs
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_runs insert" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs insert" ON public.manovik_agi_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_runs update" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs update" ON public.manovik_agi_runs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_runs delete" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs delete" ON public.manovik_agi_runs
  FOR DELETE USING (auth.uid() = user_id);

-- manovik_agi_steps
DROP POLICY IF EXISTS "own agi_steps select" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps select" ON public.manovik_agi_steps
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_steps insert" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps insert" ON public.manovik_agi_steps
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_steps update" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps update" ON public.manovik_agi_steps
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_steps delete" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps delete" ON public.manovik_agi_steps
  FOR DELETE USING (auth.uid() = user_id);

-- manovik_agi_lessons
DROP POLICY IF EXISTS "own agi_lessons select" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons select" ON public.manovik_agi_lessons
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_lessons insert" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons insert" ON public.manovik_agi_lessons
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_lessons update" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons update" ON public.manovik_agi_lessons
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_lessons delete" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons delete" ON public.manovik_agi_lessons
  FOR DELETE USING (auth.uid() = user_id);

-- manovik_agi_doctrine
DROP POLICY IF EXISTS "own agi_doctrine select" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine select" ON public.manovik_agi_doctrine
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_doctrine insert" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine insert" ON public.manovik_agi_doctrine
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_doctrine update" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine update" ON public.manovik_agi_doctrine
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_doctrine delete" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine delete" ON public.manovik_agi_doctrine
  FOR DELETE USING (auth.uid() = user_id);

