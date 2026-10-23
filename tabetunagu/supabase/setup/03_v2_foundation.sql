-- TABETUNAGU セットアップ（v2）: v2 の基盤（料金更新・注文・決済の受け皿・ポイント台帳・注文関数）
-- 01_schema.sql の後に Supabase の SQL Editor に貼り付けて Run してください（02 のデモデータを入れる場合はその後）。
-- 生成元: supabase/migrations/20261024000000_v2_update_plans.sql, supabase/migrations/20261024000100_v2_orders_payments.sql, supabase/migrations/20261024000200_v2_points_ledger.sql, supabase/migrations/20261024000300_v2_order_functions.sql（npm run db:migrate と同じ内容です）
-- 適用済みのものがある場合は実行しないでください（npm run db:migrate なら未適用分だけを適用します）。

-- ===========================================================================
-- TABETUNAGU v2 (1/4): 料金プランの更新と運用設定値
--
-- - FREE 15% → 20%、STANDARD 5% → 8%（いずれも決済手数料込み）。月額は変更なし。
-- - 過去の予約（reservations.commission_rate / plan_code）は成約時点の値を保持しているため変更しない。
-- - つなぐチャージ・ポイント・決済待ち期限などの設定値を platform_settings で一元管理する。
--   アプリ側の同じ値は src/lib/fees.ts / src/lib/orders.ts（tests/pricing-sync.test.ts で一致を確認）。
-- ===========================================================================

update public.plans set commission_rate = 0.2000 where code = 'free';
update public.plans set commission_rate = 0.0800 where code = 'standard';

-- 注文（orders）では率を basis point（1% = 100）の整数で扱う
alter table public.plans
  add column commission_bps int generated always as ((round(commission_rate * 10000))::int) stored;

-- ---------------------------------------------------------------------------
-- 運用設定値（整数のみ。変更はマイグレーションまたは service から行う）
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key check (key ~ '^[a-z_]{3,64}$'),
  int_value int not null,
  description text not null default '',
  updated_at timestamptz not null default now()
);
create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

insert into public.platform_settings (key, int_value, description) values
  ('tsunagu_charge_yen', 30, 'つなぐチャージ（1注文あたり・円）。成約手数料の計算対象外'),
  ('order_points', 30, '決済成功時に付与する つなぐポイント（1注文あたり）'),
  ('payment_hold_minutes', 15, '決済待ち（在庫の仮押さえ）の有効期限（分）'),
  ('user_refund_window_minutes', 5, 'ユーザー都合の全額返金が可能な、決済完了からの時間（分）'),
  ('max_pending_orders_per_user', 3, '1人が同時に持てる決済待ちの注文数');

create or replace function public.platform_setting_int(p_key text) returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_value int;
begin
  select int_value into v_value from public.platform_settings where key = p_key;
  if not found then
    raise exception 'TT:setting_missing (%)', p_key;
  end if;
  return v_value;
end
$$;

alter table public.platform_settings enable row level security;
-- ポリシーなし = anon / authenticated からは参照不可（DB 関数と service のみ）
revoke all on public.platform_settings from public, anon, authenticated;
revoke execute on function public.platform_setting_int(text) from public, anon, authenticated;

insert into public.schema_migrations (version) values ('20261024000000_v2_update_plans');

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

insert into public.schema_migrations (version) values ('20261024000100_v2_orders_payments');

-- ===========================================================================
-- TABETUNAGU v2 (3/4): つなぐポイントの台帳化
--
-- - points_transactions を正とし、残高は台帳の合計から算出する（user_points_balances / points_balance()）。
-- - user_stats.points_balance は旧QRフローの互換のために残すが、今後は残高の正として使わない。
-- - 台帳は追記のみ。訂正は adjusted の行を追加して行う。
-- - 既存の行・旧フロー（checkin_store の reason = 'checkin' の挿入）はそのまま動く。
-- ===========================================================================

alter table public.points_transactions
  add column type text,
  add column order_id uuid references public.orders (id),
  add column expires_at timestamptz;

comment on column public.points_transactions.amount is 'ポイント数（符号付き。付与は正、利用・失効・取り消しは負）';
comment on column public.user_stats.points_balance is
  '旧QRフローの互換用。残高の正は points_transactions（public.user_points_balances）';

-- 既存行の type を reason から設定する
update public.points_transactions set type = case reason
  when 'checkin' then 'earned'
  when 'redeem' then 'used'
  when 'expiry' then 'expired'
  else 'adjusted'
end;

