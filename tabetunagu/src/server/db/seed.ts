/**
 * ローカル確認用のデモデータ（札幌の架空店舗・架空ユーザー）。
 * 実在の店舗名は使用していません。本番 DB には投入しないでください（scripts/seed.ts が拒否します）。
 */
import { estimatedWeightG } from "@/lib/categories";
import { PLANS, PRICING } from "@/lib/fees";
import type { Queryable } from "./types";

export const DEMO_USERS = {
  user: { id: "00000000-0000-4000-8000-000000000001", name: "デモユーザー" },
  storeOwner: { id: "00000000-0000-4000-8000-000000000002", name: "大通ベーカリー 店主（デモ）" },
  storeStaff: { id: "00000000-0000-4000-8000-000000000003", name: "すすきのデリ スタッフ（デモ）" },
  admin: { id: "00000000-0000-4000-8000-000000000004", name: "TABETUNAGU 運営（デモ）" },
} as const;

export type DemoAccount = keyof typeof DEMO_USERS;

/** デモ出品の仮の商品画像（public/demo）。画像のないカテゴリーはアイコン表示のまま */
const DEMO_IMAGES: Record<string, string> = {
  bread: "/demo/bread.webp",
  bento: "/demo/bento.webp",
  deli: "/demo/deli.webp",
  sweets: "/demo/sweets.webp",
};
const demoImage = (category: string) => DEMO_IMAGES[category] ?? null;

type SeedStore = {
  slug: string;
  name: string;
  area: string;
  category: string;
  plan: "free" | "standard";
  status?: "active" | "pending";
  description: string;
  address: string;
  hours: string;
  /** QR完了率が極端に低い（管理画面の「要確認」デモ用） */
  suspicious?: boolean;
};

const STORES: SeedStore[] = [
  {
    slug: "odori-bakery",
    name: "大通ベーカリー",
    area: "odori",
    category: "bread",
    plan: "standard",
    description: "北海道産小麦と自家製酵母のパン屋。毎朝40種類ほどを焼き上げています。",
    address: "札幌市中央区大通西（架空）",
    hours: "8:00〜20:00",
  },
  {
    slug: "susukino-deli",
    name: "すすきのデリ",
    area: "susukino",
    category: "deli",
    plan: "free",
    description: "道産野菜をたっぷり使った量り売りのお惣菜店。",
    address: "札幌市中央区南4条西（架空）",
    hours: "11:00〜21:30",
  },
  {
    slug: "sapporo-sweets-lab",
    name: "札幌スイーツラボ",
    area: "sapporo-station",
    category: "sweets",
    plan: "standard",
    description: "季節のフルーツを使ったケーキと焼き菓子の工房。",
    address: "札幌市北区北7条西（架空）",
    hours: "10:00〜20:00",
  },
  {
    slug: "kita-obento",
    name: "北のおべんとう舎",
    area: "sapporo-station",
    category: "bento",
    plan: "free",
    description: "炊きたてのごはんと手づくりおかずのお弁当屋。",
    address: "札幌市北区北6条西（架空）",
    hours: "10:30〜20:00",
  },
  {
    slug: "komugi-to-yuge",
    name: "こむぎと湯気",
    area: "odori",
    category: "bread",
    plan: "free",
    description: "朝と夕方の2回焼き。食パンとハード系が人気の小さなパン屋。",
    address: "札幌市中央区南1条西（架空）",
    hours: "9:00〜19:30",
  },
  {
    slug: "hotel-norte-dining",
    name: "ホテル・ノルテ札幌 ダイニング",
    area: "sapporo-station",
    category: "hotel",
    plan: "standard",
    description: "ホテルのブッフェとベーカリー。シェフが仕込んだ料理をお持ち帰りいただけます。",
    address: "札幌市中央区北4条西（架空）",
    hours: "ブッフェ 17:30〜21:00",
  },
  {
    slug: "omusubi-tomarigi",
    name: "おむすび とまり木",
    area: "susukino",
    category: "bento",
    plan: "free",
    description: "道産米のおむすびと豚汁のお店。",
    address: "札幌市中央区南5条西（架空）",
    hours: "11:00〜23:00",
  },
  {
    slug: "sosei-delicatessen",
    name: "創成川デリカテッセン",
    area: "odori",
    category: "deli",
    plan: "free",
    description: "ローストチキンとサラダのデリカテッセン。",
    address: "札幌市中央区南2条東（架空）",
    hours: "11:00〜20:00",
  },
  {
    slug: "yukiakari-sweets",
    name: "菓子工房 ゆきあかり",
    area: "odori",
    category: "sweets",
    plan: "free",
    description: "シュークリームとチーズケーキの専門店。",
    address: "札幌市中央区大通東（架空）",
    hours: "10:00〜19:00",
  },
  {
    slug: "kitanomori-buffet",
    name: "ホテル北の森 ブッフェ",
    area: "susukino",
    category: "hotel",
    plan: "free",
    description: "道産食材のディナーブッフェ。",
    address: "札幌市中央区南6条西（架空）",
    hours: "ディナー 17:30〜21:30",
  },
  {
    slug: "kotori-bagel",
    name: "ベーグルと珈琲 ことり",
    area: "other",
    category: "bread",
    plan: "free",
    description: "もちもちのベーグルと自家焙煎珈琲。",
    address: "札幌市中央区（架空）",
    hours: "8:00〜18:00",
  },
  {
    slug: "ekimae-irodori",
    name: "駅前キッチン いろどり",
    area: "sapporo-station",
    category: "deli",
    plan: "free",
    description: "旬の野菜を使った和惣菜のお店。",
    address: "札幌市北区北8条西（架空）",
    hours: "10:00〜20:30",
  },
  {
    slug: "yoru-shokudo",
    name: "すすきの夜食堂",
    area: "susukino",
    category: "bento",
    plan: "free",
    description: "夜遅くまで営業している定食とお弁当の店。",
    address: "札幌市中央区南7条西（架空）",
    hours: "17:00〜翌2:00",
    suspicious: true,
  },
  {
    slug: "harunire-bakery",
    name: "パン工房 はるにれ",
    area: "other",
    category: "bread",
    plan: "free",
    status: "pending",
    description: "審査中の店舗（デモ）。",
    address: "札幌市（架空）",
    hours: "9:00〜18:00",
  },
];

