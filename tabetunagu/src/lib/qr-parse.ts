/** 読み取った文字列（URL またはトークン）から店舗QRトークンを取り出す（クライアントでも使う） */
const TOKEN = "v1\\.[0-9a-f]{32}\\.\\d{1,6}\\.[A-Za-z0-9_-]{24}";

export function extractQrToken(scanned: string): string | null {
  const text = scanned.trim();
  const inUrl = new RegExp(`/c/(${TOKEN})(?:[/?#]|$)`).exec(text);
  if (inUrl) return inUrl[1];
  if (new RegExp(`^${TOKEN}$`).test(text)) return text;
  return null;
}
