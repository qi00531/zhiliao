create table rss_seen_items (
  source_id uuid not null references rss_sources(id) on delete cascade,
  external_id text not null,
  first_seen_at timestamptz not null default now(),
  primary key (source_id, external_id)
);
