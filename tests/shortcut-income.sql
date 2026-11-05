-- Integration fixture only. All users, connections, and transactions roll back.
begin;
do $test$
declare owner uuid := gen_random_uuid(); req uuid := gen_random_uuid(); hash text := md5(random()::text)||md5(random()::text); result jsonb;
begin
 insert into auth.users(id) values(owner);
 insert into public.shortcut_connections(user_id,token_hash) values(owner,hash);
 result=public.log_shortcut_expense(hash,req,1000000,'Thu nhập','Lương');
 perform public.log_shortcut_expense(hash,req,1000000,'Thu nhập','Lương');
 if (select count(*) from public.transactions where user_id=owner)<>1 then raise exception 'Duplicate income';end if;
 if not exists(select 1 from public.transactions where user_id=owner and income=1000000 and expense=0 and category_name='Thu nhập' and description='Lương' and payment_method='bank') then raise exception 'Wrong income direction';end if;
 perform public.log_shortcut_expense(hash,gen_random_uuid(),25000,'Ăn uống','Bữa trưa');
 if (select sum(income-expense) from public.transactions where user_id=owner)<>975000 then raise exception 'Wrong net balance';end if;
 if (select window_count from public.shortcut_connections where user_id=owner)<>2 then raise exception 'Duplicate consumed rate limit';end if;
 update public.shortcut_connections set enabled=false where user_id=owner;
 begin perform public.log_shortcut_expense(hash,gen_random_uuid(),1000000,'Thu nhập','Thưởng');raise exception 'Paused income accepted';
 exception when sqlstate '28001' then null;end;
 if (select count(*) from public.transactions where user_id=owner)<>2 then raise exception 'Paused insert';end if;
end $test$;
rollback;