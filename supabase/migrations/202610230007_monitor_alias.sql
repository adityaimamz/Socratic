-- Avoid collision with the PL/pgSQL attempt row variable named a.
do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('public.school_api(uuid,text,jsonb)'::regprocedure);
  if position('jsonb_each(x.answers) a where a.value' in definition) > 0 then
    definition := replace(definition,
      'jsonb_each(x.answers) a where a.value',
      'jsonb_each(x.answers) answered_entry where answered_entry.value');
    execute definition;
  end if;
end;
$migration$;
