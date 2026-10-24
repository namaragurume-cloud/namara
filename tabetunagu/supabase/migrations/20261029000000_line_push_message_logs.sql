-- ===========================================================================
-- TABETUNAGU: LINE 公式アカウント（Messaging API の Push）の送信記録（デモ）
--
-- 「今日の食べつなぎ」（注目商品）のテスト送信の記録。販促のお知らせのため、LINE ミニアプリのサービスメッセージとは別。
-- 送信先は内部のユーザー ID だけを記録する（LINE の userId・トークン・本文は保存しない）。サーバー（service）からのみ読み書きする。
-- ===========================================================================

create table public.line_push_message_logs (
  id uuid primary key default gen_random_uuid(),
  -- 将来: featured_daily（オプトインしたユーザーへの日次配信。今回は無効）
  notification_type text not null check (notification_type in ('featured_product_demo', 'featured_daily')),
  product_id uuid references public.products (id) on delete set null,
  target_user_id uuid references public.users (id) on delete set null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_category text check (error_category is null or error_category ~ '^[a-z_]{1,40}$'),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index line_push_logs_target_idx on public.line_push_message_logs (target_user_id, created_at desc);

alter table public.line_push_message_logs enable row level security;
revoke all on public.line_push_message_logs from public, anon, authenticated;
