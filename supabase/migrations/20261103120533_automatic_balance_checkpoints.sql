-- Snapshots remain manual reconciliation amounts. Automatic balances are derived
-- from these immutable bases plus transaction changes, avoiding double debits.
alter table public.monthly_status add column if not exists balance_checkpoint jsonb;

create or replace function public.initialize_balance_checkpoint(
  p_year integer, p_month integer, p_expected jsonb, p_checkpoint jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_checkpoint) <> 'object' then raise exception 'Invalid checkpoint'; end if;
  update public.monthly_status as s set balance_checkpoint = p_checkpoint
  where s.user_id = auth.uid() and s.year = p_year and s.month = p_month
    and jsonb_build_object('bank_balance',s.bank_balance,'savings_balance',s.savings_balance,
      'bank_balance_date',s.bank_balance_date,'savings_balance_date',s.savings_balance_date,
      'balance_checkpoint',s.balance_checkpoint) = p_expected;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

-- Only the selected field changes; a concurrent reconciliation of another field
-- cannot be overwritten by a stale whole-row upsert from the client.
create or replace function public.reconcile_month_balance(
  p_year integer, p_month integer, p_kind text, p_amount bigint, p_date date, p_basis bigint
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_kind not in ('bank_balance','savings_balance','start_balance','send_wife')
     or p_date is null or extract(year from p_date) <> p_year or extract(month from p_date) <> p_month
     or p_amount is null or p_basis is null then raise exception 'Invalid balance input'; end if;
  insert into public.monthly_status(user_id,year,month) values(auth.uid(),p_year,p_month)
    on conflict (user_id,year,month) do nothing;
  update public.monthly_status as s set
    bank_balance = case when p_kind='bank_balance' then p_amount else s.bank_balance end,
    bank_balance_date = case when p_kind='bank_balance' then p_date else s.bank_balance_date end,
    savings_balance = case when p_kind='savings_balance' then p_amount else s.savings_balance end,
    savings_balance_date = case when p_kind='savings_balance' then p_date else s.savings_balance_date end,
    start_balance = case when p_kind='start_balance' then p_amount else s.start_balance end,
    send_wife = case when p_kind='send_wife' then p_amount else s.send_wife end,
    send_wife_date = case when p_kind='send_wife' then p_date else s.send_wife_date end,
    balance_checkpoint = case when p_kind='send_wife' then s.balance_checkpoint else
      jsonb_set(coalesce(s.balance_checkpoint,'{}'::jsonb),
        array[case p_kind when 'bank_balance' then 'bank' when 'savings_balance' then 'savings' else 'start' end],
        jsonb_build_object('date',p_date,'amount',p_amount,'basis',p_basis),true) end,
    updated_at = now()
  where s.user_id = auth.uid() and s.year = p_year and s.month = p_month;
end;
$$;
revoke all on function public.initialize_balance_checkpoint(integer,integer,jsonb,jsonb) from public,anon;
revoke all on function public.reconcile_month_balance(integer,integer,text,bigint,date,bigint) from public,anon;
grant execute on function public.initialize_balance_checkpoint(integer,integer,jsonb,jsonb) to authenticated;
grant execute on function public.reconcile_month_balance(integer,integer,text,bigint,date,bigint) to authenticated;