type SeedProduct = {
  store: string;
  name: string;
  isBox: boolean;
  original: number;
  price: number;
  quantity: number;
  description: string;
  /** 受取開始（現在時刻からの分） */
  startIn: number;
  /** 受取時間の長さ（分） */
  duration: number;
  soldOut?: boolean;
};

const TODAY_PRODUCTS: SeedProduct[] = [
  {
    store: "odori-bakery",
    name: "本日の食べつなぎBOX",
    isBox: true,
    original: 1500,
    price: 800,
    quantity: 5,
    description: "本日限定の食べつなぎBOX。\n今日店頭に並んだパンを詰め合わせました。\n中身は当日のお楽しみです。",
    startIn: -30,
    duration: 150,
  },
  {
    store: "odori-bakery",
    name: "北海道小麦のバゲット",
    isBox: false,
    original: 420,
    price: 250,
    quantity: 3,
    description: "今日焼き上げたバゲット。翌朝は軽くトーストするのがおすすめです。",
    startIn: -30,
    duration: 150,
  },
  {
    store: "susukino-deli",
    name: "お惣菜おまかせBOX",
    isBox: true,
    original: 1800,
    price: 900,
    quantity: 4,
    description: "本日のお惣菜を、彩りよく詰め合わせました。晩ごはんのもう一品にどうぞ。",
    startIn: 0,
    duration: 180,
  },
  {
    store: "susukino-deli",
    name: "鶏ザンギ 300g",
    isBox: false,
    original: 650,
    price: 400,
    quantity: 6,
    description: "揚げたてを詰めたザンギ。温め直しても衣がさっくりです。",
    startIn: 30,
    duration: 150,
  },
  {
    store: "sapporo-sweets-lab",
    name: "ケーキの食べつなぎBOX",
    isBox: true,
    original: 2400,
    price: 1200,
    quantity: 3,
    description: "今日仕上げたケーキを3〜4個詰め合わせました。中身は当日のお楽しみです。",
    startIn: -60,
    duration: 180,
  },
  {
    store: "sapporo-sweets-lab",
    name: "焼き菓子アソート",
    isBox: false,
    original: 1200,
    price: 700,
    quantity: 5,
    description: "フィナンシェやクッキーなど6個入り。日持ちするのでおみやげにも。",
    startIn: -60,
    duration: 240,
  },
  {
    store: "kita-obento",
    name: "日替わり弁当",
    isBox: false,
    original: 750,
    price: 450,
    quantity: 8,
    description: "今日の日替わりは鶏の照り焼き。炊きたてのごはんと一緒にどうぞ。",
    startIn: -15,
    duration: 120,
  },
  {
    store: "kita-obento",
    name: "鮭のり弁",
    isBox: false,
    original: 680,
    price: 420,
    quantity: 4,
    description: "道産の鮭をのせた、昔ながらののり弁です。",
    startIn: 15,
    duration: 120,
  },
  {
    store: "komugi-to-yuge",
    name: "パンの食べつなぎBOX",
    isBox: true,
    original: 1300,
    price: 700,
    quantity: 6,
    description: "夕方焼きのパンを中心に5〜6個。中身は当日のお楽しみです。",
    startIn: 60,
    duration: 120,
  },
  {
    store: "hotel-norte-dining",
    name: "ホテルブッフェの食べつなぎBOX",
    isBox: true,
    original: 3000,
    price: 1500,
    quantity: 4,
    description: "ホテルの厨房で今日仕込んだ料理を、ご家庭用に詰め合わせました。",
    startIn: 90,
    duration: 120,
  },
  {
    store: "hotel-norte-dining",
    name: "ホテルメイドのサンドイッチ",
    isBox: false,
    original: 900,
    price: 500,
    quantity: 5,
    description: "ラウンジで提供しているサンドイッチ。明日の朝ごはんにも。",
    startIn: -30,
    duration: 180,
  },
  {
    store: "omusubi-tomarigi",
    name: "おむすび3個セット",
    isBox: false,
    original: 600,
    price: 380,
    quantity: 6,
    description: "鮭・昆布・梅のおむすびを3個。",
    startIn: 0,
    duration: 240,
  },
  {
    store: "sosei-delicatessen",
    name: "デリの食べつなぎBOX",
    isBox: true,
    original: 1600,
    price: 850,
    quantity: 3,
    description: "ローストチキンとサラダを中心に詰め合わせました。",
    startIn: -30,
    duration: 150,
    soldOut: true,
  },
  {
    store: "yukiakari-sweets",
    name: "本日のシュークリーム 2個",
    isBox: false,
    original: 560,
    price: 350,
    quantity: 4,
    description: "今日仕上げたシュークリーム。カスタードがたっぷりです。",
    startIn: -45,
    duration: 165,
  },
  {
    store: "kitanomori-buffet",
    name: "ディナーブッフェのお持ち帰りBOX",
    isBox: true,
    original: 2800,
    price: 1400,
    quantity: 5,
    description: "ディナーブッフェの料理を、シェフがお持ち帰り用に詰め合わせます。",
    startIn: 120,
    duration: 90,
  },
  {
    store: "kotori-bagel",
    name: "ベーグル4個BOX",
    isBox: true,
    original: 1400,
    price: 750,
    quantity: 4,
    description: "プレーンと季節のベーグルを4個。冷凍保存もできます。",
    startIn: -90,
    duration: 180,
  },
  {
    store: "ekimae-irodori",
    name: "お惣菜3品BOX",
    isBox: true,
    original: 1500,
    price: 800,
    quantity: 5,
    description: "旬の野菜の和惣菜を3品。",
    startIn: 0,
    duration: 150,
  },
  {
    store: "yoru-shokudo",
    name: "夜食弁当",
    isBox: false,
    original: 800,
    price: 480,
    quantity: 10,
    description: "生姜焼きと卵焼きの入ったお弁当。",
    startIn: 60,
    duration: 240,
  },
];

