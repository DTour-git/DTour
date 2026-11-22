-- Who's online (#41): the private presence:dtour channel is for signed-in
-- students only. Realtime asks Postgres whether a client may read or track by
-- running these RLS checks with realtime.topic() set to the channel's topic.
begin;
\ir 00_helpers.sql
select plan(6);

create function pg_temp.can_read(r text, uid uuid, topic text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('realtime.topic', topic, true);
  return pg_temp.count_as(r, uid, $q$select count(*) from realtime.messages where extension = 'presence' and topic = current_setting('realtime.topic')$q$);
end $$;
create function pg_temp.can_track(r text, uid uuid, topic text) returns text language plpgsql as $$
begin
  perform set_config('realtime.topic', topic, true);
  return pg_temp.try_as(r, uid, format(
    $q$insert into realtime.messages (topic, extension, payload, event, private) values (%L, 'presence', '{}', 'track', true)$q$, topic));
end $$;

-- A presence message on the private channel, as Realtime would store it.
insert into realtime.messages (topic, extension, payload, event, private)
values ('presence:dtour', 'presence', '{"id":"x","handle":"someone","board":"academics"}', 'track', true);

select is(pg_temp.can_read('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'presence:dtour'), 1::bigint,
  'a signed-in student can see who is online');
select is(pg_temp.can_track('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'presence:dtour'), 'ok',
  'a signed-in student can say they are online');
select is(pg_temp.can_read('anon', null, 'presence:dtour'), 0::bigint,
  'a visitor cannot see who is online');
select isnt(pg_temp.can_track('anon', null, 'presence:dtour'), 'ok',
  'a visitor cannot track themselves (or anyone) on the private channel');

-- The policies only open this one channel.
select is(pg_temp.can_track('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'some:other:topic'), '42501',
  'the policy does not open other private channels');
select is(pg_temp.can_read('authenticated', '00000000-0000-4000-8000-00000000e2e1', 'some:other:topic'), 0::bigint,
  'or let students read them');

select * from finish();
rollback;
