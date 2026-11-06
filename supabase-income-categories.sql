-- Preserve canonical accounting types while storing the configurable category label.
create or replace function public.log_shortcut_transaction(
 p_hash text,p_request_id uuid,p_amount bigint,p_category text,p_note text,p_display_category text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_display_category is null or length(trim(p_display_category))=0 or length(p_display_category)>64 then raise exception 'Invalid category label' using errcode='22023';end if;
 result=public.log_shortcut_expense(p_hash,p_request_id,p_amount,p_category,p_note);
 if coalesce((result->>'duplicate')::boolean,false) then return result;end if;
 update public.transactions set category_name=p_display_category,description=coalesce(nullif(trim(p_note),''),p_display_category)
 where id=(result->>'id')::uuid;
 return result;
end $$;
revoke all on function public.log_shortcut_transaction(text,uuid,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.log_shortcut_transaction(text,uuid,bigint,text,text,text) to service_role;