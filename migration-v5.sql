alter table public.monthly_status
add column if not exists send_wife bigint not null default 0;