/** 再現性のある乱数 */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uuidFrom(rand: () => number) {
  const hex = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16)).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function codeFrom(rand: () => number) {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]).join("");
}

async function insertMany(q: Queryable, table: string, columns: string[], rows: unknown[][]) {
  const chunk = Math.max(1, Math.floor(5000 / columns.length));
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params: unknown[] = [];
    const values = part.map((row) => `(${row.map((v) => (params.push(v), `$${params.length}`)).join(", ")})`);
    await q.query(`insert into ${table} (${columns.join(", ")}) values ${values.join(", ")}`, params);
  }
}

const minutes = (n: number) => n * 60_000;

function roundTo15(d: Date) {
  return new Date(Math.floor(d.getTime() / minutes(15)) * minutes(15));
}

export async function seedIfEmpty(q: Queryable, now = new Date()) {
  const [{ count }] = await q.query<{ count: number }>("select count(*)::int as count from public.stores");
  if (count === 0) {
    await seedDemo(q, now);
    return "seeded" as const;
  }
  // ローカルのデモ DB は、日付が変わって出品がなくなっていたら今日の出品を作り直す
  const [{ demo_only, live }] = await q.query<{ demo_only: boolean; live: number }>(
    `select bool_and(is_demo) as demo_only,
            (select count(*)::int from public.products where pickup_end_at > now() and deleted_at is null) as live
     from public.stores`,
  );
  if (demo_only && live === 0) {
    await refreshDemoListings(q, now);
    return "refreshed" as const;
  }
  return "skipped" as const;
}

