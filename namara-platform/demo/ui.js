(function () {
  const N = window.NAMARA;
  const D = N.dict;
  const now = new Date();
  const $app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (n) => Number(n).toLocaleString("ja-JP");
  const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
  const iso = (d) => d.toISOString().slice(0, 10);
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  /* ---------------- データ準備（アプリの db.ts と同じ手順） ---------------- */
  const stores = N.SAMPLE_STORES.map((s) => JSON.parse(JSON.stringify(s)));
  const storeById = new Map(stores.map((s) => [s.id, s]));
  const syn = N.generateSyntheticSearches(stores, now);
  const logs = syn.logs;
  const events = syn.events.map((e) => ({ ...e, sponsored: false }));
  const start = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const end = iso(new Date(now.getTime() + 60 * 864e5));
  const mk = (sid, status, name) => {
    const s = storeById.get(sid);
    return { id: "camp-" + sid, storeId: sid, organizationId: s.organizationId, name, targeting: { areaIds: [s.areaId], genreIds: [...s.genreIds] }, startDate: start, endDate: end, status, budgetYen: 9800, cpcYen: 40, reviewNote: status === "approved" ? "審査OK（デモ）" : null };
  };
  const campaigns = [mk("store-001", "approved", "秋の検索スポンサー（デモ）"), mk("store-002", "pending_review", "忘年会シーズン（デモ）"), mk("store-003", "approved", "週末ランチ訴求（デモ）")];
  const impressions = [], clicks = [];
  const spent = new Map();
  let seed = 99; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const log of logs) {
    const pick = N.selectSponsored({ campaigns, stores, conditions: log.conditions, organicStoreIds: log.shownStoreIds, spentByCampaign: spent, now: new Date(log.createdAt) });
    if (!pick) continue;
    impressions.push({ campaignId: pick.campaign.id, createdAt: log.createdAt });
    if (rnd() < 0.06) { clicks.push({ campaignId: pick.campaign.id, valid: true }); spent.set(pick.campaign.id, (spent.get(pick.campaign.id) || 0) + 40); }
  }
  const reviews = N.generateSyntheticReviews(["store-001", "store-002", "store-003"], now);
  const audit = [];
  const liveLog = [];

  /* ---------------- 共通部品 ---------------- */
  const kpi = (l, v, unit, sub) => `<div class="kpi"><div class="l">${esc(l)}</div><div class="v">${v}${unit ? `<small>${unit}</small>` : ""}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div>`;
  const delta = (d) => (d === null ? "<span>—</span>" : `<span class="${d > 0 ? "up" : d < 0 ? "down" : ""}">${d > 0 ? "▲" : d < 0 ? "▼" : "±"}${Math.abs(d)}%</span>`);
  function bars(items, unit = "回") {
    if (!items.length) return `<div class="empty">データがありません</div>`;
    const max = Math.max(1, ...items.map((i) => i.value || 0));
    return `<ul class="bars">${items.map((i) => `<li title="${esc(i.hint || "")}"><span>${esc(i.label)}</span><span class="track">${i.value === null ? '<span class="hatch"></span>' : `<span class="fill" style="width:${Math.max(2, (i.value / max) * 100)}%"></span>`}</span><span class="num">${i.value === null ? '<span class="meta">少数のため非表示</span>' : fmt(i.value) + unit}${i.delta != null ? ` <small class="${i.delta > 0 ? "up" : i.delta < 0 ? "down" : "meta"}">${i.delta > 0 ? "+" : ""}${i.delta}%</small>` : ""}</span></li>`).join("")}</ul>`;
  }
  function lineChart(series, id) {
    const W = 640, H = 180, p = { t: 12, r: 12, b: 24, l: 36 };
    const max = Math.max(5, Math.ceil(Math.max(...series.map((s) => s.value)) / 5) * 5);
    const x = (i) => p.l + (i / (series.length - 1)) * (W - p.l - p.r);
    const y = (v) => p.t + (1 - v / max) * (H - p.t - p.b);
    const path = series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.value).toFixed(1)}`).join("");
    const grid = [0, 0.5, 1].map((t) => `<line x1="${p.l}" x2="${W - p.r}" y1="${y(max * t)}" y2="${y(max * t)}" stroke="#e2e8f0"/><text x="${p.l - 6}" y="${y(max * t) + 4}" text-anchor="end">${fmt(Math.round(max * t))}</text>`).join("");
    const labels = series.map((s, i) => (i % 7 === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${s.date.slice(5).replace("-", "/")}</text>` : "")).join("");
    setTimeout(() => {
      const svg = document.getElementById(id); if (!svg) return;
      const tip = svg.parentElement.querySelector(".tip"); const g = svg.querySelector(".hov");
      svg.addEventListener("mousemove", (e) => {
        const r = svg.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W;
        const i = Math.min(series.length - 1, Math.max(0, Math.round(((px - p.l) / (W - p.l - p.r)) * (series.length - 1))));
        g.innerHTML = `<line x1="${x(i)}" x2="${x(i)}" y1="${p.t}" y2="${H - p.b}" stroke="#94a3b8" stroke-dasharray="3 3"/><circle cx="${x(i)}" cy="${y(series[i].value)}" r="4" fill="#1e3a8a" stroke="#fff" stroke-width="2"/>`;
        tip.style.display = "block"; tip.textContent = `${series[i].date}：${fmt(series[i].value)}回`;
      });
      svg.addEventListener("mouseleave", () => { g.innerHTML = ""; tip.style.display = "none"; });
    });
    return `<div style="position:relative"><svg id="${id}" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="日別推移">${grid}${labels}<path d="${path}" fill="none" stroke="#1e3a8a" stroke-width="2" stroke-linejoin="round"/><g class="hov"></g></svg><div class="tip" style="display:none"></div></div>`;
  }
  const statusPill = (s) => ({ pending_review: '<span class="pill ad">審査待ち</span>', approved: '<span class="pill good">配信中（承認済み）</span>', rejected: '<span class="pill bad">否認</span>', stopped: '<span class="pill mute">配信停止</span>', budget_exhausted: '<span class="pill bad">予算上限で停止</span>' })[s] || s;

  /* ---------------- なまらAI ---------------- */
  const chat = [];
  let lastSearchId = null;
  const EXAMPLES = ["すすきの 焼肉 予算8000円", "札幌駅でランチ 1500円以内", "大通でデート向けのイタリアン、個室あり", "子連れで行ける海鮮のお店", "札幌 イタリアン", "旭川 フレンチ 個室 3000円以内"];
  function record(type, searchId, storeId, extra) {
    liveLog.unshift({ t: new Date().toLocaleTimeString("ja-JP"), type, searchId, storeId, extra });
    const el = document.getElementById("evlog"); if (el) el.innerHTML = renderLog();
  }
  function renderLog() {
    if (!liveLog.length) return '<div style="color:#64748b">まだイベントはありません。検索してみてください。</div>';
    return liveLog.slice(0, 80).map((l) => `<div><span class="t">${l.t}</span> ${esc(l.type)}${l.storeId ? " store=" + esc(l.storeId) : ""}${l.extra ? " " + esc(l.extra) : ""}</div>`).join("");
  }
  function describe(c) {
    const out = [];
    const yen = (n) => fmt(n) + "円";
    if (c.areaIds.length) out.push(["エリア", c.areaIds.map(D.areaLabel).join("・")]); else if (c.cities.length) out.push(["エリア", c.cities.join("・")]);
    if (c.genreIds.length) out.push(["ジャンル", c.genreIds.map(D.genreLabel).join("・")]);
    if (c.budget) { const b = c.budget; out.push(["予算", (b.min != null && b.max != null ? `${yen(b.min)}〜${yen(b.max)}` : b.max != null ? `${yen(b.max)}以内` : b.min != null ? `${yen(b.min)}以上` : `${yen(b.target)}前後`) + "（1人）"]); }
    if (c.mealTime) out.push(["時間帯", c.mealTime === "lunch" ? "ランチ" : "夜"]);
    const sc = c.scenes.filter((s) => s !== "lunch"); if (sc.length) out.push(["シーン", sc.map(D.sceneLabel).join("・")]);
    if (c.features.length) out.push(["希望", c.features.map(D.featureLabel).join("・")]);
    if (c.partySize) out.push(["人数", c.partySize + "人"]);
    if (c.dateText || c.timeText) out.push(["日時", [c.dateText, c.timeText].filter(Boolean).join(" ")]);
    if (c.keywords.length) out.push(["その他", c.keywords.join("・")]);
    return out;
  }
  function search(text) {
    const searchId = "s" + Date.now().toString(36);
    record("search_submitted", searchId);
    if (lastSearchId) record("search_refined", searchId);
    const parse = N.parseSearchText(text);
    record("search_parsed", searchId, null, "parser=rule");
    const c = parse.conditions;
    const { results, totalCandidates } = N.rankStores(stores, c, now);
    const suggestions = N.buildSuggestions(stores, c, results.length, now);
    const pick = N.selectSponsored({ campaigns, stores, conditions: c, organicStoreIds: results.map((r) => r.store.id), spentByCampaign: spent, now });
    results.forEach((r) => record("recommendation_shown", searchId, r.store.id, "pos=" + r.rank));
    if (pick) { impressions.push({ campaignId: pick.campaign.id, createdAt: now.toISOString() }); record("recommendation_shown", searchId, pick.store.id, "pos=0 sponsored（ad_impression）"); }
    if (!results.length) record("no_result", searchId);
    lastSearchId = searchId;
    return { searchId, parse, results, totalCandidates, suggestions, sponsored: pick && { campaign: pick.campaign, store: pick.store, matchReasons: pick.matchReasons, budgetText: N.formatBudget(pick.store, c.mealTime).text } };
  }
  function storeCard(r, sid) {
    const s = r.store; const reasons = r.reasons.filter((x) => x.points > 0);
    return `<div class="store"><div class="head"><div class="ph"><span>🍽</span><span>写真未登録</span></div><div><div class="meta">おすすめ ${r.rank}</div><h4>${esc(s.name)}</h4><div class="meta">${esc(D.areaLabel(s.areaId))}｜${esc(s.genreIds.map(D.genreLabel).join("・"))}</div></div></div>
    <dl class="dl"><dt>予算目安</dt><dd>${esc(r.budgetText)}<div class="meta">根拠：${esc(r.budgetBasis)}</div></dd><dt>営業時間</dt><dd>${esc(s.hours ?? "不明")}</dd><dt>予約</dt><dd>${s.reservationUrl ? "予約ページあり（空席は未確認）" : "不明"}</dd></dl>
    ${reasons.length ? `<div class="why"><b>条件に合う理由</b><br>${reasons.map((x) => `<span>${esc(x.label)}</span>`).join("")}</div>` : ""}
    ${r.warnings.length ? `<div class="warn">※ ${esc(r.warnings.join(" "))}</div>` : ""}
    <div class="acts"><button class="btn pri sm" data-act="detail" data-s="${sid}" data-store="${s.id}" data-pos="${r.rank}">詳細を見る</button><button class="btn sm" data-act="map" data-s="${sid}" data-store="${s.id}" data-pos="${r.rank}">📍 地図</button>${s.reservationUrl ? `<button class="btn sm" data-act="reservation" data-s="${sid}" data-store="${s.id}" data-pos="${r.rank}">📅 予約ページ</button>` : ""}<button class="btn sm" data-act="save" data-s="${sid}" data-store="${s.id}">🔖 保存</button></div></div>`;
  }
  function botAnswer(o) {
    const cond = describe(o.parse.conditions);
    return `${cond.length ? `<div class="cond"><b>読み取った条件：</b>${cond.map(([k, v]) => `${esc(k)} <strong>${esc(v)}</strong>`).join("　")}</div>` : ""}
    <div>${o.results.length ? `条件に合うお店を${o.results.length}件見つけました。${o.totalCandidates > o.results.length ? `（候補${o.totalCandidates}件から上位を表示）` : ""}` : "条件に合うお店が見つかりませんでした。"}</div>
    ${o.parse.notes.map((n) => `<div class="meta">${esc(n)}</div>`).join("")}
    ${o.results.map((r) => storeCard(r, o.searchId)).join("")}
    ${o.sponsored ? `<div class="sponsor"><span class="lab">広告（スポンサー）</span><div class="meta" style="color:#78350f;margin-top:4px">掲載料を受け取って表示している枠です。上のおすすめ順位には影響しません。</div><div class="head" style="display:flex;gap:10px;margin-top:6px"><div class="ph"><span>🍽</span><span>写真未登録</span></div><div><h4>${esc(o.sponsored.store.name)}</h4><div class="meta">${esc(D.areaLabel(o.sponsored.store.areaId))}｜${esc(o.sponsored.store.genreIds.map(D.genreLabel).join("・"))}</div><div style="font-size:12px">予算目安：${esc(o.sponsored.budgetText)}</div><div class="meta">表示理由：${esc(o.sponsored.matchReasons.join("／"))}</div></div></div><div class="acts"><button class="btn sm" style="border-color:#f59e0b;color:#b45309;font-weight:700" data-act="ad" data-camp="${o.sponsored.campaign.id}" data-store="${o.sponsored.store.id}">詳細を見る（広告）</button></div></div>` : ""}
    ${o.suggestions.length ? `<div class="cond"><b>条件を変えると見つかるかもしれません</b><br>${o.suggestions.map((s) => "・" + esc(s)).join("<br>")}</div>` : ""}`;
  }
  function renderChat() {
    return chat.map((m) => (m.me ? `<div class="bub me">${esc(m.text)}</div>` : `<div style="display:flex;flex-direction:column;gap:10px">${botAnswer(m.o)}</div>`)).join("");
  }
  function viewAI() {
    $app.innerHTML = `<div class="notice">デモ版：表示される店舗はすべて<strong>架空</strong>です（全${stores.length}店）。価格・営業時間は架空データで、空席状況は確認していません。外部サイトには移動しません。</div>
    <div class="ai-wrap">
      <div class="phone"><div class="phone-h"><div class="avatar">な</div><div><b>なまらAI</b><div class="meta" style="font-size:10px">by なまらグルメ ｜ Web版デモ（本番はLINE）</div></div></div>
        <div class="chat" id="chat"><div class="bub bot">なまらAIです🍜 エリア・食べたいもの・予算などを、話すように送ってください。<div class="chips">${EXAMPLES.map((e) => `<button class="chip" data-ex="${esc(e)}">${esc(e)}</button>`).join("")}</div></div>${renderChat()}</div>
        <div class="composer"><form id="f"><input id="q" maxlength="200" placeholder="例：すすきの 焼肉 予算8000円" aria-label="検索したい内容"><button class="btn pri">送信</button></form><p>検索内容はサービス改善と、個人を特定できない形での飲食店向け統計に利用します。</p></div>
      </div>
      <div class="grid">
        <div class="card"><h3>このデモで確認できること</h3><ul style="margin:6px 0 0;padding-left:18px;font-size:13px">
          <li>自然文から <b>エリア・ジャンル・予算・シーン・希望条件</b> を読み取る（AI不使用の辞書方式）</li>
          <li>条件を満たす店だけを <b>最大5件</b>。足りないときは無理に埋めず「〇〇を外すと N 件」と提案</li>
          <li>「<b>札幌 イタリアン</b>」で <b>広告（スポンサー）枠</b> が別枠で1件出る（通常順位は不変）</li>
          <li>価格・営業時間が不明な店は「不明」と表示</li>
          <li>運営タブで広告を承認・停止すると、ここの広告表示も変わる</li></ul></div>
        <div class="card"><h3>計測イベント（リアルタイム）</h3><p class="desc">検索・表示・クリック・保存の記録。店舗にはこの生ログではなく匿名集計だけを渡します。</p><div class="log" id="evlog">${renderLog()}</div></div>
      </div>
    </div>`;
    const box = document.getElementById("chat"); box.scrollTop = box.scrollHeight;
    const send = (t) => { t = t.trim(); if (!t) return; chat.push({ me: true, text: t }); chat.push({ o: search(t) }); viewAI(); };
    document.getElementById("f").onsubmit = (e) => { e.preventDefault(); send(document.getElementById("q").value); };
    $app.querySelectorAll("[data-ex]").forEach((b) => (b.onclick = () => send(b.dataset.ex)));
    $app.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => onAct(b)));
  }
  const clicked = new Set();
  function onAct(b) {
    const { act, s, store, pos } = b.dataset; const st = storeById.get(store);
    if (act === "save") { record("store_saved", s, store); b.textContent = "✓ 保存しました"; b.disabled = true; return; }
    if (act === "ad") {
      const camp = campaigns.find((c) => c.id === b.dataset.camp); const key = "ad:" + camp.id;
      if (clicked.has(key)) { record("ad_click", null, store, "無効（30分以内の重複）→ 課金なし"); }
      else { clicked.add(key); clicks.push({ campaignId: camp.id, valid: true }); spent.set(camp.id, (spent.get(camp.id) || 0) + camp.cpcYen); record("ad_click", null, store, `有効 → ad_billing_event ${camp.cpcYen}円`); }
      return showStore(st, true);
    }
    const type = { detail: "store_detail_clicked", map: "map_clicked", reservation: "reservation_link_clicked" }[act];
    const key = `${act}:${s}:${store}`;
    if (!clicked.has(key)) { clicked.add(key); record(type, s, store, "pos=" + pos); } else record(type, s, store, "重複のため記録しない");
    if (act === "detail") showStore(st, false);
    else toast(act === "map" ? "本番では Google マップ（エリアの概略位置）を開きます" : "本番では予約ページを開きます（デモ用リンク）");
  }
  function showStore(s, fromAd) {
    const lunch = N.formatBudget(s, "lunch"), dinner = N.formatBudget(s, "dinner");
    const m = document.createElement("div"); m.className = "modal";
    m.innerHTML = `<div class="card" role="dialog" aria-modal="true"><div class="row"><span class="pill ad">架空のサンプル店舗</span>${fromAd ? '<span class="pill ad">広告から表示</span>' : ""}</div><h3 style="margin-top:8px">${esc(s.name)}</h3><div class="meta">${esc(D.areaLabel(s.areaId))}｜${esc(s.genreIds.map(D.genreLabel).join("・"))}</div>
    <dl class="dl" style="grid-template-columns:96px 1fr;font-size:13px"><dt>予算（昼）</dt><dd>${s.budget.lunch ? esc(lunch.text) : "不明（ランチ営業の情報なし）"}</dd><dt>予算（夜）</dt><dd>${s.budget.dinner ? esc(dinner.text) : "不明"}</dd><dt>価格の根拠</dt><dd>${esc(s.budget.basis ?? "価格情報を確認できていません")}</dd><dt>営業時間</dt><dd>${esc(s.hours ?? "不明")}</dd><dt>住所</dt><dd>${esc(s.address)}</dd><dt>特徴</dt><dd>${s.features.length ? s.features.map((f) => `<span class="pill info">${esc(D.featureLabel(f))}</span>`).join(" ") : "不明"}</dd><dt>向いている場面</dt><dd>${esc(s.scenes.map(D.sceneLabel).join("・") || "不明")}</dd><dt>情報確認日</dt><dd>${esc(s.verification.verifiedAt ?? "未確認")}</dd></dl>
    <p class="meta">空席状況は確認していません。写真は利用許可と出典を確認できたものだけ掲載します。</p><button class="btn pri">閉じる</button></div>`;
    m.onclick = (e) => { if (e.target === m || e.target.tagName === "BUTTON") m.remove(); };
    document.body.appendChild(m);
  }

  /* ---------------- NAMARA REVIEW ---------------- */
  const ACCOUNTS = [
    { key: "o1", label: "店舗オーナー（架空フードサービス）", stores: ["store-001", "store-002"], owner: true },
    { key: "s1", label: "店舗スタッフ（閲覧のみ）", stores: ["store-001"], owner: false },
    { key: "o2", label: "店舗オーナー（架空ダイニング）", stores: ["store-003"], owner: true },
  ];
  let acct = ACCOUNTS[0], curStore = "store-001", rtab = "dash", scope = "area";
  const inP = (iso_, p) => { const t = new Date(iso_).getTime(); return t >= p.from.getTime() && t < p.to.getTime(); };
  function exposure(sid, p) {
    const x = { impressions: 0, detail: 0, map: 0, reservation: 0 };
    for (const e of events) { if (e.storeId !== sid || !inP(e.createdAt, p)) continue; if (e.type === "recommendation_shown") x.impressions++; else if (e.type === "store_detail_clicked") x.detail++; else if (e.type === "map_clicked") x.map++; else if (e.type === "reservation_link_clicked") x.reservation++; }
    return x;
  }
  function viewReview() {
    if (!acct.stores.includes(curStore)) curStore = acct.stores[0];
    const s = storeById.get(curStore);
    const head = `<div class="row" style="justify-content:space-between;margin-bottom:14px"><div class="row"><label class="f">デモアカウント<select id="acct">${ACCOUNTS.map((a) => `<option value="${a.key}" ${a === acct ? "selected" : ""}>${esc(a.label)}</option>`).join("")}</select></label>${acct.stores.length > 1 ? `<label class="f">店舗<select id="st">${acct.stores.map((id) => `<option value="${id}" ${id === curStore ? "selected" : ""}>${esc(storeById.get(id).name)}</option>`).join("")}</select></label>` : ""}</div>
    <div class="subtabs" role="tablist" style="margin:0">${[["dash", "ダッシュボード"], ["demand", "NAMARA DEMAND（検索需要）"], ["ads", "スポンサー広告"]].map(([k, l]) => `<button data-rt="${k}" aria-selected="${rtab === k}">${l}</button>`).join("")}</div></div>
    <div class="notice"><strong>デモ用合成データ：</strong>数値は架空店舗と自動生成した検索ログによるものです。実際の計測値ではありません。検索回数は<strong>来店数ではありません</strong>。</div>`;
    $app.innerHTML = head + (rtab === "dash" ? dash(s) : rtab === "demand" ? demand(s) : ads(s));
    document.getElementById("acct").onchange = (e) => { acct = ACCOUNTS.find((a) => a.key === e.target.value); viewReview(); };
    const st = document.getElementById("st"); if (st) st.onchange = (e) => { curStore = e.target.value; viewReview(); };
    $app.querySelectorAll("[data-rt]").forEach((b) => (b.onclick = () => { rtab = b.dataset.rt; viewReview(); }));
    $app.querySelectorAll("[data-scope]").forEach((b) => (b.onclick = () => { scope = b.dataset.scope; viewReview(); }));
    $app.querySelectorAll("[data-stop]").forEach((b) => (b.onclick = () => { const c = campaigns.find((x) => x.id === b.dataset.stop); c.status = "stopped"; audit.unshift(`${new Date().toLocaleTimeString("ja-JP")} campaign.stop_by_store ${c.id}`); viewReview(); }));
    const f = document.getElementById("cf");
    if (f) f.onsubmit = (e) => {
      e.preventDefault(); const name = f.name.value.trim(); const budget = Number(f.budget.value); const msg = document.getElementById("cfm");
      const genres = [...f.querySelectorAll("input[name=g]:checked")].map((i) => i.value);
      if (!name) { msg.innerHTML = '<span class="down">キャンペーン名を入力してください</span>'; return; }
      if (!genres.length) { msg.innerHTML = '<span class="down">対象ジャンルを1つ以上選んでください</span>'; return; }
      if (!(budget >= 9800)) { msg.innerHTML = '<span class="down">予算は9,800円以上で設定してください</span>'; return; }
      if (f.end.value < f.start.value) { msg.innerHTML = '<span class="down">終了日は開始日以降にしてください</span>'; return; }
      campaigns.push({ id: "camp-new-" + Date.now().toString(36), storeId: s.id, organizationId: s.organizationId, name, targeting: { areaIds: [s.areaId], genreIds: genres }, startDate: f.start.value, endDate: f.end.value, status: "pending_review", budgetYen: budget, cpcYen: 40, reviewNote: null });
      audit.unshift(`${new Date().toLocaleTimeString("ja-JP")} campaign.create ${name}`);
      rtab = "ads"; viewReview(); toast("審査を申請しました。「運営管理」タブで承認できます");
    };
  }
  function dash(s) {
    const { current, previous } = N.comparablePeriods(now);
    const rv = reviews.filter((r) => r.storeId === s.id);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
    const recent = rv.filter((r) => new Date(r.createdAt).getTime() >= now.getTime() - 30 * 864e5);
    const avg = rv.length ? (rv.reduce((a, r) => a + r.rating, 0) / rv.length).toFixed(1) : "—";
    const unreplied = rv.filter((r) => !r.reply).length;
    const exN = exposure(s.id, current), exP = exposure(s.id, previous);
    const areaNow = N.summarizeDemand(N.filterLogs(logs, current, [s.areaId])), areaPrev = N.summarizeDemand(N.filterLogs(logs, previous, [s.areaId]));
    const actions = N.buildActionSuggestions({ store: s, featureTrend: N.compareBreakdowns(areaNow.byFeature, areaPrev.byFeature), sceneTrend: N.compareBreakdowns(areaNow.byScene, areaPrev.byScene), unrepliedReviews: unreplied, lowRatingShare30d: recent.length >= 5 ? recent.filter((r) => r.rating <= 2).length / recent.length : null, detailRate: exN.impressions >= 20 ? Math.round((exN.detail / exN.impressions) * 1000) / 10 : null, areaDetailRate: null });
    const counts = new Map(); for (const e of events) if (e.storeId === s.id && e.type === "recommendation_shown") { const d = e.createdAt.slice(0, 10); counts.set(d, (counts.get(d) || 0) + 1); }
    const series = Array.from({ length: 30 }, (_, i) => { const d = iso(new Date(now.getTime() - (29 - i) * 864e5)); return { date: d, value: counts.get(d) || 0 }; });
    return `<h1 class="page">${esc(s.name)}</h1><p class="sub">今月（${iso(current.from)}〜本日）。前月比は前月の同じ日数との比較です。</p>
    <h2 class="sec">口コミ（Google口コミ連携はモック）</h2><div class="grid k5">${kpi("総口コミ数", fmt(rv.length), "件")}${kpi("平均評価", avg, "", "★ 5点満点")}${kpi("今月の新規口コミ", fmt(rv.filter((r) => new Date(r.createdAt).getTime() >= monthStart).length), "件")}${kpi("未返信", fmt(unreplied), "件")}${kpi("AI返信案（承認待ち）", fmt(rv.filter((r) => r.draft).length), "件", "投稿には人の承認が必要")}</div>
    <h2 class="sec">なまらAIでの表示・クリック</h2><div class="grid k4">${kpi("検索結果への表示回数", fmt(exN.impressions), "回", delta(pct(exN.impressions, exP.impressions)) + " 前月比")}${kpi("詳細の閲覧回数", fmt(exN.detail), "回", delta(pct(exN.detail, exP.detail)) + " 前月比")}${kpi("地図クリック", fmt(exN.map), "回", delta(pct(exN.map, exP.map)) + " 前月比")}${kpi("予約リンククリック", fmt(exN.reservation), "回", delta(pct(exN.reservation, exP.reservation)) + " 前月比")}</div>
    <div class="grid c3" style="margin-top:14px"><div class="card"><h3>検索結果への表示回数（直近30日）</h3><p class="desc">グラフにカーソルを合わせると日別の値が見られます</p>${lineChart(series, "lc1")}</div>
    <div class="card"><h3>${esc(D.areaLabel(s.areaId))}エリアの検索需要</h3><p class="desc">今月・ジャンル別（匿名集計・5単位で丸め）</p>${areaNow.sufficient ? bars(areaNow.byGenre.cells.slice(0, 6).map((c) => ({ label: c.label, value: c.searches }))) : '<div class="empty">分析に必要なデータが不足しています</div>'}</div></div>
    <div class="grid c3" style="margin-top:14px"><div class="card"><h3>AI店長の改善提案</h3><p class="desc">今週の改善アクション（モック：ルールベース。根拠の数値はすべて集計値）</p>${actions.map((a, i) => `<div class="action"><div><span class="n">${i + 1}</span><b>${esc(a.title)}</b> <span class="pill ${a.priority === "高" ? "bad" : a.priority === "中" ? "info" : "mute"}">優先度：${a.priority}</span></div><ul>${a.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul><div class="foot">担当（案）：${esc(a.owner)}｜期限（案）：${a.dueInDays}日以内｜状況：未着手</div></div>`).join("")}</div>
    <div class="card"><h3>最近の口コミ</h3><p class="desc">モックデータ（架空の投稿）</p>${rv.slice(0, 5).map((r) => `<div style="border-bottom:1px solid var(--line);padding:8px 0"><div class="row" style="justify-content:space-between"><span class="stars">${"★".repeat(r.rating)}<i>${"★".repeat(5 - r.rating)}</i></span><span class="meta">${r.createdAt.slice(0, 10)}</span></div><div>${esc(r.text)}</div><div style="margin-top:3px">${r.reply ? '<span class="pill good">返信済み</span>' : r.draft ? '<span class="pill info">AI返信案あり（未承認）</span>' : '<span class="pill bad">未返信</span>'}</div></div>`).join("")}</div></div>`;
  }
  function demand(s) {
    const { current, previous } = N.comparablePeriods(now);
    const area = scope === "area" ? [s.areaId] : undefined;
    const ln = N.filterLogs(logs, current, area), lp = N.filterLogs(logs, previous, area);
    const a = N.summarizeDemand(ln), b = N.summarizeDemand(lp);
    const cmp = (k) => N.compareBreakdowns(a[k], b[k]).map((r) => ({ label: r.label, value: r.current, delta: r.changePct, hint: r.previous != null ? `前月同期間：約${fmt(r.previous)}回` : "前月：少数または0件" }));
    const ex = exposure(s.id, current);
    const rising = [...N.compareBreakdowns(a.byFeature, b.byFeature), ...N.compareBreakdowns(a.byScene, b.byScene), ...N.compareBreakdowns(a.byGenre, b.byGenre)].filter((r) => r.changePct != null && r.changePct >= 20 && (r.current || 0) >= 10).sort((x, y) => y.changePct - x.changePct).slice(0, 3);
    const under = N.findUnderservedThemes(ln);
    const label = scope === "area" ? `${D.areaLabel(s.areaId)}エリア` : "全エリア";
    if (!a.sufficient) return `<div class="empty">分析に必要なデータが不足しています</div>`;
    return `<div class="row" style="justify-content:space-between"><div><h1 class="page">NAMARA DEMAND｜検索需要分析</h1><p class="sub">なまらAIで「${label}」のお店を探した人の条件を、個人を特定できない形で集計しています。</p></div><div class="subtabs">${[["area", "自店のエリア"], ["all", "全エリア"]].map(([k, l]) => `<button data-scope="${k}" aria-selected="${scope === k}">${l}</button>`).join("")}</div></div>
    <div class="notice info">利用者数が5人未満の区分は「少数のため非表示」とし、件数は5単位で丸めています。生の検索文や利用者IDは店舗に提供しません。</div>
    <div class="grid k4">${kpi(label + "の検索回数（今月）", "約" + fmt(a.totalSearches), "回")}${kpi("自店の表示回数", fmt(ex.impressions), "回")}${kpi("自店の詳細閲覧", fmt(ex.detail), "回")}${kpi("表示→詳細の割合", ex.impressions >= 20 ? (Math.round((ex.detail / ex.impressions) * 1000) / 10).toFixed(1) : "—", ex.impressions >= 20 ? "%" : "")}</div>
    <div class="grid c2" style="margin-top:14px"><div class="card"><h3>集客機会のAI分析</h3><p class="desc">モック：ルールベース。根拠は下の集計値</p>${rising.length ? rising.map((r) => `<div class="cond" style="margin-bottom:8px;background:var(--soft)"><b>「${esc(r.label)}」</b>を含む検索が前月同期間比 <b>+${r.changePct}%</b>（約${fmt(r.current)}回）。対応できる場合は店舗情報やSNS投稿でアピールする余地があります。</div>`).join("") : '<div class="empty">目立って伸びている条件はありません</div>'}</div>
    <div class="card"><h3>条件に合う店が少ない検索テーマ</h3><p class="desc">検索はあるのに、表示できる店舗が平均3件未満の組み合わせ</p>${under.length ? `<table>${under.map((u) => `<tr><td>${esc(u.label)}</td><td class="num meta">約${fmt(u.searches)}回／平均${u.avgResults}件</td></tr>`).join("")}</table>` : '<div class="empty">該当なし</div>'}</div></div>
    <div class="grid c2" style="margin-top:14px">${[["ジャンル別", "byGenre"], ["予算帯別（1人あたり）", "byBudget"], ["利用シーン別", "byScene"], ["人気の希望条件", "byFeature"]].concat(scope === "all" ? [["エリア別", "byArea"]] : []).map(([t, k]) => `<div class="card"><h3>${t}</h3><p class="desc">今月の検索回数と前月比（行にカーソルで前月値）</p>${bars(cmp(k))}</div>`).join("")}</div>`;
  }
  function campStats(c) {
    const imp = impressions.filter((i) => i.campaignId === c.id).length, cl = clicks.filter((x) => x.campaignId === c.id && x.valid).length, sp = spent.get(c.id) || 0;
    return { imp, cl, ctr: imp ? (Math.round((cl / imp) * 1000) / 10).toFixed(1) + "%" : "—", sp, rem: Math.max(0, c.budgetYen - sp) };
  }
  function ads(s) {
    const mine = campaigns.filter((c) => c.storeId === s.id);
    const t = iso(now), e30 = iso(new Date(now.getTime() + 30 * 864e5));
    return `<h1 class="page">スポンサー検索広告</h1><p class="sub">なまらAIの検索結果に「広告」と明示した枠（最大1件）で表示されます。通常のおすすめ順位は変わりません。</p>
    <div class="notice info">広告は、利用者の検索条件（エリア・ジャンル・予算・希望条件）に合うときだけ表示されます。請求・決済は行いません（モック）。</div>
    ${mine.length ? mine.map((c) => { const st = campStats(c); return `<div class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><div><h3>${esc(c.name)}</h3><p class="desc">${c.startDate}〜${c.endDate}｜対象：${esc(c.targeting.areaIds.map(D.areaLabel).join("・"))} × ${esc(c.targeting.genreIds.map(D.genreLabel).join("・"))}</p></div>${statusPill(c.status)}</div>
      <div class="grid k5">${kpi("表示回数", fmt(st.imp), "回")}${kpi("クリック数（有効）", fmt(st.cl), "回")}${kpi("クリック率", st.ctr)}${kpi("使用金額（モック）", fmt(st.sp), "円")}${kpi("予算残高", fmt(st.rem), "円")}</div>
      ${c.reviewNote ? `<p class="meta">審査メモ：${esc(c.reviewNote)}</p>` : ""}${acct.owner && ["approved", "pending_review"].includes(c.status) ? `<button class="btn sm" style="margin-top:8px" data-stop="${c.id}">配信を停止する</button>` : ""}</div>`; }).join("") : '<div class="empty">まだキャンペーンがありません</div>'}
    <div class="card" style="margin-top:14px"><h3>新しいキャンペーンを申請</h3><p class="desc">作成後は運営の審査を経て配信されます</p>
    ${acct.owner ? `<form id="cf" class="grid" style="gap:10px"><label class="f">キャンペーン名<input name="name" maxlength="60" placeholder="例：忘年会シーズンの個室プラン"></label>
      <div class="f" style="font-size:12px;color:var(--muted)">対象エリア：<b style="color:var(--ink)">${esc(D.areaLabel(s.areaId))}</b>（店舗の所在エリアのみ選べます）</div>
      <div class="row" style="font-size:13px">対象ジャンル：${s.genreIds.map((g) => `<label><input type="checkbox" name="g" value="${g}" checked> ${esc(D.genreLabel(g))}</label>`).join(" ")}</div>
      <div class="grid k4" style="grid-template-columns:repeat(3,minmax(0,1fr))"><label class="f">開始日<input type="date" name="start" value="${t}"></label><label class="f">終了日<input type="date" name="end" value="${e30}"></label><label class="f">予算（円）<input type="number" name="budget" min="9800" step="100" value="9800"></label></div>
      <p class="meta" style="margin:0">クリック課金（仮：1クリック40円）。予算に達すると自動停止します。</p><div class="row"><button class="btn pri">審査を申請する</button><span id="cfm"></span></div></form>` : '<p class="meta">スタッフ権限では広告を作成・変更できません。店舗オーナーにご依頼ください。</p>'}</div>`;
  }

  /* ---------------- 運営 ---------------- */
  let atab = "overview", storeFilter = "attention";
  function viewAdmin() {
    $app.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:14px"><span class="pill info">デモアカウント：なまらグルメ運営</span><div class="subtabs" style="margin:0">${[["overview", "概要・検索需要"], ["ads", "広告審査・配信"], ["stores", "店舗マスター"], ["plans", "料金プラン・連携状況"]].map(([k, l]) => `<button data-at="${k}" aria-selected="${atab === k}">${l}</button>`).join("")}</div></div>
    <div class="notice"><strong>デモ用合成データ：</strong>運営画面では少数セル抑制をかけない内部集計を表示します（店舗には提供しません）。</div>` + (atab === "overview" ? adminOverview() : atab === "ads" ? adminAds() : atab === "stores" ? adminStores() : adminPlans());
    $app.querySelectorAll("[data-at]").forEach((b) => (b.onclick = () => { atab = b.dataset.at; viewAdmin(); }));
    $app.querySelectorAll("[data-rv]").forEach((b) => (b.onclick = () => {
      const c = campaigns.find((x) => x.id === b.dataset.id); const d = b.dataset.rv;
      c.status = d === "approve" ? "approved" : d === "reject" ? "rejected" : "stopped"; c.reviewNote = d === "approve" ? "審査OK" : d === "reject" ? "条件不一致（デモ）" : "運営により停止";
      audit.unshift(`${new Date().toLocaleTimeString("ja-JP")} campaign.${d} ${c.id}`); viewAdmin(); toast(d === "approve" ? "承認しました。なまらAIで条件に合う検索に表示されます" : "更新しました");
    }));
    const sf = document.getElementById("sf"); if (sf) sf.onchange = (e) => { storeFilter = e.target.value; viewAdmin(); };
    $app.querySelectorAll("[data-pub]").forEach((b) => (b.onclick = () => { const st = storeById.get(b.dataset.pub); st.published = !st.published; audit.unshift(`${new Date().toLocaleTimeString("ja-JP")} store.${st.published ? "publish" : "unpublish"} ${st.id}`); viewAdmin(); }));
  }
  function adminOverview() {
    const { current } = N.comparablePeriods(now);
    const ln = N.filterLogs(logs, current);
    const zero = ln.filter((l) => l.resultCount === 0);
    const top = new Map(); const add = (k) => top.set(k, (top.get(k) || 0) + 1);
    ln.forEach((l) => { l.conditions.areaIds.forEach((a) => add("エリア：" + D.areaLabel(a))); l.conditions.genreIds.forEach((g) => add("ジャンル：" + D.genreLabel(g))); l.conditions.scenes.forEach((s) => add("シーン：" + D.sceneLabel(s))); l.conditions.features.forEach((f) => add("条件：" + D.featureLabel(f))); });
    const zc = new Map(); zero.forEach((l) => { const c = l.conditions; const k = [...c.areaIds.map(D.areaLabel), ...c.genreIds.map(D.genreLabel), ...c.features.map(D.featureLabel), c.budget ? "予算" + fmt(c.budget.max ?? c.budget.target ?? c.budget.min) + "円" : "", c.mealTime === "lunch" ? "ランチ" : ""].filter(Boolean).join(" × ") || "（条件なし）"; zc.set(k, (zc.get(k) || 0) + 1); });
    const daily = new Map(); logs.forEach((l) => { const d = l.createdAt.slice(0, 10); daily.set(d, (daily.get(d) || 0) + 1); });
    const series = Array.from({ length: 30 }, (_, i) => { const d = iso(new Date(now.getTime() - (29 - i) * 864e5)); return { date: d, value: daily.get(d) || 0 }; });
    const shown = events.filter((e) => e.type === "recommendation_shown" && inP(e.createdAt, current)).length;
    const sorted = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
    return `<h1 class="page">運営ダッシュボード</h1><p class="sub">今月（${iso(current.from)}〜本日）</p>
    <div class="grid k6">${kpi("利用者数（仮名ID）", fmt(new Set(ln.map((l) => l.sessionId)).size), "人")}${kpi("検索回数", fmt(ln.length), "回", `LINE ${fmt(ln.filter((l) => l.channel === "line").length)}／Web ${fmt(ln.filter((l) => l.channel === "web").length)}`)}${kpi("ゼロ件の割合", ln.length ? (Math.round((zero.length / ln.length) * 1000) / 10).toFixed(1) : "—", "%")}${kpi("おすすめ表示回数", fmt(shown), "回")}${kpi("広告表示／クリック", `${fmt(impressions.length)}／${fmt(clicks.length)}`)}${kpi("広告審査待ち", fmt(campaigns.filter((c) => c.status === "pending_review").length), "件")}</div>
    <div class="grid c3" style="margin-top:14px"><div class="card"><h3>検索回数（直近30日）</h3>${lineChart(series, "lc2")}</div><div class="card"><h3>エリア別の需要</h3><p class="desc">今月</p>${bars(N.summarizeDemand(ln).byArea.cells.map((c) => ({ label: c.label, value: c.searches })))}</div></div>
    <div class="grid c2" style="margin-top:14px"><div class="card"><h3>人気の検索条件</h3><p class="desc">辞書で正規化した条件（生の入力文ではありません）</p>${bars(sorted(top, 10))}</div><div class="card"><h3>検索結果ゼロ件の分析</h3><p class="desc">店舗開拓・掲載情報追加の優先度づけに使います</p>${bars(sorted(zc, 8))}</div></div>
    <div class="card" style="margin-top:14px"><h3>監査ログ（このページでの操作）</h3>${audit.length ? `<div class="log">${audit.map((a) => `<div>${esc(a)}</div>`).join("")}</div>` : '<p class="meta">まだ操作はありません。広告の承認や店舗の公開切替をすると記録されます。</p>'}</div>`;
  }
  function adminAds() {
    const pend = campaigns.filter((c) => c.status === "pending_review");
    return `<h1 class="page">広告審査・配信状況</h1><p class="sub">審査基準：店舗情報が検証済み、誇大・虚偽表現なし、口コミ投稿を条件とした特典なし。操作は監査ログに記録。</p>
    <h2 class="sec">審査待ち（${pend.length}件）</h2>${pend.length ? pend.map((c) => `<div class="card" style="margin-bottom:10px"><div class="row" style="justify-content:space-between"><div><h3>${esc(c.name)}</h3><p class="desc">${esc(storeById.get(c.storeId).name)}｜${c.startDate}〜${c.endDate}｜予算 ${fmt(c.budgetYen)}円｜対象 ${esc(c.targeting.areaIds.map(D.areaLabel).join("・"))} × ${esc(c.targeting.genreIds.map(D.genreLabel).join("・"))}</p></div><div class="row"><button class="btn pri sm" data-rv="approve" data-id="${c.id}">承認</button><button class="btn sm" data-rv="reject" data-id="${c.id}">否認</button></div></div></div>`).join("") : '<p class="meta">審査待ちはありません。</p>'}
    <h2 class="sec">全キャンペーン</h2><div class="card scroll" style="padding:0"><table style="min-width:760px"><tr><th>キャンペーン／店舗</th><th>対象</th><th>状態</th><th class="num">表示</th><th class="num">有効クリック</th><th class="num">請求見込み（モック）</th><th>操作</th></tr>
    ${campaigns.map((c) => { const st = campStats(c); return `<tr><td>${esc(c.name)}<div class="meta">${esc(storeById.get(c.storeId).name)}</div></td><td class="meta">${esc(c.targeting.areaIds.map(D.areaLabel).join("・"))} × ${esc(c.targeting.genreIds.map(D.genreLabel).join("・"))}</td><td>${statusPill(c.status)}</td><td class="num">${fmt(st.imp)}</td><td class="num">${fmt(st.cl)}</td><td class="num">${fmt(st.sp)}円 / ${fmt(c.budgetYen)}円</td><td>${c.status === "approved" ? `<button class="btn sm" data-rv="stop" data-id="${c.id}">配信停止</button>` : ""}</td></tr>`; }).join("")}</table></div>`;
  }
  function adminStores() {
    const list = stores.filter((s) => storeFilter === "all" || !s.published || s.verification.status !== "verified" || !s.budget.basis || !s.hours);
    return `<div class="row" style="justify-content:space-between"><div><h1 class="page">店舗マスター</h1><p class="sub">共通の store_id でなまらAIとNAMARA REVIEWを紐づけています。表示中 ${list.length} / ${stores.length} 店舗。</p></div>
    <label class="f">絞り込み<select id="sf"><option value="attention" ${storeFilter === "attention" ? "selected" : ""}>要確認（非公開・未検証・価格不明・営業時間不明）</option><option value="all" ${storeFilter === "all" ? "selected" : ""}>すべて</option></select></label></div>
    <div class="card scroll" style="padding:0"><table style="min-width:820px"><tr><th>ID</th><th>店舗名</th><th>エリア／ジャンル</th><th>データソース・確認日</th><th>状態</th><th>操作</th></tr>
    ${list.map((s) => `<tr><td class="meta">${s.id}</td><td>${esc(s.name)}${!s.budget.basis ? '<div class="meta">価格情報：不明</div>' : ""}${!s.hours ? '<div class="meta">営業時間：不明</div>' : ""}</td><td class="meta">${esc(D.areaLabel(s.areaId))}／${esc(s.genreIds.map(D.genreLabel).join("・"))}</td><td class="meta">サンプル（架空）<br>確認日：${esc(s.verification.verifiedAt ?? "未確認")}</td><td>${s.published ? '<span class="pill good">公開</span>' : '<span class="pill mute">非公開</span>'} ${s.verification.status === "verified" ? '<span class="pill info">検証済み</span>' : '<span class="pill bad">未検証</span>'} ${s.organizationId ? '<span class="pill ad">契約</span>' : ""}</td><td>${s.verification.status === "verified" || s.published ? `<button class="btn sm" data-pub="${s.id}">${s.published ? "非公開にする" : "公開する"}</button>` : '<span class="meta">未検証は公開不可</span>'}</td></tr>`).join("")}</table></div>`;
  }
  function adminPlans() {
    return `<h1 class="page">料金プラン・外部連携状況</h1><p class="sub">料金はすべて仮設定です。課金・決済は未実装（Phase 10）。</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${N.PLANS.map((p) => `<div class="card"><div class="row" style="justify-content:space-between"><h3>${esc(p.name)}</h3><span class="pill mute">仮設定</span></div><div style="font-size:22px;font-weight:700">${fmt(p.priceYen)}円<small class="meta">/${p.unit}${p.from ? "〜" : ""}</small></div><ul style="padding-left:18px;color:var(--muted);font-size:13px;margin:6px 0 0">${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>`).join("")}</div>
    <div class="card" style="margin-top:14px"><h3>外部連携の状況</h3><table>${[["Supabase（DB・認証）", "未接続（スキーマとRLSテストのみ完成）"], ["LINE Messaging API（なまらAI）", "未接続（署名検証・Flex Message はテスト済み）"], ["LINE（店舗通知・別チャネル）", "未接続（Phase 9）"], ["OpenAI API", "未接続（辞書ベースの解析を使用）"], ["Google Business Profile API", "未接続（利用申請・承認後に Phase 8）"], ["Google Places API", "採用保留（キャッシュ制限が設計と合わない）"]].map(([a, b]) => `<tr><td>${a}</td><td class="meta">${b}</td></tr>`).join("")}</table></div>`;
  }

  /* ---------------- タブ切り替え ---------------- */
  const views = { ai: viewAI, review: viewReview, admin: viewAdmin };
  document.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => {
    document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
    views[b.dataset.tab](); window.scrollTo(0, 0);
  }));
  viewAI();
})();
