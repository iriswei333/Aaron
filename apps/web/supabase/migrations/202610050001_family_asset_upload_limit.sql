-- Direct mobile uploads bypass the application server, so enforce the same
-- per-photo limit at the private storage boundary as the application uses.
update storage.buckets
set file_size_limit = 20971520
where id = 'family-assets';