/** 今日の出品をデモ用に作り直す（デモ店舗のみ） */
export async function refreshDemoListings(q: Queryable, now = new Date()) {
  await q.query(
    `update public.products p set status = 'closed', closed_at = now()
     from public.stores s
     where s.id = p.store_id and s.is_demo and p.status in ('published', 'sold_out', 'draft')`,
  );
  const stores = await q.query<{ id: string; slug: string; category: string }>(
    "select id, slug, category::text from public.stores where is_demo",
  );
  const bySlug = new Map(stores.map((s) => [s.slug, s]));
  const base = roundTo15(now);
  const rows: unknown[][] = [];
  for (const p of TODAY_PRODUCTS) {
    const store = bySlug.get(p.store);
    if (!store) continue;
    const start = new Date(base.getTime() + minutes(p.startIn));
    const end = new Date(start.getTime() + minutes(p.duration));
    rows.push([
      store.id,
      p.name,
      p.description,
      demoImage(store.category),
      store.category,
      p.isBox,
      p.original,
      p.price,
      p.quantity,
      estimatedWeightG(store.category, p.isBox),
      start.toISOString(),
      end.toISOString(),
      "published",
      new Date(now.getTime() - minutes(120)).toISOString(),
    ]);
  }
  await insertMany(
    q,
    "public.products",
    [
      "store_id",
      "name",
      "description",
      "image_url",
      "category",
      "is_box",
      "original_price",
      "rescue_price",
      "quantity",
      "estimated_weight_g",
      "pickup_start_at",
      "pickup_end_at",
      "status",
      "published_at",
    ],
    rows,
  );
  await seedDemoOrders(q, now);

  // 完売デモ（すべてつながった状態）
  const soldOut = TODAY_PRODUCTS.filter((p) => p.soldOut).map((p) => p.store);
  if (soldOut.length > 0) {
    await q.query(
      `update public.products p set remaining_quantity = 0, status = 'sold_out', sold_out_at = now() - interval '40 minutes'
       from public.stores s
       where s.id = p.store_id and s.slug = any($1::text[]) and p.status = 'published' and p.pickup_end_at > now()`,
      [soldOut],
    );
  }
}

