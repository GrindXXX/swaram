-- 0001_extensions.sql
-- Postgres extensions Swaram depends on. Run first; everything else assumes these.

create extension if not exists "uuid-ossp";
create extension if not exists postgis;        -- jurisdiction point-in-polygon (B3)
create extension if not exists vector;         -- clustering candidate retrieval (C4)
create extension if not exists pg_trgm;        -- fuzzy name matching for LGD fallback
create extension if not exists pg_cron;        -- SLA sweeps, pressure recompute (E3)

-- pgmq powers the job queue (E1). On hosted Supabase enable it from the
-- dashboard (Database > Extensions) rather than here, since it installs into
-- its own schema.
create extension if not exists pgmq;

-- Queues. Long-running work never runs in a request; it is enqueued here and
-- drained by backend/workers.
select pgmq.create('intake');
select pgmq.create('cluster');
select pgmq.create('verify');
select pgmq.create('dispatch');
select pgmq.create('notify');
