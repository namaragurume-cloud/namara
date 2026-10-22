-- =====================================================================
-- NAMARA PLATFORM 初期スキーマ（Phase 2 で Supabase に適用予定）
--
-- 方針
-- - 共通の stores.id（store_id）で なまらAI と NAMARA REVIEW を紐づける
-- - すべてのテーブルで RLS を有効化。消費者の検索ログ等は anon / authenticated から一切読めない
-- - サーバー（service_role）だけが検索ログ・イベントを書き込む
-- - 店舗ユーザーには「自分の組織・担当店舗」のデータと、匿名集計関数の結果だけを返す
-- - 外部トークン（Google OAuth 等）はテーブルに保存せず Supabase Vault に置き、ここには参照IDだけ持つ
--
-- ※ このファイルはまだ本番に適用していません（docs/PROGRESS.md 参照）
-- =====================================================================

create extension if not exists pg_trgm;
-- 将来、意味検索を行う場合に pgvector を追加する（Phase 3 以降で判断）
-- create extension if not exists vector;

-- ---------------------------------------------------------------------
-- 共通：更新日時
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 組織・ユーザー・権限
-- ---------------------------------------------------------------------
create table public.plans (
  id text primary key,
  name text not null,
  price_yen integer not null check (price_yen >= 0),
  billing_unit text not null check (billing_unit in ('month', 'item')),
  price_is_from boolean not null default false,
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '[]'::jsonb,
  is_provisional boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 運営者（なまらグルメ）。service_role のみが追加できる
create table public.platform_operators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null check (status in ('trial', 'active', 'past_due', 'canceled')),
  current_period_end date,
  -- 決済サービスの顧客ID等（Phase 10）。カード情報は保存しない
  external_customer_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 共通店舗マスター
-- ---------------------------------------------------------------------
-- エリア・ジャンル・利用シーン・希望条件の辞書（store_categories / store_features を統合）
create table public.store_categories (
  id text primary key,
  kind text not null check (kind in ('area', 'genre', 'scene', 'feature')),
  label text not null,
  synonyms text[] not null default '{}',
  parent_id text references public.store_categories (id),
  sort_order integer not null default 0
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  is_sample boolean not null default false,
  published boolean not null default false,
  area_id text not null references public.store_categories (id),
  city text not null,
  address text not null,
  genre_ids text[] not null default '{}',
  scene_ids text[] not null default '{}',
  feature_ids text[] not null default '{}',
  tags text[] not null default '{}',
  lunch_min_yen integer check (lunch_min_yen > 0),
  lunch_max_yen integer check (lunch_max_yen >= lunch_min_yen),
  dinner_min_yen integer check (dinner_min_yen > 0),
  dinner_max_yen integer check (dinner_max_yen >= dinner_min_yen),
  -- 価格の根拠。根拠が無い価格は登録しない
  budget_basis text,
  hours_text text,
  reservation_url text check (reservation_url ~ '^https://'),
  website_url text check (website_url ~ '^https://'),
  photo_url text,
  photo_credit text,
  photo_license text check (photo_license in ('owner_provided', 'namara_original', 'google_places')),
  lat double precision,
  lng double precision,
  location_approximate boolean not null default true,
  verification_status text not null default 'unverified' check (verification_status in ('verified', 'unverified')),
  verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_budget_has_basis check (
    (lunch_min_yen is null and dinner_min_yen is null) or budget_basis is not null
  ),
  constraint stores_photo_has_credit check (photo_url is null or (photo_credit is not null and photo_license is not null)),
  constraint stores_publish_requires_verification check (not published or verification_status = 'verified')
);
create index stores_area_idx on public.stores (area_id) where published;
create index stores_genre_idx on public.stores using gin (genre_ids);
create index stores_feature_idx on public.stores using gin (feature_ids);
create index stores_name_trgm_idx on public.stores using gin (name gin_trgm_ops);
create index stores_org_idx on public.stores (organization_id);

-- 店舗情報の出典と更新履歴
create table public.store_sources (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  source_type text not null check (source_type in ('owner', 'operator', 'google_places', 'sample')),
  source_url text,
  license_note text,
  changed_fields text[] not null default '{}',
  recorded_by uuid references auth.users (id),
  recorded_at timestamptz not null default now()
);

create table public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

-- ---------------------------------------------------------------------
-- 消費者（なまらAI）：識別子・同意・検索ログ
-- 個人に結び付く情報は anon / authenticated から読めない（service_role のみ）
-- ---------------------------------------------------------------------
create table public.consumer_identities (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('line', 'web')),
  -- HMAC-SHA256(IDENTITY_HASH_SECRET, 'line:' || userId)。生の LINE userId は保存しない
  identifier_hash text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (channel, identifier_hash)
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.consumer_identities (id) on delete cascade,
  purpose text not null check (purpose in ('service', 'anonymous_statistics', 'marketing')),
  policy_version text not null,
  granted boolean not null,
  recorded_at timestamptz not null default now()
);

