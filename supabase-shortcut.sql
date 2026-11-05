create table public.shortcut_connections (
 user_id uuid primary key references auth.users(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '1 year',
 window_started_at timestamptz not null default now(),
 enabled boolean not null default true,
 window_count integer not null default 0 check(window_count>=0)
);
alter table public.shortcut_connections enable row level security;
revoke all on public.shortcut_connections from anon,authenticated;
grant select,delete on public.shortcut_connections to authenticated;
grant insert,update on public.shortcut_connections to authenticated;

grant all on public.shortcut_connections to service_role;
create policy shortcut_select_own on public.shortcut_connections for select to authenticated using((select auth.uid())=user_id);
create policy shortcut_insert_own on public.shortcut_connections for insert to authenticated with check((select auth.uid())=user_id);
create policy shortcut_update_own on public.shortcut_connections for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy shortcut_delete_own on public.shortcut_connections for delete to authenticated using((select auth.uid())=user_id);
alter table public.transactions add column category_name text;

-- Service-only, invoker function: bearer credential validation, rate limiting, idempotency,
-- preservation of existing reconciliation snapshots and insert occur in one transaction.
create or replace function public.log_shortcut_expense(
 p_hash text,p_request_id uuid,p_amount bigint,p_category text,p_note text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare conn public.shortcut_connections%rowtype; existing public.transactions%rowtype;
 today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
 row_id uuid; s public.monthly_status%rowtype; checkpoint jsonb; kind text; d date;
 amount bigint; basis bigint; saved jsonb;
begin
 select * into conn from public.shortcut_connections where token_hash=p_hash and expires_at>now() for update;
 if not found then raise exception 'Invalid shortcut connection' using errcode='28000';end if;
 if not conn.enabled then raise exception 'Shortcut paused' using errcode='28001';end if;
 if p_amount is null or p_amount<=0 or p_amount>1000000000000 or p_category is null or length(p_category)>64 or length(trim(p_category))=0 or length(coalesce(p_note,''))>500 then
  raise exception 'Invalid expense' using errcode='22023';
 end if;
 select * into existing from public.transactions where user_id=conn.user_id and source_key='app-shortcut-'||p_request_id;
 if found then return jsonb_build_object('ok',true,'duplicate',true,'id',existing.id,'message','Đã lưu giao dịch.');end if;
 if conn.window_started_at < now()-interval '1 hour' then
  update public.shortcut_connections set window_started_at=now(),window_count=1 where user_id=conn.user_id;
 elsif conn.window_count>=120 then raise exception 'Too many requests' using errcode='54000';
 else update public.shortcut_connections set window_count=window_count+1 where user_id=conn.user_id;end if;
 -- Never reinterpret a reconciliation snapshot inside a shortcut.
 -- The signed-in app initializes these with the shared balance engine before pairing.
 for s in select * from public.monthly_status where user_id=conn.user_id and year*12+month<=extract(year from today)::int*12+extract(month from today)::int loop
  foreach kind in array array['bank','savings'] loop
   amount=case when kind='bank' then s.bank_balance else s.savings_balance end;
   d=case when kind='bank' then s.bank_balance_date else s.savings_balance_date end;
   if d is null and coalesce(amount,0)=0 then continue;end if;
   d=coalesce(d,(make_date(s.year,s.month,1)+interval '1 month - 1 day')::date);
   saved=s.balance_checkpoint->kind;
   if saved is null or saved->>'date' is distinct from d::text or (saved->>'amount')::numeric is distinct from amount or not(saved ? 'basis') then
    raise exception 'Mở Happy Money và làm mới số dư trước khi dùng Back Tap.' using errcode='55000';
   end if;
  end loop;
 end loop;
 insert into public.transactions(user_id,year,month,txn_date,description,income,expense,source,payment_method,source_key,category_name)
 values(conn.user_id,extract(year from today),extract(month from today),today,coalesce(nullif(trim(p_note),''),p_category),case when p_category in ('Thu nhập','Rút tiết kiệm','Số dư đầu tháng') then p_amount else 0 end,case when p_category in ('Thu nhập','Rút tiết kiệm','Số dư đầu tháng') then 0 else p_amount end,'app','bank','app-shortcut-'||p_request_id,p_category) returning id into row_id;
 return jsonb_build_object('ok',true,'id',row_id,'message','Đã lưu giao dịch.');
end $$;
revoke all on function public.log_shortcut_expense(text,uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.log_shortcut_expense(text,uuid,bigint,text,text) to service_role;