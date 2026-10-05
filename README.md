# re:Invent 2026 Session Map

AWS re:Invent 2026（2026/11/30〜12/4、ラスベガス）のセッションを、会場ホテルの地図と一緒に眺めるための Web アプリ。

- 地図上に 5 会場（Wynn / Encore、Venetian、Caesars Forum、Caesars Palace、MGM Grand）を表示。マーカーの数字は表示中のセッション数、リングの色はカテゴリ構成比
- 会場別 / 時間別 / カテゴリ別の 3 つの表示を切り替え
- 日付、時間枠、カテゴリ（複数選択）、セッション形式、キーワードで絞り込み。地図の件数も連動する
- ★ でお気に入り登録（ブラウザの localStorage に保存）
- 「録画なし形式のみ」（既定オン）で Workshop / Builders' session / Chalk talk / Lab / Bootcamp / Gamified learning に絞る。例年の傾向にもとづく分類で、2026 年の録画方針は未確認
- 宿（`src/plan.ts` の `HOME_VENUE`、既定は MGM Grand）からの距離を各セッションに表示
- マイプラン: ★ を付けたセッションと、基調講演・ブログ執筆・交流会・スワグ回収などの予定を 1 日の流れで表示
  - 宿起点の移動距離と徒歩目安（直線距離 ×1.4 を時速 4.5km）、間に合わない移動や予定の重なりを警告
  - 45 分以上の空き時間に、ブログ・交流・スワグ回収をワンタップで追加（次の会場への徒歩時間を残す）
  - 現地セッションが 1 日 3 本以上になったら強調表示
  - 地図にその日のルートを描く
  - 基調講演は公式発表前のため、例年の形で「仮」として入っている。発表後に編集する

## 起動

```bash
npm install
npm run fetch:catalog   # 初回のみ。セッションデータを取得する
npm run dev
```

公式カタログのデータ（`public/data/sessions.json`）は AWS のコンテンツのため、リポジトリには含めていない。

## セッションデータの更新

公式セッションカタログ（RainFocus のイベント API `catalog.awsevents.com/api/sessions`）から全件を取得し、`public/data/sessions.json` に整形して保存する。

```bash
npm run fetch:catalog
```

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