create table public.search_sessions (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid references public.consumer_identities (id) on delete set null,
  channel text not null check (channel in ('line', 'web')),
  started_at timestamptz not null default now()
);

-- search_filters は search_queries の正規化済み列に統合（集計しやすくするため）
create table public.search_queries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.search_sessions (id) on delete cascade,
  channel text not null check (channel in ('line', 'web')),
  raw_text text check (char_length(raw_text) <= 200),
  raw_text_expires_at timestamptz not null default now() + interval '90 days',
  parser text not null check (parser in ('rule', 'openai')),
  parsed jsonb not null,
  area_ids text[] not null default '{}',
  cities text[] not null default '{}',
  genre_ids text[] not null default '{}',
  scene_ids text[] not null default '{}',
  feature_ids text[] not null default '{}',
  budget_band text,
  meal_time text check (meal_time in ('lunch', 'dinner')),
  result_count integer not null check (result_count between 0 and 5),
  refined_from uuid references public.search_queries (id) on delete set null,
  created_at timestamptz not null default now()
);
create index search_queries_created_idx on public.search_queries (created_at);
create index search_queries_area_idx on public.search_queries using gin (area_ids);

create table public.recommendation_batches (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.search_queries (id) on delete cascade,
  algorithm_version text not null,
  total_candidates integer not null,
  created_at timestamptz not null default now()
);

create table public.recommendation_items (
  batch_id uuid not null references public.recommendation_batches (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  -- 0 はスポンサー枠、1〜5 が通常推薦
  position smallint not null check (position between 0 and 5),
  sponsored boolean not null default false,
  score numeric not null,
  reasons jsonb not null,
  primary key (batch_id, position),
  constraint recommendation_items_sponsored_slot check ((position = 0) = sponsored)
);
create index recommendation_items_store_idx on public.recommendation_items (store_id);

create table public.interaction_events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  event_type text not null check (event_type in (
    'search_submitted', 'search_parsed', 'recommendation_shown', 'store_detail_clicked', 'map_clicked',
    'reservation_link_clicked', 'store_saved', 'search_refined', 'no_result'
  )),
  channel text not null check (channel in ('line', 'web')),
  session_id uuid references public.search_sessions (id) on delete cascade,
  query_id uuid references public.search_queries (id) on delete set null,
  store_id uuid references public.stores (id) on delete set null,
  position smallint,
  sponsored boolean not null default false,
  created_at timestamptz not null default now()
);
create index interaction_events_store_idx on public.interaction_events (store_id, created_at);

