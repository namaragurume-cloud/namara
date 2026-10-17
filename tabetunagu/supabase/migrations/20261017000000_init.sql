-- ===========================================================================
-- TABETUNAGU（食べつなぐ） 初期スキーマ
--
-- 設計方針
-- - 商品代金は扱わない（予約・来店確認・成約記録のみ）。
-- - 在庫・予約・QRチェックインなど整合性が必要な処理は SECURITY DEFINER 関数で
--   1トランザクションにまとめ、行ロックで「最後の1個」の取り合いを防ぐ。
-- - アプリは request.jwt.claims を設定して authenticated / anon ロールで接続し、
--   RLS を常に効かせる（Supabase の PostgREST と同じ仕組み）。
--   集計・バッチ・管理者処理のみサーバー側で service（RLS バイパス）を使う。
-- - アプリ固有のエラーは 'TT:<code>' 形式のメッセージで raise する。
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 型
-- ---------------------------------------------------------------------------
create type public.store_status as enum ('pending', 'active', 'suspended');
create type public.member_role as enum ('owner', 'staff');
create type public.product_status as enum ('draft', 'published', 'sold_out', 'closed', 'deleted');
create type public.product_category as enum ('bread', 'bento', 'deli', 'sweets', 'hotel', 'other');
create type public.reservation_status as enum (
  'pending',   -- 予約作成済み・確定待ち（現状は即時確定のため未使用。将来の店舗承認制用）
  'confirmed', -- 予約確定。来店・QRチェックイン待ち
  'completed', -- QRチェックイン済み = 食べつなぎ完了（成約）
  'cancelled', -- ユーザー / 店舗 / 管理者によるキャンセル
  'no_show',   -- confirmed のまま受取時間 + 猶予を過ぎた（ユーザー起因）
  'expired'    -- pending のまま受取時間を過ぎた（ユーザー起因ではない）
);
create type public.cancel_actor as enum ('user', 'store', 'admin', 'system');

-- ---------------------------------------------------------------------------
-- 共通
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- 受取時間の前後どれだけチェックインを受け付けるか（アプリ側 src/lib/constants.ts と揃える）
create or replace function public.checkin_early_window() returns interval
language sql immutable as $$ select interval '30 minutes' $$;
create or replace function public.checkin_grace_window() returns interval
language sql immutable as $$ select interval '30 minutes' $$;
-- 1予約あたりのチェックインポイント
create or replace function public.checkin_points() returns int
language sql immutable as $$ select 10 $$;
-- 同時に持てる有効な予約数
create or replace function public.max_active_reservations() returns int
language sql immutable as $$ select 3 $$;

-- ---------------------------------------------------------------------------
-- マスタ
-- ---------------------------------------------------------------------------
create table public.areas (
  id text primary key check (id ~ '^[a-z0-9-]{2,32}$'),
  name text not null,
  sort_order int not null default 0
);

create table public.plans (
  code text primary key check (code in ('free', 'standard')),
  name text not null,
  monthly_fee int not null check (monthly_fee >= 0),
  commission_rate numeric(5, 4) not null check (commission_rate >= 0 and commission_rate < 1),
  features jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- ユーザー
-- 個人情報は LINE User ID・表示名・（任意）メール程度に留める。
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique,
  display_name text not null default 'ゲスト' check (char_length(display_name) between 1 and 60),
  email text check (email is null or char_length(email) <= 254),
  avatar_url text,
  is_demo boolean not null default false,
  notify_enabled boolean not null default true,
  notify_areas text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- 信頼スコア用の集計（将来 trust_score による予約制限などに利用）
create table public.user_stats (
  user_id uuid primary key references public.users (id) on delete cascade,
  reservation_count int not null default 0,
  completed_count int not null default 0,
  cancelled_count int not null default 0,
  late_cancel_count int not null default 0,
  no_show_count int not null default 0,
  points_balance int not null default 0,
  trust_score int not null default 100 check (trust_score between 0 and 100),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 店舗
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name text not null check (char_length(name) between 1 and 80),
  category public.product_category not null default 'other',
  area_id text not null references public.areas (id),
  address text not null default '',
  phone text not null default '',
  description text not null default '',
  opening_hours text not null default '',
  pickup_note text not null default '',
  image_url text,
  status public.store_status not null default 'pending',
  plan_code text not null default 'free' references public.plans (code),
  -- 店舗QRの世代。QRを作り直すと古い印刷物は無効になる
  qr_version int not null default 1 check (qr_version >= 1),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_area_idx on public.stores (area_id) where status = 'active';
create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();

create table public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index store_members_user_idx on public.store_members (user_id);

create table public.store_plan_changes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  from_plan text not null references public.plans (code),
  to_plan text not null references public.plans (code),
  changed_by uuid references public.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 出品テンプレート（「いつものBOXを出品」「自動再出品」用）
-- ---------------------------------------------------------------------------
create table public.product_templates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 600),
  category public.product_category not null,
  is_box boolean not null default true,
  image_url text,
  original_price int not null check (original_price between 1 and 100000),
  rescue_price int not null check (rescue_price between 1 and 100000),
  quantity int not null check (quantity between 1 and 999),
  pickup_start_time time not null,
  pickup_end_time time not null,
  auto_relist boolean not null default false,
  auto_relist_weekdays smallint[] not null default '{}', -- 0=日 … 6=土（JST）
  last_listed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rescue_price <= original_price)
);
create index product_templates_store_idx on public.product_templates (store_id);
create trigger product_templates_updated_at before update on public.product_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 商品（出品）
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete restrict,
  template_id uuid references public.product_templates (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 600),
  image_url text,
  category public.product_category not null,
  is_box boolean not null default false,
  original_price int not null check (original_price between 1 and 100000),
  rescue_price int not null check (rescue_price between 1 and 100000), -- 食べつなぎ価格
  quantity int not null check (quantity between 1 and 999),
  remaining_quantity int not null,
  max_per_reservation int not null default 3 check (max_per_reservation between 1 and 10),
  estimated_weight_g int not null default 300 check (estimated_weight_g between 0 and 10000), -- 1点あたり
  pickup_start_at timestamptz not null,
  pickup_end_at timestamptz not null,
  status public.product_status not null default 'published',
  published_at timestamptz,
  sold_out_at timestamptz,
  closed_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rescue_price <= original_price),
  check (remaining_quantity between 0 and quantity),
  check (pickup_end_at > pickup_start_at)
);
create index products_catalog_idx on public.products (status, pickup_end_at) where deleted_at is null;
create index products_store_idx on public.products (store_id, created_at desc);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- 出品時は残数 = 数量。公開日時を記録。
create or replace function public.products_before_insert() returns trigger
language plpgsql as $$
begin
  new.remaining_quantity := new.quantity;
  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end
