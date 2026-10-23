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
