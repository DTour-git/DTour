begin;
\ir 00_helpers.sql
select plan(4);

select is((select allowed_mime_types from storage.buckets where id = 'media'),
  array['image/png','image/jpeg','image/webp','image/gif','image/heic','image/heif'],
  'media accepts raster images, including phone HEIC/HEIF images');
select is((select allowed_mime_types from storage.buckets where id = 'library'),
  array['application/pdf','application/zip','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/png','image/jpeg'],
  'library accepts only the supported document and image types');
select ok((select public and file_size_limit = 10485760 from storage.buckets where id = 'media'), 'media stays public with the same size limit');
select ok((select not public and file_size_limit = 52428800 from storage.buckets where id = 'library'), 'library stays private with the same size limit');

select * from finish();
rollback;