-- ---------------------------------------------------------------------
-- 広告（表示・クリック・課金を別テーブルで記録）
-- ad_budgets は campaigns.budget_yen と ad_billing_events の合計で管理
-- ---------------------------------------------------------------------
create table public.ad_placements (
  id text primary key,
  description text not null,
  max_slots smallint not null check (max_slots between 0 and 3)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  placement_id text not null default 'search_sponsored' references public.ad_placements (id),
  name text not null check (char_length(name) between 1 and 60),
  target_area_ids text[] not null check (cardinality(target_area_ids) between 1 and 5),
  target_genre_ids text[] not null check (cardinality(target_genre_ids) between 1 and 5),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  status text not null default 'pending_review' check (status in (
    'draft', 'pending_review', 'approved', 'rejected', 'paused', 'stopped', 'budget_exhausted'
  )),
  budget_yen integer not null check (budget_yen >= 9800),
  cpc_yen integer not null default 40 check (cpc_yen > 0),
  review_note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_store_idx on public.campaigns (store_id);

create table public.ad_impressions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  query_id uuid references public.search_queries (id) on delete set null,
  session_id uuid references public.search_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ad_impressions_campaign_idx on public.ad_impressions (campaign_id, created_at);

create table public.ad_clicks (
  id uuid primary key default gen_random_uuid(),
  impression_id uuid not null references public.ad_impressions (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  session_id uuid references public.search_sessions (id) on delete set null,
  valid boolean not null,
  invalid_reason text check (invalid_reason in ('duplicate', 'rate_limited', 'unknown_impression', 'expired_impression', 'budget_exhausted')),
  created_at timestamptz not null default now(),
  constraint ad_clicks_reason check (valid = (invalid_reason is null))
);

create table public.ad_billing_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  -- 1クリックにつき課金は1回まで（二重課金防止）
  click_id uuid not null unique references public.ad_clicks (id) on delete restrict,
  amount_yen integer not null check (amount_yen > 0),
  invoiced boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 口コミ・返信（Google Business Profile 連携は Phase 8。それまではモック）
-- ---------------------------------------------------------------------
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.stores (id) on delete cascade,
  provider text not null check (provider in ('google_business_profile', 'line_store_notify')),
  status text not null check (status in ('pending', 'connected', 'revoked', 'error')),
  -- トークン本体は Supabase Vault に保存し、ここにはシークレットIDのみ
  vault_secret_id uuid,
  external_account_ref text,
  scopes text[] not null default '{}',
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  source text not null check (source in ('google', 'google_mock')),
  external_id text not null,
  rating smallint not null check (rating between 1 and 5),
  body text,
  author_label text,
  reviewed_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  unique (source, external_id)
);
create index reviews_store_idx on public.reviews (store_id, reviewed_at desc);

create table public.reply_drafts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  generated_by text not null check (generated_by in ('ai', 'human')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'discarded')),
  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reply_drafts_approval check ((status = 'approved') = (approved_by is not null and approved_at is not null))
);

-- 投稿は「承認済みの下書き」からのみ。idempotency_key で二重投稿を防ぐ
create table public.reply_publications (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  draft_id uuid not null references public.reply_drafts (id),
  idempotency_key text not null unique,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  error_message text,
  attempts smallint not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index reply_publications_one_success on public.reply_publications (review_id) where status = 'succeeded';

-- ---------------------------------------------------------------------
-- NAMARA VOICE / ACTION
-- ---------------------------------------------------------------------
create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  title text not null,
  questions jsonb not null,
  active boolean not null default true,
  -- 高評価者だけを口コミ投稿に誘導する設定は持たない（レビューゲーティング禁止）
  created_at timestamptz not null default now()
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  satisfaction smallint check (satisfaction between 1 and 5),
  scores jsonb not null default '{}'::jsonb,
  comment text check (char_length(comment) <= 2000),
  ai_categories text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.action_tasks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  title text not null,
  priority text not null check (priority in ('high', 'medium', 'low')),
  evidence jsonb not null default '[]'::jsonb,
  assignee_label text,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'skipped')),
  metric_before jsonb,
  metric_after jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 監査ログ（書き込みはトリガーと service_role のみ）
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at トリガー
-- ---------------------------------------------------------------------
create trigger organizations_updated before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger stores_updated before update on public.stores for each row execute function public.set_updated_at();
create trigger campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();
create trigger subscriptions_updated before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger action_tasks_updated before update on public.action_tasks for each row execute function public.set_updated_at();

-- =====================================================================
-- 認可ヘルパー（security definer：RLS の再帰を避けるため。search_path を固定）
-- =====================================================================
create or replace function public.is_operator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_operators where user_id = auth.uid());
$$;