-- 旧フローは type を指定せずに挿入するため、reason から補完する
create or replace function public.points_transactions_fill_type() returns trigger
language plpgsql as $$
begin
  if new.type is null then
    new.type := case new.reason
      when 'checkin' then 'earned'
      when 'redeem' then 'used'
      when 'expiry' then 'expired'
      else 'adjusted'
    end;
  end if;
  return new;
end
$$;
create trigger points_transactions_fill_type before insert on public.points_transactions
  for each row execute function public.points_transactions_fill_type();

alter table public.points_transactions
  alter column type set not null,
  add constraint points_transactions_type_check
    check (type in ('earned', 'used', 'expired', 'adjusted', 'revoked'));

alter table public.points_transactions drop constraint points_transactions_reason_check;
alter table public.points_transactions add constraint points_transactions_reason_check check (reason in (
  'checkin', 'adjustment', 'expiry', 'redeem',          -- 旧フロー
  'order_paid', 'order_refunded', 'balance_migration'   -- v2
));

-- 符号の整合性（既存行は検証しない。新しい行から適用）
alter table public.points_transactions add constraint points_transactions_sign_check check (
  (type = 'earned' and amount > 0)
  or (type in ('used', 'expired', 'revoked') and amount < 0)
  or (type = 'adjusted' and amount <> 0)
) not valid;

-- 同じ注文への付与・取り消しは1回ずつ（used など他の種類は将来の用途のため制限しない）
create unique index points_once_per_order
  on public.points_transactions (order_id, type) where order_id is not null and type in ('earned', 'revoked');
create index points_order_idx on public.points_transactions (order_id) where order_id is not null;

-- ---------------------------------------------------------------------------
-- 既存残高との整合性: user_stats.points_balance と台帳の合計が違うユーザーには差額の adjusted を追加し、
-- 移行の前後で表示される残高を変えない。
-- ---------------------------------------------------------------------------
insert into public.points_transactions (user_id, amount, type, reason)
select s.user_id, s.points_balance - coalesce(l.total, 0), 'adjusted', 'balance_migration'
from public.user_stats s
left join (
  select user_id, sum(amount)::int as total from public.points_transactions group by user_id
) l on l.user_id = s.user_id
where s.points_balance <> coalesce(l.total, 0);

-- 追記のみ（更新は禁止。削除はユーザー削除の cascade のみ。anon / authenticated には削除権限なし）
create trigger points_transactions_no_update before update on public.points_transactions
  for each row execute function public.reject_modification();

-- ---------------------------------------------------------------------------
-- 残高（台帳の合計）。security_invoker により RLS が効き、本人の残高だけが見える。
-- ---------------------------------------------------------------------------
create view public.user_points_balances with (security_invoker = true) as
select
  user_id,
  sum(amount)::int as balance,
  coalesce(sum(amount) filter (where type = 'earned'), 0)::int as earned_total,
  max(created_at) as last_transaction_at
from public.points_transactions
group by user_id;

create or replace function public.points_balance(p_user_id uuid) returns int
language sql stable security invoker set search_path = public as $$
  select coalesce(sum(amount), 0)::int from public.points_transactions where user_id = p_user_id
$$;

revoke all on public.user_points_balances from public, anon, authenticated;
grant select on public.user_points_balances to authenticated;
revoke execute on function public.points_balance(uuid), public.points_transactions_fill_type()
  from public, anon, authenticated;
grant execute on function public.points_balance(uuid) to authenticated;

insert into public.schema_migrations (version) values ('20261024000200_v2_points_ledger');

-- ===========================================================================
-- TABETUNAGU v2 (4/4): 注文・ポイントの DB 関数
--
-- - create_order        : 在庫の仮押さえ + 注文作成（pending_payment）。決済はまだ行わない
-- - cancel_pending_order: 決済前の注文をユーザーが中断（在庫を戻す）
-- - sweep_orders        : 決済期限切れの注文を cancelled にして在庫を戻す（service のみ）
-- - grant_order_points  : paid の注文に つなぐポイントを付与（service のみ。STEP 2 で決済成功時に呼ぶ）
-- - revoke_order_points : 全額返金（refunded）の注文の付与ポイントを取り消す（service のみ）
-- 旧フローの関数は products の在庫・削除ガードに v2 の注文を考慮する変更のみ行う。
-- ===========================================================================

-- 商品に有効な v2 注文（決済待ち、または決済済みで受取終了前）があるか
create or replace function public.product_has_active_orders(p_product_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.order_items i join public.orders o on o.id = i.order_id
    where i.product_id = p_product_id
      and (o.status = 'pending_payment' or (o.status = 'paid' and o.pickup_end > now()))
  )
