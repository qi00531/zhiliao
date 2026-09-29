create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table rss_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  url text not null,
  canonical_url text not null,
  title text not null,
  site_url text,
  status text not null default 'active' check (status in ('active', 'paused', 'error')),
  frequency text not null default 'adaptive' check (frequency in ('adaptive', 'immediate', 'daily', 'weekly', 'manual')),
  etag text,
  last_modified text,
  next_fetch_at timestamptz,
  last_success_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, canonical_url)
);

create table rss_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references rss_sources(id) on delete cascade,
  external_id text not null,
  url text,
  title text not null,
  author text,
  summary_text text not null default '',
  published_at timestamptz,
  first_seen_at timestamptz not null default now(),
  initial_import boolean not null default false,
  visible_on_home boolean not null default true,
  current_content_hash text not null,
  unique (source_id, external_id)
);

create table rss_item_revisions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references rss_items(id) on delete cascade,
  content_hash text not null,
  title text not null,
  summary_text text not null default '',
  observed_at timestamptz not null default now(),
  unique (item_id, content_hash)
);

create table rss_evidence (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references rss_items(id) on delete cascade,
  source_id uuid not null references rss_sources(id) on delete cascade,
  url text not null,
  title text not null,
  excerpt text not null default '',
  captured_at timestamptz not null default now(),
  unique (item_id, url)
);

create table rss_fetch_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references rss_sources(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text check (outcome in ('success', 'not_modified', 'failed')),
  http_status integer,
  item_count integer not null default 0,
  error_code text,
  error_message text
);

create index rss_sources_due_idx on rss_sources (next_fetch_at)
  where status = 'active' and frequency <> 'manual';
create index rss_items_newest_idx on rss_items (coalesce(published_at, first_seen_at) desc)
  where visible_on_home;
create index rss_fetch_runs_source_idx on rss_fetch_runs (source_id, started_at desc);
