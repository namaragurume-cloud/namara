-- TABETUNAGU セットアップ（v2 決済）: 決済・返金・Connect（Stripe）
-- 03_v2_foundation.sql の後に Supabase の SQL Editor に貼り付けて Run してください。
-- 生成元: supabase/migrations/20261025000000_v2_stripe_connect.sql, supabase/migrations/20261025000100_v2_stripe_payments.sql, supabase/migrations/20261025000200_v2_stripe_payment_functions.sql（npm run db:migrate と同じ内容です）
-- 適用済みのものがある場合は実行しないでください（npm run db:migrate なら未適用分だけを適用します）。

-- ===========================================================================
-- TABETUNAGU v2 STEP 2 (1/3): 店舗の Stripe Connect（Express）情報
--
-- - 商品は掲載できても、stripe_charges_enabled でない店舗の注文は決済を開始できない。
-- - Connect の情報は account.updated Webhook（または店舗画面からの再取得）で同期する。
-- - Stripe アカウント ID などは店舗メンバー以外に見せない（列権限）。
--   一般公開するのは「決済を受け付けられるか」（stripe_charges_enabled）だけ。
-- ===========================================================================

alter table public.stores
  add column stripe_account_id text unique
    check (stripe_account_id is null or stripe_account_id ~ '^acct_[A-Za-z0-9]{1,64}$'),
  add column stripe_charges_enabled boolean not null default false,
  add column stripe_payouts_enabled boolean not null default false,
  add column stripe_details_submitted boolean not null default false,
  add column stripe_onboarding_completed_at timestamptz,
  add column stripe_account_synced_at timestamptz;

-- 列権限: 既存の列（と stripe_charges_enabled）だけを anon / authenticated に公開する
revoke select on public.stores from anon, authenticated;
grant select (
  id, slug, name, category, area_id, address, phone, description, opening_hours, pickup_note, image_url,
  status, plan_code, qr_version, is_demo, created_at, updated_at, stripe_charges_enabled
) on public.stores to anon, authenticated;