$$;

-- ---------------------------------------------------------------------------
-- 注文作成（在庫の仮押さえ）
-- 商品行を FOR UPDATE でロックしてから在庫を確認・減算するため、
-- 同時に最後の1個を注文しても成功するのは1件だけ（reserve_product と同じ考え方）。
-- 金額（小計・つなぐチャージ・成約手数料）はすべてここで計算し、クライアントの値は使わない。
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p_product_id uuid, p_quantity int default 1)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_product public.products%rowtype;
  v_store public.stores%rowtype;
  v_plan_code text;
  v_bps int;
  v_subtotal int;
  v_charge int;
  v_commission int;
  v_expires timestamptz;
  v_order public.orders%rowtype;
  v_pending int;
begin
  if v_uid is null or not exists (select 1 from public.users where id = v_uid) then
    raise exception 'TT:not_authenticated';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'TT:invalid_quantity';
  end if;

  -- 同じユーザーの注文作成を直列化（決済待ちの上限・重複注文の判定を確実にする）
  perform pg_advisory_xact_lock(hashtextextended('create_order:' || v_uid::text, 0));

  select * into v_product from public.products where id = p_product_id for update;
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
    select 1 from public.order_items i join public.orders o on o.id = i.order_id
    where o.user_id = v_uid and i.product_id = p_product_id
      and (o.status = 'pending_payment' or (o.status = 'paid' and o.pickup_end > now()))
  ) then
    raise exception 'TT:already_ordered';
  end if;
  select count(*) into v_pending from public.orders
  where user_id = v_uid and status = 'pending_payment' and payment_expires_at > now();
  if v_pending >= public.platform_setting_int('max_pending_orders_per_user') then
    raise exception 'TT:too_many_pending';
  end if;

  update public.products
  set remaining_quantity = remaining_quantity - p_quantity,
      status = case when remaining_quantity - p_quantity = 0 then 'sold_out'::public.product_status else status end,
      sold_out_at = case when remaining_quantity - p_quantity = 0 then now() else sold_out_at end
  where id = p_product_id;

  select p.code, p.commission_bps into v_plan_code, v_bps
  from public.plans p where p.code = v_store.plan_code;
  v_subtotal := v_product.rescue_price * p_quantity;
  v_charge := public.platform_setting_int('tsunagu_charge_yen');
  v_commission := floor(v_subtotal::numeric * v_bps / 10000)::int;
  v_expires := least(
    now() + make_interval(mins => public.platform_setting_int('payment_hold_minutes')),
    v_product.pickup_end_at
  );

  loop
    begin
      insert into public.orders (
        order_number, user_id, store_id, status, subtotal, tsunagu_charge, total,
        commission_bps, commission_amount, platform_fee_total, plan_code,
        pickup_start, pickup_end, payment_expires_at
      ) values (
        public.gen_reservation_code(), v_uid, v_product.store_id, 'pending_payment', v_subtotal, v_charge,
        v_subtotal + v_charge, v_bps, v_commission, v_commission + v_charge, v_plan_code,
        v_product.pickup_start_at, v_product.pickup_end_at, v_expires
      ) returning * into v_order;
      exit;
    exception when unique_violation then
      -- 注文番号の衝突のみリトライ
      null;
    end;
  end loop;

  insert into public.order_items (order_id, product_id, product_name_snapshot, unit_price, quantity, line_total)
  values (v_order.id, v_product.id, v_product.name, v_product.rescue_price, p_quantity,
          v_product.rescue_price * p_quantity);

  insert into public.events (name, user_id, store_id, product_id, properties)
  values ('order_created', v_uid, v_order.store_id, v_product.id,
          jsonb_build_object('order_id', v_order.id, 'quantity', p_quantity, 'total', v_order.total));

  return v_order;
end
$$;

