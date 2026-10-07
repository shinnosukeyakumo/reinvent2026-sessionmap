# re:Invent 2026 Session Map

AWS re:Invent 2026（2026/11/30〜12/4、ラスベガス）のセッションを、会場ホテルの地図と一緒に眺めるための Web アプリ。

- 地図上に 5 会場（Wynn / Encore、Venetian、Caesars Forum、Caesars Palace、MGM Grand）を表示。マーカーの数字は表示中のセッション数、リングの色はカテゴリ構成比
- 会場別 / 時間別 / カテゴリ別の 3 つの表示を切り替え
- 日付、時間枠、カテゴリ（複数選択）、セッション形式、キーワードで絞り込み。地図の件数も連動する
- ★ でお気に入り登録（ブラウザの localStorage に保存）
- 「録画なし形式のみ」（既定オン）で Workshop / Builders' session / Chalk talk / Lab / Bootcamp / Gamified learning に絞る。例年の傾向にもとづく分類で、2026 年の録画方針は未確認
- 宿（`src/plan.ts` の `HOME_VENUE`、既定は MGM Grand）からの距離を各セッションに表示
- 公式カタログで予約できたセッションは `src/plan.ts` の `RESERVED_CODES` に入れてある。どの端末でも最初からマイプランに並び、「予約済み」の印が付く
- マイプラン: ★ を付けたセッションと、基調講演・ブログ執筆・交流会・スワグ回収などの予定を 1 日の流れで表示
  - 宿起点の移動距離と徒歩目安（直線距離 ×1.4 を時速 4.5km）、間に合わない移動や予定の重なりを警告
  - 上部に固定した「ブログ執筆・交流・スワグ回収」を、PC はドラッグ、スマホはタップしてから時間軸の時刻をタップして置く（15 分刻み。場所は直前の予定の会場を引き継ぎ、置いたらすぐ編集欄が開く）。「一覧」表示では、空き時間からワンタップで追加できる
  - 現地セッションが 1 日 3 本以上になったら強調表示
  - 地図にその日のルートを描く
  - 「時間軸」表示では、予定・移動・空き時間を実際の長さで縦に並べる（1 分 = 1.2px）。予定が無い日も 0:00〜24:00 を描き、PC では最初の予定の 1 時間前（無ければ 7:00）まで自動でスクロールする。「一覧」表示に切り替えもできる
- マイプランの「カレンダーに書き出す」で、全日程の予定を .ics で書き出す（Google カレンダー・Apple カレンダーに取り込める）。時間軸の予定を押すと、その予定だけを Google カレンダーに追加するリンクも出る。時刻は UTC で書き出すので、端末のタイムゾーンに合わせて表示される
- 「次の行き先」カード: 会期中は現地時刻で次の予定を出し、「現在地を使う」をオンにすると、そこまでの距離・徒歩目安・出発時刻を出す。Google マップ / Apple マップの徒歩ナビを開くボタン付き。位置情報は端末の中だけで使う
- 新着セッションに NEW を付ける（カタログに追加されてから 7 日以内）。「新着のみ」で絞り込める
- PC では、地図とサイドバーの境目をドラッグしてサイドバーの幅を変えられる（幅は端末に保存。ダブルクリックで元に戻す）
  - 睡眠は毎晩 3:00–6:00 の 3 時間で固定し、それ以外の 30 分以上の空き（移動を除く）は「ブログ執筆・検証」の枠で埋めてある。夜の交流（Venetian のレセプション → Noodle Asia）も入れてある
  - 公式アジェンダの主な予定（Kickoff、Welcome reception、基調講演 4 本、re:Play）と、ブログ執筆の枠（1 日 2 枠、各 90 分前後）を最初から入れてある。ブログ枠が 1 日 2 本を下回ると赤く表示する。予定を足したり消したりしても、公式予定の改訂時には未編集のものだけを入れ替える

## 起動

```bash
npm install
npm run fetch:catalog   # 初回のみ。セッションデータを取得する
npm run dev
```

公式カタログのデータ（`public/data/sessions.json`）は AWS のコンテンツのため、リポジトリには含めていない。

## 公開先

- URL: https://main.d13ddmw6nhifec.amplifyapp.com/
- Amplify Hosting（us-east-1、appId `d13ddmw6nhifec`、ブランチ `main`）。GitHub とは連携しておらず、手動デプロイで更新する
- PWA 対応。スマホでは共有メニューの「ホーム画面に追加」でアプリとして開ける。アプリ本体・セッションデータ・一度見た地図タイルは端末に保存され、電波が弱くても開ける

手動デプロイの手順:

1. `npm run fetch:catalog && npm run build`
2. `dist/` の中身を zip にまとめる（`cd dist && zip -r ../dist.zip .`）
3. Amplify の `CreateDeployment` で受け取ったアップロード URL に zip を PUT し、`StartDeployment` を呼ぶ

## セッションデータの更新

公式セッションカタログ（RainFocus のイベント API `catalog.awsevents.com/api/sessions`）から全件を取得し、`public/data/sessions.json` に整形して保存する。

```bash
npm run fetch:catalog
```

- 前回のデータから各セッションの「初めて見つけた日時」（`firstSeen`）を引き継ぎ、今回初めて現れたものには取得日時を付ける。新着の件数をログに出す
- 1 リクエスト 50 件が上限のため、400ms 間隔でページ送りする（約 2,000 件で 40 リクエスト強）
- ヘッダーの `rfapiprofileid` / `rfwidgetid` は公開カタログページが送っている値。カタログ側の更新で変わった場合は、カタログページを開いてブラウザの開発者ツールで `api/sessions` リクエストのヘッダーを確認して差し替える
- 会場は `room` の先頭（`MGM Grand | Level 3 | ...` の `MGM Grand`）から取る。新しい会場名が出てきたら `src/data/master.ts` の `VENUES` に追加する

## 構成

| パス | 内容 |
|------|------|
| `scripts/fetch-catalog.mjs` | カタログ取得・整形スクリプト |
| `public/data/sessions.json` | 取得済みセッションデータ |
| `src/data/master.ts` | 会場の座標・色、カテゴリの日本語名・色、日付 |
| `src/components/MapView.tsx` | Leaflet の地図とホテルマーカー |
| `src/components/Views.tsx` | 会場別 / 時間別 / カテゴリ別のリスト |
| `src/components/SessionCard.tsx` | セッションカード |
| `src/components/PlanView.tsx` | マイプラン |
| `src/plan.ts` | 宿・録画なし形式の定義、予定の保存、距離計算 |

地図タイルは OpenStreetMap の標準タイルを CSS フィルターで暗色化して使っている。公開運用でアクセスが増える場合は、[OSM のタイル利用ポリシー](https://operations.osmfoundation.org/policies/tiles/)に沿って別のタイル提供元へ切り替えること。
