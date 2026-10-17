export type Row = Record<string, unknown>;

/** パラメータ付きクエリを実行できるもの（トランザクション内のコネクション） */
export interface Queryable {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Driver {
  readonly kind: "pglite" | "postgres";
  transaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  /** パラメータなしの複数ステートメントを1トランザクションで実行する（マイグレーション用） */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * DB に誰として接続するか。
 * - anon / user: RLS が効く（Supabase の anon / authenticated ロール）
 * - service: RLS をバイパス。サーバー側で認可済みの集計・バッチ・管理者処理のみで使う
 */
export type DbActor = { kind: "anon" } | { kind: "user"; userId: string } | { kind: "service" };