export async function seedDemo(q: Queryable, now = new Date()) {
  const rand = prng(20261017);

  // ---- ユーザー ----
  const demoUsers = Object.values(DEMO_USERS);
  await insertMany(
    q,
    "public.users",
    ["id", "display_name", "is_demo", "created_at"],
    demoUsers.map((u) => [u.id, u.name, true, new Date(now.getTime() - 50 * 86_400_000).toISOString()]),
  );
  const familyNames = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田"];
  const crowd: string[] = [];
  const crowdRows: unknown[][] = [];
  for (let i = 0; i < 80; i++) {
    const id = uuidFrom(rand);
    crowd.push(id);
    const created = new Date(now.getTime() - Math.floor(rand() * 60) * 86_400_000);
    const lastSeen = rand() < 0.7 ? new Date(now.getTime() - Math.floor(rand() * 25) * 86_400_000) : null;
    crowdRows.push([
      id,
      `${familyNames[i % familyNames.length]}（デモ${i + 1}）`,
      true,
      created.toISOString(),
      lastSeen?.toISOString() ?? null,
    ]);
  }
  await insertMany(q, "public.users", ["id", "display_name", "is_demo", "created_at", "last_seen_at"], crowdRows);
  await q.query("update public.users set last_seen_at = now() where id = any($1::uuid[])", [demoUsers.map((u) => u.id)]);
  await q.query("insert into public.admin_users (user_id) values ($1)", [DEMO_USERS.admin.id]);

  // ---- 店舗 ----
  const storeIds = new Map<string, string>();
  for (const s of STORES) {
    const id = uuidFrom(rand);
    storeIds.set(s.slug, id);
    await q.query(
      `insert into public.stores (id, slug, name, category, area_id, address, description, opening_hours,
         pickup_note, status, plan_code, is_demo, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, now() - interval '45 days')`,
      [
        id,
        s.slug,
        s.name,
        s.category,
        s.area,
        s.address,
        s.description,
        s.hours,
        "レジで「TABETUNAGUの予約です」とお伝えください。店頭のQRを読み取ってからお会計になります。",
        s.status ?? "active",
        s.plan,
      ],
    );
  }
  await q.query(
    `insert into public.store_members (store_id, user_id, role) values ($1, $2, 'owner'), ($3, $4, 'staff')`,
    [storeIds.get("odori-bakery"), DEMO_USERS.storeOwner.id, storeIds.get("susukino-deli"), DEMO_USERS.storeStaff.id],
  );

  // v2 の購入導線の確認用に、1店舗（札幌スイーツラボ）だけ「売上受取設定済み」にする。
  // Stripe の鍵が設定されている環境では行わない（実際の Stripe の登録手順で確認するため）。
  if (!process.env.STRIPE_SECRET_KEY) {
    await q.query(
      `update public.stores set stripe_account_id = 'acct_demoSweetsLab', stripe_charges_enabled = true,
         stripe_payouts_enabled = true, stripe_details_submitted = true, stripe_onboarding_completed_at = now()
       where id = $1`,
      [storeIds.get("sapporo-sweets-lab")],
    );
  }

  // ---- テンプレート（いつものBOX） ----
  await q.query(
    `insert into public.product_templates (store_id, name, description, category, is_box, original_price, rescue_price,
       quantity, pickup_start_time, pickup_end_time, auto_relist, auto_relist_weekdays)
     values
       ($1, '本日の食べつなぎBOX', '本日限定の食べつなぎBOX。
今日店頭に並んだパンを詰め合わせました。
中身は当日のお楽しみです。', 'bread', true, 1500, 800, 5, '18:00', '20:00', true, '{1,2,3,4,5,6}'),
       ($1, '食パン1斤', '北海道産小麦の食パン。翌朝のトーストに。', 'bread', false, 480, 300, 3, '18:00', '20:00', false, '{}'),
       ($2, 'お惣菜おまかせBOX', '本日のお惣菜を、彩りよく詰め合わせました。', 'deli', true, 1800, 900, 4, '19:00', '21:30', false, '{}')`,
    [storeIds.get("odori-bakery"), storeIds.get("susukino-deli")],
  );

  // ---- 過去40日分の販売履歴（ダッシュボード・分析・将来のAI用） ----
  await q.query("alter table public.reservations disable trigger reservations_sales_history");
  await q.query("alter table public.products disable trigger products_sales_history");

  const planRate: Record<string, number> = { free: PLANS.free.commissionBps / 10000, standard: PLANS.standard.commissionBps / 10000 };
  const productRows: unknown[][] = [];
  const reservationRows: unknown[][] = [];
  const todayJst = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(now)}T00:00:00+09:00`);
  const regulars = [DEMO_USERS.user.id, ...crowd];

  for (const s of STORES) {
    if (s.status === "pending") continue;
    const storeId = storeIds.get(s.slug)!;
    const templates = TODAY_PRODUCTS.filter((p) => p.store === s.slug);
    for (let day = 40; day >= 1; day--) {
      for (const t of templates) {
        if (rand() < 0.25) continue; // 毎日は出品しない
        const productId = uuidFrom(rand);
        const startHour = 17 + Math.floor(rand() * 3);
        const start = new Date(todayJst.getTime() - day * 86_400_000 + startHour * 3_600_000);
        const end = new Date(start.getTime() + minutes(120 + Math.floor(rand() * 4) * 30));
        const listedAt = new Date(start.getTime() - minutes(60 + Math.floor(rand() * 120)));
        const demand = s.suspicious ? 0.9 : 0.55 + rand() * 0.45;
        let reserved = 0;
        let soldOutAt: Date | null = null;
        const n = Math.min(t.quantity, Math.round(t.quantity * demand));
        for (let k = 0; k < n; k++) {
          const user = regulars[Math.floor(rand() * regulars.length)];
          const createdAt = new Date(listedAt.getTime() + minutes(5 + Math.floor(rand() * 100)));
          const roll = rand();
          let status: string;
          if (s.suspicious) status = roll < 0.25 ? "completed" : roll < 0.9 ? "no_show" : "cancelled";
          else status = roll < 0.84 ? "completed" : roll < 0.9 ? "no_show" : "cancelled";
          const completedAt = status === "completed" ? new Date(start.getTime() + minutes(Math.floor(rand() * 110))) : null;
          const cancelledAt = status === "cancelled" ? new Date(createdAt.getTime() + minutes(20)) : null;
          const noShowAt = status === "no_show" ? new Date(end.getTime() + minutes(40)) : null;
          if (status !== "cancelled") reserved += 1;
          if (reserved === t.quantity && !soldOutAt) soldOutAt = createdAt;
          reservationRows.push([
            uuidFrom(rand),
            codeFrom(rand),
            user,
            productId,
            storeId,
            1,
            t.price,
            t.price,
            status,
            start.toISOString(),
            end.toISOString(),
            createdAt.toISOString(),
            createdAt.toISOString(),
            completedAt?.toISOString() ?? null,
            cancelledAt?.toISOString() ?? null,
            cancelledAt ? "user" : null,
            noShowAt?.toISOString() ?? null,
            status === "completed" ? s.plan : null,
            status === "completed" ? planRate[s.plan] : null,
          ]);
        }
        productRows.push([
          productId,
          storeId,
          t.name,
          t.description,
          demoImage(s.category),
          s.category,
          t.isBox,
          t.original,
          t.price,
          t.quantity,
          t.quantity - reserved,
          estimatedWeightG(s.category, t.isBox),
          start.toISOString(),
          end.toISOString(),
          "closed",
          listedAt.toISOString(),
          soldOutAt?.toISOString() ?? null,
          end.toISOString(),
          listedAt.toISOString(),
        ]);
      }
    }
  }

  await insertMany(
    q,
    "public.products",
    [
      "id",
      "store_id",
      "name",
      "description",
      "image_url",
      "category",
      "is_box",
      "original_price",
      "rescue_price",
      "quantity",
      "remaining_quantity",
      "estimated_weight_g",
      "pickup_start_at",
      "pickup_end_at",
      "status",
      "published_at",
      "sold_out_at",
      "closed_at",
      "created_at",
    ],
    productRows,
  );
  await insertMany(
    q,
    "public.reservations",
    [
      "id",
      "code",
      "user_id",
      "product_id",
      "store_id",
      "quantity",
      "unit_price",
      "total_price",
      "status",
      "pickup_start_at",
      "pickup_end_at",
      "created_at",
      "confirmed_at",
      "completed_at",
      "cancelled_at",
      "cancelled_by",
      "no_show_at",
      "plan_code",
      "commission_rate",
    ],
    reservationRows,
  );
  // products_before_insert トリガーが remaining_quantity を数量で上書きするため、予約数から戻す
  await q.query(
    `update public.products p set remaining_quantity = p.quantity - coalesce((
       select count(*) from public.reservations r where r.product_id = p.id and r.status <> 'cancelled'), 0)
     where p.status = 'closed'`,
  );

  await q.query("alter table public.reservations enable trigger reservations_sales_history");
  await q.query("alter table public.products enable trigger products_sales_history");
  await q.query("select public.refresh_product_sales(id) from public.products");

  // ---- 派生データ（チェックイン・ポイント・イベント・ユーザー集計） ----
  await q.query(
    `insert into public.checkins (user_id, store_id, reservation_id, result, qr_version, created_at)
     select user_id, store_id, id, 'success', 1, completed_at from public.reservations where status = 'completed'`,
  );
  await q.query(
    `insert into public.points_transactions (user_id, reservation_id, amount, reason, created_at)
     select user_id, id, 10, 'checkin', completed_at from public.reservations where status = 'completed'`,
  );
  await q.query(
    `insert into public.events (name, user_id, store_id, product_id, reservation_id, created_at)
     select 'reservation_created', user_id, store_id, product_id, id, created_at from public.reservations
     union all
     select 'reservation_completed', user_id, store_id, product_id, id, completed_at from public.reservations where status = 'completed'
     union all
     select 'no_show', user_id, store_id, product_id, id, no_show_at from public.reservations where status = 'no_show'
     union all
     select 'reservation_cancelled', user_id, store_id, product_id, id, cancelled_at from public.reservations where status = 'cancelled'`,
  );
  await q.query(
    `insert into public.user_stats (user_id, reservation_count, completed_count, cancelled_count, no_show_count, points_balance)
     select u.id,
       count(r.id)::int,
       count(r.id) filter (where r.status = 'completed')::int,
       count(r.id) filter (where r.status = 'cancelled')::int,
       count(r.id) filter (where r.status = 'no_show')::int,
       (count(r.id) filter (where r.status = 'completed') * 10)::int
     from public.users u left join public.reservations r on r.user_id = u.id
     group by u.id`,
  );
  await q.query("select public.recalc_trust_score(user_id) from public.user_stats");
  await q.query(
    `insert into public.favorites (user_id, store_id) values ($1, $2), ($1, $3)`,
    [DEMO_USERS.user.id, storeIds.get("odori-bakery"), storeIds.get("sapporo-sweets-lab")],
  );

  // ---- 今日の出品 ----
  await refreshDemoListings(q, now);
}

/**
 * v2（事前決済）のデモ注文。決済済み（paid）の状態を Stripe を使わずに作る（ローカル・E2E 用）。
 * - 受取時間中の注文（受取チケット・スワイプの確認用）
 * - 受取時間を過ぎた注文（画面を開くと未受取になる）
 * - 返金済みの注文（受取チケットとして操作できない表示の確認用。ポイントは付与 → 取り消し）
 * 商品は一覧に出さない（closed）。
 */
async function seedDemoOrders(q: Queryable, now: Date) {
  const [store] = await q.query<{ id: string; plan_code: "free" | "standard"; commission_bps: number }>(
    `select s.id, s.plan_code, p.commission_bps from public.stores s join public.plans p on p.code = s.plan_code
     where s.slug = 'odori-bakery' and s.is_demo`,
  );
  if (!store) return;
  const specs = [
    { name: "受取チケットのデモBOX", startIn: -10, endIn: 50 },
    { name: "受取時間を過ぎたデモBOX", startIn: -120, endIn: -30 },
    { name: "返金済みのデモBOX", startIn: 60, endIn: 120, refunded: true },
  ];
  for (const spec of specs) {
    const price = 800;
    const start = new Date(now.getTime() + minutes(spec.startIn));
    const end = new Date(now.getTime() + minutes(spec.endIn));
    const [product] = await q.query<{ id: string }>(
      `insert into public.products (store_id, name, description, image_url, category, is_box, original_price, rescue_price,
         quantity, pickup_start_at, pickup_end_at, status)
       values ($1, $2, '事前決済のデモ注文用の商品です。', $6, 'bread', true, 1500, $3, 1, $4, $5, 'closed') returning id`,
      [store.id, spec.name, price, start.toISOString(), end.toISOString(), demoImage("bread")],
    );
    const commission = Math.floor((price * store.commission_bps) / 10000);
    const [order] = await q.query<{ id: string }>(
      `insert into public.orders (order_number, user_id, store_id, status, subtotal, tsunagu_charge, total, commission_bps,
         commission_amount, platform_fee_total, plan_code, pickup_start, pickup_end, payment_expires_at)
       values (public.gen_reservation_code(), $1, $2, 'pending_payment', $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
       returning id`,
      [
        DEMO_USERS.user.id,
        store.id,
        price,
        PRICING.tsunaguCharge,
        price + PRICING.tsunaguCharge,
        store.commission_bps,
        commission,
        commission + PRICING.tsunaguCharge,
        store.plan_code,
        start.toISOString(),
        end.toISOString(),
      ],
    );
    await q.query(
      `insert into public.order_items (order_id, product_id, product_name_snapshot, unit_price, quantity, line_total)
       values ($1, $2, $3, $4, 1, $4)`,
      [order.id, product.id, spec.name, price],
    );
    await q.query(
      `insert into public.payments (order_id, provider, provider_payment_id, amount, application_fee_amount, status, paid_at)
       select id, 'stripe', 'pi_demo_' || replace(id::text, '-', ''), total, platform_fee_total, 'succeeded', now()
       from public.orders where id = $1`,
      [order.id],
    );
    await q.query("update public.orders set status = 'paid' where id = $1", [order.id]);
    await q.query("select public.grant_order_points($1::uuid)", [order.id]);
    if ("refunded" in spec && spec.refunded) {
      await q.query("update public.payments set status = 'refunded' where order_id = $1", [order.id]);
      await q.query("update public.orders set status = 'refunded' where id = $1", [order.id]);
      await q.query("select public.revoke_order_points($1::uuid)", [order.id]);
    }
  }
}

