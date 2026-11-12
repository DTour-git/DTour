begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif','image/heic','image/heif']
where id = 'media';

update storage.buckets
set allowed_mime_types = array['application/pdf','application/zip','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation','image/png','image/jpeg']
where id = 'library';

-- Existing object ownership policies, grants, visibility and size limits stay in effect.
commit;
