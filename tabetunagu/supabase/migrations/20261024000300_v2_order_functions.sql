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
