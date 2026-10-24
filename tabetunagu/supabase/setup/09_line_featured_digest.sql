-- TABETUNAGU セットアップ（LINE 日次注目商品通知・オプトイン）
-- 08_line_push_message_logs.sql の後に Supabase の SQL Editor に貼り付けて Run してください。
-- 生成元: supabase/migrations/20261030000000_line_featured_digest.sql（npm run db:migrate と同じ内容です）
-- 適用済みのものがある場合は実行しないでください（npm run db:migrate なら未適用分だけを適用します）。

-- ===========================================================================
-- TABETUNAGU: LINE 日次注目商品通知（「今夜の食べつなぎ」・オプトイン）
--
-- - ユーザーが明示的に ON にしたときだけ送る（既定は OFF）。ON にした日時を同意の記録として残す
-- - 送信記録は line_push_message_logs に追加（商品 ID の配列・配信日（JST））。LINE の userId・トークン・本文は保存しない
-- - 1人1日1回: 配信日ごとに「送信中・送信済み・失敗」は1件だけ（一意インデックス。失敗しても同じ日に再送しない）
-- ===========================================================================

alter table public.users
  add column line_featured_opt_in boolean not null default false,
  add column line_featured_opt_in_at timestamptz;

alter table public.line_push_message_logs
  add column product_ids uuid[] not null default '{}',
  add column delivery_date date;

alter table public.line_push_message_logs drop constraint line_push_message_logs_notification_type_check;
alter table public.line_push_message_logs add constraint line_push_message_logs_notification_type_check
  check (notification_type in ('featured_product_demo', 'featured_daily', 'featured_daily_test'));

alter table public.line_push_message_logs drop constraint line_push_message_logs_status_check;
alter table public.line_push_message_logs add constraint line_push_message_logs_status_check
  check (status in ('pending', 'sent', 'failed', 'skipped', 'dry_run'));

create unique index line_push_logs_daily_once on public.line_push_message_logs (target_user_id, delivery_date)
  where notification_type = 'featured_daily' and status in ('pending', 'sent', 'failed');
create index line_push_logs_type_date_idx on public.line_push_message_logs (notification_type, delivery_date);

insert into public.schema_migrations (version) values ('20261030000000_line_featured_digest');
