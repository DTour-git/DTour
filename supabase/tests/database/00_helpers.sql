-- Shared helpers, \ir-included by each test file. Run as the postgres role.
-- try_as(role, user, sql): run sql as that role/user; returns 'ok' or the SQLSTATE it failed with.
-- count_as(role, user, sql): run a count(*) query as that role/user.
create or replace function pg_temp.claims(uid uuid) returns text language sql as $$
  select case when uid is null then '{"role":"anon"}'
              else json_build_object('sub', uid, 'role', 'authenticated')::text end
$$;

create or replace function pg_temp.try_as(r text, uid uuid, q text) returns text language plpgsql as $$
declare st text;
begin
  perform set_config('request.jwt.claims', pg_temp.claims(uid), true);
  execute format('set local role %I', r);
  begin
    execute q;
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    reset role;
    return st;
  end;
  reset role;
  return 'ok';
end $$;

create or replace function pg_temp.count_as(r text, uid uuid, q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claims', pg_temp.claims(uid), true);
  execute format('set local role %I', r);
  execute q into n;
  reset role;
  return n;
end $$;
