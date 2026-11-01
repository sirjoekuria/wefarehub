-- Riders Welfare Contribution System. All monetary values are KES.
create extension if not exists pgcrypto;
create type public.payment_status as enum ('matched', 'unmatched');

create table public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9]{1,15}$'),
  name text not null check (length(trim(name)) between 2 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.members (
  id uuid primary key default gen_random_uuid(),
  pickup_point_id uuid not null references public.pickup_points(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  phone text not null check (phone ~ '^254(7|1)[0-9]{8}$'),
  qr_number text not null check (qr_number ~ '^[0-9]{1,12}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (pickup_point_id, qr_number)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  mpesa_receipt text not null unique,
  amount numeric(14,2) not null check (amount > 0),
  payer_phone text not null,
  bill_ref_raw text not null,
  pickup_code_parsed text,
  qr_parsed text,
  member_id uuid references public.members(id) on delete restrict,
  status public.payment_status not null default 'unmatched',
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  check ((status = 'matched' and member_id is not null) or (status = 'unmatched' and member_id is null))
);
create index members_pickup_idx on public.members(pickup_point_id);
create index payments_paid_at_idx on public.payments(paid_at desc);
create index payments_status_idx on public.payments(status);
create index payments_member_idx on public.payments(member_id);

-- Only invited Supabase Auth users are admins. Disable public sign-ups.
-- Edge Functions use the service role, which is never exposed to the browser.
alter table public.pickup_points enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
revoke all on public.pickup_points, public.members, public.payments from anon;
grant select, insert, update on public.pickup_points, public.members, public.payments to authenticated;
grant usage on schema public to authenticated;
create policy "Admins manage pickup points" on public.pickup_points for all to authenticated using (true) with check (true);
create policy "Admins manage members" on public.members for all to authenticated using (true) with check (true);
create policy "Admins manage payments" on public.payments for all to authenticated using (true) with check (true);
-- No DELETE policies: points and members are deactivated, not deleted.

create or replace function public.admin_dashboard(p_days integer default 14)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if auth.role() is distinct from 'authenticated' then raise exception 'Authentication required'; end if;
  if p_days not between 1 and 90 then raise exception 'Choose 1 to 90 days'; end if;
  select jsonb_build_object(
    'totalCollected', coalesce(sum(amount), 0),
    'totalCount', count(*),
    'todayAmount', coalesce(sum(amount) filter (where (paid_at at time zone 'Africa/Nairobi')::date = (now() at time zone 'Africa/Nairobi')::date), 0),
    'todayCount', count(*) filter (where (paid_at at time zone 'Africa/Nairobi')::date = (now() at time zone 'Africa/Nairobi')::date),
    'unmatchedCount', count(*) filter (where status = 'unmatched'),
    'activePoints', (select count(*) from pickup_points where is_active),
    'totalPoints', (select count(*) from pickup_points),
    'activeMembers', (select count(*) from members where is_active)
  ) into result from payments;
  select result || jsonb_build_object(
    'chart', coalesce(jsonb_agg(jsonb_build_object('date', to_char(d.day_value, 'YYYY-MM-DD'), 'amount', coalesce(p.total, 0), 'count', coalesce(p.count, 0)) order by d.day_value), '[]'::jsonb),
    'recentPayments', (select coalesce(jsonb_agg(x.obj order by x.paid_at desc), '[]'::jsonb) from (
      select p.paid_at, jsonb_build_object('id', p.id, 'mpesa_receipt', p.mpesa_receipt, 'amount', p.amount, 'payer_phone', p.payer_phone, 'bill_ref_raw', p.bill_ref_raw, 'pickup_code_parsed', p.pickup_code_parsed, 'qr_parsed', p.qr_parsed, 'member_id', p.member_id, 'status', p.status, 'paid_at', p.paid_at, 'created_at', p.created_at, 'member_name', m.full_name, 'pickup_name', pp.name, 'pickup_code', pp.code) obj
      from payments p left join members m on m.id=p.member_id left join pickup_points pp on pp.id=m.pickup_point_id order by p.paid_at desc limit 10
    ) x),
    'topPoints', (select coalesce(jsonb_agg(y.obj order by y.total desc), '[]'::jsonb) from (
      select coalesce(sum(p.amount), 0) total, jsonb_build_object('id', pp.id, 'code', pp.code, 'name', pp.name, 'members', count(distinct m.id), 'collected', coalesce(sum(p.amount), 0)) obj
      from pickup_points pp left join members m on m.pickup_point_id=pp.id left join payments p on p.member_id=m.id
      where pp.is_active group by pp.id order by total desc limit 4
    ) y)
  ) into result
  from generate_series(((now() at time zone 'Africa/Nairobi')::date - (p_days-1))::timestamp, (now() at time zone 'Africa/Nairobi')::date::timestamp, interval '1 day') d(day_value)
  left join (select (paid_at at time zone 'Africa/Nairobi')::date as day_value, sum(amount) total, count(*) count from payments where paid_at >= ((now() at time zone 'Africa/Nairobi')::date - (p_days-1))::timestamp at time zone 'Africa/Nairobi' group by 1) p on p.day_value=d.day_value::date;
  return result;
end $$;

create or replace function public.admin_report(p_pickup_point_id uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if auth.role() is distinct from 'authenticated' then raise exception 'Authentication required'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to-p_from > 366 then raise exception 'Choose a valid date range of at most 366 days'; end if;
  select jsonb_build_object(
    'point', (select jsonb_build_object('id', id, 'code', code, 'name', name) from pickup_points where id=p_pickup_point_id),
    'from', p_from, 'to', p_to,
    'rows', coalesce((select jsonb_agg(jsonb_build_object('qr_number', m.qr_number, 'full_name', m.full_name, 'phone', m.phone, 'payment_count', coalesce(x.n, 0), 'total', coalesce(x.total, 0)) order by m.qr_number)
      from members m left join (select member_id, count(*) n, sum(amount) total from payments where (paid_at at time zone 'Africa/Nairobi')::date between p_from and p_to group by member_id) x on x.member_id=m.id
      where p_pickup_point_id is null or m.pickup_point_id=p_pickup_point_id), '[]'::jsonb),
    'grandTotal', coalesce((select sum(p.amount) from payments p join members m on m.id=p.member_id where (p_pickup_point_id is null or m.pickup_point_id=p_pickup_point_id) and (p.paid_at at time zone 'Africa/Nairobi')::date between p_from and p_to), 0),
    'paymentCount', (select count(*) from payments p join members m on m.id=p.member_id where (p_pickup_point_id is null or m.pickup_point_id=p_pickup_point_id) and (p.paid_at at time zone 'Africa/Nairobi')::date between p_from and p_to)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_dashboard(integer), public.admin_report(uuid,date,date) from public, anon;
grant execute on function public.admin_dashboard(integer), public.admin_report(uuid,date,date) to authenticated;
