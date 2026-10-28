/* Additional fictional, static investigations. Load after cases.js. */
(() => {
  'use strict';
  const A='/var/log/nginx/access.log', J='/var/log/app/audit.jsonl', T='/var/log/app/audit.log';
  const txt=a=>a.join('\n')+'\n';
  const iso=(h,m=0,s=0)=>new Date(Date.UTC(2026,7,12,h,m,s)).toISOString().replace('.000Z','Z');
  const http=(at,ip,url,status,bytes,id,method='GET')=>ip+' - - [12/Aug/2026:'+at.slice(11,19)+' +0000] "'+method+' '+url+' HTTP/1.1" '+status+' '+bytes+' "-" "LabBrowser/1.0" request_id='+id;
  const pair=(s,at,fields)=>{s.t.push(at+' '+s.host+' app_audit '+Object.entries(fields).map(([k,v])=>k+'='+String(v)).join(' '));s.j.push(JSON.stringify({timestamp:at,host:s.host,...fields}));};
  // Each business request is observed consistently by HTTP, application and service logs.
  const base=(id,host,h,path)=>{
    const s={id,host,h,path,a:[],t:[],j:[],x:[]};
    const prefix={pathtraversal:'path',webauth:'wa',ssrf:'ssrf',upload:'up',tamper:'edge'}[id];
    for(let i=0;i<60;i++){
      const at=iso(h,Math.floor(i*5/60),i*5%60),rid='req-'+prefix+'-'+(100+i),ip='192.0.2.20';
      if(i%5!==0 && !(id==='webauth'&&i===59)){
        const route=[['/',1824],['/health',32],['/assets/app.js',14852]][i%3];
        s.a.push(http(at,ip,route[0],200,route[1],rid));continue;
      }
      const n=Math.floor(i/5);
      if(id==='pathtraversal'){
        const [name,bytes]=[['manual.pdf',24576],['schedule.csv',1536],['handbook.pdf',36864]][n%3],resolved='/srv/downloads/'+name;
        event(s,at,ip,'/download?file='+name,200,bytes,rid,{action:'file_read',result:'success',handler:'validated',allowed_root:'/srv/downloads',resolved_path:resolved,read_bytes:bytes});
        line(s,at,'fs_audit event=read user=download-web path='+resolved+' result=success bytes='+bytes+' request_id='+rid);
      }else if(id==='webauth'){
        const common={actor:'staff-a',session_id:'sess-staff-a'};
        if(i===0){
          event(s,at,ip,'/login',302,145,rid,{action:'login',result:'success',...common,mfa_used:true},'POST');
          line(s,at,'session_audit event=issue session_id=sess-staff-a actor=staff-a client_ip='+ip+' result=success request_id='+rid);
        }else if(i===59){
          event(s,at,ip,'/logout',302,145,rid,{action:'logout',result:'success',...common,revoked:true},'POST');
          line(s,at,'session_audit event=revoke session_id=sess-staff-a actor=staff-a result=success request_id='+rid);
        }else{
          const rows=[12,8,15][n%3],bytes=[3210,2418,4096][n%3];
          event(s,at,ip,'/reports/team?period=august',200,bytes,rid,{action:'report_view',result:'success',...common,resource:'/reports/team',rows});
          line(s,at,'session_audit event=validate session_id=sess-staff-a actor=staff-a client_ip='+ip+' result=success request_id='+rid);
        }
      }else if(id==='ssrf'){
        const page=['guide','faq','release-notes'][n%3],url='https://docs.vendor.example/'+page,bytes=[1024,768,1536][n%3];
        event(s,at,ip,'/preview?url='+encodeURIComponent(url),200,bytes,rid,{action:'url_fetch',result:'success',initial_url:url,final_url:url,redirects:0,bytes});
        line(s,at,'egress_audit src=192.0.2.60 dst=198.51.100.40 host=docs.vendor.example status=200 bytes='+bytes+' result=success request_id='+rid);
      }else if(id==='upload'){
        const fileId='f-'+(101+Math.floor(n/2)),stored='/srv/www/uploads/'+fileId+'.png',bytes=[2048,4096,3072][Math.floor(n/2)%3];
        if(n%2===0){
          event(s,at,ip,'/upload',201,80,rid,{action:'upload',result:'stored',handler:'validated',filename:'team-photo.png',declared_type:'image/png',detected_type:'image/png',file_id:fileId,stored_path:stored,bytes},'POST');
          line(s,at,'artifact_audit event=create path='+stored+' file_id='+fileId+' user=media-web bytes='+bytes+' result=success request_id='+rid);
        }else{
          event(s,at,ip,'/uploads/'+fileId+'.png',200,bytes,rid,{action:'artifact_view',result:'completed',file_id:fileId,path:stored,handler:'static'});
          line(s,at,'artifact_audit event=read path='+stored+' file_id='+fileId+' user=www-data bytes='+bytes+' result=success request_id='+rid);
        }
      }else{
        event(s,at,ip,'/reports/daily',200,3210,rid,{action:'page_view',result:'success',actor:'staff-a',resource:'/reports/daily'});
      }
    }
    return s;
  };
  const logs=s=>({[A]:txt(s.a),[T]:txt(s.t),[J]:txt(s.j),[s.path]:txt(s.x)});
  const line=(s,at,rest)=>s.x.push(at+' '+s.host+' '+rest);
  const event=(s,at,ip,url,status,bytes,id,fields,method)=>{s.a.push(http(at,ip,url,status,bytes,id,method));pair(s,at,{...fields,src_ip:ip,request_id:id});};
  const readme=(title,paths,before)=>txt([title,'','組織・人物・通信・ログはすべて架空です。実行や外部通信は行いません。','日付は2026年8月12日、全時刻はUTCです。IPとドメインは文書・テスト用です。',before?'現在は正常状態です。画面の攻撃ボタンで合成イベントを加えた状態に切り替えます。':'攻撃後の静的ログです。HTTP結果だけで成功と決めず、別の監査記録を照合してください。','audit.logとaudit.jsonlは同じイベントのテキスト表示とJSON Lines表示です。','他の監査・通信ログは別の観測記録です。すべて教材用に正規化されています。','正常ログの保存先は /baseline 以下の同じ絶対パスです。diffで比較できます。','Nginxはcombinedにrequest_idを追加したカスタムlog_formatです。標準combinedにはrequest_idがなく、実運用では$request_idの記録、proxy_set_header X-Request-ID $request_id等によるアプリへの引き継ぎ、アプリ監査への記録が必要です。教材のreq-…は可読な固定IDで、Nginxの32桁の16進IDとは表記が異なります。','','調査対象:',...paths,'','使える操作はhelpで確認できます。']);
  const build=(s,title,summary,baseline,attackLabel,briefing)=>{
    const full=logs(s),paths=Object.keys(full),c={id:s.id,title,shortTitle:title,level:'中級',minutes:30,summary,briefing:['2026年8月12日。全時刻はUTCです。全データは静的な架空ログです。',...briefing],files:{...full,'/etc/hostname':s.host+'\n','/home/analyst/README.txt':readme(title,paths,false)},baselineFiles:{...baseline,'/etc/hostname':s.host+'\n','/home/analyst/README.txt':readme(title,paths,true)},attack:{label:attackLabel,summary},logPaths:paths,tasks:[],walkthrough:[],initialCommand:'cat /home/analyst/README.txt',clockNote:'時刻はUTC（Z / +0000）。日本時間は+9時間。'};
    c._e=(p,needle)=>{const a=c.files[p].trimEnd().split('\n'),i=a.findIndex(x=>x.includes(needle));if(i<0)throw Error('missing evidence '+s.id+':'+needle);return{path:p,line:i+1,quote:a[i]};};return c;
  };
  const teaching={
    "pathtraversal": [
      [
        "URL内の相対移動を含む要求を探し、行頭のIPを比較します。",
        "IPを重複排除し、アプリ監査のsrc_ipでも確かめます。",
        "通常の資料要求も同じ形式のIDを使うため、ID名ではなく要求内容から調査範囲を決めます。"
      ],
      [
        "file_readのallowed_rootとresolved_pathを並べて読みます。",
        "正常ダウンロードにも同じallowed_rootがあるか比較します。",
        "allowed_rootは利用者の入力や参照先そのものではなく、許可範囲を示します。"
      ],
      [
        "通常の公開資料と異なる成功readのpathを探します。",
        "調査対象の送信元で絞り、resolved_pathをOSのpathと照合します。",
        "通常資料のread成功もあるため、成功という条件だけでは対象を一意に決められません。"
      ],
      [
        "対象ファイルのread記録でbytesを確認します。",
        "同じ要求のアプリread_bytesと一致するか照合します。",
        "応答サイズと読取量は一般には同一ではないため、OSのbytesを回答の根拠にします。"
      ],
      [
        "read成功行のuserフィールドを探します。",
        "列を取り出す前に、user=が何列目か実際の行で確認します。",
        "このユーザーの権限でサーバーが読んだことを示し、遠隔の利用者名までは分かりません。"
      ],
      [
        "対象送信元のfile_read成功をアプリ監査から抽出します。",
        "得られたrequest_idでOSのread成功を照合します。",
        "同じIDに加えて、参照パスとバイト数まで一致することが照合の根拠です。"
      ],
      [
        "アプリのreason=outside_rootを探します。",
        "要求IDを読み、アクセスログの拒否応答と照合します。",
        "ログにないOSの拒否を補って推測せず、アプリで観測された拒否として扱います。"
      ],
      [
        "アプリのnot_foundに対応する要求IDを探します。",
        "同じIDのOS行からresult値を読みます。",
        "ENOENTはファイルの不存在を示す結果で、アプリの事前拒否とは処理段階が異なります。"
      ],
      [
        "確認した送信元IPのアクセス行だけを選びます。",
        "wc -lでHTTP要求を数え、監査行を加算しません。",
        "1要求が複数のログへ残るため、調査対象の件数はHTTPの記録単位で数えます。"
      ],
      [
        "調査対象の要求IDに対応するOS行を確認します。",
        "event=readかつresult=successの行だけ数えます。",
        "正常資料の成功readを混ぜず、アプリで拒否された要求をOSの失敗readとしても数えません。"
      ]
    ],
    "webauth": [
      [
        "action=loginの失敗を探して送信元の分布を見ます。",
        "失敗が集中するIPを成功ログインのsrc_ipと比較します。",
        "正常スタッフのログインもあるため、成功行全体ではなく同じ送信元を追います。"
      ],
      [
        "対象IPのaction=loginを選びます。",
        "result=failureを追加し、その行数を数えます。",
        "認証以外の失敗や別の送信元を混ぜず、1監査イベントを1試行として数えます。"
      ],
      [
        "対象IPのloginからactorだけを取り出します。",
        "sortとuniqで名前の重複を除いてから数えます。",
        "同じ名前への再試行は失敗数を増やしますが、名前の種類数は増やしません。"
      ],
      [
        "対象送信元のlogin成功だけを選びます。",
        "actorを読み、同じ要求のevent=issueと照合します。",
        "HTTP 302だけでは認証成功を保証しないため、アプリの判定と発行記録を使います。"
      ],
      [
        "対象のlogin成功行にあるtimestampを読みます。",
        "セッション発行時刻と比較し、UTCの時分秒を答えます。",
        "レポート閲覧やlogoutの時刻ではなく、認証結果を記録した時点です。"
      ],
      [
        "ログイン成功と帳票操作のsession_idを比較します。",
        "session監査でissueとvalidateの両方を探します。",
        "request_idは要求ごとに異なりますが、同一セッションは複数の要求を結びます。"
      ],
      [
        "対象セッションのreport_view成功を探します。",
        "URLのクエリではなく監査のresourceフィールドを読みます。",
        "このパスへの閲覧結果は確認できますが、同アカウントの全アクセス権までは分かりません。"
      ],
      [
        "report_viewのrowsとHTTP応答のbytesを区別します。",
        "JSONLからrowsだけを取り出します。",
        "出力形式やヘッダーで応答量は変わるため、バイト数を行数へ換算しません。"
      ],
      [
        "対象ログイン成功イベントのmfa_usedを探します。",
        "真偽値のfalseと、項目が存在しない場合を区別します。",
        "正常スタッフのmfa_used=trueと比較できますが、どちらも各ログイン時の観測値です。"
      ],
      [
        "対象セッションに絞ってevent=revokeを探します。",
        "アプリのlogout成功と時刻を照合します。",
        "正常スタッフにも失効記録があるため、revokeという条件だけでは対象を特定できません。"
      ]
    ],
    "ssrf": [
      [
        "url_fetchの拒否やエラーを探し、要求元を確認します。",
        "src_ipを取り出し、アクセスログの行頭IPとの比較に使います。",
        "通常プレビューも外向き通信を行うため、通信の存在だけで調査対象とは判断しません。"
      ],
      [
        "reason=destination_policyのアプリイベントを探します。",
        "そのイベントのrequest_idを読みます。",
        "拒否のHTTP応答と、通信ログに対応行がないことを合わせて確認します。"
      ],
      [
        "egressで内部ホストへの成功応答を探します。",
        "同じrequest_idのアプリ結果と取得量を照合します。",
        "要求したURLだけでは接続を証明できず、サーバー側の独立した通信記録が必要です。"
      ],
      [
        "リダイレクト後のegress行でdstを探します。",
        "初期の外部接続先と内部接続先を分けて読みます。",
        "ホスト名とIPは違う識別子なので、final_urlの文字列からIPを推測しません。"
      ],
      [
        "内部宛てegress行のsrcを読みます。",
        "要求元のsrc_ipと値・役割が異なることを確認します。",
        "同じ要求IDでつながっていても、利用者からアプリとアプリから内部宛ては別の通信です。"
      ],
      [
        "result=redirectの通信行を探します。",
        "そのstatusとlocationを続く通信先と比較します。",
        "302は最初の接続の応答であり、内部取得の200や利用者向け200とは別です。"
      ],
      [
        "内部ホストの成功行でbytesを確認します。",
        "アプリの取得結果bytesと一致するか比較します。",
        "転送応答の145バイトは内部サービス本文の取得量には加算しません。"
      ],
      [
        "対象3要求に対応するegressだけを選びます。",
        "1要求に転送前後の複数行がある点を確認して数えます。",
        "これはHTTP要求数や成功数ではなく、通信監査に残った試行の件数です。"
      ],
      [
        "対象のアプリ監査でresultを比較します。",
        "result=successだけを数え、HTTPの200を代用しません。",
        "タイムアウト要求のフロント応答が200でも、取得した本文は0バイトです。"
      ],
      [
        "取得成功イベントのinitial_urlとfinal_urlを比較します。",
        "scheme・host・pathを含むfinal_url全文を取り出します。",
        "最終URLの確認で到達先は分かりますが、取得内容の機密性はログからは分かりません。"
      ]
    ],
    "upload": [
      [
        "uploadの拒否イベントから送信元を調べます。",
        "拒否要求のsrc_ipを取り出し、同じIPの保存と後の参照を調べます。",
        "正常なスタッフのアップロードもあるため、upload全体を一括で疑わしい要求とは扱いません。"
      ],
      [
        "reason=extension_blockedをアプリ監査で探します。",
        "そのrequest_idとHTTP 415を照合します。",
        "拒否された要求にfile_idやcreateがないことは、保存成功の要求との重要な違いです。"
      ],
      [
        "疑わしい種類のstoredイベントを探します。",
        "同じ要求のHTTP行からクエリを含まない入口パスを読みます。",
        "ハンドラー名だけではURLは決まらないため、アクセスログで入口を確かめます。"
      ],
      [
        "declared_typeとdetected_typeを並べて確認します。",
        "申告値ではなく、検出された種類のフィールドを取り出します。",
        "text/plainという判定だけで具体的なプログラム内容までは復元できません。"
      ],
      [
        "stored_pathをファイル作成イベントのpathと比較します。",
        "利用者のfilenameと保存後のサーバーパスを区別します。",
        "作成監査が同じfile_idを記録しているため、名前の変更後も対応付けできます。"
      ],
      [
        "保存と参照のfile_idを比較します。",
        "同じ値がプロセス監査にも含まれるか確認します。",
        "要求IDが異なるイベント同士でも、成果物のIDが保存から実行までをつなぎます。"
      ],
      [
        "対象ファイルのprocess_audit event=execを探します。",
        "同じpidのexitとstatusを確認してexeを読みます。",
        "execだけなら起動の観測ですが、同じpidのexitで終了結果まで確かめられます。"
      ],
      [
        "exec行のuserフィールドを確認します。",
        "保存のcreate行にあるuserと比べます。",
        "www-dataの実行からroot権限の取得を推測することはできません。"
      ],
      [
        "対象送信元のaction=uploadだけを選びます。",
        "result=storedの行数を数えます。",
        "正常スタッフの保存も含む全体件数と、対象送信元の保存数は異なります。"
      ],
      [
        "対象送信元のstoredイベントからbytesを取り出します。",
        "各保存量を足し、参照応答や拒否行を加算しません。",
        "同じファイルの後の参照は保存量を増やさず、HTTPの小さな受付応答も保存データとは別です。"
      ]
    ],
    "tamper": [
      [
        "sudoのCOMMANDと実行者を確認します。",
        "file_truncateのactorと照合し、euidと区別します。",
        "正常なopsのsudoもあるため、対象パスと操作内容を合わせて追います。"
      ],
      [
        "確認した操作アカウントのAccepted publickeyを探します。",
        "fromの直後のIPを読み、SSHセッションの時刻も確認します。",
        "公開鍵認証は成功を示しますが、鍵の正規所有者が操作したかまでは確定しません。"
      ],
      [
        "action=file_truncateのpathを読みます。",
        "sudoのCOMMANDで渡された対象パスと比較します。",
        "別収集先のパスは操作対象ではなく、比較用に保全された写しです。"
      ],
      [
        "file_truncateのold_sizeとnew_sizeを確認します。",
        "正常スナップショットのwc -cとold_sizeを照合します。",
        "これは全期間の転送量ではなく、切り詰め直前のローカルファイルサイズです。"
      ],
      [
        "現在のaccess.logを読み、残る行の時刻を確認します。",
        "wc -lで現在のファイルだけを数えます。",
        "現在の2行を観測期間全体の通信件数と解釈しないことが重要です。"
      ],
      [
        "collector配下のaccessログの保存範囲を確認します。",
        "request_idを含むHTTP行を数えます。",
        "ローカルの通常スナップショットは20行なので、62−2をそのまま削除件数にはできません。"
      ],
      [
        "改変イベントのeuidを取り出します。",
        "auid・actor・euidが別の役割であることを確かめます。",
        "euidは操作時の権限で、auidは元のログイン主体を追うための値です。"
      ],
      [
        "file_truncate行のpidとppidを並べて読みます。",
        "ppidをsudoのpid付加フィールドと照合します。",
        "sudoのPIDは親を指し、実際の切り詰めを記録したPIDは子プロセスです。"
      ],
      [
        "file_truncate成功のaudit_serialを探します。",
        "後のfile_appendイベントの識別子と区別します。",
        "これはファイル名やプロセス番号ではなく、監査イベントを識別する番号です。"
      ],
      [
        "SSH成功とfile_truncateの時刻を別ログから読みます。",
        "syslogをREADMEの2026年・UTCで解釈して秒差を求めます。",
        "sudo開始からの2秒ではなく、認証成功からの122秒を求める設問です。"
      ]
    ]
  };
  const q=(c,id,label,prompt,answer,explanation,refs,first,second,alts=[])=>{
    const lesson=teaching[c.id][c.tasks.length];
    const forms=typeof answer==='number'?[answer.toLocaleString('en-US')]:[];
    if(typeof answer==='number'){const unit=/バイト|\bbytes\b/.test(prompt)?'バイト':prompt.includes('秒')?'秒':prompt.includes('種類')?'種類':prompt.includes('件')?'件':'';if(unit)forms.push(String(answer)+unit);}
    if(/^\d\d:\d\d:\d\d$/.test(String(answer)))forms.push(answer+' UTC');
    c.tasks.push({id,label,prompt,placeholder:'値を入力',answer:String(answer),accepted:[...new Set([String(answer),...forms,...alts])],explanation:explanation+' '+lesson[2],evidence:refs.map(([p,n])=>c._e(p,n)),hints:[{text:lesson[0],command:first},{text:lesson[1],command:second}]});
  };
  const walk=(c,title,command,explanation)=>c.walkthrough.push({title,command,explanation});
  const finish=c=>{delete c._e;return c;};

  // Canonical paths and OS reads distinguish blocked/failed requests from disclosure.
  const P='/var/log/audit/file.log';
  const ps=base('pathtraversal','download-01',14,P);
  const pb=logs(ps),pi='198.51.100.141';
  event(ps,iso(14,5,1),pi,'/download?file=..%2F..%2Fetc%2Fhostname',403,80,'req-path-301',{action:'file_read',result:'denied',handler:'validated',allowed_root:'/srv/downloads',resolved_path:'/etc/hostname',reason:'outside_root',read_bytes:0});
  event(ps,iso(14,6,10),pi,'/download-legacy?file=..%2F..%2Fetc%2Fapp%2Fservice.conf',200,384,'req-path-302',{action:'file_read',result:'success',handler:'legacy',allowed_root:'/srv/downloads',resolved_path:'/etc/app/service.conf',read_bytes:384});
  line(ps,iso(14,6,10),'fs_audit event=read user=download-web path=/etc/app/service.conf result=success bytes=384 request_id=req-path-302');
  event(ps,iso(14,6,40),pi,'/download-legacy?file=..%2F..%2Fvar%2Flog%2Fmissing.log',404,84,'req-path-303',{action:'file_read',result:'error',handler:'legacy',allowed_root:'/srv/downloads',resolved_path:'/var/log/missing.log',reason:'not_found',read_bytes:0});
  line(ps,iso(14,6,40),'fs_audit event=read user=download-web path=/var/log/missing.log result=ENOENT bytes=0 request_id=req-path-303');
  const pc=build(ps,'パストラバーサルとファイル参照','要求パスの正規化、許可範囲、OSの読取結果を照合します。',pb,'ファイル参照の異常を追加',['正規のダウンロードと旧式ハンドラーが共存します。許可ルートと実際の参照パスを比較してください。','パスの試行だけでは読取成功と判断できません。OS監査の結果とバイト数を確認します。']);
  q(pc,'source','要求元','不正な相対パスを試した送信元IPは？',pi,'3要求の送信元と監査のsrc_ipが一致します。',[[A,'req-path-301'],[J,'req-path-302']],"grep -F '..%2F' /var/log/nginx/access.log","grep -F '..%2F' /var/log/nginx/access.log | awk '{print $1}' | sort | uniq");
  q(pc,'root','許可ルート','ダウンロードのallowed_rootは？','/srv/downloads','成功した参照先は、このルートの外にあります。',[[J,'req-path-302']],"grep 'action=file_read ' /var/log/app/audit.log","jq -r 'select(.src_ip == \"198.51.100.141\") | .allowed_root' /var/log/app/audit.jsonl");
  q(pc,'path','実際の参照先','対象送信元の要求のうち、OS監査でも読取成功が確認できる絶対パスは？','/etc/app/service.conf','URLの文字列だけでなく正規化後のパスとOSの成功記録が根拠です。',[[J,'req-path-302'],[P,'req-path-302']],"grep 'result=success ' /var/log/audit/file.log","jq -r 'select(.src_ip == \"198.51.100.141\" and .result == \"success\") | .resolved_path' /var/log/app/audit.jsonl");
  q(pc,'bytes','読取バイト数','この成功した参照でOSが記録した読取バイト数は？',384,'アプリのread_bytesとOS監査のbytesが384で一致します。',[[P,'req-path-302'],[J,'req-path-302']],"grep '/etc/app/service.conf' /var/log/audit/file.log","jq -r 'select(.src_ip == \"198.51.100.141\" and .result == \"success\") | .read_bytes' /var/log/app/audit.jsonl");
  q(pc,'os-user','OSの実行主体','このファイルを読んだOSユーザー名は？','download-web','HTTP送信元とサーバー上のOS実行主体を区別します。',[[P,'req-path-302']],"grep '/etc/app/service.conf' /var/log/audit/file.log","grep '/etc/app/service.conf' /var/log/audit/file.log | awk '{print $5}'",['user=download-web']);
  q(pc,'confirmed','読取成功の要求','対象送信元の要求のうち、アプリとOSの両方で読取成功を確認できるrequest_idは？','req-path-302','403の拒否や404の不存在と区別して照合できます。',[[T,'req-path-302'],[P,'req-path-302']],"jq -r 'select(.src_ip == \"198.51.100.141\" and .result == \"success\") | .request_id' /var/log/app/audit.jsonl","grep '/etc/app/service.conf' /var/log/app/audit.log /var/log/audit/file.log");
  q(pc,'blocked','拒否された要求','許可ルート外として拒否されたrequest_idは？','req-path-301','validatedハンドラーはoutside_rootとしてアプリ内で拒否しました。この要求に対応するOSのread記録はありません。',[[T,'req-path-301'],[A,'req-path-301']],"grep 'outside_root' /var/log/app/audit.log","grep 'outside_root' /var/log/app/audit.log; grep ' 403 ' /var/log/nginx/access.log");
  q(pc,'missing','失敗の区別','不存在ファイルの参照でOS監査が返したresult値は？','ENOENT','パス探索はありましたが、このファイルの読取成功は確認できません。',[[P,'req-path-303']],"grep 'reason=not_found' /var/log/app/audit.log","grep 'req-path-303' /var/log/audit/file.log | awk '{print $7}'",['result=ENOENT']);
  q(pc,'request-count','試行数の集計','対象送信元のHTTP要求は合計何件？',3,'アクセスログだけを数え、重複する監査ビューを加算しません。',[[A,'req-path-301'],[A,'req-path-303']],"grep '198.51.100.141' /var/log/nginx/access.log","grep '198.51.100.141' /var/log/nginx/access.log | wc -l");
  q(pc,'read-count','成功数の集計','対象3要求のうちOSで成功したreadは何件？',1,'拒否とENOENTは成功数に含めません。',[[P,'req-path-302']],"grep 'req-path-30' /var/log/audit/file.log","grep 'req-path-30' /var/log/audit/file.log | grep 'event=read ' | grep 'result=success ' | wc -l");

  // Web authentication includes session issue, use, and revocation.
  const W='/var/log/session/events.log';
  const ws=base('webauth','portal-02',15,W);
  const wb=logs(ws),wi='203.0.113.142';
  for(let i=0;i<4;i++)event(ws,iso(15,6,i*10),wi,'/login',401,88,'req-wa-'+(501+i),{action:'login',result:'failure',actor:i<2?'admin':'report-viewer',reason:'invalid_password'},'POST');
  event(ws,iso(15,7,2),wi,'/login',302,145,'req-wa-505',{action:'login',result:'success',actor:'report-viewer',session_id:'sess-lab-42',mfa_used:false},'POST');
  line(ws,iso(15,7,2),'session_audit event=issue session_id=sess-lab-42 actor=report-viewer client_ip=203.0.113.142 result=success request_id=req-wa-505');
  event(ws,iso(15,8,4),wi,'/reports/private?period=august',200,4920,'req-wa-506',{action:'report_view',result:'success',actor:'report-viewer',session_id:'sess-lab-42',resource:'/reports/private',rows:18});
  line(ws,iso(15,8,4),'session_audit event=validate session_id=sess-lab-42 actor=report-viewer client_ip=203.0.113.142 result=success request_id=req-wa-506');
  event(ws,iso(15,9,20),wi,'/logout',302,145,'req-wa-507',{action:'logout',result:'success',actor:'report-viewer',session_id:'sess-lab-42',revoked:true},'POST');
  line(ws,iso(15,9,20),'session_audit event=revoke session_id=sess-lab-42 actor=report-viewer result=success request_id=req-wa-507');
  const wc=build(ws,'Web認証試行とセッション追跡','認証失敗からセッション発行、利用、失効までを追います。',wb,'Web認証の異常を追加',['短時間のパスワード試行と、その後のセッション利用が調査対象です。認証成功だけで全操作を推測しないでください。','MFAの値はこのログインで使用したかを示し、アカウント全体の設定を示すものではありません。']);
  q(wc,'source','認証試行元','連続する失敗と後の成功に共通する送信元IPは？',wi,'認証監査の送信元とアクセスの行頭が一致します。',[[A,'req-wa-501'],[J,'req-wa-505']],"grep 'action=login ' /var/log/app/audit.log","jq -r 'select(.action == \"login\" and .result == \"failure\") | .src_ip' /var/log/app/audit.jsonl | sort | uniq -c");
  q(wc,'failure-count','認証失敗の集計','この送信元によるログイン失敗は何件？',4,'adminとreport-viewerへの失敗を合計し、成功は含めません。',[[T,'req-wa-501'],[T,'req-wa-504']],"grep 'src_ip=203.0.113.142' /var/log/app/audit.log","grep 'src_ip=203.0.113.142' /var/log/app/audit.log | grep 'action=login ' | grep 'result=failure ' | wc -l");
  q(wc,'name-count','試行した名前の種類','この送信元がログインを試したactorは何種類？',2,'adminとreport-viewerの2種類。成功と失敗で同じ名前を重複加算しません。',[[J,'req-wa-501'],[J,'req-wa-503']],"jq -r 'select(.src_ip == \"203.0.113.142\" and .action == \"login\") | .actor' /var/log/app/audit.jsonl","jq -r 'select(.src_ip == \"203.0.113.142\" and .action == \"login\") | .actor' /var/log/app/audit.jsonl | sort | uniq | wc -l");
  q(wc,'account','成功したアカウント','対象送信元から認証に成功してセッションを受け取ったactorは？','report-viewer','セッション発行ログも同じアカウントを記録しています。',[[J,'req-wa-505'],[W,'req-wa-505']],"jq -r 'select(.src_ip == \"203.0.113.142\" and .action == \"login\" and .result == \"success\") | .actor' /var/log/app/audit.jsonl","grep 'client_ip=203.0.113.142' /var/log/session/events.log | grep 'event=issue '");
  q(wc,'login-time','認証成功の時刻','対象送信元の認証成功は何時何分何秒？（UTC）','15:07:02','認証監査とセッション発行の時刻が一致します。',[[T,'req-wa-505'],[W,'req-wa-505']],"jq -r 'select(.src_ip == \"203.0.113.142\" and .action == \"login\" and .result == \"success\") | .timestamp' /var/log/app/audit.jsonl","grep 'client_ip=203.0.113.142' /var/log/session/events.log | grep 'event=issue '",['2026-08-12T15:07:02Z']);
  q(wc,'session','セッションの照合値','ログインと非公開レポート閲覧に共通するsession_idは？','sess-lab-42','同じセッションの発行と検証が独立ログでも確認できます。',[[W,'req-wa-505'],[W,'req-wa-506']],"jq -r 'select(.src_ip == \"203.0.113.142\" and .result == \"success\") | .session_id' /var/log/app/audit.jsonl","grep 'client_ip=203.0.113.142' /var/log/session/events.log");
  q(wc,'resource','閲覧されたリソース','このセッションで閲覧成功が記録されたresourceのパスは？','/reports/private','HTTP 200に加え、アプリ監査のreport_view成功とセッション検証が根拠です。',[[J,'req-wa-506'],[W,'req-wa-506']],"jq -r 'select(.src_ip == \"203.0.113.142\" and .action == \"report_view\") | .resource' /var/log/app/audit.jsonl","grep 'sess-lab-42' /var/log/session/events.log | grep 'event=validate '");
  q(wc,'rows','閲覧結果の行数','アプリが記録したレポートの行数は？',18,'4920はHTTPの応答サイズで、行数は監査のrows=18です。',[[J,'req-wa-506'],[A,'req-wa-506']],"grep 'req-wa-506' /var/log/nginx/access.log /var/log/app/audit.log","jq -r 'select(.src_ip == \"203.0.113.142\" and .action == \"report_view\") | .rows' /var/log/app/audit.jsonl");
  q(wc,'mfa','MFAの観測値','この成功ログインのmfa_usedの真偽値は？','false','このログインでMFAを使わなかった記録です。設定や他のログインについては断定しません。',[[J,'req-wa-505']],"jq -r 'select(.src_ip == \"203.0.113.142\" and .action == \"login\" and .result == \"success\") | .mfa_used' /var/log/app/audit.jsonl","grep 'req-wa-505' /var/log/app/audit.jsonl");
  q(wc,'revoke-time','失効時刻','このセッションのrevoke成功は何時何分何秒？（UTC）','15:09:20','アプリのlogout成功と独立セッション監査のrevokeが対応します。',[[T,'req-wa-507'],[W,'req-wa-507']],"grep 'sess-lab-42' /var/log/session/events.log | grep 'event=revoke '","grep 'req-wa-507' /var/log/app/audit.log /var/log/session/events.log",['2026-08-12T15:09:20Z']);

  // A redirect is followed by the server; a separate egress log proves the fetch.
  const N='/var/log/egress/http.log';
  const ss=base('ssrf','preview-01',16,N);
  const sb=logs(ss),si='203.0.113.143';
  event(ss,iso(16,5,0),si,'/preview?url=http%3A%2F%2Fconfig.internal.test%2Fadmin',400,80,'req-ssrf-401',{action:'url_fetch',result:'denied',reason:'destination_policy',initial_url:'http://config.internal.test/admin',bytes:0});
  event(ss,iso(16,6,5),si,'/preview?url=http%3A%2F%2Fpreview.vendor.example%2Fredirect',200,512,'req-ssrf-402',{action:'url_fetch',result:'success',initial_url:'http://preview.vendor.example/redirect',final_url:'http://config.internal.test/status',redirects:1,bytes:512});
  line(ss,iso(16,6,4),'egress_audit src=192.0.2.60 dst=198.51.100.41 host=preview.vendor.example status=302 bytes=145 result=redirect location=http://config.internal.test/status request_id=req-ssrf-402');
  line(ss,iso(16,6,5),'egress_audit src=192.0.2.60 dst=192.0.2.80 host=config.internal.test status=200 bytes=512 result=success request_id=req-ssrf-402');
  event(ss,iso(16,7,8),si,'/preview?url=http%3A%2F%2Fstatus.vendor.example%2Fhealth',200,64,'req-ssrf-403',{action:'url_fetch',result:'error',reason:'timeout',initial_url:'http://status.vendor.example/health',bytes:0});
  line(ss,iso(16,7,8),'egress_audit src=192.0.2.60 dst=198.51.100.42 host=status.vendor.example status=none bytes=0 result=timeout request_id=req-ssrf-403');
  const sc=build(ss,'SSRFとサーバー外向き通信','利用者の要求とサーバー自身の通信、リダイレクト先を照合します。',sb,'URL取得の異常を追加',['URLプレビューサービスです。利用者のIPと、サーバーが外向き通信に使うIPを区別します。','リダイレクト先の再検証が調査対象です。内部サービス取得の事実と、内容の機密性は別に判断してください。']);
  q(sc,'source','外部要求元','調査対象のURL取得を要求した利用者の送信元IPは？',si,'アクセス元はサーバーの外向きsrcとは別です。',[[A,'req-ssrf-402'],[J,'req-ssrf-402']],"grep 'action=url_fetch ' /var/log/app/audit.log","jq -r 'select(.action == \"url_fetch\" and .result != \"success\") | .src_ip' /var/log/app/audit.jsonl | sort | uniq");
  q(sc,'blocked','拒否された要求','destination_policyで拒否されたrequest_idは？','req-ssrf-401','入力の要求はありますが、対応する外向き通信は記録されていません。',[[T,'req-ssrf-401']],"grep 'destination_policy' /var/log/app/audit.log","jq -r 'select(.reason == \"destination_policy\") | .request_id' /var/log/app/audit.jsonl");
  q(sc,'confirmed','取得を確認した要求','内部サービスの応答取得を別の通信ログでも確認できるrequest_idは？','req-ssrf-402','アプリの成功と内部宛てegressの200・512バイトが一致します。',[[T,'req-ssrf-402'],[N,'host=config.internal.test']],"grep 'host=config.internal.test ' /var/log/egress/http.log","jq -r 'select(.src_ip == \"203.0.113.143\" and .result == \"success\") | .request_id' /var/log/app/audit.jsonl");
  q(sc,'internal-ip','最終接続先IP','実際に応答を取得した内部サービスのdst IPは？','192.0.2.80','初期URLの外部IPではなく、リダイレクト後の接続先です。',[[N,'host=config.internal.test']],"grep 'req-ssrf-402' /var/log/egress/http.log","grep 'host=config.internal.test ' /var/log/egress/http.log | awk '{print $5}'",['dst=192.0.2.80']);
  q(sc,'worker-ip','通信したサーバー','内部宛て通信を発信したサーバーのsrc IPは？','192.0.2.60','外部利用者の203.0.113.143が直接接続した記録ではありません。',[[N,'host=config.internal.test']],"grep 'host=config.internal.test ' /var/log/egress/http.log","grep 'host=config.internal.test ' /var/log/egress/http.log | awk '{print $4}'",['src=192.0.2.60']);
  q(sc,'redirect','転送応答のコード','初期接続先が返したリダイレクトのHTTPステータスは？',302,'同じrequest_idの次の接続が内部ホストへ進んでいます。',[[N,'result=redirect']],"grep 'req-ssrf-402' /var/log/egress/http.log","grep 'result=redirect ' /var/log/egress/http.log | awk '{print $7}'",['status=302']);
  q(sc,'bytes','取得した応答量','内部サービスから取得した応答は何バイト？',512,'アプリのbytesとegressのbytesが一致します。HTTP 200だけに依存しません。',[[J,'req-ssrf-402'],[N,'host=config.internal.test']],"grep 'host=config.internal.test ' /var/log/egress/http.log","jq -r 'select(.src_ip == \"203.0.113.143\" and .result == \"success\") | .bytes' /var/log/app/audit.jsonl");
  q(sc,'egress-count','外向き試行数','対象req-ssrf-40で始まる要求の外向き通信記録は合計何件？',3,'転送元、転送先、タイムアウトの3件。拒否要求は含まれません。',[[N,'result=redirect'],[N,'result=timeout']],"grep 'req-ssrf-40' /var/log/egress/http.log","grep 'req-ssrf-40' /var/log/egress/http.log | wc -l");
  q(sc,'success-count','取得成功数','対象3要求のうち、アプリが取得成功を記録したものは何件？',1,'外向き通信数3件、利用者のHTTP 200が2件、取得成功1件を区別します。',[[T,'req-ssrf-402'],[T,'req-ssrf-403']],"grep 'src_ip=203.0.113.143' /var/log/app/audit.log","grep 'src_ip=203.0.113.143' /var/log/app/audit.log | grep 'result=success ' | wc -l");
  q(sc,'final-url','最終URL','対象送信元の取得成功イベントにあるfinal_url全文は？','http://config.internal.test/status','初期URLと最終URLのホストが違うことが調査の要点です。',[[J,'req-ssrf-402'],[N,'result=redirect']],"grep 'req-ssrf-402' /var/log/app/audit.log","jq -r 'select(.src_ip == \"203.0.113.143\" and .result == \"success\") | .final_url' /var/log/app/audit.jsonl");

  // Artifact IDs link uploads to file creation and a later process observation.
  const U='/var/log/audit/artifact.log';
  const us=base('upload','media-01',17,U);
  const ub=logs(us),ui='198.51.100.144';
  event(us,iso(17,5,0),ui,'/upload',201,80,'req-up-401',{action:'upload',result:'stored',handler:'validated',filename:'portrait.png',declared_type:'image/png',detected_type:'image/png',file_id:'f-701',stored_path:'/srv/www/uploads/f-701.png',bytes:2048},'POST');
  line(us,iso(17,5,0),'artifact_audit event=create path=/srv/www/uploads/f-701.png file_id=f-701 user=media-web bytes=2048 result=success request_id=req-up-401');
  event(us,iso(17,5,40),ui,'/upload',415,88,'req-up-402',{action:'upload',result:'denied',handler:'validated',filename:'avatar.php',declared_type:'image/png',detected_type:'text/plain',reason:'extension_blocked',bytes:0},'POST');
  event(us,iso(17,6,10),ui,'/upload-legacy',201,80,'req-up-403',{action:'upload',result:'stored',handler:'legacy',filename:'avatar.php',declared_type:'image/png',detected_type:'text/plain',file_id:'f-702',stored_path:'/srv/www/uploads/f-702.php',bytes:148},'POST');
  line(us,iso(17,6,10),'artifact_audit event=create path=/srv/www/uploads/f-702.php file_id=f-702 user=media-web bytes=148 result=success request_id=req-up-403');
  event(us,iso(17,7,4),ui,'/uploads/f-702.php',200,106,'req-up-404',{action:'artifact_view',result:'completed',file_id:'f-702',script:'/srv/www/uploads/f-702.php',handler:'php-fpm',unexpected_child:'/usr/bin/id'});
  line(us,iso(17,7,4),'process_audit event=exec pid=9702 ppid=9700 exe=/usr/bin/id user=www-data file_id=f-702 script=/srv/www/uploads/f-702.php request_id=req-up-404');
  line(us,iso(17,7,4),'process_audit event=exit pid=9702 status=0 file_id=f-702 request_id=req-up-404');
  const uc=build(us,'不正アップロードと実行痕跡','保存されたファイルのID、参照要求、プロセス記録を結びます。',ub,'アップロードの異常を追加',['拡張子と内容種別を検証する入口と、旧式の入口が共存します。ファイルの中身や実行コードは含まれていません。','201や200だけでは保存・実行の証拠になりません。ファイル作成とexec・exitを確認します。']);
  q(uc,'source','要求元','関連するアップロードと参照を行った送信元IPは？',ui,'アップロードと参照要求の送信元が一致します。',[[A,'req-up-403'],[A,'req-up-404']],"grep 'action=upload ' /var/log/app/audit.log","jq -r 'select(.action == \"upload\" and .result == \"denied\") | .src_ip' /var/log/app/audit.jsonl");
  q(uc,'denied','検証で拒否された要求','拡張子の検証で拒否されたrequest_idは？','req-up-402','同じ名前でも正規入口では拒否され、作成イベントがありません。',[[T,'req-up-402']],"grep 'extension_blocked' /var/log/app/audit.log","jq -r 'select(.reason == \"extension_blocked\") | .request_id' /var/log/app/audit.jsonl");
  q(uc,'route','保存を許した入口','疑わしいファイルを保存したHTTP入口のパスは？','/upload-legacy','アプリのlegacy保存結果と、実際のcreateイベントが対応します。',[[A,'req-up-403'],[U,'req-up-403']],"jq -r 'select(.src_ip == \"198.51.100.144\" and .result == \"stored\" and .detected_type != .declared_type) | .request_id' /var/log/app/audit.jsonl","grep 'req-up-403' /var/log/nginx/access.log | awk '{print $7}'");
  q(uc,'type','実体の種類','画像と申告された疑わしいファイルのdetected_typeは？','text/plain','申告のimage/pngと実体のtext/plainが一致していません。',[[J,'req-up-403']],"grep 'req-up-403' /var/log/app/audit.log","jq -r 'select(.request_id == \"req-up-403\") | .detected_type' /var/log/app/audit.jsonl");
  q(uc,'path','保存先','ファイル作成監査でも確認できる疑わしいファイルの保存先は？','/srv/www/uploads/f-702.php','利用者のfilenameと実際の保存先を分けて読みます。',[[J,'req-up-403'],[U,'req-up-403']],"grep 'req-up-403' /var/log/app/audit.log /var/log/audit/artifact.log","jq -r 'select(.request_id == \"req-up-403\") | .stored_path' /var/log/app/audit.jsonl");
  q(uc,'file-id','成果物の照合値','保存と後の参照・プロセス記録を結ぶfile_idは？','f-702','request_idは保存と参照で変わりますが、file_idは同じです。',[[U,'req-up-403'],[U,'event=exec']],"grep '/srv/www/uploads/f-702.php' /var/log/audit/artifact.log","jq -r 'select(.request_id == \"req-up-404\") | .file_id' /var/log/app/audit.jsonl");
  q(uc,'exe','予期しない子プロセス','execと終了コード0の両方が確認できる実行ファイルは？','/usr/bin/id','参照HTTP 200に加えて独立プロセス監査が実行を裏付けます。',[[U,'event=exec'],[U,'event=exit']],"grep 'req-up-404' /var/log/audit/artifact.log","grep 'event=exec ' /var/log/audit/artifact.log | awk '{print $7}'",['exe=/usr/bin/id']);
  q(uc,'user','実行権限','この予期しない子プロセスを動かしたOSユーザーは？','www-data','アップロード保存のmedia-webと実行のwww-dataは別の主体です。',[[U,'event=exec'],[U,'req-up-403']],"grep 'event=exec ' /var/log/audit/artifact.log","grep 'event=exec ' /var/log/audit/artifact.log | awk '{print $8}'",['user=www-data']);
  q(uc,'stored-count','保存数の集計','対象送信元のアップロードのうち保存成功は何件？',2,'正常なPNGと疑わしいPHPの2件。拒否と後の参照は加算しません。',[[T,'req-up-401'],[T,'req-up-403']],"grep 'src_ip=198.51.100.144' /var/log/app/audit.log","grep 'src_ip=198.51.100.144' /var/log/app/audit.log | grep 'action=upload ' | grep 'result=stored ' | wc -l");
  q(uc,'stored-bytes','保存量の合計','対象送信元が保存できたファイルのbytesの合計は？',2196,'2048バイトと148バイトで2196。HTTP応答サイズや拒否入力を加算しません。',[[J,'req-up-401'],[J,'req-up-403']],"jq -r 'select(.src_ip == \"198.51.100.144\" and .action == \"upload\" and .result == \"stored\") | .bytes' /var/log/app/audit.jsonl","jq -r 'select(.src_ip == \"198.51.100.144\" and .action == \"upload\" and .result == \"stored\") | .bytes' /var/log/app/audit.jsonl | awk '{total += $1} END {print total}'");

  // Deliberate removal is visible locally; the independent collector retains requests.
  const F='/var/log/auth.log', C='/var/log/collector/nginx-access.log';
  const ts=base('tamper','edge-02',18,F);
  const auth=(time,rest)=>'Aug 12 '+time+' edge-02 '+rest;
  ts.x.push(
    auth('18:00:00','sshd[8000]: Accepted publickey for ops from 192.0.2.10 port 55000 ssh2: ED25519 SHA256:FICTIONALTRAININGKEY'),
    auth('18:00:00','sshd[8000]: pam_unix(sshd:session): session opened for user ops(uid=1001) by (uid=0)'),
    auth('18:01:00','sudo: ops : TTY=pts/1 ; PWD=/home/ops ; USER=root ; COMMAND=/usr/bin/stat /var/log/nginx/access.log ; pid=8010'),
    auth('18:01:00','sudo: pam_unix(sudo:session): session opened for user root(uid=0) by ops(uid=1001) ; pid=8010'),
    auth('18:01:01','sudo: pam_unix(sudo:session): session closed for user root ; pid=8010'),
    auth('18:03:00','sshd[8000]: pam_unix(sshd:session): session closed for user ops')
  );
  const normalAccess=ts.a.slice(),activeBefore=txt(normalAccess.slice(-20));
  const tb=logs(ts);tb[A]=activeBefore;tb[C]=txt(normalAccess);
  ts.x.push(
    auth('18:04:00','sshd[9010]: Accepted publickey for maint from 192.0.2.77 port 56100 ssh2: ED25519 SHA256:FICTIONALMAINTKEY'),
    auth('18:04:00','sshd[9010]: pam_unix(sshd:session): session opened for user maint(uid=1005) by (uid=0)'),
    auth('18:06:00','sudo: maint : TTY=pts/2 ; PWD=/home/maint ; USER=root ; COMMAND=/usr/bin/editor /var/log/nginx/access.log ; pid=9020'),
    auth('18:06:00','sudo: pam_unix(sudo:session): session opened for user root(uid=0) by maint(uid=1005) ; pid=9020'),
    auth('18:06:03','sudo: pam_unix(sudo:session): session closed for user root ; pid=9020'),
    auth('18:06:04','sshd[9010]: pam_unix(sshd:session): session closed for user maint')
  );
  pair(ts,iso(18,6,2),{action:'file_truncate',result:'success',actor:'maint',auid:1005,euid:0,pid:9024,ppid:9020,exe:'/usr/bin/editor',path:A,old_size:activeBefore.length,new_size:0,audit_serial:4801,request_id:'local-4801'});
  const after=[http(iso(18,7,0),'192.0.2.20','/health',200,32,'req-edge-160'),http(iso(18,8,0),'192.0.2.21','/help',200,96,'req-edge-161')];
  pair(ts,iso(18,7,1),{action:'file_append',result:'success',actor:'nginx',path:A,bytes:after[0].length+1,new_size:after[0].length+1,audit_serial:4802,request_id:'local-4802'});
  pair(ts,iso(18,8,1),{action:'file_append',result:'success',actor:'nginx',path:A,bytes:after[1].length+1,new_size:txt(after).length,audit_serial:4803,request_id:'local-4803'});
  ts.a=after;ts.x.sort();
  const tc=build(ts,'ログ改変と独立監査の照合','失われたローカルログを、別収集ログ・sudo・ファイル監査で調べます。',tb,'ログ改変の記録を追加',['このケースでは対象access.logの正常行が意図的に消えます。別収集ログには元の要求が残ります。','通常のローテーション等と即断せず、sudoの主体、PID、ファイル監査の操作と実効権限を照合します。']);
  tc.files[C]=txt(normalAccess.concat(after));tc.logPaths.push(C);
  tc.files['/home/analyst/README.txt']=readme(tc.title,tc.logPaths,false);
  tc.baselineFiles['/home/analyst/README.txt']=readme(tc.title,tc.logPaths,true);
  for(const files of [tc.files,tc.baselineFiles])files['/home/analyst/README.txt']+='auth.logは年・TZを省略した従来syslog形式です。収集年は2026年、時刻はUTCとして照合します。sudoのpidは監査照合用の付加フィールドです。\n';
  q(tc,'actor','操作主体','sudoとファイル改変監査に共通する操作アカウントは？','maint','sudoの実行者と監査actorが一致します。rootは実効権限であり元の操作主体と別です。',[[F,'pid=9020'],[J,'"audit_serial":4801']],"grep 'COMMAND=' /var/log/auth.log","jq -r 'select(.action == \"file_truncate\") | .actor' /var/log/app/audit.jsonl");
  q(tc,'source','SSH接続元','このアカウントがSSH認証に成功した送信元IPは？','192.0.2.77','SSH成功とその後のsudo操作を時系列で結びます。接続元だけで実在人物までは特定できません。',[[F,'sshd[9010]']],"grep 'Accepted publickey for maint' /var/log/auth.log","grep 'Accepted publickey for maint' /var/log/auth.log | awk '{print $11}'");
  q(tc,'path','改変されたログ','file_truncate成功の対象パスは？',A,'ローカルの対象ログと別収集ログは異なる保存先です。',[[J,'"audit_serial":4801'],[F,'pid=9020']],"grep 'action=file_truncate ' /var/log/app/audit.log","jq -r 'select(.action == \"file_truncate\") | .path' /var/log/app/audit.jsonl");
  q(tc,'old-size','改変直前のサイズ','監査が記録した改変直前のold_sizeは何バイト？',activeBefore.length,'監査のold_sizeは正常スナップショットの対象ファイルのバイト数と一致します。',[[J,'"audit_serial":4801']],"jq -r 'select(.action == \"file_truncate\") | .old_size' /var/log/app/audit.jsonl","wc -c /baseline/var/log/nginx/access.log");
  q(tc,'active-count','残ったローカル要求','攻撃後の対象access.logに残る要求は何件？',2,'後から追記された2件だけで、先行する正常20行は残っていません。',[[A,'req-edge-160'],[A,'req-edge-161']],"cat /var/log/nginx/access.log","wc -l /var/log/nginx/access.log");
  q(tc,'collector-count','別収集ログの要求数','別収集ログに残る要求は全部で何件？',62,'正常60件と後の2件が保全されています。ローカル2件だけで通信が2件だったとは判断できません。',[[C,'req-edge-100'],[C,'req-edge-161']],"grep 'request_id=' /var/log/collector/nginx-access.log","grep 'request_id=' /var/log/collector/nginx-access.log | wc -l");
  q(tc,'euid','操作の実効権限','file_truncate時のeuidの数値は？',0,'euid=0の操作です。元のログイン主体を表すauid=1005とは区別します。',[[J,'"audit_serial":4801']],"grep 'action=file_truncate ' /var/log/app/audit.log","jq -r 'select(.action == \"file_truncate\") | .euid' /var/log/app/audit.jsonl");
  q(tc,'pid','操作プロセス','実際にfile_truncateを行ったpidは？',9024,'そのppid=9020がsudoログのプロセス番号と一致します。',[[J,'"audit_serial":4801'],[F,'pid=9020']],"grep 'action=file_truncate ' /var/log/app/audit.log","jq -r 'select(.action == \"file_truncate\") | .pid' /var/log/app/audit.jsonl");
  q(tc,'serial','独立監査の識別子','file_truncate成功のaudit_serialは？',4801,'後の通常追記4802・4803とは違うイベント識別子です。',[[J,'"audit_serial":4801']],"grep 'file_truncate' /var/log/app/audit.log","jq -r 'select(.action == \"file_truncate\") | .audit_serial' /var/log/app/audit.jsonl");
  q(tc,'gap','認証から改変まで','SSH認証成功からfile_truncate成功までは何秒？',122,'18:04:00から18:06:02まで122秒です。sudoの時刻18:06:00と実際の改変時刻を分けます。',[[F,'sshd[9010]'],[T,'audit_serial=4801']],"grep 'Accepted publickey for maint' /var/log/auth.log","grep 'action=file_truncate ' /var/log/app/audit.log");
  pc.attack.summary="許可領域外の3要求を追加しました。アプリでの拒否、旧式処理の読取成功、不存在を比較します。";
  walk(pc,"正常な資料取得を照合する","head -n 6 /baseline/var/log/app/audit.log /baseline/var/log/audit/file.log","通常の/download要求は許可ルート内の資料を読み、アプリのread_bytesとOSのbytesが一致します。");
  walk(pc,"相対移動を含む要求を探す","grep -F '..%2F' /var/log/nginx/access.log","URLの相対移動から調査対象を選びます。行頭のIPを比較すると3要求が同じ送信元だと分かります。");
  walk(pc,"検証と解決先の違いを見る","grep 'src_ip=198.51.100.141' /var/log/app/audit.log","allowed_root・resolved_path・handler・resultを比較します。検証付き処理の拒否と旧式処理の成功・エラーを分けます。");
  walk(pc,"OSのread成功を確かめる","grep 'req-path-302' /var/log/app/audit.log /var/log/audit/file.log","同じ要求IDでパスと384バイトが一致します。OSユーザーdownload-webはHTTPの送信元とは別の主体です。");
  walk(pc,"拒否と不存在を分ける","grep -E 'req-path-301|req-path-303' /var/log/app/audit.log /var/log/audit/file.log","301はアプリが拒否しOSのreadはありません。303はOSがENOENTを返しており、どちらも読取成功ではありません。");
  walk(pc,"要求数と成功数の単位をそろえる","grep 'req-path-30' /var/log/audit/file.log | grep 'result=success ' | wc -l","対象HTTP要求は3件、成功readは1件です。正常資料や同じイベントのJSONL表示を加算しません。");
  wc.attack.summary="4回のログイン失敗と、その後の認証・セッション発行・帳票閲覧・失効を追加しました。";
  walk(wc,"正常セッションを確認する","grep 'sess-staff-a' /baseline/var/log/session/events.log","正常スタッフはログインで1セッションを受け取り、複数の帳票要求で検証したあとlogoutで失効します。");
  walk(wc,"失敗の送信元と件数を調べる","jq -r 'select(.action == \"login\" and .result == \"failure\") | .src_ip' /var/log/app/audit.jsonl | sort | uniq -c","失敗は203.0.113.142に集中します。認証失敗数とアカウント名の種類数を別に集計します。");
  walk(wc,"成功とセッション発行を結ぶ","grep 'req-wa-505' /var/log/app/audit.log /var/log/session/events.log","15:07:02のreport-viewer成功とsess-lab-42の発行が一致します。mfa_used=falseはこのログインだけの値です。");
  walk(wc,"認証後の利用を確かめる","grep 'req-wa-506' /var/log/nginx/access.log /var/log/app/audit.log /var/log/session/events.log","同じセッションの検証と/reports/privateの閲覧成功が対応します。HTTP 4920バイトとrows=18は別の量です。");
  walk(wc,"失効で追跡範囲を区切る","grep 'sess-lab-42' /var/log/session/events.log","issue、validate、revokeの順を確認します。15:09:20の失効は、発行されたセッションを無期限に利用できたという推測を防ぎます。");
  walk(wc,"観測した事実と未確認事項を分ける","grep 'src_ip=203.0.113.142' /var/log/app/audit.log","4失敗・2種類の名前・認証成功・帳票18行・失効が観測事実です。パスワードの入手経路や実在人物はこのログだけでは分かりません。");
  sc.attack.summary="URL取得の拒否、内部へのリダイレクト取得、タイムアウトを追加しました。";
  walk(sc,"正常なプレビューの2段階を読む","head -n 3 /baseline/var/log/app/audit.log /baseline/var/log/egress/http.log","/previewの要求とdocs.vendor.exampleへの通信が同じIDで対応します。通常は初期URLと最終URLが一致します。");
  walk(sc,"要求元と拒否を調べる","grep 'src_ip=203.0.113.143' /var/log/app/audit.log","対象IPの3要求を比較します。destination_policyの拒否は記録されていますが、それ自体は内部への接続ではありません。");
  walk(sc,"転送を通信ログで追う","grep 'req-ssrf-402' /var/log/egress/http.log","外部の302応答に内部向けlocationが続きます。同じ要求IDでも転送の前後は別の通信記録です。");
  walk(sc,"内部取得の結果を照合する","grep 'req-ssrf-402' /var/log/app/audit.log /var/log/egress/http.log","サーバー192.0.2.60が192.0.2.80から512バイトを取得し、アプリのfinal_url・bytesと一致します。");
  walk(sc,"フロントの200と取得失敗を分ける","grep 'req-ssrf-403' /var/log/nginx/access.log /var/log/app/audit.log /var/log/egress/http.log","HTTPは200ですが、アプリはerror、通信はtimeout、取得量は0です。応答コードだけで取得成功とは決めません。");
  walk(sc,"数える対象を明示する","grep 'req-ssrf-40' /var/log/egress/http.log | wc -l","HTTP要求3件、通信記録3件、取得成功1件を区別します。内部への到達から内容の機密性までは推測しません。");
  uc.attack.summary="検証による拒否、旧式入口での保存、同じファイルの後続参照とプロセス記録を追加しました。";
  walk(uc,"正常な保存と参照を照合する","head -n 4 /baseline/var/log/app/audit.log /baseline/var/log/audit/artifact.log","通常のPNGは/uploadで作成され、同じfile_idの後続要求で静的配信されます。要求IDは別になります。");
  walk(uc,"検証された入口の拒否を見る","grep 'req-up-402' /var/log/nginx/access.log /var/log/app/audit.log","avatar.phpは画像と申告されていますが検出種類が異なり、extension_blockedとHTTP 415が記録されます。");
  walk(uc,"旧式入口での保存を確認する","grep 'req-up-403' /var/log/nginx/access.log /var/log/app/audit.log /var/log/audit/artifact.log","旧式入口は148バイトを保存し、独立createイベントも同じ保存パスとfile_idを記録します。");
  walk(uc,"成果物IDで後の要求へ進む","grep 'f-702' /var/log/app/audit.log /var/log/audit/artifact.log","保存要求と参照要求をfile_idで結ぶとPHP-FPMの処理に到達します。拡張子やHTTP 200だけでは実行成功を決めません。");
  walk(uc,"プロセスの実行と終了を照合する","grep 'req-up-404' /var/log/audit/artifact.log","/usr/bin/idのexecとpid=9702のexit status=0が対応し、実行主体はwww-dataです。保存主体media-webとは区別します。");
  walk(uc,"対象送信元の保存量を集計する","jq -r 'select(.src_ip == \"198.51.100.144\" and .action == \"upload\" and .result == \"stored\") | .bytes' /var/log/app/audit.jsonl | awk '{total += $1} END {print total}'","対象の保存成功2件は2048+148=2196バイトです。正常スタッフの保存や後の参照応答を加算しません。");
  tc.attack.summary="SSH・sudo・ファイル切り詰めの記録を追加しました。消えたローカル行を別収集先と照合します。";
  walk(tc,"比較資料の保存範囲を確認する","wc -l /baseline/var/log/nginx/access.log /baseline/var/log/collector/nginx-access.log","通常のローカルは最新20行、別収集先は60行です。件数差を解釈する前に資料ごとの保持範囲を確認します。");
  walk(tc,"SSHからsudoへ時系列で追う","grep -E 'maint|pid=9020' /var/log/auth.log","maintのSSHセッション中にsudoが実行されています。syslogの年とTZはREADMEの2026年・UTCとして解釈します。");
  walk(tc,"操作と親子プロセスを照合する","grep 'action=file_truncate ' /var/log/app/audit.log","actor=maint、euid=0、pid=9024、ppid=9020を別々に読みます。sudoの付加pidが親プロセスを裏付けます。");
  walk(tc,"サイズの変化を確かめる","wc -c /baseline/var/log/nginx/access.log","正常スナップショットの2456バイトがold_sizeと一致し、監査のnew_sizeは0です。HTTP通信量を示す値ではありません。");
  walk(tc,"残った行と保全された行を比べる","wc -l /var/log/nginx/access.log /var/log/collector/nginx-access.log","ローカルは後続2行のみ、別収集先は62行です。基準の保持範囲が違うので差分60を削除行数とは扱いません。");
  walk(tc,"追記と改変、事実と意図を分ける","grep -E 'file_truncate|file_append' /var/log/app/audit.log","切り詰めの後に通常の追記が2件あります。改変の事実と主体は確認できますが、承認された保守かは業務資料が必要です。");
  globalThis.LOG_LAB_CASES.push(...[pc,wc,sc,uc,tc].map(finish));
})();
