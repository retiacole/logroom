/* Verified primary-source learning notes. Load after case-context.js. */
(() => {
  'use strict';
  const OW='https://cheatsheetseries.owasp.org/cheatsheets/';
  const apache='https://httpd.apache.org/security/vulnerabilities_24.html';
  const midnight='https://www.microsoft.com/en-us/security/blog/2024/01/25/midnight-blizzard-guidance-for-responders-on-nation-state-attack/';
  const capital='https://www.justice.gov/usao-wdwa/pr/seattle-tech-worker-arrested-data-theft-involving-large-financial-services-company';
  const complaint='https://www.justice.gov/usao-wdwa/press-release/file/1188626/dl?inline=';
  const exchange='https://www.microsoft.com/en-us/security/blog/2021/03/02/hafnium-targeting-exchange-servers/';
  const pulse='https://cloud.google.com/blog/topics/threat-intelligence/suspected-apt-actors-leverage-bypass-techniques-pulse-secure-zero-day';
  const notes={
    pathtraversal:{
      knowledge:[
        {title:'表記されたパスと解決されたパス',detail:'パストラバーサルは、利用者が指定した相対パス等が、意図した保存領域の外へ解決される問題です。URL上の表記、アプリが解決した絶対パス、許可ルートを別々に確認します。単に記号を探すだけでなく、正規化後の参照先が許可範囲に収まるかを読むと、正規入口と旧式入口の違いを説明できます。'},
        {title:'HTTP・アプリ・OSで観測対象が異なる',detail:'HTTPは要求と応答、アプリ監査は機能の判定、OS監査はファイル操作の結果を記録します。同じrequest_idで結び、参照先、成功・拒否・不存在、読取量を照合してください。200という数字だけでは、意図したファイルを読んだかや、その内容を利用者へ返した範囲までは確定できません。'},
        {title:'要求数と成功した読取数を分ける',detail:'集計前に、送信元と要求IDの範囲、数えるイベント種別を決めます。HTTP要求数にOSのread行や同一イベントのJSONL表示を足すと、回数を過大評価します。拒否や不存在の記録を成功と分け、OS主体も読むことで、外部の要求元とサーバー上でファイルを扱ったユーザーを区別できます。'}
      ],
      history:[{title:'Apache HTTP Serverのパス正規化脆弱性',year:2021,detail:'Apacheは2021年、2.4.49のパス正規化の変更に由来する問題をCVE-2021-41773として公表しました。2.4.50の修正が不十分だった問題はCVE-2021-42013となり、2.4.51で修正されています。公式情報は、対象外ディレクトリへのアクセス制限やCGI設定などの条件によって影響が変わることも説明しています。',url:apache,sourceTitle:'Apache HTTP Server 2.4 vulnerabilities',relation:'同じパストラバーサルという仕組みを学ぶ参考です。本演習は独自のダウンロード機能の合成ログであり、このApacheの実装・バージョン・CGI実行を再現したものではありません。'}],
      references:[
        {title:'OWASP：Path Traversal',url:'https://community.owasp.org/attacks/Path_Traversal',description:'パスの解釈、正規化、許可範囲の制限を学ぶ基本資料。'},
        {title:'Apache：2021年の脆弱性情報',url:apache,description:'CVE-2021-41773とCVE-2021-42013の影響範囲・修正・設定条件を確認する一次資料。'},
        {title:'Apache：Access Control',url:'https://httpd.apache.org/docs/2.4/howto/access.html',description:'Webサーバー側の許可・拒否の考え方を学ぶ公式文書。演習のサーバー製品を示す資料ではない。'}
      ]
    },
    webauth:{
      knowledge:[
        {title:'認証成功から操作成功へ証拠をつなぐ',detail:'認証はアカウントへのログイン判定で、認証後の業務操作をすべて証明するものではありません。認証監査、セッションの発行・検証・失効、リソースの操作結果を時系列で結びます。要求ごとに変わるIDと、複数要求をまたぐセッションの照合値を使い分けると、実際に確認できた利用範囲を区切れます。'},
        {title:'試行の形から手法を断定しない',detail:'失敗回数、対象名の種類、成功数を別に集計し、時間と送信元も合わせて比較します。同じパスワードを多数の名前へ試す方式と、漏えい済みの組合せを試す方式は異なりますが、本教材には試した秘密値がありません。複数名への失敗だけで特定方式と断定せず、通常の入力ミスや共有IPも考慮します。'},
        {title:'MFAの観測範囲とセッションの保護',detail:'mfa_usedは当該イベントで追加認証を使ったかを示し、アカウント全体のMFA設定や他のログインを示しません。また、本教材のsession_idは架空の照合ラベルです。実運用では認証に再利用できる生のセッション値をログへ残さず、保護されたハッシュ等の照合値でライフサイクルを追跡します。'}
      ],
      history:[{title:'Microsoftが公表したMidnight Blizzardの認証侵害',year:2024,detail:'Microsoftの2024年1月25日の調査報告は、MFAが有効でなかった旧い非本番テストテナントのアカウントがpassword sprayで侵害されたと説明しています。その後はOAuthアプリの権限を悪用したメールアクセスへ展開しており、初期認証だけを見て調査を止めない重要性が分かります。',url:midnight,sourceTitle:'Midnight Blizzard: Guidance for responders on nation-state attack',relation:'認証試行と認証後の活動を関連付ける学習参考です。実事案はクラウドIDとOAuthの侵害であり、本演習の一般的なWebセッションとは構成が異なります。本演習のログだけでpassword sprayを証明することもできません。'}],
      references:[
        {title:'OWASP：Authentication Cheat Sheet',url:OW+'Authentication_Cheat_Sheet.html',description:'認証方式、試行制限、MFA、認証機能の監視を整理する資料。'},
        {title:'OWASP：Session Management Cheat Sheet',url:OW+'Session_Management_Cheat_Sheet.html',description:'セッションの生成・利用・失効と、安全な照合値の記録を学ぶ資料。'},
        {title:'Microsoft：Midnight Blizzard調査報告',url:midnight,description:'2024年公表の初期認証とOAuth悪用を説明する当事者の一次資料。'}
      ]
    },
    ssrf:{
      knowledge:[
        {title:'要求した利用者と通信したサーバー',detail:'SSRFは、外部からの入力等によりサーバー自身が意図しない宛先へ要求を行う問題です。利用者向けアクセスログの送信元と、外向き通信ログのsrc・dstは別の観測です。要求IDで対応付け、どの機械がどの宛先へ接続したかを確認しないと、利用者が内部へ直接接続したと誤読してしまいます。'},
        {title:'初期URLだけで接続先を決めない',detail:'URL取得では、最初のホストが許可対象でも、リダイレクトで接続先が変わる場合があります。初期URL、転送の応答、location、最終URL、実際の接続先IPを順に照合します。一つの利用者要求が複数の外向き通信になるため、要求数と接続試行数を分け、各段階で宛先制限が働くかを調べます。'},
        {title:'取得結果と情報の機密性を区別する',detail:'利用者向けHTTP 200は、代理取得の成功と一致するとは限りません。アプリの処理結果、外向き通信の成功・タイムアウト、取得バイト数を照合します。内部応答を取得した事実が分かっても、本文がない本教材から秘密情報や認証情報の取得までは判断できず、業務上の許可や応答内容の追加確認が必要です。'}
      ],
      history:[{title:'Capital Oneの2019年データアクセス事案',year:2019,detail:'米司法省が2019年7月に公表したCapital One事案の資料は、設定不備のWebアプリケーションファイアウォールを通じたデータアクセスを説明しています。添付の当時の告訴状には、クラウドの認証情報やデータ取得に関する記録と、ログの時刻等を照合した記述があります。訴追時の資料として、その記載範囲を確認します。',url:capital,sourceTitle:'DOJ: Seattle Tech Worker Arrested for Data Theft Involving Large Financial Services Company',relation:'サーバー経由のアクセスがクラウド資源へ影響した歴史的事案を学ぶ参考です。引用した司法省発表が本演習と同じリダイレクトSSRFを立証するわけではありません。本演習にはクラウドメタデータや認証情報の取得はありません。'}],
      references:[
        {title:'OWASP：SSRF Prevention Cheat Sheet',url:OW+'Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html',description:'アプリとネットワークの二層で宛先を制限し、リダイレクトによる検証回避を防ぐ考え方。'},
        {title:'米司法省：Capital One事案の発表',url:capital,description:'2019年の公表内容と当時の告訴資料への公式リンク。'},
        {title:'米司法省：当時の告訴状（PDF）',url:complaint,description:'設定不備のWAFを通じたアクセスと、取得操作のログ照合を記す一次資料。'},
        {title:'AWS：Instance Metadata Service',url:'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html',description:'IMDSv2のセッションとトークンを学ぶ別構成の発展資料。本演習はIMDSを再現しない。'}
      ]
    },
    upload:{
      knowledge:[
        {title:'申告・検出・保存を別々に確認する',detail:'アップロードのContent-Typeやファイル名は利用者の申告であり、それだけを信用できません。拡張子、検出された種類、保存結果、保存後のパスを比較します。一つの検査だけで安全を保証せず、正規入口と旧式入口で判定が違う理由を調べ、拒否された要求と実際に作成されたファイルを区別します。'},
        {title:'要求IDから成果物IDへ照合軸を変える',detail:'アップロード、後の参照、処理は別のHTTP要求なので、request_idは通常それぞれ変わります。サーバー側で付いたfile_idと保存先を使って、作成イベントから利用イベントへつなぎます。利用者が付けた名前だけでは同名の別ファイルを混同しやすく、応答バイト数と保存ファイルのサイズも別に集計します。'},
        {title:'保存されたことと実行されたことは異なる',detail:'保存成功やPHPの拡張子だけでは、OS上でコマンドが実行されたとは言えません。本教材では参照時のハンドラー、独立したexec、同じPIDのexitを照合して確認します。保存主体と実行主体のユーザーも分けます。対策では保存領域を公開・実行処理から隔離し、必要最小限の権限に制限することが基本です。'}
      ],
      history:[{title:'2021年のExchange侵害後のWebシェル配置',year:2021,detail:'Microsoftは2021年3月2日、HAFNIUMがExchange Serverの複数のゼロデイ脆弱性を使って侵入し、その後にWebシェルを配置したと報告しました。公式記事は関連するサーバーログ、ファイルの所在、プロセス等の調査を案内し、初期侵入と後続のサーバー上の処理を分けて確認する材料を示しています。',url:exchange,sourceTitle:'HAFNIUM targeting Exchange Servers with 0-day exploits',relation:'サーバー上に置かれたファイルと後続処理を追う参考事案です。実事案のExchange脆弱性を使う侵入経路は、本演習のアップロード検証不備とは異なり、Windows・ASP系と本教材のPHP系の構成も同じではありません。'}],
      references:[
        {title:'OWASP：File Upload Cheat Sheet',url:OW+'File_Upload_Cheat_Sheet.html',description:'種類の検証、サーバー側の命名、保存場所と権限を組み合わせた対策。'},
        {title:'Microsoft：HAFNIUMとExchange侵害',url:exchange,description:'2021年の脆弱性悪用後のWebシェル配置と調査を説明する一次資料。'},
        {title:'OWASP：PHP Configuration Cheat Sheet',url:OW+'PHP_Configuration_Cheat_Sheet.html',description:'PHPのアップロード処理・実行処理・設定を安全に分離するための発展資料。'}
      ]
    },
    tamper:{
      knowledge:[
        {title:'ログの欠落を原因の証明と取り違えない',detail:'ローカルのログが短くても、直ちに攻撃による消去とは言えません。ローテーション、保持期間、収集障害、参照先の違いも候補です。正常スナップショットと別収集先で同じ要求を照合し、さらにファイル操作監査の結果と変更前後のサイズを確認すると、欠落した事実と変更操作の根拠を分けて説明できます。'},
        {title:'ログイン主体・実効権限・プロセスを結ぶ',detail:'Linux監査のauidは元のログイン主体の識別に使われ、euidは操作時の実効ユーザーを示します。権限を切り替えると両者が異なるため、rootという値だけで操作主体を決めません。sudoの記録、PIDと親PID、監査識別子、時刻を合わせて読み、SSH送信元から実在人物を特定したかのような結論も避けます。'},
        {title:'独立した収集先と監査の保護',detail:'同じホストにだけ残すログは、そのホストの権限を奪われた際に一緒に改変されるおそれがあります。独立した収集先、アクセス制御、改変検知、保全方法を組み合わせます。別保存先に残る要求数とローカルの要求数を比較し、同じイベントのテキスト版とJSONL版は二重に数えないことが調査の基本です。'}
      ],
      history:[{title:'Pulse Secure VPN侵害で報告されたTHINBLOOD',year:2021,detail:'Mandiantは2021年4月20日、Pulse Secure VPN装置の複数の侵害調査を公表し、関連ログを条件に応じて消すTHINBLOODを報告しました。報告は、すべての侵入経路やマルウェアの帰属を確定できていたわけではないことも明記しています。単独の痕跡で攻撃者や全体像を決めず、独立した記録を照合する参考になります。',url:pulse,sourceTitle:'Check Your Pulse: Suspected APT Actors Leverage Authentication Bypass Techniques and Pulse Secure Zero-Day',relation:'侵害後のログ改変が実際に報告された事例です。VPN装置での選択的なログ消去と、本教材のLinuxアクセスログの短縮では侵入経路・対象・操作方法が異なります。同じ道具や攻撃者の活動を再現するものではありません。'}],
      references:[
        {title:'Mandiant：Pulse Secure侵害の調査報告',url:pulse,description:'2021年の調査とTHINBLOODによるログ消去を記す調査当事者の一次資料。'},
        {title:'OWASP：Logging Cheat Sheet',url:OW+'Logging_Cheat_Sheet.html',description:'ログの改変検知、保存・転送・アクセス保護、独立収集と監視の考え方。'},
        {title:'Red Hat：RHEL Audit System Reference',url:'https://access.redhat.com/articles/4409591',description:'auid・euid・pid・ppid等の正式な意味。本教材の監査は読みやすく正規化した形式。'}
      ]
    }
  };
  for(const item of globalThis.LOG_LAB_CASES||[])if(notes[item.id])item.debrief={...(item.debrief||{}),...notes[item.id]};
})();
