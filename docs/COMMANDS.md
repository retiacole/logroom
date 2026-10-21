# コマンドとオプション

[READMEに戻る](../README.md) · [操作ガイド](USER_GUIDE.md)

52コマンドの学習用部分実装です。対応するオプションや式は、Logroom内の **コマンド一覧** と `help コマンド名` で確認できます。一般のLinuxコマンドや外部マニュアルに載っている機能のすべてが使えるわけではありません。

## 対応コマンド

以下は各コマンドの対応構文です。`[ ]` は省略可能な引数、`...` は繰り返しを示します。選択肢を表す `|` は説明用で、すべてをそのまま入力する記号ではありません。

### ヘルプ・場所・一覧

**`help`**：対応構文を確認する。

```text
help [command]
```

**`pwd`**：現在の仮想ディレクトリを表示する。

```text
pwd
```

**`cd`**：仮想ディレクトリを移動する。

```text
cd [directory|-]
```

**`ls`**：ファイルやディレクトリを一覧する。

```text
ls [-alhdRSr] [path ...]
```

**`find`**：仮想パスを条件で検索する。

```text
find [path] [-type f|d] [-name glob|-iname glob] [-path glob] [-maxdepth N] [-mindepth N]
```

**`history`**：コマンド履歴を表示する。

```text
history
```

**`clear`**：ターミナルの表示を消す。

```text
clear
```

### 表示・検索

**`cat`**：ファイルを連結して表示する。

```text
cat [-n] [file ...]
```

**`tac`**：行を逆順に表示する。

```text
tac [file ...]
```

**`less`**：閲覧画面を開く。

```text
less [file ...]  (read-only viewer; q closes)
```

**`more`**：閲覧画面を開く。

```text
more [file ...]  (read-only viewer; q closes)
```

**`head`**：先頭の行やバイトを表示する。

```text
head [-n N|-c N] [file ...]
```

**`tail`**：末尾の行やバイトを表示する。

```text
tail [-n N|+N] [-c N|+N] [file ...]
```

**`grep`**：一致する行や文字列を抽出する。

```text
grep [-EFiwvncrRlhHLqxo] [-m N] [-A N|-B N|-C N] [-e pattern ...] [--include glob|--exclude glob|--exclude-dir glob] [--] pattern [file ...]
```

**`rg`**：再帰検索やファイル一覧を使う。

```text
rg [-FiwvnclHhqo] [-A N|-B N|-C N] [-e pattern] [-g glob] [--no-heading] [--count] [pattern] [path ...] | rg --files [-g glob] [path ...]
```

**`strings`**：表示可能なASCII文字列を抽出する。

```text
strings [-a] [-n minimum] [-t d|o|x] [file ...]
```

### 集計・加工・比較

**`sort`**：行を並べ替える。

```text
sort [-nrufbsc] [-k N[,M][nrfb]] [-t delimiter] [file ...]
```

**`uniq`**：連続する同じ行をまとめる。

```text
uniq [-cdui] [-f fields] [-s characters] [file]
```

**`wc`**：行・語・文字・バイトなどを数える。

```text
wc [-lwmcL] [file ...]
```

**`cut`**：指定フィールドや文字位置を取り出す。

```text
cut [-d delimiter] -f fields [-s] [--complement] [--output-delimiter text] [file ...] | cut -c characters [file ...]
```

**`tr`**：標準入力の文字を変換・削除する。

```text
tr [-cds] [--] SET1 [SET2]  (reads standard input)
```

**`sed`**：行の選択・削除・置換をする。

```text
sed [-nE] [-i[backup-suffix]] [-e script ...] [script] [file ...]
```

**`awk`**：フィールド抽出・条件・集計をする。

```text
awk [-F separator] [-v name=value ...] '[BEGIN {...}] [/regex/|expression] {print field, ...} [END {...}]' [file ...]
```

**`jq`**：JSON/JSONLから値を抽出・加工する。

```text
jq [-rcs] [--] [filter] [file ...]
```

**`column`**：文字列を表形式に整える。

```text
column -t [-s delimiter-characters] [file ...]
```

**`nl`**：行番号を付ける。

```text
nl [-ba|-bt] [-w width] [-s separator] [file]
```

**`diff`**：2ファイルの差分を表示する。

```text
diff [-u] [--] file1 file2
```

**`comm`**：整列済み2ファイルの共通・固有行を比較する。

