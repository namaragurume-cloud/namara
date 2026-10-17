import "server-only";
import { AppError } from "@/lib/errors";
import { asService } from "../db";
import { env } from "../env";

/**
 * LINE Login（LIFF / Web）。
 * - LIFF: クライアントで liff.getIDToken() → /api/auth/liff → ここで検証
 * - Web: /api/auth/line → LINE 認可画面 → /api/auth/line/callback → コード交換 → 検証
 * ID トークンは必ず LINE の verify エンドポイントでサーバー側検証する（クライアントの自己申告を信用しない）。
 */

export type LineProfile = { sub: string; name: string; picture: string | null; email: string | null };

export async function verifyLineIdToken(idToken: string, nonce?: string): Promise<LineProfile> {
  if (!env.line.channelId) throw new AppError("line_not_configured");
  const body = new URLSearchParams({ id_token: idToken, client_id: env.line.channelId });
  if (nonce) body.set("nonce", nonce);
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new AppError("login_failed");
  const data = (await res.json()) as { sub?: string; name?: string; picture?: string; email?: string };
  if (!data.sub) throw new AppError("login_failed");
  return { sub: data.sub, name: data.name || "LINEユーザー", picture: data.picture ?? null, email: data.email ?? null };
}

export function lineAuthorizeUrl(params: { state: string; nonce: string; redirectUri: string }) {
  const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.line.channelId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  // 必要最小限: openid（User ID）と profile（表示名・画像）。メールは取得しない。
  url.searchParams.set("scope", "openid profile");
  return url.toString();
}

export async function exchangeLineCode(code: string, redirectUri: string) {
  const res = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: env.line.channelId,
      client_secret: env.line.channelSecret,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new AppError("login_failed");
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new AppError("login_failed");
  return data.id_token;
}

/** LINE User ID でユーザーを作成または更新し、users.id を返す */
export async function upsertLineUser(profile: LineProfile): Promise<string> {
  return asService(async (q) => {
    const [row] = await q.query<{ id: string }>(
      `insert into public.users (line_user_id, display_name, avatar_url, email, last_seen_at)
       values ($1, left($2, 60), $3, $4, now())
       on conflict (line_user_id) do update
         set display_name = left(excluded.display_name, 60),
             avatar_url = excluded.avatar_url,
             email = coalesce(excluded.email, public.users.email),
             last_seen_at = now()
       returning id`,
      [profile.sub, profile.name, profile.picture, profile.email],
    );
    await q.query("select public.ensure_user_stats($1)", [row.id]);
    await q.query("insert into public.events (name, user_id) values ('login', $1)", [row.id]);
    return row.id;
  });
}

/** 戻り先は自サイト内のパスのみ許可（オープンリダイレクト対策） */
export function safeNextPath(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