-- 仮押さえ在庫を戻す（内部用。呼び出し側で注文行をロック・状態を確認すること）
create or replace function public.release_order_stock(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in select product_id, quantity from public.order_items where order_id = p_order_id loop
    update public.products
    set remaining_quantity = least(quantity, remaining_quantity + r.quantity),
        status = case when status = 'sold_out' and pickup_end_at > now()
                      then 'published'::public.product_status else status end,
        sold_out_at = case when status = 'sold_out' and pickup_end_at > now() then null else sold_out_at end
    where id = r.product_id and deleted_at is null;
  end loop;
end
$$;

-- 決済前の注文をユーザー本人が中断する（決済画面を閉じた等）
create or replace function public.cancel_pending_order(p_order_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'TT:not_authenticated';
  end if;
  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'TT:order_not_found';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'TT:not_cancellable';
  end if;
  update public.orders
  set status = 'cancelled', cancelled_by = 'user', cancel_reason = 'payment_abandoned'
  where id = p_order_id
  returning * into v_order;
  perform public.release_order_stock(p_order_id);
  insert into public.events (name, user_id, store_id, properties)
  values ('order_cancelled', v_order.user_id, v_order.store_id,
          jsonb_build_object('order_id', v_order.id, 'actor', 'user', 'reason', 'payment_abandoned'));
  return v_order;
end
$$;

-- 決済期限切れの注文を cancelled にして在庫を戻す（service のみ）。paid 以降の注文には触れない。
create or replace function public.sweep_orders() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_expired int := 0;
  r record;
begin
  for r in
    update public.orders
    set status = 'cancelled', cancelled_by = 'system', cancel_reason = 'payment_expired'
    where status = 'pending_payment' and payment_expires_at < now()
    returning id, user_id, store_id
  loop
    perform public.release_order_stock(r.id);
    insert into public.events (name, user_id, store_id, properties)
    values ('order_payment_expired', r.user_id, r.store_id, jsonb_build_object('order_id', r.id));
    v_expired := v_expired + 1;
  end loop;
  return jsonb_build_object('expired_orders', v_expired);
end
$$;

-- ---------------------------------------------------------------------------
-- つなぐポイント
-- ---------------------------------------------------------------------------
-- paid の注文に付与する。同じ注文には1回だけ（2回目以降は granted = false で何もしない）。
create or replace function public.grant_order_points(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_points int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'TT:order_not_found';
  end if;
  if v_order.status <> 'paid' then
    raise exception 'TT:order_not_paid';
  end if;
  if exists (select 1 from public.points_transactions where order_id = p_order_id and type = 'earned') then
    return jsonb_build_object('granted', false, 'points', 0);
  end if;
  v_points := public.platform_setting_int('order_points');
  insert into public.points_transactions (user_id, order_id, amount, type, reason)
  values (v_order.user_id, p_order_id, v_points, 'earned', 'order_paid');
  return jsonb_build_object('granted', true, 'points', v_points);
end
$$;

-- 全額返金（refunded）の注文の付与ポイントを取り消す。付与済みの場合のみ・1回だけ。
create or replace function public.revoke_order_points(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_earned int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'TT:order_not_found';
  end if;
  if v_order.status <> 'refunded' then
    raise exception 'TT:order_not_refunded';
  end if;
  select amount into v_earned from public.points_transactions where order_id = p_order_id and type = 'earned';
  if v_earned is null
     or exists (select 1 from public.points_transactions where order_id = p_order_id and type = 'revoked') then
    return jsonb_build_object('revoked', false, 'points', 0);
  end if;
  insert into public.points_transactions (user_id, order_id, amount, type, reason)
  values (v_order.user_id, p_order_id, -v_earned, 'revoked', 'order_refunded');
  return jsonb_build_object('revoked', true, 'points', -v_earned);
end
$$;

-- ---------------------------------------------------------------------------
-- 旧フロー関数の更新: v2 の注文がある商品も、予約と同じく受取時間の変更・削除を不可にする
-- ---------------------------------------------------------------------------
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
     and (
       exists (
         select 1 from public.reservations r
         where r.product_id = old.id and r.status in ('pending', 'confirmed')
       )
       or public.product_has_active_orders(old.id)
     ) then
    raise exception 'TT:has_active_reservations';
  end if;
  return new;
end
$$;

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
  ) or public.product_has_active_orders(p_product_id) then
    raise exception 'TT:has_active_reservations';
  end if;
  update public.products set status = 'deleted', deleted_at = now() where id = p_product_id;
end
$$;

-- ---------------------------------------------------------------------------
-- 権限
-- ---------------------------------------------------------------------------
revoke execute on function
  public.product_has_active_orders(uuid),
  public.create_order(uuid, int),
  public.release_order_stock(uuid),
  public.cancel_pending_order(uuid),
  public.sweep_orders(),
  public.grant_order_points(uuid),
  public.revoke_order_points(uuid),
  public.products_guard_update(),
  public.delete_product(uuid)
from public, anon, authenticated;

-- product_has_active_orders は products_guard_update（authenticated 権限で実行されるトリガー）から呼ぶ
grant execute on function
  public.product_has_active_orders(uuid),
  public.create_order(uuid, int),
  public.cancel_pending_order(uuid),
  public.delete_product(uuid)
to authenticated;

insert into public.schema_migrations (version) values ('20261024000300_v2_order_functions');
