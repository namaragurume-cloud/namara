-- RLS（行レベルセキュリティ）のテスト。
-- 実行：supabase/tests/run-local.sh（ローカルの PostgreSQL に一時DBを作って検証）
-- 他社・他店舗・他ユーザーのデータが見えないこと、権限昇格できないことを確認する。
\set ON_ERROR_STOP on

-- ---------- テストデータ（管理者権限で投入） ----------
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),  -- org1 オーナー
  ('00000000-0000-0000-0000-00000000000b'),  -- org1 スタッフ（store1 のみ）
  ('00000000-0000-0000-0000-00000000000c'),  -- org2 オーナー
  ('00000000-0000-0000-0000-0000000000ff');  -- 運営
insert into public.platform_operators values ('00000000-0000-0000-0000-0000000000ff');
insert into public.store_categories (id, kind, label) values ('susukino', 'area', 'すすきの'), ('odori', 'area', '大通'), ('yakiniku', 'genre', '焼肉');
insert into public.organizations (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'org1（架空）'),
  ('10000000-0000-0000-0000-000000000002', 'org2（架空）');
insert into public.organization_members values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', 'owner');
insert into public.stores (id, organization_id, name, is_sample, published, area_id, city, address, genre_ids, verification_status, verified_at) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '店舗1（架空）', true, true, 'susukino', '札幌市', '架空', '{yakiniku}', 'verified', '2026-10-01'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '店舗2（架空）', true, true, 'susukino', '札幌市', '架空', '{yakiniku}', 'verified', '2026-10-01'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '店舗3（架空）', true, true, 'odori', '札幌市', '架空', '{yakiniku}', 'verified', '2026-10-01'),
  ('20000000-0000-0000-0000-000000000004', null, '非公開店舗（架空）', true, false, 'odori', '札幌市', '架空', '{yakiniku}', 'unverified', null);
insert into public.store_members values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'staff');
insert into public.campaigns (id, store_id, organization_id, name, target_area_ids, target_genre_ids, start_date, end_date, status, budget_yen) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'c1', '{susukino}', '{yakiniku}', '2026-10-01', '2026-12-31', 'approved', 9800),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'c3', '{odori}', '{yakiniku}', '2026-10-01', '2026-12-31', 'approved', 9800);
insert into public.reviews (store_id, source, external_id, rating, body, reviewed_at) values
  ('20000000-0000-0000-0000-000000000001', 'google_mock', 'r1', 5, 'org1の口コミ', now()),
  ('20000000-0000-0000-0000-000000000003', 'google_mock', 'r3', 2, 'org2の口コミ', now());
-- 検索ログ：すすきの×焼肉を 6人、大通×焼肉を 2人（少数セル）
insert into public.consumer_identities (id, channel, identifier_hash) select ('40000000-0000-0000-0000-00000000000' || i)::uuid, 'line', 'hash' || i from generate_series(1, 8) i;
insert into public.search_sessions (id, consumer_id, channel) select ('50000000-0000-0000-0000-00000000000' || i)::uuid, ('40000000-0000-0000-0000-00000000000' || i)::uuid, 'line' from generate_series(1, 8) i;
insert into public.search_queries (session_id, channel, raw_text, parser, parsed, area_ids, genre_ids, result_count)
  select ('50000000-0000-0000-0000-00000000000' || i)::uuid, 'line', 'すすきの 焼肉', 'rule', '{}', '{susukino}', '{yakiniku}', 3 from generate_series(1, 6) i;
insert into public.search_queries (session_id, channel, raw_text, parser, parsed, area_ids, genre_ids, result_count)
  select ('50000000-0000-0000-0000-00000000000' || i)::uuid, 'line', '大通 焼肉', 'rule', '{}', '{odori}', '{yakiniku}', 1 from generate_series(7, 8) i;

create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if not cond then raise exception 'FAILED: %', label; end if;
  raise notice 'ok: %', label;
end $$;

