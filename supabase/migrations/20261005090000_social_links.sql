-- Social links on business profiles (after Phase 7): customers check a barber's Instagram,
-- a brand checks an influencer's TikTok. Handles are stored without "@"; pages are https URLs.
alter table public.businesses
  add column instagram_handle text check (instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  add column tiktok_handle    text check (tiktok_handle ~ '^[A-Za-z0-9._]{2,24}$'),
  add column x_handle         text check (x_handle ~ '^[A-Za-z0-9_]{1,15}$'),
  add column facebook_url     text check (facebook_url ~ '^https://([a-z0-9-]+\.)?(facebook\.com|fb\.com)/' and char_length(facebook_url) <= 200),
  add column youtube_url      text check (youtube_url ~ '^https://((www|m)\.)?(youtube\.com|youtu\.be)/' and char_length(youtube_url) <= 200),
  add column website_url      text check (website_url ~ '^https://[^\s/]+\.[^\s]+$' and char_length(website_url) <= 200);

grant update (instagram_handle, tiktok_handle, x_handle, facebook_url, youtube_url, website_url)
  on public.businesses to authenticated;
