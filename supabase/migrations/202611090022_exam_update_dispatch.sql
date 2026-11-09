-- school_request never routed exams.update to school_exam_update, so editing a published
-- exam always failed with NOT_FOUND. Dispatch it explicitly.
do $migration$
declare
 definition text:=pg_get_functiondef('public.school_request(uuid,text,text,text,jsonb)'::regprocedure);
 anchor text:=$$  elsif p_action='exams.accommodation.get' then$$;
begin
 if position(anchor in definition)=0 then raise exception 'EXAM_UPDATE_DISPATCH_ANCHOR_MISSING'; end if;
 if position('school_exam_update' in definition)>0 then return; end if;
 execute replace(definition,anchor,$$  elsif p_action='exams.update' then result:=public.school_exam_update(p_actor,(p_data->>'id')::uuid,p_data);
$$||anchor);
end;
$migration$;
