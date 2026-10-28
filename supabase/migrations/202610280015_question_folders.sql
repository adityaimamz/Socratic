-- Question folders (grouped by tag) and live correct/wrong counts for monitoring.
-- school_view is wrapped, not rewritten: the previous body stays reachable as school_view_base.
alter function private.school_view(uuid,text,jsonb) rename to school_view_base;

create function private.question_tag_key(t text) returns text
language sql immutable set search_path='' as $$ select lower(btrim(coalesce(t,''))) $$;

create function private.attempt_counts(snapshot jsonb, answers jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object(
  'correct',count(*) filter(where sel is not null and sel=correct),
  'wrong',count(*) filter(where sel is not null and sel<>correct),
  'empty',count(*) filter(where sel is null))
 from (select item->>'correctOptionId' as correct, answers->(item->>'id')->>'optionId' as sel
  from jsonb_array_elements(snapshot->'items') item where item->>'correctOptionId' is not null) t
$$;

create function private.school_view(actor uuid, view_name text, input jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare search text:=coalesce(input->>'q',''); folder text:=input->>'folder';
 target uuid:=nullif(input->>'id','')::uuid; page_no integer:=greatest(1,coalesce((input->>'page')::integer,1)); rows jsonb; total_n bigint; result jsonb; key text;
begin
 if view_name='question-folders' then
  select coalesce(jsonb_agg(jsonb_build_object('tag',f.label,'key',f.key,'count',f.n) order by f.key='',f.key),'[]') into rows
  from (select private.question_tag_key(x.tag) as key,min(btrim(x.tag)) as label,count(*) as n from private.questions x
   where not x.archived and private.question_visible(actor,x)
    and (search='' or position(lower(search) in lower(x.prompt))>0 or position(lower(search) in lower(x.tag))>0)
   group by 1) f;
  return jsonb_build_object('folders',rows);
 elsif view_name='questions' and folder is not null then
  key:=case when folder='__none__' then '' else private.question_tag_key(folder) end;
  select count(*) into total_n from private.questions x where not x.archived and private.question_visible(actor,x) and private.question_tag_key(x.tag)=key
   and (search='' or position(lower(search) in lower(x.prompt))>0);
  select coalesce(jsonb_agg(private.question_summary(x) order by x.created_at desc,x.id desc),'[]') into rows from
   (select * from private.questions q where not q.archived and private.question_visible(actor,q) and private.question_tag_key(q.tag)=key
    and (search='' or position(lower(search) in lower(q.prompt))>0) order by q.created_at desc,q.id desc limit 50 offset (page_no-1)*50) x;
  return jsonb_build_object('items',rows,'total',total_n,'page',page_no,'pageSize',50);
 end if;
 result:=private.school_view_base(actor,view_name,input);
 if view_name='monitor' and result ? 'attempts' then
  select coalesce(jsonb_agg(a.value||jsonb_build_object('counts',private.attempt_counts(t.snapshot,t.answers)) order by a.ord),'[]') into rows
  from jsonb_array_elements(result->'attempts') with ordinality a(value,ord) join private.attempts t on t.id=(a.value->>'id')::uuid;
  result:=jsonb_set(result,'{attempts}',rows);
 end if;
 if view_name='exam-editor' and target is not null then
  result:=result||jsonb_build_object('has_attempts',exists(select 1 from private.attempts where exam_id=target));
 end if;
 return result;
end $$;

revoke all on function private.school_view(uuid,text,jsonb),private.school_view_base(uuid,text,jsonb),private.question_tag_key(text),private.attempt_counts(jsonb,jsonb) from public,anon,authenticated;
