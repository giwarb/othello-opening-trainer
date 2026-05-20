# AGENTS.md

このリポジトリで作業するエージェント向けの手順です。

## プロジェクト

- Vite + React + TypeScript の SPA。
- GitHub Pages への公開は `.github/workflows/pages.yml` で行う。
- Pages の公開 URL は `https://giwarb.github.io/othello-opening-trainer/`。
- Vite の `base` は `./`。GitHub Pages のサブパスで白画面にならないよう、ここを不用意に変えない。

## 作業前

- 既存のユーザー変更を巻き戻さない。
- `dist/`、`node_modules/`、一時ファイルはコミットしない。
- 定石データや UI 文言は日本語表示を優先する。

## push 前チェック

GitHub Actions と同じチェックをローカルで通す。

```bash
npm test
npm run lint
npm run build
```

Biome の整形だけ直す場合:

```bash
npm run format
```

## よくある CI 失敗

- `noNonNullAssertion`: `stats.get(id)!` や `find(...)!` を避け、fallback や明示的なエラーにする。
- `organizeImports`: import 順は Biome に合わせる。
- `noEmptyBlock`: 空の CSS ルールを残さない。
- `noImportantStyles`: CSS の `!important` を使わない。
- `useExhaustiveDependencies`: React Hooks の依存配列をごまかさない。必要なら関数構造を整理する。

## デプロイ確認

push 後に Actions を確認する。

```bash
gh run list --repo giwarb/othello-opening-trainer --limit 5
gh run watch <run-id> --repo giwarb/othello-opening-trainer --exit-status
```

成功後、公開 URL をブラウザで開いて以下を確認する。

- 画面が白紙ではない。
- ホーム画面の定石カードが表示される。
- 定石を選ぶと開始演出のあと盤面が表示される。
- 少なくとも 1 手入力できる。
