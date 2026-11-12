-- Approving a guide publishes only that guide (#53).
-- review_wiki_article used to publish every suggested revision of the
-- article, even when the article was no longer pending (a double click, a
-- stale /mod tab, a direct RPC call). Edits nobody had reviewed went live.
-- Now:
-- 1. Only a pending guide can be reviewed. Anything else is an error, which
--    /mod already shows to the moderator.
-- 2. Approving publishes the guide and its own first revision (the one
--    createWikiArticle writes with the same body). That is what the
--    moderator read in /mod. Every other suggested edit stays suggested and
--    shows up under "Suggested edits" once the guide is live, to be reviewed
--    one by one with review_wiki_revision.
begin;

create or replace function public.review_wiki_article(p_article bigint, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  if not public.is_moderator() then raise exception 'Only moderators can review articles'; end if;

  -- The row lock makes a second, concurrent call wait and then find the guide
  -- no longer pending.
  update public.wiki_articles set status = case when p_approve then 'published' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_article and status = 'pending'
  returning id, started_by, body into a;
  if not found then raise exception 'This guide is not waiting for review'; end if;

  if p_approve then
    -- Publishing the revision applies its body (tg_wiki_revision), so it has
    -- to match the body the moderator approved.
    update public.wiki_revisions set status = 'published', reviewed_by = auth.uid(), reviewed_at = now()
    where id = (select r.id from public.wiki_revisions r
                where r.article_id = a.id and r.editor_id = a.started_by and r.status = 'suggested'
                  and coalesce(r.body, a.body) = a.body
                order by r.id limit 1);
  end if;
end $$;

-- Only signed-in moderators review, so visitors don't need either RPC.
revoke all on function public.review_wiki_article(bigint, boolean, text),
                       public.review_wiki_revision(bigint, boolean, text) from public, anon;
grant execute on function public.review_wiki_article(bigint, boolean, text),
                          public.review_wiki_revision(bigint, boolean, text) to authenticated;

commit;
