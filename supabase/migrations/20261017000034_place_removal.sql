-- Places can be deleted by their author or a moderator (#28).
--
-- places had an insert policy and nothing else, so once a student added a
-- place, nobody could take it down through the product, not even a moderator.
-- (The rest of #28 is already fixed: 20261017000025 stops clients setting
-- home_sort, so a new place can't pin itself to the Today page, and
-- 20261017000023 limits place images to our own storage.) Hearts on a deleted
-- place cascade away with it.
create policy "delete own place, or any as a moderator" on public.places for delete to authenticated
  using (author_id = auth.uid() or public.is_moderator());
grant delete on public.places to authenticated;
