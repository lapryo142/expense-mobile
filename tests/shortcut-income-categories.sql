begin;
do $test$
declare owner uuid:=gen_random_uuid();hash text:=md5(random()::text)||md5(random()::text);req uuid:=gen_random_uuid();result jsonb;
begin
 insert into auth.users(id) values(owner);insert into public.shortcut_connections(user_id,token_hash) values(owner,hash);
 result=public.log_shortcut_transaction(hash,req,1000000,'Thu nhập','Lương tháng','Lương chính');
 perform public.log_shortcut_transaction(hash,req,2000000,'Thu nhập','Changed retry','Different label');
 if (select count(*) from public.transactions where user_id=owner)<>1 then raise exception 'Duplicate insert';end if;
 if not exists(select 1 from public.transactions where user_id=owner and income=1000000 and expense=0 and category_name='Lương chính' and description='Lương tháng') then raise exception 'Incorrect label or duplicate mutation';end if;
 perform public.log_shortcut_transaction(hash,gen_random_uuid(),200000,'Rút tiết kiệm','','Chuyển từ tiết kiệm');
 if not exists(select 1 from public.transactions where user_id=owner and income=200000 and expense=0 and category_name='Chuyển từ tiết kiệm' and description='Chuyển từ tiết kiệm') then raise exception 'Incorrect funding label';end if;
 if has_function_privilege('authenticated','public.log_shortcut_transaction(text,uuid,bigint,text,text,text)','execute') or has_function_privilege('anon','public.log_shortcut_transaction(text,uuid,bigint,text,text,text)','execute') then raise exception 'Public write access';end if;
end $test$;
rollback;