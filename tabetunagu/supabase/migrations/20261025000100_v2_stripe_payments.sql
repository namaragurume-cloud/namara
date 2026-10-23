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
