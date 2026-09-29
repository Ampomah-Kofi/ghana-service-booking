-- Storage policies for the public-media bucket (businesses/{business_id}/{logo|photos|staff}/file).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  if p_user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;

-- Kwame owns b…01. Efua is staff at b…02. Akosua manages b…03.
select pg_temp.act_as('a0000000-0000-4000-8000-000000000001');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'businesses/b0000000-0000-4000-8000-000000000001/photos/a-400.webp') $$,
  'owner uploads into their own business folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'businesses/b0000000-0000-4000-8000-000000000002/photos/evil.webp') $$,
  '42501', null, 'owner A cannot upload into business B''s folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'businesses/b0000000-0000-4000-8000-000000000001/secrets/x.webp') $$,
  '42501', null, 'only logo/photos/staff subfolders are allowed');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'businesses/not-a-uuid/photos/x.webp') $$,
  '42501', null, 'malformed business ids are refused, not errors');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'businesses/b0000000-0000-4000-8000-000000000001/photos/deep/x.webp') $$,
  '42501', null, 'no nested folders');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('private-uploads', 'businesses/b0000000-0000-4000-8000-000000000001/photos/x.webp') $$,
  '42501', null, 'no writes to the private bucket yet');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000003');  -- Efua (staff)
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'businesses/b0000000-0000-4000-8000-000000000002/logo/x.webp') $$,
  '42501', null, 'staff cannot upload business media');

select pg_temp.act_as('a0000000-0000-4000-8000-000000000005');  -- Akosua (manager of b…03)
-- The Storage API sets this flag for its own deletes; set it so the RLS policy is what's under test.
select set_config('storage.allow_delete_query', 'true', true);
select is_empty($$ delete from storage.objects where name like 'businesses/b0000000-0000-4000-8000-000000000001/%' returning name $$,
  'a manager of another business cannot delete A''s files');

select pg_temp.act_as(null);
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('public-media', 'businesses/b0000000-0000-4000-8000-000000000001/photos/anon.webp') $$,
  '42501', null, 'anon cannot upload');

select * from finish();
rollback;