-- ---------- 未ログイン（anon） ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check((select count(*) from public.stores) = 3, 'anon は公開・検証済み店舗だけ見える');
select pg_temp.check((select count(*) from public.campaigns) = 0, 'anon は広告キャンペーンを見られない');
select pg_temp.check((select count(*) from public.reviews) = 0, 'anon は口コミ管理データを見られない');
do $$ begin
  perform count(*) from public.search_queries;
  raise exception 'FAILED: anon が検索ログを読めた';
exception when insufficient_privilege then raise notice 'ok: anon は検索ログを読めない';
end $$;
do $$ begin
  perform count(*) from public.consumer_identities;
  raise exception 'FAILED: anon が利用者識別子を読めた';
exception when insufficient_privilege then raise notice 'ok: anon は利用者識別子を読めない';
end $$;
reset role;

-- ---------- org1 オーナー ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.check((select count(*) from public.campaigns) = 1, 'org1 オーナーは自社の広告だけ見える');
select pg_temp.check((select count(*) from public.reviews) = 1, 'org1 オーナーは自社の口コミだけ見える');
select pg_temp.check((select count(*) from public.organizations) = 1, 'org1 オーナーは自社の組織だけ見える');
select pg_temp.check((select count(*) from public.stores where id = '20000000-0000-0000-0000-000000000004') = 0, '非公開の他店舗は見えない');
select pg_temp.check((select count(*) from public.search_queries) = 0, '店舗ユーザーは検索ログを直接読めない');
-- 他社店舗の広告を作れない
do $$ begin
  insert into public.campaigns (store_id, organization_id, name, target_area_ids, target_genre_ids, start_date, end_date, budget_yen)
  values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'x', '{odori}', '{yakiniku}', '2026-11-01', '2026-11-30', 9800);
  raise exception 'FAILED: 他社店舗の広告を作成できた';
exception when insufficient_privilege then raise notice 'ok: 他社店舗の広告は作成できない';
end $$;
-- 自店の広告は「審査待ち」でのみ作成できる
do $$ begin
  insert into public.campaigns (store_id, organization_id, name, target_area_ids, target_genre_ids, start_date, end_date, budget_yen, status)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'x', '{susukino}', '{yakiniku}', '2026-11-01', '2026-11-30', 9800, 'approved');
  raise exception 'FAILED: 自分で承認済みの広告を作成できた';
exception when insufficient_privilege then raise notice 'ok: 承認済みステータスでは作成できない';
end $$;
insert into public.campaigns (store_id, organization_id, name, target_area_ids, target_genre_ids, start_date, end_date, budget_yen)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '申請', '{susukino}', '{yakiniku}', '2026-11-01', '2026-11-30', 9800);
select pg_temp.check((select status from public.campaigns where name = '申請') = 'pending_review', '自店の広告は審査待ちで作成できる');
-- 自分で承認・予算変更はできない
do $$ begin
  update public.campaigns set status = 'approved' where name = '申請';
  raise exception 'FAILED: 店舗が自分で承認できた';
exception when insufficient_privilege then raise notice 'ok: 店舗は自分で承認できない';
end $$;
do $$ begin
  update public.campaigns set budget_yen = 1000000, status = 'stopped' where name = '申請';
  raise exception 'FAILED: 停止と同時に予算を変更できた';
exception when insufficient_privilege then raise notice 'ok: 停止時に他の項目は変更できない';
end $$;
update public.campaigns set status = 'stopped' where name = '申請';
select pg_temp.check((select status from public.campaigns where name = '申請') = 'stopped', '店舗は広告を停止できる');
-- 他社の広告は更新しても0件
update public.campaigns set status = 'stopped' where id = '30000000-0000-0000-0000-000000000003';
reset role;
select pg_temp.check((select status from public.campaigns where id = '30000000-0000-0000-0000-000000000003') = 'approved', '他社の広告は停止できない');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
-- 権限昇格の防止
do $$ begin
  insert into public.platform_operators values ('00000000-0000-0000-0000-00000000000a');
  raise exception 'FAILED: 自分を運営者にできた';
