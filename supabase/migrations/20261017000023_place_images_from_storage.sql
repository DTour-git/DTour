-- A place's photo must be one uploaded to DTour's own `media` bucket (issue #43).
-- Places are public and shown on the home page, so a third-party image URL there works as a
-- tracking pixel: every visitor's browser would fetch it, leaking IP, user agent and visit time.
--
-- uploadImage() in packages/shared/src/api.ts is the only writer and stores
--   <project URL>/storage/v1/object/public/media/<uploader uuid>/<file name>
-- The project URL differs per project, so the host is matched by shape: a hosted Supabase project
-- (https://<20-letter ref>.supabase.co) or a local CLI stack (http://127.0.0.1:<port>). Clients
-- check the exact host before showing an image (mediaImageUrl in packages/shared/src/media.ts).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.is_media_image_url(url text) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select url ~ ('^(https://[a-z0-9]{20}\.supabase\.co|http://(127\.0\.0\.1|localhost):[0-9]{1,5})'
                '/storage/v1/object/public/media/'
                '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
                '[A-Za-z0-9_-][A-Za-z0-9._-]*$')
     and url !~ '\.\.'
$$;
-- Not revoked: a CHECK constraint runs its function as the writing role, so members need execute.

-- Rows written before this check that point anywhere else lose the photo (the halftone shows instead).
-- The demo seed sets no place photos, so this only touches member-recommended places.
update public.places set image_path = null
where image_path is not null and not public.is_media_image_url(image_path);

alter table public.places
  add constraint places_image_path_is_media
  check (image_path is null or public.is_media_image_url(image_path));

commit;
