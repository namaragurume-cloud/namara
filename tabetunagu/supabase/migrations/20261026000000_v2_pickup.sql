-- ===========================================================================
-- TABETUNAGU v2 STEP 3: デジタル受取チケット・自己スワイプ受取・未受取（unclaimed）
--
-- - 受取はユーザー本人のスワイプのみ（店舗の完了操作はない）。受取時間 ± 猶予の間だけ受け付ける。
-- - 受取時間 + 猶予を過ぎても受け取られていない paid の注文は unclaimed にする。
--   決済は確定のまま（返金しない・ポイントも取り消さない）。
-- - 受取に関する出来事は pickup_events に追記のみで残す（不正分析用）。
-- - 旧フロー（店頭 QR / checkin_store）の猶予（30分）とは別の設定値。
-- ===========================================================================

insert into public.platform_settings (key, int_value, description) values
  ('pickup_early_grace_minutes', 10, '受取開始の何分前から受取完了（スワイプ）できるか'),
  ('pickup_late_grace_minutes', 15, '受取終了の何分後まで受取完了できるか。過ぎると未受取（unclaimed）');

-- ---------------------------------------------------------------------------
-- 受取完了（ユーザー本人のスワイプ）
-- 結果: picked_up（今回受け取った）/ already_picked_up（受取済み。何もしない）
-- 受け取れない場合は 'TT:<code>' で例外。
-- p_metadata はサーバーが組み立てた付帯情報（IP・User-Agent・スワイプの所要時間など）。将来の店舗コード・NFC 等もここに入れる。
-- ---------------------------------------------------------------------------
create or replace function public.pickup_order(p_order_id uuid, p_metadata jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_early int;
  v_late int;
begin
  if v_uid is null then
    raise exception 'TT:not_authenticated';
  end if;
  select * into v_order from public.orders where id = p_order_id and user_id = v_uid for update;
  if not found then
    raise exception 'TT:order_not_found';
  end if;
  if v_order.status = 'picked_up' then
    return jsonb_build_object('result', 'already_picked_up', 'picked_up_at', v_order.picked_up_at);
  end if;
  case v_order.status
    when 'pending_payment' then raise exception 'TT:order_not_paid';
    when 'refunded' then raise exception 'TT:already_refunded';
    when 'cancelled' then raise exception 'TT:not_pickupable';
    when 'unclaimed' then raise exception 'TT:pickup_window_closed';
    else null;
  end case;

  v_early := public.platform_setting_int('pickup_early_grace_minutes');
  v_late := public.platform_setting_int('pickup_late_grace_minutes');
  if now() < v_order.pickup_start - make_interval(mins => v_early) then
    raise exception 'TT:pickup_too_early';
  end if;
  if now() > v_order.pickup_end + make_interval(mins => v_late) then
    raise exception 'TT:pickup_window_closed';
  end if;

  update public.orders set status = 'picked_up' where id = v_order.id returning * into v_order;
  insert into public.pickup_events (order_id, user_id, actor, kind, metadata)
  values (v_order.id, v_uid, 'user', 'swipe',
          case when octet_length(coalesce(p_metadata, '{}'::jsonb)::text) <= 2000 then coalesce(p_metadata, '{}'::jsonb)
               else '{}'::jsonb end);
  insert into public.events (name, user_id, store_id, properties)
  values ('pickup_completed', v_uid, v_order.store_id, jsonb_build_object('order_id', v_order.id));
  return jsonb_build_object('result', 'picked_up', 'picked_up_at', v_order.picked_up_at);
end
$$;

-- ---------------------------------------------------------------------------
-- 未受取: 受取終了 + 猶予を過ぎた paid の注文を unclaimed にする（service のみ）
-- p_store_id を指定するとその店舗だけ（店舗モニター・注文画面を開いたときの処理用）
-- ---------------------------------------------------------------------------
create or replace function public.mark_unclaimed_orders(p_store_id uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  v_late int := public.platform_setting_int('pickup_late_grace_minutes');
  r record;
begin
  for r in
    update public.orders
    set status = 'unclaimed'
    where status = 'paid'
      and pickup_end + make_interval(mins => v_late) < now()
      and (p_store_id is null or store_id = p_store_id)
    returning id, user_id, store_id
  loop
    insert into public.pickup_events (order_id, user_id, actor, kind, metadata)
    values (r.id, r.user_id, 'system', 'auto_unclaimed', jsonb_build_object('late_grace_minutes', v_late));
    insert into public.events (name, user_id, store_id, properties)
    values ('order_unclaimed', r.user_id, r.store_id, jsonb_build_object('order_id', r.id));
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- 決済期限切れの注文を閉じる（sweep_orders の店舗単位版。在庫を戻す）
create or replace function public.expire_pending_orders(p_store_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    update public.orders
    set status = 'cancelled', cancelled_by = 'system', cancel_reason = 'payment_expired'
    where status = 'pending_payment' and payment_expires_at < now() and store_id = p_store_id
    returning id, user_id, store_id
  loop
    perform public.release_order_stock(r.id);
    insert into public.events (name, user_id, store_id, properties)
    values ('order_payment_expired', r.user_id, r.store_id, jsonb_build_object('order_id', r.id));
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- 画面を開いたときの店舗単位の状態更新（決済期限切れ・未受取）。service のみ
create or replace function public.maintain_store_orders(p_store_id uuid) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'expired_orders', public.expire_pending_orders(p_store_id),
    'unclaimed_orders', public.mark_unclaimed_orders(p_store_id)
  )
$$;

revoke execute on function
  public.pickup_order(uuid, jsonb),
  public.mark_unclaimed_orders(uuid),
  public.expire_pending_orders(uuid),
  public.maintain_store_orders(uuid)
from public, anon, authenticated;
grant execute on function public.pickup_order(uuid, jsonb) to authenticated;
