/** 法人専用ページのURL（/o/{slug}）に使う識別子のルール */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** システムで使う名前は法人IDにできない */
export const RESERVED_SLUGS = ["admin", "login", "logout", "api", "o", "app", "www", "settings", "new", "support", "namara"];

export function validateSlug(slug: string, existing: string[]): string | null {
  if (!SLUG_PATTERN.test(slug)) return "半角英小文字・数字・ハイフンで3〜40文字にしてください（先頭と末尾は英数字）";
  if (RESERVED_SLUGS.includes(slug)) return "この法人IDはシステムで使用しているため利用できません";
  if (existing.includes(slug)) return "この法人IDは既に使われています";
  return null;
}

export function organizationPath(slug: string) {
  return `/o/${slug}`;
}
