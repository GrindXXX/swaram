-- 0006_users_officers.sql
-- Identity. Google OAuth for everyone; officer status comes from the employer.
--
-- The rule that must not bend: nobody self-declares as an officer. A
-- government_officers row exists because a roster the government published
-- says so, or because an admin approved a claim. There is no signup path
-- that grants it.

create table users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  display_name    text,               -- what the public sees; may be a pseudonym
  full_name       text,
  avatar_url      text,
  role            app_role not null default 'CITIZEN',

  phone           text,               -- nullable: Google auth today, phone OTP later
  phone_verified_at timestamptz,
  home_jurisdiction_id bigint references jurisdictions(id),
  language        text not null default 'en',

  -- Identity strength. PHONE/ENHANCED are future tiers; with Google alone
  -- everyone is EMAIL, which is why rate limiting in 0013 matters.
  identity_tier   text not null default 'EMAIL'
                  check (identity_tier in ('EMAIL','PHONE','ENHANCED')),
  -- Never an Aadhaar number. An opaque reference at most.
  verification_ref text,

  is_suspended    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index users_role_idx on users (role);
create index users_email_idx on users (lower(email));

comment on column users.verification_ref is
  'Opaque token only. Aadhaar carries no employment data and cannot establish '
  'officer status; storing Aadhaar numbers is a liability we decline.';

-- Government-published roster rows, staged BEFORE any account exists.
-- A Google sign-in is matched against this by email (B2). Rosters carry email
-- far more reliably than mobile numbers, which is why Google auth improved
-- this path rather than compromising it.
create table officer_roster_records (
  id               bigserial primary key,
  source_batch_id  text not null,        -- which import produced this row
  name             text,
  designation      text,
  department_ref   text,                 -- raw string from the source
  jurisdiction_ref text,
  department_id    bigint references departments(id),
  jurisdiction_id  bigint references jurisdictions(id),
  jurisdiction_lvl jurisdiction_level,
  email            text,
  phone            text,
  employee_ref     text,

  match_status     text not null default 'PENDING'
                   check (match_status in
                     ('PENDING','MATCHED','CONFIRMED','AMBIGUOUS','UNUSABLE_CONTACT')),
  matched_user_id  uuid references users(id),
  confirmed_at     timestamptz,

  source_url       text,
  created_at       timestamptz not null default now(),
  deactivated_at   timestamptz
);

create index roster_email_idx on officer_roster_records (lower(email))
  where deactivated_at is null;
create index roster_status_idx on officer_roster_records (match_status);

comment on table officer_roster_records is
  'A shared or office contact must be marked UNUSABLE_CONTACT rather than '
  'matched: it cannot identify a person, and provisioning it would break the '
  'one-accountable-Owner rule.';

create table government_officers (
  id                 bigserial primary key,
  user_id            uuid not null references users(id) on delete cascade,
  department_id      bigint references departments(id),
  jurisdiction_id    bigint not null references jurisdictions(id),
  -- This column IS the officer/supervisor distinction. There is no supervisor
  -- role; a supervisor is a government user scoped to a zone or district, so a
  -- promotion or transfer is a roster update rather than a manual role change.
  jurisdiction_level jurisdiction_level not null default 'WARD',
  designation        text,
  employee_ref       text,
  roster_record_id   bigint references officer_roster_records(id),

  confirmed_at       timestamptz,        -- the user actively accepted the role
  last_attested_at   timestamptz,        -- periodic re-attestation by an admin
  max_workload       int not null default 50,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),

  unique (user_id, department_id, jurisdiction_id)
);

create index gov_officers_user_idx  on government_officers (user_id) where is_active;
create index gov_officers_juris_idx on government_officers (jurisdiction_id, department_id)
  where is_active;

-- Every role grant, logged. Officer provisioning is the most security-sensitive
-- event in the system.
create table role_grants_log (
  id          bigserial primary key,
  user_id     uuid not null references users(id),
  granted_role app_role not null,
  officer_id  bigint references government_officers(id),
  roster_record_id bigint references officer_roster_records(id),
  match_method text not null,            -- ROSTER_EMAIL | GOV_DOMAIN_APPROVED | ADMIN
  granted_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

-- Mirror a new auth.users row into public.users. Everyone starts CITIZEN.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, display_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Does this signed-in user look like an officer? Read-only: it never grants
-- anything. The UI offers a claim; the user must explicitly confirm.
create or replace function officer_claim_candidate(p_user_id uuid)
returns table (
  roster_record_id bigint, name text, designation text,
  department_id bigint, jurisdiction_id bigint, signal text
) language plpgsql stable security definer set search_path = public as $$
declare v_email text;
begin
  select lower(u.email) into v_email from users u where u.id = p_user_id;
  if v_email is null then return; end if;

  -- Strong signal: the government published this person's email.
  return query
  select r.id, r.name, r.designation, r.department_id, r.jurisdiction_id,
         'ROSTER_EMAIL'::text
  from officer_roster_records r
  where lower(r.email) = v_email
    and r.deactivated_at is null
    and r.match_status in ('PENDING','MATCHED')
  limit 2;   -- 2 so the caller can detect ambiguity and refuse to provision

  -- Weak signal: government domain but no roster row. Needs admin approval;
  -- domain alone must never auto-provision.
  if not found and (v_email like '%@%.gov.in' or v_email like '%@%.nic.in') then
    return query select null::bigint, null::text, null::text,
                        null::bigint, null::bigint, 'GOV_DOMAIN'::text;
  end if;
end $$;