$$;
create trigger products_before_insert before insert on public.products
  for each row execute function public.products_before_insert();

-- 店舗スタッフ（authenticated）による直接更新のガード。
-- 在庫・削除・完売の変更は専用関数経由のみ。予約がある商品の受取時間は変更不可。
create or replace function public.products_guard_update() returns trigger
language plpgsql as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if old.status = 'deleted' then
    raise exception 'TT:product_not_found';
  end if;
  if new.status is distinct from old.status then
    if new.status not in ('draft', 'published', 'closed') then
      raise exception 'TT:invalid_status';
    end if;
    if new.status = 'published' and old.pickup_end_at <= now() then
      raise exception 'TT:pickup_ended';
    end if;
    if new.status = 'published' then
      new.published_at := coalesce(old.published_at, now());
      if old.remaining_quantity = 0 then
        new.status := 'sold_out';
      end if;
    elsif new.status = 'closed' then
      new.closed_at := now();
    end if;
  end if;
  if (new.pickup_start_at, new.pickup_end_at) is distinct from (old.pickup_start_at, old.pickup_end_at)
     and exists (
       select 1 from public.reservations r
       where r.product_id = old.id and r.status in ('pending', 'confirmed')
     ) then
    raise exception 'TT:has_active_reservations';
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- 予約
-- ---------------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- 予約番号（店頭で読み上げやすい英数字6桁）
  user_id uuid not null references public.users (id),
  product_id uuid not null references public.products (id),
  store_id uuid not null references public.stores (id),
  quantity int not null check (quantity between 1 and 10),
  unit_price int not null check (unit_price >= 0),
  total_price int not null check (total_price >= 0),
  status public.reservation_status not null default 'confirmed',
  -- 予約時点の受取時間（スナップショット）
  pickup_start_at timestamptz not null,
  pickup_end_at timestamptz not null,
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by public.cancel_actor,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 200),
  no_show_at timestamptz,
  expired_at timestamptz,
  -- 成約時点のプラン・手数料率（月の途中でプラン変更しても正しく計算できるように）
  plan_code text references public.plans (code),
  commission_rate numeric(5, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 同じ商品への有効な予約は1ユーザー1件まで
create unique index reservations_one_active_per_product
  on public.reservations (user_id, product_id) where status in ('pending', 'confirmed');
create index reservations_user_idx on public.reservations (user_id, created_at desc);
create index reservations_store_idx on public.reservations (store_id, pickup_start_at desc);
create index reservations_status_idx on public.reservations (status, pickup_end_at);
create index reservations_product_idx on public.reservations (product_id);
create trigger reservations_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();

create trigger products_guard_update before update on public.products
  for each row execute function public.products_guard_update();

-- QRチェックインの試行ログ（失敗も記録し、不正・成約漏れの検知に使う）
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  store_id uuid references public.stores (id),
  reservation_id uuid references public.reservations (id),
  result text not null check (result in (
    'success', 'invalid_token', 'store_inactive', 'no_reservation', 'too_early',
    'window_closed', 'already_completed', 'cancelled'
  )),
  qr_version int,
  created_at timestamptz not null default now()
);
create unique index checkins_one_success_per_reservation
  on public.checkins (reservation_id) where result = 'success';
create index checkins_store_idx on public.checkins (store_id, created_at desc);
create index checkins_user_idx on public.checkins (user_id, created_at desc);

create table public.favorites (
  user_id uuid not null references public.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);
create index favorites_store_idx on public.favorites (store_id);

create table public.points_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  reservation_id uuid references public.reservations (id),
  amount int not null,
  reason text not null check (reason in ('checkin', 'adjustment', 'expiry', 'redeem')),
  created_at timestamptz not null default now()
);
create unique index points_once_per_reservation
  on public.points_transactions (reservation_id, reason) where reservation_id is not null;
