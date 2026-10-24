-- Keep feedback tied to the exact question and order in the submitted snapshot.
create function private.essay_feedback(target uuid) returns jsonb language sql stable as $$
 select coalesce(jsonb_agg(jsonb_build_object('item_id',g.item_id,'points',g.points,'feedback',g.feedback,
  'prompt',item.value->>'prompt','max_points',(item.value->>'weight')::numeric) order by item.ord),'[]'::jsonb)
 from private.attempts attempt cross join lateral jsonb_array_elements(attempt.snapshot->'items') with ordinality item(value,ord)
 join private.essay_grades g on g.attempt_id=attempt.id and g.item_id::text=item.value->>'id'
 where attempt.id=target
$$;
revoke all on function private.essay_feedback(uuid) from public,anon,authenticated;
do $migration$
declare definition text; before text := $$coalesce((select jsonb_agg(jsonb_build_object('item_id',g.item_id,'points',g.points,'feedback',g.feedback)) from private.essay_grades g where g.attempt_id=a.id),'[]'::jsonb)$$;
begin
 definition:=pg_get_functiondef('public.school_api(uuid,text,jsonb)'::regprocedure);
 if position(before in definition)=0 then raise exception 'ESSAY_FEEDBACK_ANCHOR_MISSING'; end if;
 execute replace(definition,before,'private.essay_feedback(a.id)');
end;
$migration$;