-- 店舗メンバーが自店舗の売上受取設定の状態を確認する
create or replace function public.store_payment_status(p_store_id uuid)
returns table (
  stripe_account_id text,
  charges_enabled boolean,
  payouts_enabled boolean,
  details_submitted boolean,
  onboarding_completed_at timestamptz,
  synced_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_store_member(p_store_id) then
    raise exception 'TT:forbidden';
  end if;
  return query
    select s.stripe_account_id, s.stripe_charges_enabled, s.stripe_payouts_enabled, s.stripe_details_submitted,
           s.stripe_onboarding_completed_at, s.stripe_account_synced_at
    from public.stores s where s.id = p_store_id;
end
$$;

-- 店舗に Connect アカウントを紐付ける（service のみ）。別のアカウントへの付け替えは不可。
create or replace function public.set_store_stripe_account(p_store_id uuid, p_account_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_current text;
begin
  select stripe_account_id into v_current from public.stores where id = p_store_id for update;
  if not found then
    raise exception 'TT:forbidden';
  end if;
  if v_current is not null and v_current <> p_account_id then
    raise exception 'TT:stripe_account_exists';
  end if;
  update public.stores set stripe_account_id = p_account_id where id = p_store_id;
end
$$;

-- Stripe のアカウント状態を同期する（service のみ。account.updated / 店舗画面からの再取得）
create or replace function public.sync_stripe_account(
  p_account_id text, p_charges_enabled boolean, p_payouts_enabled boolean, p_details_submitted boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_store_id uuid;
begin
  update public.stores
  set stripe_charges_enabled = p_charges_enabled,
      stripe_payouts_enabled = p_payouts_enabled,
      stripe_details_submitted = p_details_submitted,
      stripe_onboarding_completed_at = case
        when p_charges_enabled and p_details_submitted then coalesce(stripe_onboarding_completed_at, now())
        else stripe_onboarding_completed_at end,
      stripe_account_synced_at = now()
  where stripe_account_id = p_account_id
  returning id into v_store_id;
  return v_store_id; -- 該当店舗がなければ null
end
$$;

revoke execute on function
  public.store_payment_status(uuid),
  public.set_store_stripe_account(uuid, text),
  public.sync_stripe_account(text, boolean, boolean, boolean)
from public, anon, authenticated;
grant execute on function public.store_payment_status(uuid) to authenticated;

insert into public.schema_migrations (version) values ('20261025000000_v2_stripe_connect');

-- ===========================================================================
-- TABETUNAGU v2 STEP 2 (2/3): 決済・返金・Webhook 処理の記録
--
-- payments: 1注文につき複数の決済試行（Checkout Session）を持てる。成功（succeeded）は1注文1件まで。
--   pending         Checkout Session 作成済み・支払い待ち（カード失敗後の再入力もこの状態のまま）
--   succeeded       決済成功・注文を paid にした
--   failed          Checkout Session を作成できなかった
--   cancelled       Checkout Session の期限切れ・注文の期限切れで閉じた
--   requires_refund 決済は成功したが注文に使えない（期限切れ後の決済・二重決済）。自動で全額返金する
--   refunded        全額返金済み
--   requires_review 金額・店舗などが注文と一致しない。注文は paid にしない（要確認）
-- refunds: 全額返金のみ。1決済につき有効な返金は1件まで。
-- ===========================================================================

alter table public.payments
  add column checkout_session_id text unique
    check (checkout_session_id is null or char_length(checkout_session_id) <= 255),
  add column connected_account_id text
    check (connected_account_id is null or connected_account_id ~ '^acct_[A-Za-z0-9]{1,64}$'),
  add column checkout_url text check (checkout_url is null or char_length(checkout_url) <= 2048),
  add column checkout_expires_at timestamptz,
  add column failure_reason text check (failure_reason is null or char_length(failure_reason) <= 500);

alter table public.payments drop constraint payments_status_check;
alter table public.payments add constraint payments_status_check check (status in (
  'pending', 'requires_action', 'processing', 'succeeded', 'failed', 'cancelled',
  'requires_refund', 'refunded', 'requires_review'
));
alter table public.payments add constraint payments_provider_id_when_settled check (
  status not in ('succeeded', 'requires_refund', 'refunded') or provider_payment_id is not null
);

-- 成功した決済は1注文1件まで（返金済み・二重決済の返金済みは対象外にして、再決済・二重決済の返金を妨げない）
drop index public.payments_one_success_per_order;
create unique index payments_one_success_per_order on public.payments (order_id) where status = 'succeeded';

-- ---------------------------------------------------------------------------
-- 返金
-- ---------------------------------------------------------------------------
create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  provider text not null default 'stripe' check (provider in ('stripe')),
  provider_refund_id text unique check (provider_refund_id is null or char_length(provider_refund_id) <= 255),
  amount int not null check (amount > 0),
  reason text not null check (char_length(reason) between 1 and 200),
  actor public.cancel_actor not null,
  requested_by uuid references public.users (id),
  -- order: 注文ごと返金（注文を refunded にする） / payment: 注文に使われなかった決済だけを返金
  scope text not null check (scope in ('order', 'payment')),
  restock boolean not null default false,
  -- requested: 記録済み・Stripe 未送信 / pending: Stripe が受け付け処理中 / succeeded / failed
  status text not null default 'requested' check (status in ('requested', 'pending', 'succeeded', 'failed')),
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz,
  failed_at timestamptz,
  check (status <> 'succeeded' or succeeded_at is not null),
  check (status <> 'failed' or failed_at is not null)
);
create unique index refunds_one_active_per_payment
  on public.refunds (payment_id) where status in ('requested', 'pending', 'succeeded');
create index refunds_order_idx on public.refunds (order_id);
create trigger refunds_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Webhook の処理状況（再試行・同時受信の制御）
-- ---------------------------------------------------------------------------
alter table public.payment_events
  add column attempts int not null default 0,
  add column last_error text check (last_error is null or char_length(last_error) <= 1000),
  add column locked_until timestamptz;

-- ---------------------------------------------------------------------------
-- 権限・RLS
-- ---------------------------------------------------------------------------
revoke all on public.refunds from public, anon, authenticated;
alter table public.refunds enable row level security;
grant select on public.refunds to authenticated;

create policy refunds_read on public.refunds for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = refunds.order_id and (o.user_id = auth.uid() or public.is_store_member(o.store_id))
  )
);

