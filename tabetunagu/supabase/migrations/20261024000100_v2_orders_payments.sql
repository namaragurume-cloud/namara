-- ===========================================================================
-- TABETUNAGU v2 (2/4): 注文・決済・受取イベント
--
-- - 旧フロー（reservations / checkins / 店舗QR）はそのまま残し、v2 の注文を並行して追加する。
-- - 金額はすべて整数の円。率は basis point（1% = 100）。
-- - 注文の状態は「決済」と「受取」を分けて管理する（paid = 売上確定、picked_up = 受取実績）。
-- - 注文・決済の書き込みは SECURITY DEFINER 関数と service（サーバー）からのみ。
--   anon / authenticated には参照以外の権限を付与しない。
-- ===========================================================================

create type public.order_status as enum (
  'pending_payment', -- 注文作成・在庫を仮押さえ。決済待ち（payment_expires_at まで）
  'paid',            -- 決済成功 = 売上確定。受取待ち
  'picked_up',       -- ユーザーが受取完了（終端）
  'unclaimed',       -- 受取時間を過ぎても受取完了がない（終端。売上は確定のまま、在庫は戻さない）
  'cancelled',       -- 決済前のキャンセル・決済期限切れ（終端。在庫を戻す）
  'refunded'         -- 決済後の全額返金（終端）
);

-- 許可する状態遷移（src/lib/orders.ts の ORDER_TRANSITIONS と同じ）
create or replace function public.order_transition_allowed(
  p_from public.order_status, p_to public.order_status
) returns boolean
language sql immutable as $$
  select (p_from, p_to) in (
    ('pending_payment'::public.order_status, 'paid'::public.order_status),
    ('pending_payment', 'cancelled'),
    ('paid', 'picked_up'),
    ('paid', 'unclaimed'),
    ('paid', 'refunded')
  )
$$;

-- ---------------------------------------------------------------------------
-- 注文
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique, -- 店頭で読み上げやすい英数字6桁
  user_id uuid not null references public.users (id),
  store_id uuid not null references public.stores (id),
  status public.order_status not null default 'pending_payment',
  subtotal int not null check (subtotal >= 0),                 -- 商品小計（成約手数料の計算対象）
  tsunagu_charge int not null check (tsunagu_charge >= 0),     -- つなぐチャージ（手数料の計算対象外）
  total int not null,                                          -- ユーザーの支払総額
  commission_bps int not null check (commission_bps between 0 and 10000),
  commission_amount int not null check (commission_amount >= 0),
  platform_fee_total int not null,                             -- 成約手数料 + つなぐチャージ
  plan_code text not null references public.plans (code),      -- 注文時点の店舗プラン
  pickup_start timestamptz not null,                           -- 注文時点の受取時間（スナップショット）
  pickup_end timestamptz not null,
  payment_expires_at timestamptz not null,
  paid_at timestamptz,
  picked_up_at timestamptz,
  unclaimed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by public.cancel_actor,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 200),
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total = subtotal + tsunagu_charge),
  check (commission_amount <= subtotal),
  check (platform_fee_total = commission_amount + tsunagu_charge),
  check (pickup_end > pickup_start),
  check (status <> 'paid' or paid_at is not null),
  check (status <> 'picked_up' or (paid_at is not null and picked_up_at is not null)),
  check (status <> 'unclaimed' or (paid_at is not null and unclaimed_at is not null)),
  check (status <> 'cancelled' or (paid_at is null and cancelled_at is not null)),
  check (status <> 'refunded' or (paid_at is not null and refunded_at is not null))
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_store_idx on public.orders (store_id, pickup_start desc);
create index orders_status_idx on public.orders (status, pickup_end);
create index orders_payment_expiry_idx on public.orders (payment_expires_at) where status = 'pending_payment';
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- 注文の作成時・更新時のガード（関数・service を含むすべての経路に効く）
-- - 作成時は必ず pending_payment
-- - 金額・所有者・受取時間のスナップショットは変更不可
-- - 状態遷移は order_transition_allowed のみ。遷移時刻を自動で記録する
create or replace function public.orders_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending_payment' then
      raise exception 'TT:invalid_order_transition';
    end if;
    return new;
  end if;

  if (new.order_number, new.user_id, new.store_id, new.subtotal, new.tsunagu_charge, new.total,
      new.commission_bps, new.commission_amount, new.platform_fee_total, new.plan_code,
      new.pickup_start, new.pickup_end, new.created_at)
     is distinct from
     (old.order_number, old.user_id, old.store_id, old.subtotal, old.tsunagu_charge, old.total,
      old.commission_bps, old.commission_amount, old.platform_fee_total, old.plan_code,
      old.pickup_start, old.pickup_end, old.created_at) then
    raise exception 'TT:order_immutable';
  end if;

  if new.status is distinct from old.status then
    if not public.order_transition_allowed(old.status, new.status) then
      raise exception 'TT:invalid_order_transition';
    end if;
    case new.status
      when 'paid' then new.paid_at := coalesce(new.paid_at, now());
      when 'picked_up' then new.picked_up_at := coalesce(new.picked_up_at, now());
      when 'unclaimed' then new.unclaimed_at := coalesce(new.unclaimed_at, now());
      when 'cancelled' then new.cancelled_at := coalesce(new.cancelled_at, now());
      when 'refunded' then new.refunded_at := coalesce(new.refunded_at, now());
      else null;
    end case;
  end if;
  return new;
