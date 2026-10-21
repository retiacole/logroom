# 参考資料

各ケースの技術解説と歴史的事案に付けた公開資料へのリンクです。原文・画像・ソフトウェアは同梱していません。資料の権利と利用条件は各公開元に帰属します。外部資料の閲覧にはインターネット接続が必要ですが、演習本体はオフラインで利用できます。

演習は架空の合成ログです。紹介する実際の事案と同じ製品・構成・攻撃経路を再現しているとは限りません。共通点と相違点は各ケースの解説で確認してください。

## 01. SSH認証の異常とsudoの追跡

### 関連する事案の一次資料

- [Mirai亜種によるSSH認証試行の分析（2021）](https://unit42.paloaltonetworks.com/mirai-variant-iot-vulnerabilities/) — Unit 42: Mirai Variant Targeting New IoT Vulnerabilities, Network Security Devices

### 技術資料

- [RFC 4252 — SSH Authentication Protocol](https://www.rfc-editor.org/rfc/rfc4252.html) — 公開鍵・パスワードなどの認証方式と、認証要求の成功・失敗を定めた一次仕様です。
- [OpenSSH sshd_config(5)](https://man.openbsd.org/sshd_config) — AuthenticationMethods、PasswordAuthentication、PubkeyAuthenticationなど、認証設定の意味を確認できます。教材内のサーバー設定を示す資料ではありません。
- [Unit 42 — Mirai亜種とSSHの認証試行（2021）](https://unit42.paloaltonetworks.com/mirai-variant-iot-vulnerabilities/) — 実際に分析した研究者による報告です。SSHへの試行を扱う箇所を、教材との共通点と相違点に注目して読めます。

## 02. Web探索とデータ出力の照合

### 関連する事案の一次資料

- [Confluenceのアクセス制御不備 CVE-2023-22515（2023）](https://confluence.atlassian.com/security/data-center-and-server-1295682276.html) — Atlassian: CVE-2023-22515 — Broken Access Control Vulnerability in Confluence Data Center and Server

### 技術資料

- [Nginx — ngx_http_log_module](https://nginx.org/en/docs/http/ngx_http_log_module.html) — log_formatと標準combined形式を確認できます。本文バイト数と要求・ステータスの位置を読む基礎資料です。
- [OWASP — Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) — いつ・どこで・誰が・何をしたかの記録と、Interaction identifierによるイベントの照合を解説しています。
- [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — 認証と認可の違い、最小権限、要求ごとの権限確認を学べます。
- [Atlassian — CVE-2023-22515公式勧告](https://confluence.atlassian.com/security/data-center-and-server-1295682276.html) — 2023年に公表されたアクセス制御不備の製品公式資料です。教材と実製品の条件を混同せず読んでください。

## 03. DNS・プロキシ・メールの横断調査

### 関連する事案の一次資料

- [SolarWinds SUNBURSTのDNS・HTTP通信分析（2020）](https://cloud.google.com/blog/topics/threat-intelligence/evasive-attacker-leverages-solarwinds-supply-chain-compromises-with-sunburst-backdoor) — FireEye／Mandiant: Highly Evasive Attacker Leverages SolarWinds Supply Chain to Compromise Multiple Global Victims With SUNBURST Backdoor

### 技術資料

- [RFC 1034 — Domain Names: Concepts and Facilities](https://www.rfc-editor.org/rfc/rfc1034.html) — DNSの名前空間、資源レコード、問い合わせと名前解決の基本を定めた一次仕様です。
- [RFC 5321 — SMTP](https://www.rfc-editor.org/rfc/rfc5321.html) — SMTPの応答と配送責任を確認できます。特に4.2.5節と6.1節が、成功応答の意味を考える参考になります。
- [FireEye／Mandiant — SUNBURST初期分析（2020）](https://cloud.google.com/blog/topics/threat-intelligence/evasive-attacker-leverages-solarwinds-supply-chain-compromises-with-sunburst-backdoor) — 発見・分析した研究者の報告です。DNSとHTTPのつながりや、通信の文脈を調べる観点を学べます。

## 04. SQLインジェクションと検索結果の異常

### 関連する事案の一次資料

- [MOVEit TransferのSQLインジェクション CVE-2023-34362（2023）](https://www.ic3.gov/CSA/2023/230607.pdf) — FBI／CISA AA23-158A: CL0P Ransomware Gang Exploits CVE-2023-34362 MOVEit Vulnerability

### 技術資料

- [OWASP — SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) — コードと値を分離するパラメータ化、入力検証、最小権限などの基本原理を確認できます。
- [PostgreSQL — PREPARE](https://www.postgresql.org/docs/current/sql-prepare.html) — 準備した文とパラメータを扱う実製品の公式説明です。教材のDB製品がPostgreSQLであることを意味しません。
- [FBI／CISA — MOVEit脆弱性の共同勧告（PDF）](https://www.ic3.gov/CSA/2023/230607.pdf) — 2023年のCVE-2023-34362悪用を扱う政府機関の一次報告です。教材とは異なる製品・時期の資料として読めます。
- [Progress — MOVEit製品のセキュリティ対応（2023）](https://www.progress.com/blogs/working-enhance-security-moveit-transfer-products-through-partnership-transparency) — 製品ベンダーによる当時の対応説明です。5月31日のCVE-2023-34362と、後から判明した別の脆弱性の区別も確認できます。

## 05. コマンドインジェクションと子プロセス

### 関連する事案の一次資料

- [PAN-OS GlobalProtectのOSコマンド注入 CVE-2024-3400（2024）](https://security.paloaltonetworks.com/CVE-2024-3400) — Palo Alto Networks: CVE-2024-3400 — Arbitrary File Creation Leads to OS Command Injection Vulnerability in GlobalProtect

### 技術資料

- [OWASP — OS Command Injection Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html) — OSコマンド呼び出しの回避、データと命令の分離、引数の検証という防御の原理を学べます。
- [Linux man-pages — getpid(2)](https://man7.org/linux/man-pages/man2/getpid.2.html) — PIDと親PIDの意味を確認する、Linux man-pagesプロジェクトの一次マニュアルです。
- [Linux man-pages — wait(2) / waitpid(2)](https://man7.org/linux/man-pages/man2/waitpid.2.html) — 子プロセスの状態と終了状態の読み方を確認できます。教材の正規化ログそのものの仕様ではありません。
- [Palo Alto Networks — CVE-2024-3400公式勧告](https://security.paloaltonetworks.com/CVE-2024-3400) — 2024年のGlobalProtectの問題について、原因の分類、対象条件、影響を確認できる製品公式資料です。

## 06. パストラバーサルとファイル参照

### 関連する事案の一次資料

- [Apache HTTP Serverのパス正規化脆弱性（2021）](https://httpd.apache.org/security/vulnerabilities_24.html) — Apache HTTP Server 2.4 vulnerabilities

### 技術資料

- [OWASP：Path Traversal](https://community.owasp.org/attacks/Path_Traversal) — パスの解釈、正規化、許可範囲の制限を学ぶ基本資料。
- [Apache：2021年の脆弱性情報](https://httpd.apache.org/security/vulnerabilities_24.html) — CVE-2021-41773とCVE-2021-42013の影響範囲・修正・設定条件を確認する一次資料。
- [Apache：Access Control](https://httpd.apache.org/docs/2.4/howto/access.html) — Webサーバー側の許可・拒否の考え方を学ぶ公式文書。演習のサーバー製品を示す資料ではない。

## 07. Web認証試行とセッション追跡

### 関連する事案の一次資料

- [Microsoftが公表したMidnight Blizzardの認証侵害（2024）](https://www.microsoft.com/en-us/security/blog/2024/01/25/midnight-blizzard-guidance-for-responders-on-nation-state-attack/) — Midnight Blizzard: Guidance for responders on nation-state attack

### 技術資料

- [OWASP：Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) — 認証方式、試行制限、MFA、認証機能の監視を整理する資料。
- [OWASP：Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) — セッションの生成・利用・失効と、安全な照合値の記録を学ぶ資料。
- [Microsoft：Midnight Blizzard調査報告](https://www.microsoft.com/en-us/security/blog/2024/01/25/midnight-blizzard-guidance-for-responders-on-nation-state-attack/) — 2024年公表の初期認証とOAuth悪用を説明する当事者の一次資料。

## 08. SSRFとサーバー外向き通信

### 関連する事案の一次資料

- [Capital Oneの2019年データアクセス事案（2019）](https://www.justice.gov/usao-wdwa/pr/seattle-tech-worker-arrested-data-theft-involving-large-financial-services-company) — DOJ: Seattle Tech Worker Arrested for Data Theft Involving Large Financial Services Company

### 技術資料

- [OWASP：SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) — アプリとネットワークの二層で宛先を制限し、リダイレクトによる検証回避を防ぐ考え方。
- [米司法省：Capital One事案の発表](https://www.justice.gov/usao-wdwa/pr/seattle-tech-worker-arrested-data-theft-involving-large-financial-services-company) — 2019年の公表内容と当時の告訴資料への公式リンク。
- [米司法省：当時の告訴状（PDF）](https://www.justice.gov/usao-wdwa/press-release/file/1188626/dl?inline=) — 設定不備のWAFを通じたアクセスと、取得操作のログ照合を記す一次資料。
- [AWS：Instance Metadata Service](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html) — IMDSv2のセッションとトークンを学ぶ別構成の発展資料。本演習はIMDSを再現しない。

## 09. 不正アップロードと実行痕跡

### 関連する事案の一次資料

- [2021年のExchange侵害後のWebシェル配置（2021）](https://www.microsoft.com/en-us/security/blog/2021/03/02/hafnium-targeting-exchange-servers/) — HAFNIUM targeting Exchange Servers with 0-day exploits

### 技術資料

- [OWASP：File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — 種類の検証、サーバー側の命名、保存場所と権限を組み合わせた対策。
- [Microsoft：HAFNIUMとExchange侵害](https://www.microsoft.com/en-us/security/blog/2021/03/02/hafnium-targeting-exchange-servers/) — 2021年の脆弱性悪用後のWebシェル配置と調査を説明する一次資料。
- [OWASP：PHP Configuration Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/PHP_Configuration_Cheat_Sheet.html) — PHPのアップロード処理・実行処理・設定を安全に分離するための発展資料。

## 10. ログ改変と独立監査の照合

### 関連する事案の一次資料

- [Pulse Secure VPN侵害で報告されたTHINBLOOD（2021）](https://cloud.google.com/blog/topics/threat-intelligence/suspected-apt-actors-leverage-bypass-techniques-pulse-secure-zero-day) — Check Your Pulse: Suspected APT Actors Leverage Authentication Bypass Techniques and Pulse Secure Zero-Day

### 技術資料

- [Mandiant：Pulse Secure侵害の調査報告](https://cloud.google.com/blog/topics/threat-intelligence/suspected-apt-actors-leverage-bypass-techniques-pulse-secure-zero-day) — 2021年の調査とTHINBLOODによるログ消去を記す調査当事者の一次資料。
- [OWASP：Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) — ログの改変検知、保存・転送・アクセス保護、独立収集と監視の考え方。
- [Red Hat：RHEL Audit System Reference](https://access.redhat.com/articles/4409591) — auid・euid・pid・ppid等の正式な意味。本教材の監査は読みやすく正規化した形式。
