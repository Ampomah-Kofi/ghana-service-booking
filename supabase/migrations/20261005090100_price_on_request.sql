-- Optional prices (after Phase 7): a service can say "Price on request" (influencer campaigns,
-- electrical jobs, DJ sets). Enum value first; its rules follow in the next migration.
alter type public.price_type add value if not exists 'on_request';