```text
comm [-123] file1 file2
```

**`join`**：整列済みファイルをキーで結ぶ。

```text
join [-1 N] [-2 N] [-t delimiter] [-a 1|2|-v 1|2] [-e text] [-o field-list] file1 file2
```

**`paste`**：ファイルの行を横に結ぶ。

```text
paste [-s] [-d delimiters] [file ...]
```

**`rev`**：各行の文字を逆順にする。

```text
rev [file ...]
```

**`base64`**：UTF-8テキストをBase64変換する。

```text
base64 [-d|--decode] [-w columns] [file]
```

### 出力・引数・パス・情報

**`echo`**：文字列を出力する。

```text
echo [-n] [text ...]
```

**`printf`**：書式を指定して出力する。

```text
printf format [argument ...]
```

**`tee`**：標準出力と仮想ファイルの両方へ書き出す。

```text
tee [-a] [file ...]
```

**`xargs`**：入力を仮想コマンドの引数に渡す。

```text
xargs [-0r] [-d delimiter] [-n N] [-I token] [virtual-command [argument ...]]
```

**`basename`**：パスの末尾名を取り出す。

```text
basename [-a] [-s suffix] path [suffix]
```

**`dirname`**：親パスを取り出す。

```text
dirname path ...
```

**`realpath`**：仮想パスを正規化する。

```text
realpath [-m|-e] path ...
```

**`file`**：仮想テキストの種類を調べる。

```text
file [-bi] path ...
```

**`stat`**：仮想ファイルの基本情報を表示する。

```text
stat [-c format] path ...
```

**`du`**：仮想テキストの論理サイズを集計する。

```text
du [-ashb] [--max-depth N] [path ...]
```

**`date`**：日時を指定書式で表示する。

```text
date [-u] [-d ISO-date|@epoch] [+format]
```

### 仮想ファイル・編集・おまけ

**`mkdir`**：仮想ディレクトリを作る。

```text
mkdir [-p] directory ...
```

**`touch`**：空の仮想ファイルを作る。

```text
touch file ...
```

**`cp`**：仮想ファイルをコピーする。

```text
cp source destination
```

**`mv`**：仮想ファイルやディレクトリを移動する。

```text
mv [-n] source destination
```

**`rm`**：仮想ファイルを削除する。

```text
rm [-f] file ... | rm -rf /  (GAME OVER / reset current case)
```

**`rmdir`**：空の仮想ディレクトリを削除する。

```text
rmdir [-p] directory ...
```

**`vi`**：基本的なvi編集画面を開く。

```text
vi [file]  (standalone only)
```

**`view`**：既存ファイルを読み取り専用のviで開く。

```text
view [file]  (read-only editor; standalone only)
```

**`sl`**：蒸気機関車の演出を表示する。

```text
sl  (steam locomotive; standalone only; wait until it passes)
```

## よく使う組み合わせ

以下の例はSSHケースで使えます。`#` で始まる行は説明なので入力不要です。

```sh
# 行番号を付けて検索する
grep -n 'Failed password' /var/log/auth.log

# 前後の文脈を含める
grep -C 2 'Accepted' /var/log/auth.log

# 条件を重ねて件数を数える
grep 'Failed password' /var/log/auth.log | wc -l

# 認証失敗の送信元を集計する（このケースのログ形式）
grep 'Failed password' /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr

# 正常時との差分を表示する
diff -u /baseline/var/log/auth.log /var/log/auth.log

# 仮想ファイルへ保存する
grep 'Failed password' /var/log/auth.log | tee /home/analyst/failed.txt
```

フィールド位置はログ形式ごとに確認してください。別のログでも同じ列番号が使えるとは限りません。

JSONLがあるケースでは、たとえば次のように使えます。

```sh
jq '.' /var/log/app/audit.jsonl | head -n 20
jq -r '.request_id' /var/log/app/audit.jsonl
jq -r 'select(.result == "success") | .request_id' /var/log/app/audit.jsonl
```

## 主なオプション