create index points_user_idx on public.points_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 通知（まとめ通知。商品ごとの全員通知はしない）
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('evening_digest', 'reservation_reminder', 'favorite_store', 'system')),
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'dry_run', 'failed')),
  target_count int not null default 0,
  sent_count int not null default 0,
  error text,
  created_by uuid references public.users (id),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  channel text not null default 'line' check (channel in ('line')),
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed', 'dry_run')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, user_id)
);
create index notification_deliveries_user_idx on public.notification_deliveries (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AI 生成ログ
-- ---------------------------------------------------------------------------
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid references public.users (id),
  product_id uuid references public.products (id) on delete set null,
  kind text not null check (kind in ('product_description', 'price_suggestion')),
  provider text not null check (provider in ('openai', 'template')),
  model text,
  input jsonb not null default '{}'::jsonb,
  output text not null,
  latency_ms int,
  created_at timestamptz not null default now()
);
create index ai_generations_store_idx on public.ai_generations (store_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 請求（TABETUNAGU → 店舗の手数料請求。商品代金の入金処理は行わない）
-- ---------------------------------------------------------------------------
create table public.billing_records (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  period_month date not null check (extract(day from period_month) = 1),
  plan_code text not null references public.plans (code),
  monthly_fee int not null,
  gmv int not null,
  completed_count int not null,
  commission_amount int not null,
  total_amount int not null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, period_month)
);
create trigger billing_records_updated_at before update on public.billing_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 分析イベントログ（外部 Analytics を使わない最小構成）
-- ---------------------------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  name text not null check (name ~ '^[a-z_]{3,48}$'),
  user_id uuid,
  store_id uuid,
  product_id uuid,
  reservation_id uuid,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_name_idx on public.events (name, created_at desc);
