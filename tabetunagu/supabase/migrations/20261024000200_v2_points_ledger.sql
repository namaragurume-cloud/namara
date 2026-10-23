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