create or replace function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members where organization_id = p_org and user_id = auth.uid());
$$;

-- 店舗にアクセスできるか：運営、店舗メンバー、または組織オーナー（組織内の全店舗）
create or replace function public.can_access_store(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_operator()
    or exists (select 1 from public.store_members where store_id = p_store and user_id = auth.uid())
    or exists (
      select 1 from public.stores s
      join public.organization_members m on m.organization_id = s.organization_id
      where s.id = p_store and m.user_id = auth.uid() and m.role = 'owner'
    );
$$;

-- 店舗の設定変更ができるか（オーナーのみ。スタッフは閲覧のみ）
create or replace function public.can_manage_store(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_operator()
    or exists (select 1 from public.store_members where store_id = p_store and user_id = auth.uid() and role = 'owner')
    or exists (
      select 1 from public.stores s
      join public.organization_members m on m.organization_id = s.organization_id
      where s.id = p_store and m.user_id = auth.uid() and m.role = 'owner'
    );
$$;

revoke all on function public.is_operator() from public;
revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.can_access_store(uuid) from public;
revoke all on function public.can_manage_store(uuid) from public;
grant execute on function public.is_operator(), public.is_org_member(uuid), public.can_access_store(uuid), public.can_manage_store(uuid) to authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.plans enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.platform_operators enable row level security;
alter table public.organization_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.store_categories enable row level security;
alter table public.stores enable row level security;
alter table public.store_sources enable row level security;
alter table public.store_members enable row level security;
alter table public.consumer_identities enable row level security;
alter table public.consent_records enable row level security;
alter table public.search_sessions enable row level security;
alter table public.search_queries enable row level security;
alter table public.recommendation_batches enable row level security;
alter table public.recommendation_items enable row level security;
alter table public.interaction_events enable row level security;
alter table public.ad_placements enable row level security;
alter table public.campaigns enable row level security;
alter table public.ad_impressions enable row level security;
alter table public.ad_clicks enable row level security;
alter table public.ad_billing_events enable row level security;
alter table public.integration_connections enable row level security;
alter table public.reviews enable row level security;
alter table public.reply_drafts enable row level security;
alter table public.reply_publications enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;
alter table public.action_tasks enable row level security;
alter table public.audit_logs enable row level security;

-- 消費者データは anon / authenticated から完全に遮断（ポリシーを作らない＋権限も剥がす）
revoke all on public.consumer_identities, public.consent_records, public.search_sessions, public.search_queries,
  public.recommendation_batches, public.recommendation_items, public.interaction_events,
  public.ad_impressions, public.ad_clicks
  from anon, authenticated;
-- 運営だけは内部集計のため検索ログを閲覧できる（生テキストを含む。画面では期限付き）
grant select on public.search_queries, public.interaction_events, public.ad_impressions, public.ad_clicks to authenticated;
create policy search_queries_operator_read on public.search_queries for select to authenticated using (public.is_operator());
create policy interaction_events_operator_read on public.interaction_events for select to authenticated using (public.is_operator());
create policy ad_impressions_operator_read on public.ad_impressions for select to authenticated using (public.is_operator());
create policy ad_clicks_operator_read on public.ad_clicks for select to authenticated using (public.is_operator());

-- 公開情報
create policy plans_read on public.plans for select to anon, authenticated using (true);
create policy plans_operator_write on public.plans for all to authenticated using (public.is_operator()) with check (public.is_operator());
create policy categories_read on public.store_categories for select to anon, authenticated using (true);
create policy categories_operator_write on public.store_categories for all to authenticated using (public.is_operator()) with check (public.is_operator());
create policy placements_read on public.ad_placements for select to anon, authenticated using (true);

-- 店舗：公開・検証済みは誰でも閲覧。担当者は自店を閲覧。変更は運営のみ（店舗からの修正依頼は別フロー）
create policy stores_public_read on public.stores for select to anon, authenticated
  using (published and verification_status = 'verified');
create policy stores_member_read on public.stores for select to authenticated using (public.can_access_store(id));
create policy stores_operator_write on public.stores for all to authenticated using (public.is_operator()) with check (public.is_operator());
create policy store_sources_read on public.store_sources for select to authenticated using (public.can_access_store(store_id));
create policy store_sources_operator_write on public.store_sources for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- 組織・メンバー（追加・変更は運営のみ＝権限昇格の防止）
create policy organizations_read on public.organizations for select to authenticated using (public.is_org_member(id) or public.is_operator());
create policy organizations_operator_write on public.organizations for all to authenticated using (public.is_operator()) with check (public.is_operator());
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() or public.is_operator());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy operators_read on public.platform_operators for select to authenticated using (public.is_operator());
create policy org_members_read on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_operator());
create policy org_members_operator_write on public.organization_members for all to authenticated using (public.is_operator()) with check (public.is_operator());
create policy store_members_read on public.store_members for select to authenticated
  using (user_id = auth.uid() or public.is_operator());
