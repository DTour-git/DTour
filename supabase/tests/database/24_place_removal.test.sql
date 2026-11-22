-- Places (#28): the author or a moderator can delete one; nobody else can.
-- e2e1 adds the places, profile 2 is another member, e2e2 the moderator.
begin;
\ir 00_helpers.sql
select plan(6);

insert into public.places (id, author_id, category, name, where_label, sort)
overriding system value values
  (90901, '00000000-0000-4000-8000-00000000e2e1', 'nearby', 'Test momo stall', 'Near the gate', 50),
  (90902, '00000000-0000-4000-8000-00000000e2e1', 'nearby', 'Another test stall', 'Sector 11', 50);
insert into public.place_hearts (place_id, user_id) values (90901, '00000000-0000-4000-8000-000000000002');

select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-000000000002',
  'with d as (delete from public.places where id = 90901 returning 1) select count(*) from d'), 0::bigint,
  'another member cannot delete someone else''s place');
select is(pg_temp.try_as('anon', null, 'delete from public.places where id = 90901'), '42501',
  'a visitor cannot delete a place');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e1',
  'with d as (delete from public.places where id = 90901 returning 1) select count(*) from d'), 1::bigint,
  'the author can delete their own place');
select is((select count(*) from public.place_hearts where place_id = 90901), 0::bigint, 'its hearts go with it');
select is(pg_temp.count_as('authenticated', '00000000-0000-4000-8000-00000000e2e2',
  'with d as (delete from public.places where id = 90902 returning 1) select count(*) from d'), 1::bigint,
  'a moderator can remove any place');
select is(pg_temp.count_as('anon', null, 'select count(*) from public.places where id in (90901, 90902)'), 0::bigint,
  'and both are gone for visitors too');

select * from finish();
rollback;
