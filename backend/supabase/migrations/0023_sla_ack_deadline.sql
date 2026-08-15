-- Acknowledgement and resolution are separate promises in the PRD. The core
-- SLA implementation already computes both; persist the acknowledgement clock.

alter table public.issues
  add column sla_ack_due_at timestamptz;

create index issues_sla_ack_due_idx on public.issues (sla_ack_due_at)
  where sla_ack_due_at is not null
    and acknowledged_at is null
    and status not in ('RESOLVED', 'CLOSED', 'MERGED', 'REJECTED');

comment on column public.issues.sla_ack_due_at is
  'Tier-1 acknowledgement deadline. Separate from the resolution deadline in sla_due_at.';

create or replace function set_sla_due_at()
returns trigger language plpgsql as $$
declare
  v_ack     interval;
  v_resolve interval;
  v_base    timestamptz;
begin
  if new.routing_tier <> 'ONBOARDED' then
    new.sla_ack_due_at := null;
    new.sla_due_at := null;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_base := coalesce(new.created_at, now());
  elsif old.routing_tier <> 'ONBOARDED'
     or new.department_id is distinct from old.department_id then
    v_base := now();
  elsif new.priority is distinct from old.priority then
    v_base := old.created_at;
  else
    return new;
  end if;

  select s.ack_interval, s.resolve_interval into v_ack, v_resolve
    from sla_targets(new.priority, new.department_id) s;
  new.sla_ack_due_at := v_base + v_ack;
  new.sla_due_at := v_base + v_resolve;
  return new;
end $$;

update public.issues i
   set sla_ack_due_at = i.created_at
     + (select s.ack_interval from sla_targets(i.priority, i.department_id) s)
 where i.routing_tier = 'ONBOARDED'
   and i.sla_ack_due_at is null;