end
$$;
create trigger orders_guard before insert or update on public.orders
  for each row execute function public.orders_guard();

-- ---------------------------------------------------------------------------
-- 注文明細（注文時点の商品名・価格のスナップショット。作成後は変更しない）
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  product_id uuid not null references public.products (id),
  product_name_snapshot text not null check (char_length(product_name_snapshot) between 1 and 60),
  unit_price int not null check (unit_price >= 0),
  quantity int not null check (quantity between 1 and 10),
  line_total int not null,
  created_at timestamptz not null default now(),
  check (line_total = unit_price * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

-- ---------------------------------------------------------------------------
-- 決済（STEP 2 で Stripe の PaymentIntent を保存する受け皿）
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider in ('stripe')), -- 決済事業者を追加するときは制約を変更する
  provider_payment_id text check (provider_payment_id is null or char_length(provider_payment_id) <= 255),
  amount int not null check (amount >= 0),
  currency text not null default 'jpy' check (currency ~ '^[a-z]{3}$'),
  application_fee_amount int not null default 0 check (application_fee_amount >= 0),
  status text not null default 'pending' check (status in (
    'pending', 'requires_action', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'
  )),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (application_fee_amount <= amount)
);
create unique index payments_provider_payment_idx
  on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
-- 1注文につき成功した決済は1件まで
create unique index payments_one_success_per_order
  on public.payments (order_id) where status in ('succeeded', 'refunded');
create index payments_order_idx on public.payments (order_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 決済 Webhook イベント（同じイベントを二重に処理しないための記録）
-- ---------------------------------------------------------------------------
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 255),
  event_type text not null check (char_length(event_type) between 1 and 120),
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index payment_events_unprocessed_idx on public.payment_events (created_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- 受取イベント（注文の状態とは別に、受取に関する出来事を追記のみで残す。不正分析用）
-- ---------------------------------------------------------------------------
create table public.pickup_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  user_id uuid not null references public.users (id), -- 注文者（admin_override でも注文者を記録）
  actor text not null check (actor in ('user', 'system', 'admin')),
  kind text not null check (kind in ('swipe', 'auto_unclaimed', 'admin_override')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index pickup_events_order_idx on public.pickup_events (order_id, created_at);
create index pickup_events_user_idx on public.pickup_events (user_id, created_at desc);

-- 追記のみ（明細・受取イベントは更新・削除しない）
create or replace function public.reject_modification() returns trigger
language plpgsql as $$
begin
  raise exception 'TT:append_only (%)', tg_table_name;
end
$$;
create trigger order_items_append_only before update or delete on public.order_items
  for each row execute function public.reject_modification();
create trigger pickup_events_append_only before update or delete on public.pickup_events
  for each row execute function public.reject_modification();

-- ---------------------------------------------------------------------------
-- 権限・RLS
-- （Supabase の既定権限で新しいテーブルに付く権限をいったん剥奪し、参照のみ付与する）
-- ---------------------------------------------------------------------------
revoke all on public.orders, public.order_items, public.payments, public.payment_events, public.pickup_events
  from public, anon, authenticated;
revoke execute on function public.order_transition_allowed(public.order_status, public.order_status),
  public.orders_guard(), public.reject_modification()
  from public, anon, authenticated;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.pickup_events enable row level security;

grant select on public.orders, public.order_items, public.payments, public.pickup_events to authenticated;
grant execute on function public.order_transition_allowed(public.order_status, public.order_status) to authenticated;

-- 注文: 本人と、注文先店舗のメンバー
create policy orders_read on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_store_member(store_id));

create policy order_items_read on public.order_items for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and (o.user_id = auth.uid() or public.is_store_member(o.store_id))
  )
);

create policy payments_read on public.payments for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = payments.order_id and (o.user_id = auth.uid() or public.is_store_member(o.store_id))
  )
);

create policy pickup_events_read on public.pickup_events for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.orders o where o.id = pickup_events.order_id and public.is_store_member(o.store_id))
);

-- payment_events: ポリシーなし = anon / authenticated からは一切アクセス不可（service のみ）

-- 注文したユーザーは、停止中の店舗・終了した商品でも注文の表示に必要な範囲で閲覧できる
create policy stores_read_order_customer on public.stores for select to authenticated using (
  exists (select 1 from public.orders o where o.store_id = stores.id and o.user_id = auth.uid())
);
create policy products_read_order_customer on public.products for select to authenticated using (
  exists (
    select 1 from public.order_items i join public.orders o on o.id = i.order_id
    where i.product_id = products.id and o.user_id = auth.uid()
  )
);
-- 店舗メンバーは自店舗に注文したユーザーの表示名を参照できる（列権限で id・表示名・アイコンのみ）
create policy users_read_order_store on public.users for select to authenticated using (
  exists (select 1 from public.orders o where o.user_id = users.id and public.is_store_member(o.store_id))
);
