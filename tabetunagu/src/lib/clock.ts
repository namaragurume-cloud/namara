/**
 * 現在時刻（ミリ秒）。Server Component はリクエストごとに1回だけ描画されるため、
 * 受取時間を過ぎたかどうかの判定にはこの値を使う（クライアントコンポーネントでは使わない）。
 */
export function nowMs() {
  return Date.now();
}
