
-- Expense Mobile V2 schema
create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  row_order int,
  description text not null,
  txn_date date,
  income bigint not null default 0,
  expense bigint not null default 0,
  source text not null default 'app',
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, source_key)
);

create table if not exists public.monthly_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  start_balance bigint not null default 0,
  total_income bigint not null default 0,
  total_expense bigint not null default 0,
  remaining bigint not null default 0,
  bank_balance bigint not null default 0,
  food_difference bigint not null default 0,
  savings_balance bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, year, month)
);

alter table public.transactions enable row level security;
alter table public.monthly_status enable row level security;

grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.monthly_status to authenticated;

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

create policy "transactions_select_own" on public.transactions
for select to authenticated using ((select auth.uid()) = user_id);

create policy "transactions_insert_own" on public.transactions
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "transactions_update_own" on public.transactions
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "transactions_delete_own" on public.transactions
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "monthly_select_own" on public.monthly_status;
drop policy if exists "monthly_insert_own" on public.monthly_status;
drop policy if exists "monthly_update_own" on public.monthly_status;
drop policy if exists "monthly_delete_own" on public.monthly_status;

create policy "monthly_select_own" on public.monthly_status
for select to authenticated using ((select auth.uid()) = user_id);

create policy "monthly_insert_own" on public.monthly_status
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "monthly_update_own" on public.monthly_status
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "monthly_delete_own" on public.monthly_status
for delete to authenticated using ((select auth.uid()) = user_id);
