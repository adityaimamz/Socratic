-- Also: question-folder-items lists a whole tag folder so exams can be built by tag.
-- Score breakdown before/after the wrong-answer penalty, for staff views.
-- Points are weights: original = correct points; deduction = wrong answers x penalty.
create or replace function private.attempt_counts(snapshot jsonb, answers jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object(
  'correct',count(*) filter(where sel is not null and sel=correct),
  'wrong',count(*) filter(where sel is not null and sel<>correct),
  'empty',count(*) filter(where sel is null),
  'correct_points',coalesce(sum(weight) filter(where sel is not null and sel=correct),0),
  'penalty',coalesce((snapshot->>'penalty')::numeric,0),
  'total_points',coalesce((select sum((i->>'weight')::numeric) from jsonb_array_elements(snapshot->'items') i),0))
 from (select item->>'correctOptionId' as correct, answers->(item->>'id')->>'optionId' as sel, (item->>'weight')::numeric as weight
  from jsonb_array_elements(snapshot->'items') item where item->>'correctOptionId' is not null) t
$$;

create or replace function private.school_view(actor uuid, view_name text, input jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare a private.attempts; e private.exams; target uuid:=nullif(input->>'id','')::uuid; folder text:=input->>'folder'; key text;
begin
 if view_name='question-folder-items' then
  key:=case when folder='__none__' then '' else private.question_tag_key(folder) end;
  return jsonb_build_object('items',coalesce((select jsonb_agg(private.question_summary(x) order by x.created_at desc,x.id desc) from
   (select * from private.questions q where not q.archived and private.question_visible(actor,q) and private.question_tag_key(q.tag)=key order by q.created_at desc,q.id desc limit 500) x),'[]'));
 end if;
 if view_name='attempt-detail' then
  perform 1 from private.profiles where id=actor and active;
  if not found then raise exception 'UNAUTHORIZED'; end if;
  select * into a from private.attempts where id=target;
  select * into e from private.exams where id=a.exam_id;
  if a.id is null or not private.can_manage(actor,e) then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('attempt_id',a.id,'exam_id',e.id,'name',(select name from private.profiles where id=a.user_id),'status',a.status,
   'items',coalesce(a.snapshot->'items','[]'::jsonb),'answers',a.answers,'counts',private.attempt_counts(a.snapshot,a.answers),
   'result',(select to_jsonb(r)-'grade_payload'-'grade_operation' from private.results r where r.attempt_id=a.id));
 end if;
 return private.school_view_v2(actor,view_name,input);
end $$;
