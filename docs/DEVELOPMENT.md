# 開発ガイド

LogroomはHTML・CSS・JavaScriptで作られた静的アプリです。ブラウザ上に仮想ファイルシステムとコマンド処理を持ち、実際のLinuxやサーバープロセスを起動しません。公開・利用にアプリサーバーやデータベースは不要です。

## 必要なもの

- Node.js 22以降。CIではNode.js 24を使用します。
- npm。通常のビルドとコアテストはNode.jsの標準機能だけで動きます。
- ブラウザテストには開発依存のPlaywrightとChromiumを使います。

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

依存パッケージを導入せずに、`node scripts/build.js` と `node scripts/test.js` を実行することもできます。`index.html` をブラウザで開くと、生成したアプリを確認できます。

## ファイル構成

| パス | 内容 |
| --- | --- |
| `src/ui.html` | HTMLのひな形。ビルド時にCSS・JavaScriptを埋め込む |
| `src/style.css`、`src/sl.css` | 画面と演出のスタイル |
| `src/shell.js` | 仮想シェル、コマンド、仮想ファイルシステム |
| `src/vi.js` | viの編集バッファ・モード・基本操作 |
| `src/sl.js` | ブラウザ内の機関車演出 |
| `src/cases.js`、`src/cases-extra.js` | 正常・攻撃後のログ、設問、正解、証拠、ヒント |
| `src/case-context.js` | 各ケースの前提・構成、攻撃の解説 |
| `src/case-reading-a.js`、`src/case-reading-b.js` | 技術知識、歴史的事例、外部参考資料 |
| `src/app.js` | 画面、演習の判定、状態保存、演出の連携 |
| `src/i18n.js` | オフラインの言語切り替え、静的画面とケースのローカライズ |
| `src/locales/ui.js` | 日本語の画面文言をキーにした英語・タイ語の翻訳 |
| `src/locales/cases-a.js`〜`cases-c.js` | ケースIDとデータのパスに対応する英語・タイ語の翻訳 |
| `scripts/` | ビルド・テストの実行 |
| `tests/` | コマンド、エディター、設問とログ、配布ファイルの検証 |
| `tests/browser/` | 配布HTMLを操作するブラウザテスト |
| `index.html` | リポジトリに含める単一HTMLの配布版 |
| `dist/` | Pagesに配信する生成物。Git管理対象外 |

`npm run build` は同じ内容を `index.html`、`dist/index.html`、`dist/logroom.html` に書き出します。外部のスクリプト・CSS・フォントは必要ありません。ビルドに日時は埋め込まず、同じソースから同じファイルを生成します。

## テストの範囲

`npm test` はコマンドと主要オプション、パイプ・リダイレクト、viの編集、slの演出モデル、設問の正解と根拠、配布用HTMLを検証します。各スイートを別プロセスで実行し、失敗した時点で終了します。先に `npm run build` を実行してください。

`npm run test:browser` は生成済み `index.html` を開き、コマンド一覧・前提説明・解説の解放、演習の状態保存、vi、画面幅、sl、GAME OVERからの復帰を確認します。外部へのバックグラウンド通信やJavaScriptエラーも検出します。スクリーンショットは `tests/artifacts/` に出力し、Gitには含めません。

既存のChromeで動かす場合は、環境変数 `LOGROOM_BROWSER_CHANNEL=chrome` を指定できます。`LOGROOM_BROWSER_EXECUTABLE` を指定すると実行ファイルを直接選べます。通常はPlaywrightのChromiumが使われます。開発環境に既存のPlaywrightがある場合に限り、`LOGROOM_PLAYWRIGHT_MODULE` でそのモジュールの場所を指定できます。これらのローカル設定をソースに書き込まないでください。

## オフライン動作と状態保存

アプリの本体は単一HTMLで動きます。外部資料へのリンクは、利用者が開いたときにだけ通信します。Content Security Policyでアプリからのバックグラウンド通信を禁止しています。

演習の状態はCookieではなく、ブラウザの `localStorage` に `logroom.offline.v1` というキーで保存します。保存先はオリジン単位です。GitHub Pages版とダウンロード版は状態を共有せず、URL・ブラウザ・プロファイルが変わると別の状態になる場合があります。ファイルを直接開く場合の保存可否・範囲はブラウザにも依存します。保存できない環境でも演習は利用できますが、ページを閉じると状態が失われます。

`rm -rf /` の演出後は、選択中のケースだけが初期状態に戻ります。他ケースの進捗と画面レイアウト設定は保持します。`sl` は約5秒の演出が終わるまで待つ仕様です。

## CIと公開

- `Check` はビルド、コアテスト、生成済み `index.html` の差分、ブラウザテストを確認します。
- `Deploy GitHub Pages` は `main` へのpush、または手動実行でビルド・コアテスト・ブラウザテストを行い、成功すると `dist/` を公開します。

リポジトリのPages設定で、公開元を「GitHub Actions」にしてください。初回公開と設定方法は公開手順のドキュメントを参照してください。Pages上の演習データは各利用者のブラウザに保存され、リポジトリや運営者のサーバーへ送信されません。

詳しくは[GitHubへの公開手順](PUBLISHING.md)、教材の拡張は[演習の追加](AUTHORING.md)を参照してください。

## 翻訳を更新する

日本語のケースが原本です。翻訳はケースIDとドット区切りのフィールドパスで関連付けます。ケースのID、正解、許容する別解、コマンド、証拠行、ログの内容、URLを翻訳用に変更しないでください。README内の説明文と例のメタ変数は翻訳できます。

画面の文言は `LogroomI18n.t` で翻訳します。タグ付きテンプレートの動的な値は `{0}`、`{1}` などの位置で保持し、利用者が入力したデータを置換文字列として解釈しません。新しい文言を追加したら英語・タイ語の両方を追加してください。既存の画面文言を変更した場合は翻訳のキーも更新します。

`state.locale`を同じlocalStorageに保存するため、言語ごとの別セッションは作りません。言語を変える直前に仮想ファイルの変更を保存し、同じケースの進捗を使って画面を再描画します。利用者のメモ・コマンド出力・編集内容は翻訳しません。翻訳データも単一HTMLに埋め込まれ、外部の翻訳APIを呼び出しません。
