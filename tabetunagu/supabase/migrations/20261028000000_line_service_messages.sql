-- ===========================================================================
-- TABETUNAGU: LINE ミニアプリのサービスメッセージ（デモ）
--
-- - line_service_notification_tokens: サービス通知トークン（ユーザーの操作ごとに LINE が発行。1年間有効・最大5回送信）。
--   送信のたびに LINE から新しいトークンが返るため、常に最新の値に更新する（古い値は使わない）。
--   LIFF アクセストークン・チャネルのシークレットは保存しない。
-- - line_service_message_logs: 送信の記録（種類・注文・結果・エラーの分類だけ。トークンや本文の個人情報は保存しない）。
-- どちらもサーバー（service）からのみ読み書きする。anon / authenticated には権限を与えない。
-- ===========================================================================

create table public.line_service_notification_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- どの操作で発行したか（デモは null。将来: 決済した注文）
  order_id uuid references public.orders (id) on delete cascade,
  purpose text not null check (purpose in ('demo', 'order_completed')),
  session_id text check (session_id is null or char_length(session_id) <= 200),
  token text not null check (char_length(token) between 1 and 2048),
  remaining_count int not null check (remaining_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index line_sn_tokens_user_idx on public.line_service_notification_tokens (user_id, created_at desc);
create index line_sn_tokens_order_idx on public.line_service_notification_tokens (order_id) where order_id is not null;
create trigger line_sn_tokens_updated_at before update on public.line_service_notification_tokens
  for each row execute function public.set_updated_at();

alter table public.line_service_notification_tokens enable row level security;
revoke all on public.line_service_notification_tokens from public, anon, authenticated;

create table public.line_service_message_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  -- 将来: order_completed（決済成功）/ pickup_reminder（受取30分前）/ order_status_changed（キャンセル・返金）
  notification_type text not null check (notification_type in ('demo_order_completed', 'order_completed', 'pickup_reminder', 'order_status_changed')),
  order_id uuid references public.orders (id) on delete set null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_category text check (error_category is null or error_category ~ '^[a-z_]{1,40}$'),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index line_sm_logs_user_idx on public.line_service_message_logs (user_id, created_at desc);
-- 同じ注文・同じ種類の通知は1回だけ（デモは除く。デモは送信間隔で二重送信を防ぐ）
create unique index line_sm_logs_once_per_order
  on public.line_service_message_logs (order_id, notification_type)
  where status = 'sent' and order_id is not null;

alter table public.line_service_message_logs enable row level security;
revoke all on public.line_service_message_logs from public, anon, authenticated;
