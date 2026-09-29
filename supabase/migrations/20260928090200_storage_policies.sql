-- Storage buckets + policies (docs/architecture.md §11).
-- Buckets are created here so hosted projects match local (config.toml also creates them locally).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-media', 'public-media', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('private-uploads', 'private-uploads', false, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

-- Returns NULL instead of raising for text that isn't a UUID (paths are user input).
create or replace function private.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;
grant execute on function private.try_uuid(text) to anon, authenticated;

-- Path convention: businesses/{business_id}/{logo|photos|staff}/{file}
-- Only owners/managers of that business may write there. Public reads go through the
-- bucket's public URL; this select policy only serves upsert/delete.
create or replace function private.can_write_business_media(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (storage.foldername(p_name))[1] = 'businesses'
     and (storage.foldername(p_name))[3] in ('logo', 'photos', 'staff')
     and array_length(storage.foldername(p_name), 1) = 3
     and private.can_manage_business(private.try_uuid((storage.foldername(p_name))[2]));
$$;
grant execute on function private.can_write_business_media(text) to authenticated;

create policy "business media: managers read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'public-media' and (select private.can_write_business_media(name)));
create policy "business media: managers upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and (select private.can_write_business_media(name)));
create policy "business media: managers replace" on storage.objects for update to authenticated
  using (bucket_id = 'public-media' and (select private.can_write_business_media(name)))
  with check (bucket_id = 'public-media' and (select private.can_write_business_media(name)));
create policy "business media: managers delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-media' and (select private.can_write_business_media(name)));
