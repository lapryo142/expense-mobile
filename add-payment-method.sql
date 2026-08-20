alter table public.transactions
add column if not exists payment_method text;

alter table public.transactions
drop constraint if exists transactions_payment_method_check;

alter table public.transactions
add constraint transactions_payment_method_check
check (payment_method is null or payment_method in ('bank', 'cash', 'pay_later'));

update public.transactions
set payment_method = 'pay_later'
where payment_method is null
  and (
    lower(description) like '%trả sau%'
    or lower(description) like '%pay later%'
  );