create policy store_members_operator_write on public.store_members for all to authenticated using (public.is_operator()) with check (public.is_operator());
create policy subscriptions_read on public.subscriptions for select to authenticated using (public.is_org_member(organization_id) or public.is_operator());
create policy subscriptions_operator_write on public.subscriptions for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- 広告キャンペーン
create policy campaigns_read on public.campaigns for select to authenticated using (public.can_access_store(store_id));
create policy campaigns_store_insert on public.campaigns for insert to authenticated
  with check (
    public.can_manage_store(store_id)
    and status = 'pending_review'
    and organization_id = (select s.organization_id from public.stores s where s.id = store_id)
  );
create policy campaigns_store_update on public.campaigns for update to authenticated
  using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy campaigns_operator_all on public.campaigns for all to authenticated using (public.is_operator()) with check (public.is_operator());
create policy billing_read on public.ad_billing_events for select to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and public.can_access_store(c.store_id)));

-- 店舗オーナーができる更新は「停止」だけ（承認・予算変更・対象変更は不可）
create or replace function public.guard_campaign_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_operator() then
    return new;
  end if;
  if new.status <> 'stopped'
     or new.store_id <> old.store_id or new.organization_id <> old.organization_id
     or new.budget_yen <> old.budget_yen or new.cpc_yen <> old.cpc_yen
     or new.target_area_ids <> old.target_area_ids or new.target_genre_ids <> old.target_genre_ids
     or new.start_date <> old.start_date or new.end_date <> old.end_date
     or new.review_note is distinct from old.review_note then
    raise exception '店舗ユーザーは広告の停止のみ行えます' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger campaigns_guard before update on public.campaigns for each row execute function public.guard_campaign_update();

-- 口コミ・返信
create policy reviews_read on public.reviews for select to authenticated using (public.can_access_store(store_id));
create policy reply_drafts_read on public.reply_drafts for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id and public.can_access_store(r.store_id)));
create policy reply_drafts_write on public.reply_drafts for insert to authenticated
  with check (exists (select 1 from public.reviews r where r.id = review_id and public.can_manage_store(r.store_id)));
create policy reply_drafts_update on public.reply_drafts for update to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id and public.can_manage_store(r.store_id)))
  with check (exists (select 1 from public.reviews r where r.id = review_id and public.can_manage_store(r.store_id)));
create policy reply_publications_read on public.reply_publications for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id and public.can_access_store(r.store_id)));
-- 投稿の作成はサーバー（service_role）のみ：承認済みか確認してから Google API を呼ぶため

create policy integrations_read on public.integration_connections for select to authenticated
  using (public.is_org_member(organization_id) or public.is_operator());

-- VOICE / ACTION
create policy surveys_rw on public.surveys for all to authenticated using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));
create policy surveys_read on public.surveys for select to authenticated using (public.can_access_store(store_id));
create policy survey_responses_read on public.survey_responses for select to authenticated using (public.can_access_store(store_id));
create policy action_tasks_read on public.action_tasks for select to authenticated using (public.can_access_store(store_id));
create policy action_tasks_write on public.action_tasks for all to authenticated using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));

