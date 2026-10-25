-- "Turn into a thread" from the Lounge, made safe to expose in the apps.
-- The function runs with owner rights, so it now applies the same rules as
-- posting a thread directly: no verified-only boards unless you may post there,
-- a 3–140 character title, and each message becomes a thread only once.
create or replace function public.promote_lounge_message(p_message bigint, p_board uuid, p_title text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare msg record; b record; tid bigint; t text := btrim(p_title);
begin
  select * into msg from public.lounge_messages where id = p_message;
  if msg is null then raise exception 'Message not found'; end if;
  if msg.author_id is distinct from auth.uid() then raise exception 'Only the author can turn a message into a thread'; end if;
  if msg.promoted_thread_id is not null then raise exception 'This message is already a thread'; end if;
  if char_length(t) not between 3 and 140 then raise exception 'Titles are 3–140 characters'; end if;
  select id, verified_only, link_screen into b from public.boards where id = p_board;
  if b is null or b.link_screen is not null then raise exception 'Pick a board to post in'; end if;
  if b.verified_only and not public.is_society_poster() then raise exception 'Only verified accounts can post in that board'; end if;
  insert into public.threads (board_id, author_id, title, body, from_lounge_message_id)
  values (p_board, msg.author_id, t, msg.body, msg.id) returning id into tid;
  update public.lounge_messages set promoted_thread_id = tid where id = p_message;
  return tid;
end $$;
revoke execute on function public.promote_lounge_message(bigint, uuid, text) from anon, public;
grant execute on function public.promote_lounge_message(bigint, uuid, text) to authenticated;
