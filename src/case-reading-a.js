/* Primary-source reading notes for the first five cases. Load after case-context.js.
 * Verified by opening the linked sources on 2026-10-20. These are static strings;
 * this module performs no network requests. Historical examples are comparisons,
 * not claims that the synthetic cases reproduce those incidents or products.
 */
(() => {
  'use strict';
  const readings = {
    ssh: {
      knowledge: [
        { title: 'SSHの認証方式と認証結果', detail: 'SSHではパスワード認証と公開鍵認証などを区別します。認証に成功した記録は、その方式でアカウントへのアクセスが許可された観測です。送信元IPだけで操作した人物を特定したり、成功をすべて不正と決めたりせず、普段の方式・端末・時間帯と比較します。' },
        { title: '認証、セッション、sudoを別のイベントとして読む', detail: '認証結果、セッションの開始・終了、sudoのCOMMANDは記録の単位が異なります。この教材のsudo行では実行者とUSERで指定された実行権限を分けて読みます。コマンドが記録されたことから、そのサービスの再起動完了や後の正常稼働までは断定できません。' },
        { title: '集計前にログの形と母集団を確かめる', detail: '認証ログの保存先は設定によりauth.log、secure、journal等に分かれます。従来型syslogは年とタイムゾーンを省略し、PID付き・なしのタグも混在し得ます。この教材ではinvalid userの有無でユーザー名やIPまでの列位置が変わります。まず認証失敗だけを抽出してから、対象名と送信元を集計します。同じIPから複数の名前への試行は探索の手掛かりですが、件数だけではパスワード漏えいや侵入成功の証拠にはなりません。' }
      ],
      history: [{
        title: 'Mirai亜種によるSSH認証試行の分析', year: 2021,
        detail: 'Unit 42は2021年に観測したMirai系の活動を分析し、ハードコードされた認証情報などを使うSSH接続のブルートフォース機能を報告しました。弱い認証情報への試行が、別の侵入経路と併用される例として読めます。',
        url: 'https://unit42.paloaltonetworks.com/mirai-variant-iot-vulnerabilities/',
        sourceTitle: 'Unit 42: Mirai Variant Targeting New IoT Vulnerabilities, Network Security Devices',
        relation: 'SSHへの認証試行という仕組みを比較する参考です。この演習はMirai感染やボットネットを再現せず、同じ攻撃者・被害組織・認証情報を示すものでもありません。'
      }],
      references: [
        { title: 'RFC 4252 — SSH Authentication Protocol', url: 'https://www.rfc-editor.org/rfc/rfc4252.html', description: '公開鍵・パスワードなどの認証方式と、認証要求の成功・失敗を定めた一次仕様です。' },
        { title: 'OpenSSH sshd_config(5)', url: 'https://man.openbsd.org/sshd_config', description: 'AuthenticationMethods、PasswordAuthentication、PubkeyAuthenticationなど、認証設定の意味を確認できます。教材内のサーバー設定を示す資料ではありません。' },
        { title: 'Unit 42 — Mirai亜種とSSHの認証試行（2021）', url: 'https://unit42.paloaltonetworks.com/mirai-variant-iot-vulnerabilities/', description: '実際に分析した研究者による報告です。SSHへの試行を扱う箇所を、教材との共通点と相違点に注目して読めます。' }
      ]
    },
    web: {
      knowledge: [
        { title: 'HTTPアクセスログと業務結果の違い', detail: 'Nginxのcombined形式では要求、ステータス、応答本文のバイト数などを記録します。本文サイズはCSVの行数ではなく、HTTP 200も業務操作の成功すべてを保証しません。標準combinedにrequest_idはなく、カスタムlog_formatとアプリへのID受け渡し・監査記録が必要です。教材のreq-…は可読な固定値で、Nginxの$request_idが生成する32桁の16進文字列とは表記が異なります。この教材で追加したrequest_idを使い、アプリ側の操作名・処理結果・件数と照合します。' },
        { title: '認証と認可を分けて確認する', detail: '認証はアカウントの本人性を確認し、認可はその主体に個々の操作を許すか判断します。ログインに成功しても、すべてのデータへアクセスできるわけではありません。出力対象ごとの成功・拒否を、同じアカウントと送信元の記録で分けて確認します。' },
        { title: '要求IDは照合の鍵であり、証拠の代わりではない', detail: 'アプリの要求IDは一つの操作に伴う複数イベントを結び付けるための情報です。IDだけに頼らず、時刻、処理対象、送信元、アカウントも整合するか確かめます。アクセスログと監査ログは同じ要求の別観測なので、両方の行数を足して要求数にはしません。' }
      ],
      history: [{
        title: 'Confluenceのアクセス制御不備 CVE-2023-22515', year: 2023,
        detail: 'Atlassianは2023年10月、Confluence Data Center／Serverのアクセス制御不備を公表しました。不正な管理者アカウントの作成やアクセスが報告され、監査では想定外のアカウントやアクセス記録などの確認が案内されました。',
        url: 'https://confluence.atlassian.com/security/data-center-and-server-1295682276.html',
        sourceTitle: 'Atlassian: CVE-2023-22515 — Broken Access Control Vulnerability in Confluence Data Center and Server',
        relation: '認証状態やHTTP結果だけで権限の妥当性を判断しないための関連事例です。教材はConfluence製品やこのCVEの再現ではなく、CSV出力との具体的な攻撃経路も異なります。'
      }],
      references: [
        { title: 'Nginx — ngx_http_log_module', url: 'https://nginx.org/en/docs/http/ngx_http_log_module.html', description: 'log_formatと標準combined形式を確認できます。本文バイト数と要求・ステータスの位置を読む基礎資料です。' },
        { title: 'OWASP — Logging Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html', description: 'いつ・どこで・誰が・何をしたかの記録と、Interaction identifierによるイベントの照合を解説しています。' },
        { title: 'OWASP — Authorization Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html', description: '認証と認可の違い、最小権限、要求ごとの権限確認を学べます。' },
        { title: 'Atlassian — CVE-2023-22515公式勧告', url: 'https://confluence.atlassian.com/security/data-center-and-server-1295682276.html', description: '2023年に公表されたアクセス制御不備の製品公式資料です。教材と実製品の条件を混同せず読んでください。' }
      ]
    },
    egress: {
      knowledge: [
        { title: '名前解決と接続は異なる観測', detail: 'DNSは名前からアドレスなどの資源情報を調べる仕組みです。A回答を得ても、その後の接続や送信が成功したとは限りません。ホスト名にはメール中継用など異なる役割があるため、問い合わせ名を完全に確認し、プロキシや配送ログの実際の通信先と照合します。' },
        { title: 'SMTP受付とメールの読了は異なる', detail: 'SMTPでは受信側がメールデータに成功応答を返すと、配送または中継の責任を引き受けます。教材のstatus=sentと250応答はこの受付を裏付けますが、人が読んだ証拠ではありません。キューIDで受付・宛先・配送を追い、認証ユーザーとFromアドレスも分けて読みます。' },
        { title: '通信量は向き、単位、対象をそろえて集計する', detail: 'この教材独自のプロキシ正規化形式ではbytes_outは端末から外向き、bytes_inは応答側のHTTPメッセージのバイト数（本文＋HTTPヘッダー、TLS/TCP/IP分は除外）です。Squid等の標準形式の定義と同一とは限りません。対象端末・ホスト・メソッド・パスをそろえてから合計し、メール全体のsizeや別のGETを混ぜません。転送量の増加は調査のきっかけですが、内容がないログだけでは機密情報の流出やその業務上の妥当性を確定できません。' }
      ],
      history: [{
        title: 'SolarWinds SUNBURSTのDNS・HTTP通信分析', year: 2020,
        detail: 'FireEyeは2020年12月、SolarWinds Orionの更新に混入したSUNBURSTを公表しました。分析ではDNSの応答と、その後のHTTP通信を関連付けて挙動を説明しています。通常の製品通信に似せた通信も、文脈を合わせて調べる必要があります。',
        url: 'https://cloud.google.com/blog/topics/threat-intelligence/evasive-attacker-leverages-solarwinds-supply-chain-compromises-with-sunburst-backdoor',
        sourceTitle: 'FireEye／Mandiant: Highly Evasive Attacker Leverages SolarWinds Supply Chain to Compromise Multiple Global Victims With SUNBURST Backdoor',
        relation: '複数の通信ログを横断する分析の参考です。教材はSUNBURSTのC2やサプライチェーン侵害を再現せず、メール配送やアップロードのイベントも実事件の再現ではありません。'
      }],
      references: [
        { title: 'RFC 1034 — Domain Names: Concepts and Facilities', url: 'https://www.rfc-editor.org/rfc/rfc1034.html', description: 'DNSの名前空間、資源レコード、問い合わせと名前解決の基本を定めた一次仕様です。' },
        { title: 'RFC 5321 — SMTP', url: 'https://www.rfc-editor.org/rfc/rfc5321.html', description: 'SMTPの応答と配送責任を確認できます。特に4.2.5節と6.1節が、成功応答の意味を考える参考になります。' },
        { title: 'FireEye／Mandiant — SUNBURST初期分析（2020）', url: 'https://cloud.google.com/blog/topics/threat-intelligence/evasive-attacker-leverages-solarwinds-supply-chain-compromises-with-sunburst-backdoor', description: '発見・分析した研究者の報告です。DNSとHTTPのつながりや、通信の文脈を調べる観点を学べます。' }
      ]
    },
    sqli: {
      knowledge: [
        { title: 'パラメータ化はSQLの構造と値を分ける', detail: 'SQLインジェクションは、外部入力が値の範囲を越えて問い合わせの構造へ影響する問題です。パラメータ化ではSQLの構造と後から渡す値を分離します。アポストロフィは正当な名前にも含まれるため、文字の検出だけで判断せず、構造の変化や処理結果を確認します。' },
        { title: 'アプリの利用者とDB接続ユーザーは別の主体', detail: 'アプリのactorはサービスを利用する主体で、app_userはDBへ接続した主体です。複数の利用者の要求を同じDBユーザーで処理する構成もあります。接続ユーザー名が読み取り専用を連想させても、それだけで実際の付与権限を確定せず、監査と権限設定を別に確認します。' },
        { title: 'エラー、構造、参照量、返却量を分ける', detail: '構文エラーは不正な入力の試行を示すことがありますが、取得成功の証拠にはなりません。この教材では通常の期待件数と、構造の変化、DB参照行数、アプリ返却行数を照合します。これらは教材用の監査項目で、実製品の標準ログに同名の項目が常にあるわけではありません。' }
      ],
      history: [{
        title: 'MOVEit TransferのSQLインジェクション CVE-2023-34362', year: 2023,
        detail: 'FBIとCISAは2023年6月、MOVEit TransferのSQLインジェクション脆弱性CVE-2023-34362の悪用を報告しました。勧告は2023年5月からの活動と、公開Webアプリへの不正なアクセスに関する調査情報をまとめています。',
        url: 'https://www.ic3.gov/CSA/2023/230607.pdf',
        sourceTitle: 'FBI／CISA AA23-158A: CL0P Ransomware Gang Exploits CVE-2023-34362 MOVEit Vulnerability',
        relation: 'SQLインジェクションが実製品の情報への不正アクセスにつながる関連事例です。教材の検索サービス、2400行、クエリ形状の監査は架空で、MOVEitの内部処理や実被害件数を示しません。'
      }],
      references: [
        { title: 'OWASP — SQL Injection Prevention Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html', description: 'コードと値を分離するパラメータ化、入力検証、最小権限などの基本原理を確認できます。' },
        { title: 'PostgreSQL — PREPARE', url: 'https://www.postgresql.org/docs/current/sql-prepare.html', description: '準備した文とパラメータを扱う実製品の公式説明です。教材のDB製品がPostgreSQLであることを意味しません。' },
        { title: 'FBI／CISA — MOVEit脆弱性の共同勧告（PDF）', url: 'https://www.ic3.gov/CSA/2023/230607.pdf', description: '2023年のCVE-2023-34362悪用を扱う政府機関の一次報告です。教材とは異なる製品・時期の資料として読めます。' },
        { title: 'Progress — MOVEit製品のセキュリティ対応（2023）', url: 'https://www.progress.com/blogs/working-enhance-security-moveit-transfer-products-through-partnership-transparency', description: '製品ベンダーによる当時の対応説明です。5月31日のCVE-2023-34362と、後から判明した別の脆弱性の区別も確認できます。' }
      ]
    },
    cmdinj: {
      knowledge: [
        { title: 'OSコマンドと引数の境界', detail: '外部入力をシェル用の文字列へ連結すると、入力の一部が構文として解釈される危険があります。OSコマンドを避けられる専用ライブラリを優先し、必要な場合も引数を分離して許可する値を検証します。シェル記号への対処だけでは、危険な追加引数まで防げるとは限りません。' },
        { title: '要求IDとPID・PPIDで親子関係を結ぶ', detail: 'request_idはアプリ要求を、pidはプロセスを、ppidはその親を識別するための情報です。この教材では同じホストと時刻の範囲で照合し、通常の診断処理と予期しない子プロセスを分けます。実環境ではPIDの再利用や名前空間もあるため、番号の一致だけで別の期間まで結び付けません。' },
        { title: '起動と終了、実行権限は別に確認する', detail: '起動の記録だけでは処理が完了したか分かりません。同じpidの終了記録と状態を確認し、さらにuserや出力と照合します。終了コード0も後続の全処理の成功を保証しません。この演習のdiag-webでの実行記録から、root権限の取得や別ファイルの改変まで結論を広げないようにします。' }
      ],
      history: [{
        title: 'PAN-OS GlobalProtectのOSコマンド注入 CVE-2024-3400', year: 2024,
        detail: 'Palo Alto Networksは2024年4月、GlobalProtectにおける任意ファイル作成を経由したOSコマンド注入の脆弱性を公表しました。特定のPAN-OSバージョンと構成で、認証前の外部利用者がroot権限のコード実行に至り得ると説明しています。',
        url: 'https://security.paloaltonetworks.com/CVE-2024-3400',
        sourceTitle: 'Palo Alto Networks: CVE-2024-3400 — Arbitrary File Creation Leads to OS Command Injection Vulnerability in GlobalProtect',
        relation: 'OSコマンド注入と実行権限の影響を考える関連事例です。診断APIの入力を使う本演習とは侵入経路も権限も異なり、PAN-OSの脆弱性を再現していません。'
      }],
      references: [
        { title: 'OWASP — OS Command Injection Defense Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html', description: 'OSコマンド呼び出しの回避、データと命令の分離、引数の検証という防御の原理を学べます。' },
        { title: 'Linux man-pages — getpid(2)', url: 'https://man7.org/linux/man-pages/man2/getpid.2.html', description: 'PIDと親PIDの意味を確認する、Linux man-pagesプロジェクトの一次マニュアルです。' },
        { title: 'Linux man-pages — wait(2) / waitpid(2)', url: 'https://man7.org/linux/man-pages/man2/waitpid.2.html', description: '子プロセスの状態と終了状態の読み方を確認できます。教材の正規化ログそのものの仕様ではありません。' },
        { title: 'Palo Alto Networks — CVE-2024-3400公式勧告', url: 'https://security.paloaltonetworks.com/CVE-2024-3400', description: '2024年のGlobalProtectの問題について、原因の分類、対象条件、影響を確認できる製品公式資料です。' }
      ]
    }
  };
  for (const [id, reading] of Object.entries(readings)) {
    const item = (globalThis.LOG_LAB_CASES || []).find(c => c.id === id);
    if (!item || !item.debrief) throw new Error('case-reading-a.js requires case-context.js first: '+id);
    Object.assign(item.debrief, reading);
  }
})();
