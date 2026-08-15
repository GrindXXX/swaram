-- 0021_fix_worker_queue_receipts.sql
-- Avoid nested pgmq helper calls after a separate FOR UPDATE lock. Hosted pgmq
-- may wait on that pattern; receipt-checked queue mutations are atomic directly.

create table worker_message_archive (
  queue_name text not null,
  msg_id bigint not null,
  read_ct integer not null,
  enqueued_at timestamptz not null,
  message jsonb not null,
  outcome text not null check (outcome in ('COMPLETED', 'DEAD_LETTERED')),
  detail text,
  archived_at timestamptz not null default now(),
  primary key (queue_name, msg_id)
);

alter table worker_message_archive enable row level security;
revoke all on worker_message_archive from public, anon, authenticated, service_role;
grant select, insert on worker_message_archive to service_role;

create or replace function public.worker_queue_retry(
  p_queue text, p_msg_id text, p_expected_read_ct integer, p_delay_seconds integer
) returns text
language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
declare v_updated bigint;
begin
  if not public.worker_queue_allowed(p_queue)
     or p_msg_id is null or p_msg_id !~ '^[0-9]+$'
     or p_expected_read_ct is null or p_expected_read_ct < 1
     or p_delay_seconds < 1 or p_delay_seconds > 604800 then
    raise exception using errcode = '22023', message = 'invalid retry request';
  end if;

  execute format(
    'update pgmq.%I set vt = clock_timestamp() + make_interval(secs => $3) '
    'where msg_id = $1 and read_ct = $2 returning msg_id',
    'q_' || p_queue
  ) into v_updated using p_msg_id::bigint, p_expected_read_ct, p_delay_seconds;

  if v_updated is null then
    raise exception using errcode = '40001', message = 'queue message is missing or was read by another worker';
  end if;
  return v_updated::text;
end;
$$;

create or replace function public.worker_queue_archive(
  p_queue text, p_msg_id text, p_expected_read_ct integer
) returns text
language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
declare
  v_id bigint;
  v_read_ct integer;
  v_enqueued timestamptz;
  v_message jsonb;
begin
  if not public.worker_queue_allowed(p_queue) or p_queue = 'dead_letter'
     or p_msg_id is null or p_msg_id !~ '^[0-9]+$'
     or p_expected_read_ct is null or p_expected_read_ct < 1 then
    raise exception using errcode = '22023', message = 'invalid archive request';
  end if;

  execute format(
    'delete from pgmq.%I where msg_id = $1 and read_ct = $2 '
    'returning msg_id, read_ct, enqueued_at, message',
    'q_' || p_queue
  ) into v_id, v_read_ct, v_enqueued, v_message
  using p_msg_id::bigint, p_expected_read_ct;

  if v_id is null then
    raise exception using errcode = '40001', message = 'queue message is missing or was read by another worker';
  end if;

  insert into worker_message_archive (
    queue_name, msg_id, read_ct, enqueued_at, message, outcome
  ) values (p_queue, v_id, v_read_ct, v_enqueued, v_message, 'COMPLETED')
  on conflict (queue_name, msg_id) do nothing;
  return v_id::text;
end;
$$;

create or replace function public.worker_queue_dead_letter(
  p_queue text, p_msg_id text, p_expected_read_ct integer, p_reason text
) returns text
language plpgsql security definer set search_path = public, pgmq, pg_temp as $$
declare
  v_id bigint;
  v_read_ct integer;
  v_enqueued timestamptz;
  v_message jsonb;
  v_dead_id bigint;
begin
  if not public.worker_queue_allowed(p_queue) or p_queue = 'dead_letter'
     or p_msg_id is null or p_msg_id !~ '^[0-9]+$'
     or p_expected_read_ct is null or p_expected_read_ct < 1
     or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'invalid dead-letter request';
  end if;

  execute format(
    'delete from pgmq.%I where msg_id = $1 and read_ct = $2 '
    'returning msg_id, read_ct, enqueued_at, message',
    'q_' || p_queue
  ) into v_id, v_read_ct, v_enqueued, v_message
  using p_msg_id::bigint, p_expected_read_ct;

  if v_id is null then
    raise exception using errcode = '40001', message = 'queue message is missing or was read by another worker';
  end if;

  select pgmq.send('dead_letter', jsonb_build_object(
    'source_queue', p_queue,
    'source_msg_id', v_id::text,
    'source_read_ct', v_read_ct,
    'reason', btrim(p_reason),
    'failed_at', now(),
    'message', v_message
  )) into v_dead_id;

  insert into worker_message_archive (
    queue_name, msg_id, read_ct, enqueued_at, message, outcome, detail
  ) values (
    p_queue, v_id, v_read_ct, v_enqueued, v_message, 'DEAD_LETTERED', btrim(p_reason)
  ) on conflict (queue_name, msg_id) do nothing;
  return v_dead_id::text;
end;
$$;

revoke all on function public.worker_queue_retry(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.worker_queue_archive(text, text, integer) from public, anon, authenticated;
revoke all on function public.worker_queue_dead_letter(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.worker_queue_retry(text, text, integer, integer) to service_role;
grant execute on function public.worker_queue_archive(text, text, integer) to service_role;
grant execute on function public.worker_queue_dead_letter(text, text, integer, text) to service_role;
