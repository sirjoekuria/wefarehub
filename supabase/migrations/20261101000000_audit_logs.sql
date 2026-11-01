-- ============================================================================
-- AUDIT LOGS TABLE & POLICIES
-- Tracks system activity, administrative changes, security events and payments
-- ============================================================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text not null default 'system',
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_name text,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action);
create index if not exists audit_logs_entity_type_idx on public.audit_logs(entity_type);
create index if not exists audit_logs_actor_email_idx on public.audit_logs(actor_email);

-- Row Level Security
alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon;
grant select, insert on public.audit_logs to authenticated;
grant select, insert on public.audit_logs to service_role;

drop policy if exists "Admins view audit logs" on public.audit_logs;
create policy "Admins view audit logs" on public.audit_logs
  for select to authenticated using (true);

drop policy if exists "System insert audit logs" on public.audit_logs;
create policy "System insert audit logs" on public.audit_logs
  for insert to authenticated with check (true);
