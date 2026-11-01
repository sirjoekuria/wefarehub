-- Run after the migration, against a disposable database with sample data.
set role authenticated;
set request.jwt.claim.role = 'authenticated';
select admin_dashboard(14);
select admin_report(null, current_date - 30, current_date);
do $$
declare n int; total numeric;
begin
  select count(*) into n from public.payments;
  if n = 0 then raise exception 'Expected sample payments'; end if;
  select (admin_dashboard(14)->>'totalCollected')::numeric into total;
  if total <> (select sum(amount) from public.payments) then raise exception 'Dashboard total mismatch'; end if;
  if jsonb_array_length(admin_dashboard(14)->'chart') <> 14 then raise exception 'Incorrect chart bucket count'; end if;
  if (admin_dashboard(14)->'chart'->13->>'date')::date <> current_date then raise exception 'Chart Nairobi date mismatch'; end if;
  if (admin_dashboard(14)->'chart'->13->>'amount')::numeric <= 0 then raise exception 'Today chart bucket is empty'; end if;
  begin
    insert into public.payments (mpesa_receipt, amount, payer_phone, bill_ref_raw, status, paid_at)
    select mpesa_receipt, 1, payer_phone, bill_ref_raw, 'unmatched', now() from public.payments limit 1;
    raise exception 'Duplicate receipt was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.members (pickup_point_id, full_name, phone, qr_number)
    select pickup_point_id, 'Duplicate Test', '254712345678', qr_number from public.members limit 1;
    raise exception 'Duplicate member QR was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.members (pickup_point_id, full_name, phone, qr_number)
    select pickup_point_id, 'Bad Phone', '0712345678', '999' from public.members limit 1;
    raise exception 'Unnormalized phone was accepted';
  exception when check_violation then null;
  end;
end $$;
reset role;
set role anon;
set request.jwt.claim.role = 'anon';
do $$
begin
  begin
    perform count(*) from public.payments;
    raise exception 'Anonymous payment read was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform admin_dashboard(14);
    raise exception 'Anonymous dashboard was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
