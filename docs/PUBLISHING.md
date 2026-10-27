# GitHubへの公開手順

公開するものは、ソースと説明書を含むGitHubリポジトリ、ブラウザで試せるGitHub Pages、オフライン用の単体HTMLです。アプリ用のサーバーや有料サービスの契約は不要です。

## 1. アカウントを用意する

[GitHubの登録画面](https://github.com/signup)でアカウントを作成し、メール認証を完了します。パスワード・認証コードはGitHubの画面で入力し、チャットやリポジトリには書かないでください。GitHubのアクセス制限が表示されている間は、制限が解消してから再開してください。

既存アカウントを使う場合は、そのアカウントにログインします。

## 2. リポジトリを作る

[新規リポジトリの作成画面](https://github.com/new)で、次の内容を設定します。

| 項目 | 設定 |
| --- | --- |
| Repository name | `logroom` |
| Description | ブラウザだけで使える、Linuxコマンドによるログ分析演習室。10ケース・104問＋導入4問・出口演習2本・61コマンド。 |
| Visibility | Public |
| README・.gitignore・Licenseの自動追加 | オフ。この一式に含まれています |

`logroom`という名前が既に使われている場合は、別名を選び、後のURLもその名前に合わせてください。

## 3. ファイルを送る

このフォルダーをGitHubへpushします。認証済みのGitが使える環境では、リポジトリのルートで実行します。`YOUR_ACCOUNT`は自分のGitHubユーザー名に置き換えます。

```sh
git remote add origin https://github.com/YOUR_ACCOUNT/logroom.git
git push -u origin main
```

配布ZIPから始め、`.git`フォルダーがない場合は、先に次を実行します。Gitの名前・メールアドレス設定も必要です。公開コミットに実メールアドレスを出したくない場合は、GitHubのEmails設定で案内されるnoreplyアドレスを使います。

```sh
git init -b main
git add .
git commit -m "Initial release of Logroom"
```

GitHub Desktopを使う場合も、同じフォルダーをローカルリポジトリとして追加して公開できます。ブラウザからファイルを送る場合は、ZIPの中身を展開し、階層を維持して送ってください。`.github/workflows/`も必要です。ZIPそのものをアップロードしても、ソースやPagesの設定としては展開されません。

公開対象はこのプロジェクトのファイルだけです。利用者のlocalStorageにある進捗や、端末の個人ファイルは含まれません。`node_modules/`、テストの一時画像、認証情報も送信しません。

## 4. GitHub Pagesを有効にする

1. リポジトリの **Settings → Pages** を開きます。
2. **Build and deployment → Source** を **GitHub Actions** にします。
3. **Actions → Deploy GitHub Pages → Run workflow** から `main` を選び、実行します。
4. ワークフローが成功したら、表示された公開URLを開きます。

通常の公開URLは `https://YOUR_ACCOUNT.github.io/logroom/` です。実際に表示されたURLを正として使ってください。以後は `main` へのpushでビルド・コアテスト・ブラウザテスト・公開が実行されます。

配信するのは `dist/` の中身だけです。初期状態の演習が開くこと、コマンドが動くこと、ページ再読み込み後にも進捗が残ることを確認します。

初回のpush時点でPagesが未設定だと、公開ワークフローが失敗する場合があります。上の設定後に再実行してください。`Check`のブラウザテストで不具合が報告された場合は、利用者に案内する前に修正します。

## 5. READMEとリリースを整える

公開に成功したら、READMEの冒頭に確認済みの公開URLを追加します。リポジトリのAbout欄にも同じURLを設定すると見つけやすくなります。

初回のRelease名は `v0.1.0` とし、`dist/logroom.html` を添付すれば、利用者が単独ファイルをダウンロードできます。リリースノートの内容には [更新履歴](../CHANGELOG.md) を使えます。

Pages版とローカルHTML版の進捗は自動で移行・同期されません。公開先を変える前に、必要な調査メモを書き出してください。

## 参考となる公式ドキュメント

- [GitHubアカウントの作成](https://docs.github.com/en/get-started/start-your-journey/creating-an-account-on-github)
- [新しいリポジトリの作成](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [GitHub Pagesのカスタムワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [コミットのメールアドレス設定](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)
