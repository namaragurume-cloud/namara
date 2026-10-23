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