exception when insufficient_privilege then raise notice 'ok: 自分を運営者にできない';
end $$;
do $$ begin
  insert into public.organization_members values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'owner');
  raise exception 'FAILED: 他社の組織に参加できた';
exception when insufficient_privilege then raise notice 'ok: 他社の組織に自分を追加できない';
end $$;
-- 匿名集計：少数セル（大通 2人）は返らない／他社店舗の集計は呼べない
select pg_temp.check((select searches from public.store_demand_by_genre('20000000-0000-0000-0000-000000000001', now() - interval '1 day', now() + interval '1 day') where genre_id = 'yakiniku') = 5, '自店エリアの需要は丸めて返る');
do $$ begin
  perform * from public.store_demand_by_genre('20000000-0000-0000-0000-000000000003', now() - interval '1 day', now() + interval '1 day');
  raise exception 'FAILED: 他社店舗の需要集計を取得できた';
exception when insufficient_privilege then raise notice 'ok: 他社店舗の需要集計は取得できない';
end $$;
reset role;

-- ---------- org1 スタッフ（店舗1のみ・閲覧のみ） ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.check((select count(*) from public.campaigns where store_id = '20000000-0000-0000-0000-000000000002') = 0, 'スタッフは担当外店舗の広告を見られない');
select pg_temp.check((select count(*) from public.campaigns where store_id = '20000000-0000-0000-0000-000000000001') >= 1, 'スタッフは担当店舗の広告を見られる');
do $$ begin
  insert into public.campaigns (store_id, organization_id, name, target_area_ids, target_genre_ids, start_date, end_date, budget_yen)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'staff', '{susukino}', '{yakiniku}', '2026-11-01', '2026-11-30', 9800);
  raise exception 'FAILED: スタッフが広告を作成できた';
exception when insufficient_privilege then raise notice 'ok: スタッフは広告を作成できない';
end $$;
-- 大通の需要は少数セルのため空
reset role;

-- ---------- org2 オーナー ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.check((select count(*) from public.reviews) = 1 and (select body from public.reviews limit 1) = 'org2の口コミ', 'org2 は自社の口コミだけ見える');
select pg_temp.check((select count(*) from public.store_demand_by_genre('20000000-0000-0000-0000-000000000003', now() - interval '1 day', now() + interval '1 day')) = 0, '少数セル（2人）は集計結果に出ない');
reset role;

-- ---------- 運営 ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', false);
select pg_temp.check((select count(*) from public.stores) = 4, '運営は全店舗を見られる');
select pg_temp.check((select count(*) from public.campaigns) = 3, '運営は全広告を見られる');
update public.campaigns set status = 'approved', review_note = 'OK' where name = '申請';
select pg_temp.check((select status from public.campaigns where name = '申請') = 'approved', '運営は広告を承認できる');
select pg_temp.check((select count(*) from public.audit_logs where target_type = 'campaigns') >= 3, '広告操作が監査ログに残る');
reset role;

-- ---------- 保存期間・削除 ----------
update public.search_queries set raw_text_expires_at = now() - interval '1 day' where 'odori' = any (area_ids);
select pg_temp.check(public.purge_expired_search_text() = 2, '期限切れの生テキストを削除');
select public.delete_consumer_data('40000000-0000-0000-0000-000000000001');
select pg_temp.check((select identifier_hash from public.consumer_identities where id = '40000000-0000-0000-0000-000000000001') like 'deleted:%', '削除依頼で識別子を消去');
select pg_temp.check((select count(*) from public.search_queries q join public.search_sessions s on s.id = q.session_id where s.consumer_id = '40000000-0000-0000-0000-000000000001') = 0, '削除依頼で検索ログを本人と切り離す');

\o
\echo 'ALL RLS TESTS PASSED'
