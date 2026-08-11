-- Run once in Supabase SQL Editor.
-- Adds independent editable dates for the three manually tracked balances.
alter table public.monthly_status
  add column if not exists bank_balance_date date,
  add column if not exists savings_balance_date date,
  add column if not exists send_wife_date date;

update public.monthly_status
set
  bank_balance_date = coalesce(bank_balance_date, updated_at::date),
  savings_balance_date = coalesce(savings_balance_date, updated_at::date),
  send_wife_date = coalesce(send_wife_date, updated_at::date)
where bank_balance_date is null
   or savings_balance_date is null
   or send_wife_date is null;