create index events_user_idx on public.events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 将来の AI（値引き提案・完売予測・需要予測・出品時間提案・仕込み量提案）用の販売履歴。
-- 出品1件 = 1行。予約の状態が変わるたびにトリガーで更新される。
-- external_features に天気・気温・イベント等を後から追加できる。
-- ---------------------------------------------------------------------------
create table public.product_sales_history (
  product_id uuid primary key references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  area_id text,
  category public.product_category not null,
  is_box boolean not null,
  listed_at timestamptz not null,
  listed_date date not null,         -- JST
  weekday smallint not null,         -- 受取日の曜日 0=日 … 6=土（JST）
  listed_hour smallint not null,     -- 出品時刻（JST, 時）
  pickup_start_at timestamptz not null,
  pickup_end_at timestamptz not null,
  pickup_start_hour smallint not null,
  original_price int not null,
  rescue_price int not null,
  discount_rate numeric(5, 4) not null,
  quantity_listed int not null,
  quantity_reserved int not null default 0,
  quantity_completed int not null default 0,
  quantity_cancelled int not null default 0,
  quantity_no_show int not null default 0,
  sold_out_at timestamptz,
  minutes_to_sell_out int,
  external_features jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index product_sales_history_store_idx on public.product_sales_history (store_id, listed_date desc);

-- エリア × 日付の外部特徴量（天気など）。後から取り込んで product_sales_history と結合する。
create table public.external_daily_features (
  area_id text not null references public.areas (id),
  on_date date not null,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (area_id, on_date)
);

create or replace function public.refresh_product_sales(p_product_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.product_sales_history as h (
    product_id, store_id, area_id, category, is_box, listed_at, listed_date, weekday, listed_hour,
    pickup_start_at, pickup_end_at, pickup_start_hour, original_price, rescue_price, discount_rate,
    quantity_listed, quantity_reserved, quantity_completed, quantity_cancelled, quantity_no_show,
    sold_out_at, minutes_to_sell_out, updated_at
  )
  select
    p.id, p.store_id, s.area_id, p.category, p.is_box,
    coalesce(p.published_at, p.created_at),
    (coalesce(p.published_at, p.created_at) at time zone 'Asia/Tokyo')::date,
    extract(dow from (p.pickup_start_at at time zone 'Asia/Tokyo'))::smallint,
    extract(hour from (coalesce(p.published_at, p.created_at) at time zone 'Asia/Tokyo'))::smallint,
    p.pickup_start_at, p.pickup_end_at,
    extract(hour from (p.pickup_start_at at time zone 'Asia/Tokyo'))::smallint,
    p.original_price, p.rescue_price,
    round(1 - p.rescue_price::numeric / p.original_price, 4),
    p.quantity,
    coalesce(sum(r.quantity) filter (where r.status <> 'cancelled'), 0)::int,
    coalesce(sum(r.quantity) filter (where r.status = 'completed'), 0)::int,
    coalesce(sum(r.quantity) filter (where r.status = 'cancelled'), 0)::int,
    coalesce(sum(r.quantity) filter (where r.status = 'no_show'), 0)::int,
    p.sold_out_at,
    case when p.sold_out_at is not null
      then (extract(epoch from (p.sold_out_at - coalesce(p.published_at, p.created_at))) / 60)::int
    end,
    now()
  from public.products p
  join public.stores s on s.id = p.store_id
  left join public.reservations r on r.product_id = p.id
  where p.id = p_product_id
  group by p.id, s.area_id
  on conflict (product_id) do update set
    area_id = excluded.area_id,
    category = excluded.category,
    is_box = excluded.is_box,
    listed_at = excluded.listed_at,
    listed_date = excluded.listed_date,
    weekday = excluded.weekday,
    listed_hour = excluded.listed_hour,
    pickup_start_at = excluded.pickup_start_at,
    pickup_end_at = excluded.pickup_end_at,
    pickup_start_hour = excluded.pickup_start_hour,
    original_price = excluded.original_price,
    rescue_price = excluded.rescue_price,
    discount_rate = excluded.discount_rate,
    quantity_listed = excluded.quantity_listed,
    quantity_reserved = excluded.quantity_reserved,
    quantity_completed = excluded.quantity_completed,
    quantity_cancelled = excluded.quantity_cancelled,
    quantity_no_show = excluded.quantity_no_show,
    sold_out_at = excluded.sold_out_at,
    minutes_to_sell_out = excluded.minutes_to_sell_out,
    updated_at = now();
$$;

create or replace function public.products_sales_history_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_product_sales(new.id);
  return null;
end
$$;
create trigger products_sales_history after insert or update on public.products
  for each row execute function public.products_sales_history_trigger();

create or replace function public.reservations_sales_history_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_product_sales(new.product_id);
  return null;
end
$$;
create trigger reservations_sales_history after insert or update of status on public.reservations
  for each row execute function public.reservations_sales_history_trigger();

-- ---------------------------------------------------------------------------
-- 認可ヘルパー（RLS ポリシーから呼ぶ。SECURITY DEFINER で再帰を避ける）
-- ---------------------------------------------------------------------------
create or replace function public.is_store_member(p_store_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id and m.user_id = auth.uid()
  )
$$;

create or replace function public.is_store_owner(p_store_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_members m
    where m.store_id = p_store_id and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

-- ---------------------------------------------------------------------------
-- 信頼スコア（簡易）: 100点スタート、No Show -20、直前キャンセル -5、完了 +2（上限100）
-- ---------------------------------------------------------------------------
create or replace function public.recalc_trust_score(p_user_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.user_stats
  set trust_score = greatest(0, least(100,
        100 - no_show_count * 20 - late_cancel_count * 5 + completed_count * 2)),
      updated_at = now()
  where user_id = p_user_id;
$$;

create or replace function public.ensure_user_stats(p_user_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.user_stats (user_id) values (p_user_id) on conflict (user_id) do nothing;
$$;

create or replace function public.gen_reservation_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- 0/O/1/I を除く
  result text := '';
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end
$$;

-- ---------------------------------------------------------------------------
-- 予約作成（在庫の原子的な減算）
-- 同時に最後の1個を2人が予約しても、products 行の更新条件
-- remaining_quantity >= p_quantity により片方だけが成功する。
-- ---------------------------------------------------------------------------
create or replace function public.reserve_product(p_product_id uuid, p_quantity int default 1)
returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
  v_store public.stores%rowtype;
  v_res public.reservations%rowtype;
  v_active int;
  v_constraint text;
begin
  if v_uid is null or not exists (select 1 from public.users where id = v_uid) then
    raise exception 'TT:not_authenticated';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'TT:invalid_quantity';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found or v_product.deleted_at is not null or v_product.status = 'deleted' then
    raise exception 'TT:product_not_found';
  end if;
  select * into v_store from public.stores where id = v_product.store_id;
  if v_store.status <> 'active' then
    raise exception 'TT:store_inactive';
  end if;
  if v_product.pickup_end_at <= now() then
    raise exception 'TT:pickup_ended';
  end if;
  if v_product.status = 'sold_out' or v_product.remaining_quantity <= 0 then
    raise exception 'TT:sold_out';
  end if;
  if v_product.status <> 'published' then
    raise exception 'TT:not_available';
  end if;
  if p_quantity > v_product.max_per_reservation then
    raise exception 'TT:quantity_limit';
  end if;
  if p_quantity > v_product.remaining_quantity then
    raise exception 'TT:insufficient_stock';
  end if;
  if exists (
    select 1 from public.reservations
    where user_id = v_uid and product_id = p_product_id and status in ('pending', 'confirmed')
  ) then
    raise exception 'TT:already_reserved';
  end if;
  select count(*) into v_active from public.reservations
  where user_id = v_uid and status in ('pending', 'confirmed') and pickup_end_at > now();
  if v_active >= public.max_active_reservations() then
    raise exception 'TT:too_many_active';
  end if;

  update public.products
  set remaining_quantity = remaining_quantity - p_quantity,
      status = case when remaining_quantity - p_quantity = 0 then 'sold_out'::public.product_status else status end,
      sold_out_at = case when remaining_quantity - p_quantity = 0 then now() else sold_out_at end
  where id = p_product_id
    and status = 'published'
    and deleted_at is null
    and remaining_quantity >= p_quantity
    and pickup_end_at > now()
  returning * into v_product;
  if not found then
    raise exception 'TT:sold_out';
  end if;

  loop
    begin
      insert into public.reservations (
        code, user_id, product_id, store_id, quantity, unit_price, total_price, status,
        pickup_start_at, pickup_end_at, confirmed_at
      ) values (
        public.gen_reservation_code(), v_uid, v_product.id, v_product.store_id, p_quantity,
        v_product.rescue_price, v_product.rescue_price * p_quantity, 'confirmed',
        v_product.pickup_start_at, v_product.pickup_end_at, now()
      ) returning * into v_res;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'reservations_one_active_per_product' then
        raise exception 'TT:already_reserved';
      end if;
      -- 予約番号の衝突のみリトライ
    end;
  end loop;

  perform public.ensure_user_stats(v_uid);
  update public.user_stats
  set reservation_count = reservation_count + 1, updated_at = now()
  where user_id = v_uid;

  insert into public.events (name, user_id, store_id, product_id, reservation_id, properties)
  values ('reservation_created', v_uid, v_res.store_id, v_res.product_id, v_res.id,
          jsonb_build_object('quantity', p_quantity, 'total_price', v_res.total_price));

  return v_res;
end
$$;

-- ---------------------------------------------------------------------------
-- キャンセル（在庫を戻す）
-- ---------------------------------------------------------------------------
create or replace function public.cancel_reservation_internal(
  p_reservation_id uuid, p_actor public.cancel_actor, p_reason text
) returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  v_res public.reservations%rowtype;
  v_late boolean;
begin
  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'TT:reservation_not_found';
  end if;
  if v_res.status not in ('pending', 'confirmed') then
    raise exception 'TT:not_cancellable';
  end if;
  if p_actor = 'user' and now() >= v_res.pickup_end_at then
    raise exception 'TT:pickup_ended';
  end if;
  v_late := now() >= v_res.pickup_start_at;

  update public.reservations
  set status = 'cancelled', cancelled_at = now(), cancelled_by = p_actor,
      cancel_reason = nullif(left(coalesce(p_reason, ''), 200), '')
  where id = v_res.id
  returning * into v_res;

  update public.products
  set remaining_quantity = least(quantity, remaining_quantity + v_res.quantity),
      status = case when status = 'sold_out' and pickup_end_at > now()
                    then 'published'::public.product_status else status end,
      sold_out_at = case when status = 'sold_out' and pickup_end_at > now() then null else sold_out_at end
  where id = v_res.product_id and deleted_at is null;

  if p_actor = 'user' then
    perform public.ensure_user_stats(v_res.user_id);
    update public.user_stats
    set cancelled_count = cancelled_count + 1,
        late_cancel_count = late_cancel_count + case when v_late then 1 else 0 end,
        updated_at = now()
    where user_id = v_res.user_id;
    perform public.recalc_trust_score(v_res.user_id);
  end if;

  insert into public.events (name, user_id, store_id, product_id, reservation_id, properties)
  values ('reservation_cancelled', v_res.user_id, v_res.store_id, v_res.product_id, v_res.id,
          jsonb_build_object('actor', p_actor, 'late', v_late));

  return v_res;
end
$$;

-- ユーザー本人によるキャンセル
create or replace function public.cancel_reservation(p_reservation_id uuid, p_reason text default null)
returns public.reservations
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'TT:not_authenticated';
  end if;
  if not exists (
    select 1 from public.reservations where id = p_reservation_id and user_id = auth.uid()
  ) then
    raise exception 'TT:reservation_not_found';
  end if;
  return public.cancel_reservation_internal(p_reservation_id, 'user', p_reason);
end
$$;

-- 店舗都合のキャンセル（品切れ等）。理由必須。ユーザーの信頼スコアには影響しない。
create or replace function public.store_cancel_reservation(p_reservation_id uuid, p_reason text)
returns public.reservations
language plpgsql security definer set search_path = public as $$
declare
  v_store_id uuid;
begin
  select store_id into v_store_id from public.reservations where id = p_reservation_id;
  if v_store_id is null or not public.is_store_member(v_store_id) then
    raise exception 'TT:reservation_not_found';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'TT:reason_required';
  end if;
  return public.cancel_reservation_internal(p_reservation_id, 'store', p_reason);
end
$$;

-- ---------------------------------------------------------------------------
-- 店舗QRチェックイン
-- QRトークンの署名はアプリ側（サーバー）で検証し、store_id と qr_version を渡す。
-- 失敗も checkins に記録するため、業務エラーは raise せず result で返す。
-- 有効な予約（同じ店舗・受取時間内）が複数あればすべて完了にする。
-- ---------------------------------------------------------------------------
create or replace function public.checkin_store(p_store_id uuid, p_qr_version int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_store public.stores%rowtype;
  v_rate numeric(5, 4);
  v_ids uuid[] := '{}';
  v_related uuid;
  v_result text;
  v_points int := 0;
  v_next timestamptz;
  r record;
begin
  if v_uid is null or not exists (select 1 from public.users where id = v_uid) then
    raise exception 'TT:not_authenticated';
  end if;

  select * into v_store from public.stores where id = p_store_id;
  if not found or v_store.qr_version <> p_qr_version then
    insert into public.checkins (user_id, store_id, result, qr_version)
    values (v_uid, case when found then p_store_id end, 'invalid_token', p_qr_version);
    return jsonb_build_object('result', 'invalid_token');
  end if;
  if v_store.status <> 'active' then
    insert into public.checkins (user_id, store_id, result, qr_version)
    values (v_uid, p_store_id, 'store_inactive', p_qr_version);
    return jsonb_build_object('result', 'store_inactive', 'store_name', v_store.name);
  end if;

  select commission_rate into v_rate from public.plans where code = v_store.plan_code;

  for r in
    select * from public.reservations
    where user_id = v_uid and store_id = p_store_id
      and status in ('pending', 'confirmed')
      and now() >= pickup_start_at - public.checkin_early_window()
      and now() <= pickup_end_at + public.checkin_grace_window()
    order by pickup_start_at
    for update
  loop
    update public.reservations
    set status = 'completed', completed_at = now(),
        plan_code = v_store.plan_code, commission_rate = v_rate
    where id = r.id and status in ('pending', 'confirmed');
    if found then
      v_ids := v_ids || r.id;
      insert into public.checkins (user_id, store_id, reservation_id, result, qr_version)
      values (v_uid, p_store_id, r.id, 'success', p_qr_version);
      insert into public.points_transactions (user_id, reservation_id, amount, reason)
      values (v_uid, r.id, public.checkin_points(), 'checkin')
      on conflict do nothing;
      v_points := v_points + public.checkin_points();
      insert into public.events (name, user_id, store_id, product_id, reservation_id, properties)
      values ('qr_checkin', v_uid, p_store_id, r.product_id, r.id, '{}'::jsonb),
             ('reservation_completed', v_uid, p_store_id, r.product_id, r.id,
              jsonb_build_object('total_price', r.total_price, 'plan', v_store.plan_code));
    end if;
  end loop;

  if array_length(v_ids, 1) > 0 then
    perform public.ensure_user_stats(v_uid);
    update public.user_stats
    set completed_count = completed_count + array_length(v_ids, 1),
        points_balance = points_balance + v_points,
        updated_at = now()
    where user_id = v_uid;
    perform public.recalc_trust_score(v_uid);
    return jsonb_build_object(
      'result', 'success',
      'store_name', v_store.name,
      'reservation_ids', to_jsonb(v_ids),
      'points_awarded', v_points
    );
  end if;

  -- 完了できる予約がない理由を判定
  select id, pickup_start_at into v_related, v_next from public.reservations
  where user_id = v_uid and store_id = p_store_id and status in ('pending', 'confirmed')
    and now() < pickup_start_at - public.checkin_early_window()
  order by pickup_start_at limit 1;
  if v_related is not null then
    v_result := 'too_early';
  else
    select id into v_related from public.reservations
    where user_id = v_uid and store_id = p_store_id and status in ('pending', 'confirmed')
      and now() > pickup_end_at + public.checkin_grace_window()
    order by pickup_end_at desc limit 1;
    if v_related is not null then
      v_result := 'window_closed';
    else
      select id into v_related from public.reservations
      where user_id = v_uid and store_id = p_store_id and status = 'completed'
        and completed_at > now() - interval '12 hours'
      order by completed_at desc limit 1;
      if v_related is not null then
        v_result := 'already_completed';
      else
        select id into v_related from public.reservations
        where user_id = v_uid and store_id = p_store_id and status = 'cancelled'
          and cancelled_at > now() - interval '24 hours'
        order by cancelled_at desc limit 1;
        v_result := case when v_related is not null then 'cancelled' else 'no_reservation' end;
      end if;
    end if;
  end if;

  insert into public.checkins (user_id, store_id, reservation_id, result, qr_version)
  values (v_uid, p_store_id, v_related, v_result, p_qr_version);

  return jsonb_build_object(
    'result', v_result,
    'store_name', v_store.name,
    'reservation_id', v_related,
    'pickup_start_at', v_next
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 店舗オペレーション
-- ---------------------------------------------------------------------------
-- 数量の変更。予約済み数を下回る変更は不可。
create or replace function public.adjust_product_quantity(p_product_id uuid, p_quantity int)
returns public.products
language plpgsql security definer set search_path = public as $$
declare
  v_product public.products%rowtype;
  v_reserved int;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found or v_product.deleted_at is not null or not public.is_store_member(v_product.store_id) then
    raise exception 'TT:product_not_found';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception 'TT:invalid_quantity';
  end if;
  v_reserved := v_product.quantity - v_product.remaining_quantity;
  if p_quantity < v_reserved then
    raise exception 'TT:below_reserved';
  end if;

  update public.products
  set quantity = p_quantity,
      remaining_quantity = p_quantity - v_reserved,
      status = case
        when status in ('published', 'sold_out') and p_quantity - v_reserved = 0 then 'sold_out'::public.product_status
        when status = 'sold_out' and p_quantity - v_reserved > 0 and pickup_end_at > now() then 'published'::public.product_status
        else status end,
      sold_out_at = case when p_quantity - v_reserved = 0 then coalesce(sold_out_at, now()) else null end
  where id = p_product_id
  returning * into v_product;
  return v_product;
end
$$;

-- 削除（論理削除）。有効な予約がある商品は削除不可（先に予約をキャンセルする）。
create or replace function public.delete_product(p_product_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_store_id uuid;
begin
  select store_id into v_store_id from public.products where id = p_product_id and deleted_at is null;
  if v_store_id is null or not public.is_store_member(v_store_id) then
    raise exception 'TT:product_not_found';
  end if;
  if exists (
    select 1 from public.reservations
    where product_id = p_product_id and status in ('pending', 'confirmed')
  ) then
    raise exception 'TT:has_active_reservations';
  end if;
  update public.products set status = 'deleted', deleted_at = now() where id = p_product_id;
end
$$;

-- 店舗QRの再発行（古いQRは無効になる）。オーナーのみ。
create or replace function public.rotate_store_qr(p_store_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_version int;
begin
  if not public.is_store_owner(p_store_id) then
    raise exception 'TT:forbidden';
  end if;
  update public.stores set qr_version = qr_version + 1 where id = p_store_id
  returning qr_version into v_version;
  return v_version;
end
$$;

-- プラン変更。オーナーのみ。履歴を残す。
create or replace function public.change_store_plan(p_store_id uuid, p_plan_code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_from text;
begin
  if not public.is_store_owner(p_store_id) then
    raise exception 'TT:forbidden';
  end if;
  if not exists (select 1 from public.plans where code = p_plan_code) then
    raise exception 'TT:invalid_plan';
  end if;
  select plan_code into v_from from public.stores where id = p_store_id for update;
  if v_from = p_plan_code then
    return;
  end if;
  update public.stores set plan_code = p_plan_code where id = p_store_id;
  insert into public.store_plan_changes (store_id, from_plan, to_plan, changed_by)
  values (p_store_id, v_from, p_plan_code, auth.uid());
end
$$;

-- 自分のプロフィール（メール等は本人のみ参照可能）
create or replace function public.my_profile() returns setof public.users
language sql stable security definer set search_path = public as $$
  select * from public.users where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- バッチ（service のみ実行可能）
-- ---------------------------------------------------------------------------
-- 受取時間 + 猶予を過ぎた予約を no_show / expired に、受取時間を過ぎた商品を closed にする
create or replace function public.sweep_reservations() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_no_show int := 0;
  v_expired int := 0;
  v_closed int := 0;
  r record;
begin
  for r in
    update public.reservations
    set status = 'no_show', no_show_at = now()
    where status = 'confirmed' and pickup_end_at + public.checkin_grace_window() < now()
    returning id, user_id, store_id, product_id
  loop
    v_no_show := v_no_show + 1;
    perform public.ensure_user_stats(r.user_id);
    update public.user_stats set no_show_count = no_show_count + 1, updated_at = now()
    where user_id = r.user_id;
    perform public.recalc_trust_score(r.user_id);
    insert into public.events (name, user_id, store_id, product_id, reservation_id)
    values ('no_show', r.user_id, r.store_id, r.product_id, r.id);
  end loop;

  with expired as (
    update public.reservations
    set status = 'expired', expired_at = now()
    where status = 'pending' and pickup_end_at + public.checkin_grace_window() < now()
    returning id
  )
  select count(*) into v_expired from expired;

  with closed as (
    update public.products
    set status = 'closed', closed_at = now()
    where status in ('published', 'sold_out') and pickup_end_at < now()
    returning id
  )
  select count(*) into v_closed from closed;

  return jsonb_build_object('no_show', v_no_show, 'expired', v_expired, 'closed_products', v_closed);
end
$$;

-- STANDARD プランの自動再出品（JST の当日分をテンプレートから作成）
create or replace function public.auto_relist_templates() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_dow smallint := extract(dow from (now() at time zone 'Asia/Tokyo'))::smallint;
  v_count int := 0;
  v_start timestamptz;
  v_end timestamptz;
  t record;
begin
  for t in
    select pt.* from public.product_templates pt
    join public.stores s on s.id = pt.store_id
    where pt.auto_relist and s.status = 'active' and s.plan_code = 'standard'
      and v_dow = any (pt.auto_relist_weekdays)
      and (pt.last_listed_on is null or pt.last_listed_on < v_today)
    for update of pt
  loop
    v_start := (v_today + t.pickup_start_time) at time zone 'Asia/Tokyo';
    v_end := (v_today + t.pickup_end_time) at time zone 'Asia/Tokyo';
    if v_end <= v_start then
      v_end := v_end + interval '1 day';
    end if;
    if v_end <= now() then
      continue;
    end if;
    insert into public.products (
      store_id, template_id, name, description, image_url, category, is_box,
      original_price, rescue_price, quantity, pickup_start_at, pickup_end_at, status
    ) values (
      t.store_id, t.id, t.name, t.description, t.image_url, t.category, t.is_box,
      t.original_price, t.rescue_price, t.quantity, v_start, v_end, 'published'
    );
    update public.product_templates set last_listed_on = v_today where id = t.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- ---------------------------------------------------------------------------
-- 権限（明示的に最小権限を付与する）
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select on public.areas, public.plans to anon, authenticated;

grant select on public.stores to anon, authenticated;
grant update (name, category, address, phone, description, opening_hours, pickup_note, image_url)
  on public.stores to authenticated;
grant select on public.store_members to authenticated;
grant select on public.store_plan_changes to authenticated;

grant select on public.products to anon, authenticated;
grant insert (
  store_id, template_id, name, description, image_url, category, is_box, original_price, rescue_price,
  quantity, max_per_reservation, estimated_weight_g, pickup_start_at, pickup_end_at, status, created_by
) on public.products to authenticated;
grant update (
  name, description, image_url, category, is_box, original_price, rescue_price, max_per_reservation,
  estimated_weight_g, pickup_start_at, pickup_end_at, status
) on public.products to authenticated;

grant select, insert, update, delete on public.product_templates to authenticated;

grant select (id, display_name, avatar_url) on public.users to authenticated;
grant update (display_name, notify_enabled, notify_areas, last_seen_at) on public.users to authenticated;
grant select on public.user_stats to authenticated;

grant select on public.reservations to authenticated;
grant select on public.checkins to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select on public.points_transactions to authenticated;
grant select on public.billing_records to authenticated;
grant select, insert on public.ai_generations to authenticated;
grant select on public.product_sales_history to authenticated;

grant execute on function
  public.is_store_member(uuid),
  public.is_store_owner(uuid),
  public.reserve_product(uuid, int),
  public.cancel_reservation(uuid, text),
  public.store_cancel_reservation(uuid, text),
  public.checkin_store(uuid, int),
  public.adjust_product_quantity(uuid, int),
  public.delete_product(uuid),
  public.rotate_store_qr(uuid),
  public.change_store_plan(uuid, text),
  public.my_profile(),
  public.checkin_early_window(),
  public.checkin_grace_window(),
  public.checkin_points(),
  public.max_active_reservations()
to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.areas enable row level security;
alter table public.plans enable row level security;
alter table public.users enable row level security;
alter table public.user_stats enable row level security;
alter table public.admin_users enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_plan_changes enable row level security;
alter table public.product_templates enable row level security;
alter table public.products enable row level security;
alter table public.reservations enable row level security;
alter table public.checkins enable row level security;
alter table public.favorites enable row level security;
alter table public.points_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.ai_generations enable row level security;
alter table public.billing_records enable row level security;
alter table public.events enable row level security;
alter table public.product_sales_history enable row level security;
alter table public.external_daily_features enable row level security;

create policy areas_read on public.areas for select to anon, authenticated using (true);
create policy plans_read on public.plans for select to anon, authenticated using (true);

-- users: 本人と、自店舗で予約したユーザー（表示名のみ列権限で公開）
create policy users_read on public.users for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from public.reservations r
    where r.user_id = users.id and public.is_store_member(r.store_id)
  )
);
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy user_stats_read_self on public.user_stats for select to authenticated
  using (user_id = auth.uid());

-- stores: 稼働中の店舗は誰でも閲覧可。メンバーは自店舗を常に閲覧可。
create policy stores_read_public on public.stores for select to anon using (status = 'active');
create policy stores_read on public.stores for select to authenticated using (
  status = 'active'
  or public.is_store_member(id)
  or exists (select 1 from public.reservations r where r.store_id = stores.id and r.user_id = auth.uid())
);
create policy stores_update_owner on public.stores for update to authenticated
  using (public.is_store_owner(id)) with check (public.is_store_owner(id));

create policy store_members_read on public.store_members for select to authenticated
  using (user_id = auth.uid() or public.is_store_member(store_id));
create policy store_plan_changes_read on public.store_plan_changes for select to authenticated
  using (public.is_store_member(store_id));

create policy product_templates_member on public.product_templates for all to authenticated
  using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));

-- products: 公開中（稼働店舗）の商品は誰でも閲覧可。メンバーは自店舗の全商品。
create policy products_read_public on public.products for select to anon using (
  status in ('published', 'sold_out', 'closed') and deleted_at is null
  and exists (select 1 from public.stores s where s.id = products.store_id and s.status = 'active')
);
create policy products_read on public.products for select to authenticated using (
  (status in ('published', 'sold_out', 'closed') and deleted_at is null
    and exists (select 1 from public.stores s where s.id = products.store_id and s.status = 'active'))
  or public.is_store_member(store_id)
  or exists (select 1 from public.reservations r where r.product_id = products.id and r.user_id = auth.uid())
);
create policy products_insert_member on public.products for insert to authenticated
  with check (public.is_store_member(store_id));
create policy products_update_member on public.products for update to authenticated
  using (public.is_store_member(store_id)) with check (public.is_store_member(store_id));

create policy reservations_read on public.reservations for select to authenticated
  using (user_id = auth.uid() or public.is_store_member(store_id));

create policy checkins_read on public.checkins for select to authenticated
  using (user_id = auth.uid() or (store_id is not null and public.is_store_member(store_id)));

create policy favorites_read on public.favorites for select to authenticated
  using (user_id = auth.uid() or public.is_store_member(store_id));
create policy favorites_insert_self on public.favorites for insert to authenticated
  with check (user_id = auth.uid());
create policy favorites_delete_self on public.favorites for delete to authenticated
  using (user_id = auth.uid());

create policy points_read_self on public.points_transactions for select to authenticated
  using (user_id = auth.uid());

create policy billing_read_owner on public.billing_records for select to authenticated
  using (public.is_store_owner(store_id));

create policy ai_generations_member on public.ai_generations for select to authenticated
  using (public.is_store_member(store_id));
create policy ai_generations_insert_member on public.ai_generations for insert to authenticated
  with check (public.is_store_member(store_id) and user_id = auth.uid());

create policy product_sales_history_member on public.product_sales_history for select to authenticated
  using (public.is_store_member(store_id));

-- admin_users / notifications / notification_deliveries / events / external_daily_features は
-- ポリシーなし = anon / authenticated からは一切アクセス不可（サーバーの service のみ）。

-- ---------------------------------------------------------------------------
-- マスタデータ
-- ---------------------------------------------------------------------------
insert into public.areas (id, name, sort_order) values
  ('sapporo-station', '札幌駅', 10),
  ('odori', '大通', 20),
  ('susukino', 'すすきの', 30),
  ('other', 'その他', 90);

insert into public.plans (code, name, monthly_fee, commission_rate, features) values
  ('free', 'FREE', 0, 0.15, '{
    "listing": true, "line_web": true, "reservations": true, "basic_stats": true,
    "ai_description": "basic"
  }'::jsonb),
  ('standard', 'STANDARD', 4980, 0.05, '{
    "listing": true, "line_web": true, "reservations": true, "basic_stats": true,
    "ai_description": "full", "ai_price_suggestion": true, "sales_analytics": true,
    "auto_relist": true, "priority_listing": true, "favorite_notifications": true,
    "hourly_analytics": true, "product_analytics": true
  }'::jsonb);
