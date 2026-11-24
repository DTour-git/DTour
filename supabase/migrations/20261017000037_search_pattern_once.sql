-- Search (#18): build the fuzzy regex once per call, not once per row.
-- fuzzy_pattern(q) is immutable, but search() has a fixed search_path so the
-- planner can't inline it, and q is a parameter, so it was re-evaluated for
-- every row of search_documents. A scalar subquery is evaluated once (InitPlan).
-- Results, ordering, grants and the view are unchanged.
create or replace function public.search(q text default '', p_kind text default null, p_limit int default 80)
returns setof public.search_documents language sql stable security invoker set search_path = '' as $$
  select * from public.search_documents d
  where (p_kind is null or d.kind = p_kind)
    and (coalesce(q, '') = '' or lower(d.title) ~ (select public.fuzzy_pattern(q)))
  order by d.popularity desc
  limit p_limit
$$;