insert into public.schema_migrations (version) values ('20261025000100_v2_stripe_payments');

-- ===========================================================================
-- TABETUNAGU v2 STEP 2 (3/3): 決済・返金・Webhook の DB 関数（すべて service のみ実行可能）
--
-- Stripe API の呼び出しはサーバー（src/server/services/payments.ts）が行い、
-- DB 側は「金額・状態・所有者の検証」と「状態の記録」を1トランザクションで行う。
-- - create_checkout_payment  決済試行（payments 行）を作る。金額は orders から取る
-- - mark_order_paid          決済成功（payment_intent.succeeded）を検証し、注文を paid にする
-- - begin_refund / complete_refund / fail_refund  返金ポリシーの確認と記録
-- - sync_charge_refunded     charge.refunded の反映（Stripe ダッシュボードからの返金を含む）
-- - claim_payment_event / finish_payment_event  Webhook の二重処理防止
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 決済試行の作成
-- 本人の pending_payment 注文で、期限内・店舗が決済を受け付けられる場合のみ。
-- 有効な Checkout Session があれば再利用する（同じ注文で何度もセッションを作らない）。
-- ---------------------------------------------------------------------------
create or replace function public.create_checkout_payment(p_order_id uuid, p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_payment public.payments%rowtype;
  v_attempts int;
begin
  select * into v_order from public.orders where id = p_order_id and user_id = p_user_id for update;
  if not found then
    raise exception 'TT:order_not_found';
  end if;
  if v_order.status = 'paid' then
    raise exception 'TT:already_paid';
  end if;
  if v_order.status <> 'pending_payment' then
    raise exception 'TT:not_payable';
  end if;
  if v_order.payment_expires_at <= now() then
    raise exception 'TT:payment_expired';
  end if;
  select * into v_store from public.stores where id = v_order.store_id;
  if v_store.status <> 'active' or v_store.stripe_account_id is null or not v_store.stripe_charges_enabled then
    raise exception 'TT:store_payment_unavailable';
  end if;

  select * into v_payment from public.payments
  where order_id = p_order_id and status = 'pending' and checkout_url is not null
    and checkout_expires_at > now() + interval '2 minutes'
    and connected_account_id = v_store.stripe_account_id
  order by created_at desc limit 1;
  if found then
    return jsonb_build_object('payment_id', v_payment.id, 'reuse', true, 'checkout_url', v_payment.checkout_url);
  end if;

  select count(*) into v_attempts from public.payments where order_id = p_order_id;
  if v_attempts >= 5 then
    raise exception 'TT:too_many_attempts';
  end if;

  insert into public.payments (order_id, provider, amount, currency, application_fee_amount, status, connected_account_id)
  values (p_order_id, 'stripe', v_order.total, 'jpy', v_order.platform_fee_total, 'pending', v_store.stripe_account_id)
  returning * into v_payment;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'reuse', false,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'user_id', v_order.user_id,
    'store_id', v_order.store_id,
    'plan_code', v_order.plan_code,
    'subtotal', v_order.subtotal,
    'tsunagu_charge', v_order.tsunagu_charge,
    'total', v_order.total,
    'application_fee_amount', v_order.platform_fee_total,
    'connected_account_id', v_store.stripe_account_id,
    'store_name', v_store.name,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_id', i.product_id, 'name', i.product_name_snapshot, 'unit_price', i.unit_price, 'quantity', i.quantity
      ) order by i.created_at), '[]'::jsonb)
      from public.order_items i where i.order_id = p_order_id
    )
  );