| コマンド | よく使うオプション・対応範囲 |
| --- | --- |
| `grep` | `-n`行番号、`-i`大文字小文字無視、`-v`反転、`-c`一致行数、`-o`一致部分、`-F`固定文字列、`-E`拡張正規表現、`-r`/`-R`再帰、`-l`/`-L`ファイル名、`-m N`件数上限、`-A`/`-B`/`-C`文脈、`--include`/`--exclude`絞り込み |
| `rg` | `-n`行番号、`-i`大文字小文字無視、`-F`固定文字列、`-v`反転、`-g`パスの絞り込み、`--files`一覧、`--hidden`隠しパス、`--count`一致行数 |
| `sort` | `-n`数値、`-r`逆順、`-u`重複除去、`-f`大文字小文字無視、`-b`先頭空白無視、`-s`安定、`-c`並び順確認、`-k`1つのキー範囲、`-t`区切り |
| `uniq` | `-c`件数、`-d`重複した行、`-u`1回だけの行、`-i`大文字小文字無視、`-f`比較時にフィールドをスキップ、`-s`文字をスキップ |
| `cut` | `-d`区切り、`-f`フィールド、`-c`文字位置、`-s`区切りなしを除外、`--complement`選択反転、`--output-delimiter`出力区切り |
| `head` / `tail` | `-n`行数、`-c`UTF-8バイト数、`-q`/`-v`見出し、`tail -n +N`指定行から。追従する`tail -f`は未対応 |
| `wc` | `-l`改行数、`-w`語数、`-m`文字数、`-c`UTF-8バイト数、`-L`最大表示幅 |
| `sed` | `-n`自動表示を抑止、`-E`拡張正規表現、`-e`複数式、`-i`仮想ファイル更新、行番号・範囲・正規表現、`p`/`d`/`s` |
| `awk` | `-F`フィールド区切り、`-v`変数、フィールド参照、条件、`print`、カウンタ・合計、基本的な`BEGIN`/`END` |
| `jq` | `-r`文字列を生で出力、`-c`1行JSON、`-s`入力を配列へ、フィールド・配列参照、`select`、基本的な整列・集約 |
| `find` | `-type`、`-name`/`-iname`、`-path`/`-ipath`、`-maxdepth`/`-mindepth`。`-exec`は未対応 |
| `ls` | `-a`隠し項目、`-l`詳細、`-h`読みやすいサイズ、`-d`ディレクトリ自身、`-R`再帰、`-S`サイズ順、`-r`逆順 |
| `tee` | `-a`で追記。`>`上書き・`>>`追記のリダイレクトも利用可能 |
| `diff` | `-u`統一形式。2つの仮想テキストファイルを比較 |
| `date` | `-u`UTC、`-d`日時指定、`+%F`などの書式。相対日時や時計の設定は未対応 |

長いオプションや組み合わせにも対応するものがあります。詳細は実装と一緒に更新される `help コマンド名` を参照してください。

## シェルの対応構文

- シングル・ダブルクォートとエスケープ
- パイプ `|`
- 標準入力 `<`、出力上書き `>`、追記 `>>`
- コマンド列 `;`、成功時の続行 `&&`、失敗時の続行 `||`
- 引用されていない `*` と `?` による仮想パス展開

シェル変数、コマンド置換、シェルスクリプト、任意のプログラム実行には対応していません。`vi`、`view`、`sl`とGAME OVERの特別なコマンドは単独で実行します。

## 一般のツールとの主な違い

- ファイルはブラウザ内の仮想テキストです。所有者、権限、ディスク使用量は実OSの状態を示しません。`ls`に実際の更新時刻はありません。
- ログは静的スナップショットです。`tail -f`で新しいイベントを待つことはできません。
- `grep`は通常は基本正規表現、`-E`で拡張正規表現です。PCRE、先読み・後読みなどには対応していません。
- `uniq`は連続している同値だけをまとめます。全体を集計するときは先に`sort`します。
- `sort`や`comm`の並び順は決定的な文字順です。OSやロケールの照合順序は再現しません。
- `awk`・`sed`・`jq`は対応する式のみを解釈します。任意のプログラムや外部処理を実行する機能はありません。
- `xargs`は対応する仮想コマンドへ直接引数を渡します。外部シェル、`sh -c`、並列実行、入れ子の`xargs`、エディター、`sl`は呼び出せません。
- 通常の`rm`は仮想ファイルの削除です。再帰削除は、単独の`rm -rf /`などに対応するGAME OVERの特別な演出を除いて未対応です。
- 入出力サイズや式の複雑さには上限があります。大きな比較や複雑な正規表現が拒否された場合は、対象を絞って調査します。

`vi`の操作と`sl`・GAME OVERの挙動は[操作ガイド](USER_GUIDE.md)にまとめています。