create policy audit_operator_read on public.audit_logs for select to authenticated using (public.is_operator());

-- =====================================================================
-- 監査ログのトリガー（広告・店舗の変更）
-- =====================================================================
create or replace function public.write_audit_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
  values (
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce(coalesce(to_jsonb(new), to_jsonb(old)) ->> 'id', coalesce(to_jsonb(new), to_jsonb(old)) ->> 'user_id'),
    case when tg_op = 'UPDATE' then jsonb_build_object('status_before', to_jsonb(old) -> 'status', 'status_after', to_jsonb(new) -> 'status')
         else '{}'::jsonb end
  );
  return coalesce(new, old);
end $$;
create trigger campaigns_audit after insert or update or delete on public.campaigns for each row execute function public.write_audit_log();
create trigger stores_audit after insert or update or delete on public.stores for each row execute function public.write_audit_log();
create trigger org_members_audit after insert or update or delete on public.organization_members for each row execute function public.write_audit_log();

-- =====================================================================
-- 店舗向けの匿名集計（少数セル抑制つき）
-- 店舗ユーザーは検索ログを直接読めないため、この関数経由でのみ需要を参照できる
-- =====================================================================
create or replace function public.store_demand_by_genre(p_store uuid, p_from timestamptz, p_to timestamptz)
returns table (genre_id text, searches integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_area text;
begin
  if not public.can_access_store(p_store) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select area_id into v_area from public.stores where id = p_store;
  return query
    select g.genre_id, (round(count(*) / 5.0) * 5)::integer as searches
    from public.search_queries q
    cross join lateral unnest(q.genre_ids) as g(genre_id)
    where q.created_at >= p_from and q.created_at < p_to and v_area = any (q.area_ids)
    group by g.genre_id
    having count(distinct q.session_id) >= 5;
end $$;
revoke all on function public.store_demand_by_genre(uuid, timestamptz, timestamptz) from public;
grant execute on function public.store_demand_by_genre(uuid, timestamptz, timestamptz) to authenticated;

-- =====================================================================
-- 保存期間と削除（service_role / pg_cron から実行）
-- =====================================================================
create or replace function public.purge_expired_search_text() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update public.search_queries set raw_text = null where raw_text is not null and raw_text_expires_at < now();
  get diagnostics n = row_count;
  delete from public.interaction_events where created_at < now() - interval '13 months';
  return n;
end $$;

-- 利用者からの削除依頼：識別子と行動ログを削除し、集計用の条件だけを本人と切り離して残す
create or replace function public.delete_consumer_data(p_consumer uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.search_queries set raw_text = null
    where session_id in (select id from public.search_sessions where consumer_id = p_consumer);
  delete from public.interaction_events
    where session_id in (select id from public.search_sessions where consumer_id = p_consumer);
  update public.search_sessions set consumer_id = null where consumer_id = p_consumer;
  delete from public.consent_records where consumer_id = p_consumer;
  update public.consumer_identities set deleted_at = now(), identifier_hash = 'deleted:' || id::text where id = p_consumer;
end $$;
revoke all on function public.purge_expired_search_text() from public, anon, authenticated;
revoke all on function public.delete_consumer_data(uuid) from public, anon, authenticated;

-- 初期データ：広告枠とプラン（金額は仮設定）
insert into public.ad_placements (id, description, max_slots) values ('search_sponsored', '検索結果内のスポンサー枠（広告表記必須）', 1);
insert into public.plans (id, name, price_yen, billing_unit, price_is_from) values
  ('free', '無料店舗登録', 0, 'month', false),
  ('starter', 'SaaS STARTER', 5980, 'month', false),
  ('growth', 'SaaS GROWTH', 14800, 'month', false),
  ('pro', 'SaaS PRO', 29800, 'month', false),
  ('sponsored_search', 'スポンサー検索広告', 9800, 'month', true),
  ('consumer_research', '消費者リサーチ', 39800, 'item', true);