end
$$;

-- Checkout Session を作成できたら記録する
create or replace function public.attach_checkout_session(
  p_payment_id uuid, p_session_id text, p_url text, p_expires_at timestamptz
) returns void
language sql security definer set search_path = public as $$
  update public.payments
  set checkout_session_id = p_session_id, checkout_url = p_url, checkout_expires_at = p_expires_at
  where id = p_payment_id and status = 'pending';
$$;

-- Checkout Session を作成できなかった・期限切れになった試行を閉じる
create or replace function public.close_checkout_payment(p_payment_id uuid, p_status text, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('failed', 'cancelled') then
    raise exception 'TT:invalid_status';
  end if;
  update public.payments
  set status = p_status, failure_reason = left(p_reason, 500)
  where id = p_payment_id and status = 'pending';
end
$$;

-- checkout.session.completed: PaymentIntent ID を決済試行に記録する（paid にはしない）
create or replace function public.link_checkout_payment_intent(p_session_id text, p_payment_intent_id text)
returns void
language sql security definer set search_path = public as $$
  update public.payments
  set provider_payment_id = coalesce(provider_payment_id, p_payment_intent_id)
  where checkout_session_id = p_session_id;
$$;

-- payment_intent.payment_failed: 失敗理由を残す（Checkout 上で再入力できるため pending のまま）
create or replace function public.note_payment_failure(p_payment_id uuid, p_payment_intent_id text, p_reason text)
returns void
language sql security definer set search_path = public as $$
  update public.payments
  set failure_reason = left(p_reason, 500),
      provider_payment_id = coalesce(provider_payment_id, p_payment_intent_id)
  where id = p_payment_id and status = 'pending';
$$;

-- ---------------------------------------------------------------------------
-- 決済成功 → 注文を paid にする（payment_intent.succeeded から呼ぶ）
-- 結果（result）:
--   paid            注文を paid にした
--   already_paid    この決済で既に paid にしている（Webhook の再送）
--   requires_refund 決済は成功したが、注文が期限切れ・別の決済で支払い済み。全額返金が必要
--   already_settled 返金済みなど、もう何もしない
--   mismatch        金額・店舗・注文が一致しない。paid にしない（requires_review）
--   not_found       該当する決済試行がない（この注文システム以外の決済）
-- ---------------------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_payment_id uuid,
  p_provider_payment_id text,
  p_amount int,
  p_currency text,
  p_destination text,
  p_application_fee int,
  p_order_id uuid,
  p_store_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_store public.stores%rowtype;
  v_problems text[] := '{}';
begin
  if p_payment_id is not null then
    select * into v_payment from public.payments where id = p_payment_id for update;
  end if;
  if v_payment.id is null and p_provider_payment_id is not null then
    select * into v_payment from public.payments
    where provider = 'stripe' and provider_payment_id = p_provider_payment_id for update;
  end if;
  if v_payment.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  select * into v_store from public.stores where id = v_order.store_id;

  if v_payment.status = 'succeeded' then
    return jsonb_build_object('result', 'already_paid', 'order_id', v_order.id, 'payment_id', v_payment.id);
  end if;
  if v_payment.status = 'requires_refund' then
    return jsonb_build_object('result', 'requires_refund', 'order_id', v_order.id, 'payment_id', v_payment.id);
  end if;
  if v_payment.status in ('refunded', 'requires_review') then
    return jsonb_build_object('result', 'already_settled', 'order_id', v_order.id, 'payment_id', v_payment.id);
  end if;

  if p_order_id is distinct from v_order.id then
    v_problems := array_append(v_problems, 'order_mismatch');
  end if;
  if p_store_id is distinct from v_order.store_id then
    v_problems := array_append(v_problems, 'store_mismatch');
  end if;
  if p_amount is distinct from v_order.total or p_amount is distinct from v_payment.amount then
    v_problems := array_append(v_problems, 'amount_mismatch');
  end if;
  if lower(coalesce(p_currency, '')) <> v_payment.currency then
    v_problems := array_append(v_problems, 'currency_mismatch');
  end if;
  if p_destination is distinct from v_payment.connected_account_id
     or p_destination is distinct from v_store.stripe_account_id then
    v_problems := array_append(v_problems, 'destination_mismatch');
  end if;
  if p_application_fee is distinct from v_order.platform_fee_total then
    v_problems := array_append(v_problems, 'application_fee_mismatch');
  end if;
  if v_payment.provider_payment_id is not null and v_payment.provider_payment_id <> p_provider_payment_id then
    v_problems := array_append(v_problems, 'payment_intent_mismatch');
  end if;

  if cardinality(v_problems) > 0 then
    update public.payments
    set status = 'requires_review',
        provider_payment_id = coalesce(provider_payment_id, p_provider_payment_id),
        failure_reason = array_to_string(v_problems, ',')
    where id = v_payment.id;
    insert into public.events (name, user_id, store_id, properties)
    values ('payment_requires_review', v_order.user_id, v_order.store_id,
            jsonb_build_object('order_id', v_order.id, 'payment_id', v_payment.id, 'problems', to_jsonb(v_problems)));
    return jsonb_build_object('result', 'mismatch', 'order_id', v_order.id, 'payment_id', v_payment.id,
                              'problems', to_jsonb(v_problems));
  end if;

  if v_order.status = 'pending_payment' then
    -- 期限（payment_expires_at）を過ぎていても、まだ sweep されていなければ在庫は仮押さえのまま。そのまま paid にする
    update public.payments
    set status = 'succeeded', paid_at = now(), provider_payment_id = p_provider_payment_id, failure_reason = null
    where id = v_payment.id;
    update public.orders set status = 'paid' where id = v_order.id;
    -- 同じ注文の他の決済試行は閉じる
    update public.payments set status = 'cancelled', failure_reason = 'order_paid_by_other_attempt'
    where order_id = v_order.id and id <> v_payment.id and status = 'pending';
    insert into public.events (name, user_id, store_id, properties)
    values ('order_paid', v_order.user_id, v_order.store_id,
            jsonb_build_object('order_id', v_order.id, 'payment_id', v_payment.id, 'total', v_order.total));
    return jsonb_build_object('result', 'paid', 'order_id', v_order.id, 'payment_id', v_payment.id);
  end if;

  -- 注文が期限切れでキャンセル済み、または別の決済で支払い済み → この決済は全額返金する
  update public.payments
  set status = 'requires_refund', provider_payment_id = p_provider_payment_id,
      failure_reason = case when v_order.status = 'cancelled' then 'order_cancelled_before_payment'
                            else 'duplicate_payment' end
  where id = v_payment.id;
  insert into public.events (name, user_id, store_id, properties)
  values ('payment_requires_refund', v_order.user_id, v_order.store_id,
          jsonb_build_object('order_id', v_order.id, 'payment_id', v_payment.id, 'order_status', v_order.status));
  return jsonb_build_object('result', 'requires_refund', 'order_id', v_order.id, 'payment_id', v_payment.id);
end
$$;

-- ---------------------------------------------------------------------------
-- 返金
-- 返金ポリシー（全額返金のみ）:
--   user   本人の paid 注文で、決済完了から user_refund_window_minutes 以内、かつ受取開始前
--   store  自店舗の paid 注文（受取前）
--   admin  paid 注文
--   system paid 注文、または注文に使われなかった決済（requires_refund）
--   picked_up / unclaimed の注文は返金しない（管理者の例外対応は将来）
-- 在庫: 受取終了前の注文ごとの返金で、user / admin / system のときは戻す。
--        store（品切れ・提供できない等）は戻さない。決済だけの返金（期限切れ後の決済・二重決済）は戻さない。
-- ---------------------------------------------------------------------------
create or replace function public.begin_refund(
  p_order_id uuid, p_actor public.cancel_actor, p_reason text, p_requested_by uuid, p_payment_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_refund public.refunds%rowtype;
  v_scope text;
  v_restock boolean := false;
  v_window int;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'TT:reason_required';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'TT:order_not_found';
  end if;

  if p_payment_id is not null then
    -- 注文に使われなかった決済だけを返金する（system のみ）
    if p_actor <> 'system' then
      raise exception 'TT:forbidden';
    end if;
    select * into v_payment from public.payments where id = p_payment_id and order_id = p_order_id for update;
    if not found or v_payment.status not in ('requires_refund', 'refunded') then
      raise exception 'TT:not_refundable';
    end if;
    v_scope := 'payment';
  else
    if v_order.status = 'refunded' then
      raise exception 'TT:already_refunded';
    end if;
    if v_order.status <> 'paid' then
      raise exception 'TT:not_refundable';
    end if;
    select * into v_payment from public.payments
    where order_id = p_order_id and status in ('succeeded', 'refunded')
    order by paid_at desc nulls last limit 1 for update;
    if not found then
      raise exception 'TT:not_refundable';
    end if;
    v_scope := 'order';

    if p_actor = 'user' then
      if p_requested_by is distinct from v_order.user_id then
        raise exception 'TT:order_not_found';
      end if;
      v_window := public.platform_setting_int('user_refund_window_minutes');
      if now() > v_order.paid_at + make_interval(mins => v_window) or now() >= v_order.pickup_start then
        raise exception 'TT:refund_window_closed';
      end if;
    elsif p_actor = 'store' then
      if not exists (
        select 1 from public.store_members m where m.store_id = v_order.store_id and m.user_id = p_requested_by
      ) then
        raise exception 'TT:forbidden';
      end if;
    elsif p_actor = 'admin' then
      if not exists (select 1 from public.admin_users a where a.user_id = p_requested_by) then
        raise exception 'TT:forbidden';
      end if;
    end if;
    v_restock := p_actor <> 'store' and now() < v_order.pickup_end;
  end if;

  -- 送信前に止まった返金があれば再開する（Stripe 側は同じ冪等キーで1回だけ作られる）
  select * into v_refund from public.refunds where payment_id = v_payment.id and status = 'requested';
  if found then
    return jsonb_build_object('refund_id', v_refund.id, 'payment_intent', v_payment.provider_payment_id,
                              'amount', v_refund.amount, 'resumed', true);
  end if;
  if exists (select 1 from public.refunds where payment_id = v_payment.id and status in ('pending', 'succeeded')) then
    raise exception 'TT:already_refunded';
  end if;

  insert into public.refunds (order_id, payment_id, amount, reason, actor, requested_by, scope, restock)
  values (p_order_id, v_payment.id, v_payment.amount, left(p_reason, 200), p_actor, p_requested_by, v_scope, v_restock)
  returning * into v_refund;
  return jsonb_build_object('refund_id', v_refund.id, 'payment_intent', v_payment.provider_payment_id,
                            'amount', v_refund.amount, 'resumed', false);
end
$$;

-- 返金の確定（内部用）: 決済・注文・ポイント・在庫に反映する。返金行はロック済みであること。
create or replace function public.apply_refund(p_refund_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_refund public.refunds%rowtype;
  v_order public.orders%rowtype;
  v_points jsonb := null;
begin
  select * into v_refund from public.refunds where id = p_refund_id;
  update public.payments set status = 'refunded' where id = v_refund.payment_id and status <> 'refunded';
  if v_refund.scope = 'order' then
    select * into v_order from public.orders where id = v_refund.order_id for update;
    if v_order.status = 'paid' then
      update public.orders set status = 'refunded' where id = v_order.id;
      if v_refund.restock then
        perform public.release_order_stock(v_order.id);
      end if;
      v_points := public.revoke_order_points(v_order.id);
      insert into public.events (name, user_id, store_id, properties)
      values ('order_refunded', v_order.user_id, v_order.store_id,
              jsonb_build_object('order_id', v_order.id, 'refund_id', v_refund.id, 'actor', v_refund.actor,
                                 'restock', v_refund.restock));
    end if;
  end if;
  return jsonb_build_object('refund_id', v_refund.id, 'scope', v_refund.scope, 'points', v_points);
end
$$;

-- Stripe が返金を受け付けた（succeeded / pending）→ 確定。冪等。
create or replace function public.complete_refund(p_refund_id uuid, p_provider_refund_id text, p_provider_status text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_refund public.refunds%rowtype;
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then
    raise exception 'TT:refund_not_found';
  end if;
  if v_refund.status in ('pending', 'succeeded') then
    return jsonb_build_object('refund_id', v_refund.id, 'status', v_refund.status, 'already', true);
  end if;
  if p_provider_status not in ('succeeded', 'pending', 'requires_action') then
    update public.refunds
    set status = 'failed', failed_at = now(), provider_refund_id = p_provider_refund_id,
        failure_reason = 'provider_status:' || coalesce(p_provider_status, 'unknown')
    where id = p_refund_id;
    return jsonb_build_object('refund_id', v_refund.id, 'status', 'failed', 'already', false);
  end if;
  update public.refunds
  set provider_refund_id = p_provider_refund_id,
      status = case when p_provider_status = 'succeeded' then 'succeeded' else 'pending' end,
      succeeded_at = case when p_provider_status = 'succeeded' then now() end
  where id = p_refund_id;
  return public.apply_refund(p_refund_id)
    || jsonb_build_object('status', case when p_provider_status = 'succeeded' then 'succeeded' else 'pending' end,
                          'already', false);
end
$$;

-- Stripe API の呼び出しに失敗した（注文・決済は変更しない。もう一度返金できる）
create or replace function public.fail_refund(p_refund_id uuid, p_reason text) returns void
language sql security definer set search_path = public as $$
  update public.refunds
  set status = 'failed', failed_at = now(), failure_reason = left(coalesce(p_reason, 'unknown'), 500)
  where id = p_refund_id and status = 'requested';
$$;

-- charge.refunded の反映
--   - この注文システムが作った返金 → succeeded にする
--   - Stripe ダッシュボードなどからの全額返金 → 返金を記録し、paid の注文は refunded にする（在庫は戻さない）
--   - 一部返金はこの MVP では扱わない（記録のみ）
create or replace function public.sync_charge_refunded(p_provider_payment_id text, p_amount_refunded int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_refund public.refunds%rowtype;
  v_order public.orders%rowtype;
begin
  select * into v_payment from public.payments
  where provider = 'stripe' and provider_payment_id = p_provider_payment_id for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  if p_amount_refunded < v_payment.amount then
    return jsonb_build_object('result', 'partial_refund_ignored', 'payment_id', v_payment.id);
  end if;

  select * into v_refund from public.refunds
  where payment_id = v_payment.id and status in ('requested', 'pending', 'succeeded') for update;
  if found then
    if v_refund.status = 'pending' then
      update public.refunds set status = 'succeeded', succeeded_at = now() where id = v_refund.id;
    end if;
    return jsonb_build_object('result', 'confirmed', 'refund_id', v_refund.id);
  end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;
  insert into public.refunds (order_id, payment_id, amount, reason, actor, scope, restock, status, succeeded_at)
  values (v_payment.order_id, v_payment.id, v_payment.amount, 'external_refund', 'admin',
          case when v_payment.status = 'succeeded' and v_order.status = 'paid' then 'order' else 'payment' end,
          false, 'succeeded', now())
  returning * into v_refund;
  perform public.apply_refund(v_refund.id);
  if v_order.status in ('picked_up', 'unclaimed') then
    insert into public.events (name, user_id, store_id, properties)
    values ('external_refund_after_pickup', v_order.user_id, v_order.store_id,
            jsonb_build_object('order_id', v_order.id, 'payment_id', v_payment.id));
  end if;
  return jsonb_build_object('result', 'external_refund_recorded', 'refund_id', v_refund.id);
end
$$;

-- ---------------------------------------------------------------------------
-- Webhook の冪等処理
-- claim: claimed（処理する）/ duplicate（処理済み）/ in_progress（他のリクエストが処理中）
-- 処理に失敗したイベントは processed_at が null のまま残り、Stripe の再送で再処理される。
-- ---------------------------------------------------------------------------
create or replace function public.claim_payment_event(
  p_provider text, p_event_id text, p_event_type text, p_payload jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_event public.payment_events%rowtype;
begin
  insert into public.payment_events (provider, provider_event_id, event_type, payload, attempts, locked_until)
  values (p_provider, p_event_id, p_event_type, coalesce(p_payload, '{}'::jsonb), 1, now() + interval '5 minutes')
  on conflict (provider, provider_event_id) do nothing
  returning * into v_event;
  if v_event.id is not null then
    return 'claimed';
  end if;

  select * into v_event from public.payment_events
  where provider = p_provider and provider_event_id = p_event_id for update;
  if v_event.processed_at is not null then
    return 'duplicate';
  end if;
  if v_event.locked_until is not null and v_event.locked_until > now() then
    return 'in_progress';
  end if;
  update public.payment_events
  set attempts = attempts + 1, locked_until = now() + interval '5 minutes'
  where id = v_event.id;
  return 'claimed';
end
$$;

create or replace function public.finish_payment_event(p_provider text, p_event_id text, p_error text)
returns void
language sql security definer set search_path = public as $$
  update public.payment_events
  set processed_at = case when p_error is null then now() else processed_at end,
      last_error = left(p_error, 1000),
      locked_until = null
  where provider = p_provider and provider_event_id = p_event_id;
$$;

-- ---------------------------------------------------------------------------
-- 期限切れで閉じた注文の、開いたままの Checkout Session（sweep 後に Stripe 側も期限切れにする）
-- ---------------------------------------------------------------------------
create or replace function public.stale_checkout_sessions(p_limit int default 50)
returns table (payment_id uuid, checkout_session_id text)
language sql stable security definer set search_path = public as $$
  select p.id, p.checkout_session_id
  from public.payments p join public.orders o on o.id = p.order_id
  where p.status = 'pending' and p.checkout_session_id is not null and o.status <> 'pending_payment'
  order by p.created_at
  limit p_limit
$$;

revoke execute on function
  public.create_checkout_payment(uuid, uuid),
  public.attach_checkout_session(uuid, text, text, timestamptz),
  public.close_checkout_payment(uuid, text, text),
  public.link_checkout_payment_intent(text, text),
  public.note_payment_failure(uuid, text, text),
  public.mark_order_paid(uuid, text, int, text, text, int, uuid, uuid),
  public.begin_refund(uuid, public.cancel_actor, text, uuid, uuid),
  public.apply_refund(uuid),
  public.complete_refund(uuid, text, text),
  public.fail_refund(uuid, text),
  public.sync_charge_refunded(text, int),
  public.claim_payment_event(text, text, text, jsonb),
  public.finish_payment_event(text, text, text),
  public.stale_checkout_sessions(int)
from public, anon, authenticated;

insert into public.schema_migrations (version) values ('20261025000200_v2_stripe_payment_functions');
