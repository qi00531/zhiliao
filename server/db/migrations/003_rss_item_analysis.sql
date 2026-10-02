create table rss_item_analysis (
  item_id uuid primary key references rss_items(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','not_configured')),
  summary text check (summary is null or char_length(summary) <= 120),
  relevance text check (relevance is null or relevance in ('high','medium','low','unknown')),
  reason text check (reason is null or char_length(reason) <= 80),
  model text,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index rss_item_analysis_queue_idx on rss_item_analysis (next_attempt_at) where status in ('pending','failed');
