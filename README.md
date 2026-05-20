# Othello Opening Trainer

決まったオセロ定石を覚えるための Vite + React + TypeScript SPA です。

公開 URL:

https://giwarb.github.io/othello-opening-trainer/

## 機能

- 定石ごとに黒番/白番の練習を開始できます。
- 「今日未クリアからランダム」と「正解率ワースト3からランダム」で復習できます。
- 定石と違う手を打つと失敗になり、元に戻して続けられます。
- クリア/失敗の履歴をブラウザの localStorage に保存し、当日クリア数や正解率を表示します。
- PWA としてインストール可能です。

## 開発

Node.js 22 系を使います。

```bash
npm ci
npm run dev
```

ローカルで確認する場合は、表示された Vite の URL をブラウザで開きます。

## チェック

GitHub Actions と同じ順番で、push 前に以下を通します。

```bash
npm test
npm run lint
npm run build
```

整形だけ直したい場合:

```bash
npm run format
```

## デプロイ

このリポジトリは GitHub Pages に GitHub Actions でデプロイします。

1. GitHub のリポジトリ設定で `Settings > Pages > Build and deployment` を開きます。
2. `Source` が `GitHub Actions` になっていることを確認します。
3. 変更を `main` に push します。

```bash
git add .
git commit -m "Your change"
git push origin main
```

push すると `.github/workflows/pages.yml` が実行され、`npm ci`、`npm test`、`npm run lint`、`npm run build` が成功したあと `dist` が Pages に反映されます。

手動で再デプロイしたい場合は、GitHub の `Actions > Deploy to GitHub Pages > Run workflow` から実行できます。

## Actions が失敗した時

GitHub CLI を使うと、失敗箇所をローカルから確認できます。

```bash
gh run list --repo giwarb/othello-opening-trainer --limit 10
gh run view <run-id> --repo giwarb/othello-opening-trainer --log-failed
```

失敗しやすいポイント:

- `npm run lint`: Biome の整形、import 順、未使用 import、非 null 断言、空の CSS ルール、`!important` など。
- `npm test`: 定石データや着手ロジックの変更で既存の期待値が崩れている。
- `npm run build`: TypeScript の型エラーや Vite のビルドエラー。

修正後はローカルで `npm test && npm run lint && npm run build` 相当を通してから push します。

## データ

定石データは `src/data/joseki.ts` にあります。各定石は以下の形です。

```ts
{
  id: "tori",
  name: "酉定石",
  color: "white",
  moves: ["f5", "d6", "..."],
}
```

- `color` はプレイヤーが練習する色です。
- `moves` は黒番から始まる定石手順です。
- 初手は `f5` 固定です。
