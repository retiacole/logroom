/* Additional fictional, static investigations. Load after cases.js. */
(() => {
  'use strict';
  const A='/var/log/nginx/access.log', J='/var/log/app/audit.jsonl', T='/var/log/app/audit.log';
  const txt=a=>a.join('\n')+'\n';
  const iso=(h,m=0,s=0)=>new Date(Date.UTC(2026,7,12,h,m,s)).toISOString().replace('.000Z','Z');
  const http=(at,ip,url,status,bytes,id,method='GET')=>ip+' - - [12/Aug/2026:'+at.slice(11,19)+' +0000] "'+method+' '+url+' HTTP/1.1" '+status+' '+bytes+' "-" "LabBrowser/1.0" request_id='+id;
  const pair=(s,at,fields)=>{s.t.push(at+' '+s.host+' audit '+Object.entries(fields).map(([k,v])=>k+'='+String(v)).join(' '));s.j.push(JSON.stringify({timestamp:at,host:s.host,...fields}));};
  const base=(id,host,h,path,normal)=>{
    const s={id,host,h,path,a:[],t:[],j:[],x:[]};
    for(let i=0;i<60;i++){const at=iso(h,Math.floor(i*5/60),i*5%60),rid='req-'+id+'-normal-'+String(i).padStart(3,'0');s.a.push(http(at,'192.0.2.20',['/','/health','/assets/app.js'][i%3],200,120+i,rid));if(i%5===0){pair(s,at,{action:'page_view',result:'success',actor:'staff-a',src_ip:'192.0.2.20',request_id:rid});s.x.push(normal(at,rid,i));}}
    return s;
  };
  const logs=s=>({[A]:txt(s.a),[T]:txt(s.t),[J]:txt(s.j),[s.path]:txt(s.x)});
  const line=(s,at,rest)=>s.x.push(at+' '+s.host+' '+rest);
  const event=(s,at,ip,url,status,bytes,id,fields,method)=>{s.a.push(http(at,ip,url,status,bytes,id,method));pair(s,at,{...fields,src_ip:ip,request_id:id});};
  const readme=(title,paths,before)=>txt([title,'','組織・人物・通信・ログはすべて架空です。実行や外部通信は行いません。','日付は2026年8月12日、全時刻はUTCです。IPとドメインは文書・テスト用です。',before?'現在は正常状態です。画面の攻撃ボタンで合成イベントを加えた状態に切り替えます。':'攻撃後の静的ログです。HTTP結果だけで成功と決めず、別の監査記録を照合してください。','audit.logとaudit.jsonlは同じイベントのテキスト表示とJSON Lines表示です。','他の監査・通信ログは別の観測記録です。すべて教材用に正規化されています。','正常ログの保存先は /baseline 以下の同じ絶対パスです。diffで比較できます。','Nginxはcombinedにrequest_idを追加したカスタムlog_formatです。標準combinedにはrequest_idがなく、実運用では$request_idの記録、proxy_set_header X-Request-ID $request_id等によるアプリへの引き継ぎ、アプリ監査への記録が必要です。教材のreq-…は可読な固定IDで、Nginxの32桁の16進IDとは表記が異なります。','','調査対象:',...paths,'','使える操作はhelpで確認できます。']);
  const build=(s,title,summary,baseline,attackLabel,briefing)=>{
    const full=logs(s),paths=Object.keys(full),c={id:s.id,title,shortTitle:title,level:'中級',minutes:30,summary,briefing:['2026年8月12日。全時刻はUTCです。全データは静的な架空ログです。',...briefing],files:{...full,'/etc/hostname':s.host+'\n','/home/analyst/README.txt':readme(title,paths,false)},baselineFiles:{...baseline,'/etc/hostname':s.host+'\n','/home/analyst/README.txt':readme(title,paths,true)},attack:{label:attackLabel,summary:'調査対象の合成イベントを追加しました。'},logPaths:paths,tasks:[],walkthrough:[],initialCommand:'cat /home/analyst/README.txt',clockNote:'時刻はUTC（Z / +0000）。日本時間は+9時間。'};
    c._e=(p,needle)=>{const a=c.files[p].trimEnd().split('\n'),i=a.findIndex(x=>x.includes(needle));if(i<0)throw Error('missing evidence '+s.id+':'+needle);return{path:p,line:i+1,quote:a[i]};};return c;
  };
  const q=(c,id,label,prompt,answer,explanation,refs,first,second,alts=[])=>{
    const forms=typeof answer==='number'?[answer.toLocaleString('en-US')]:[];
    if(typeof answer==='number'){const unit=/バイト|\bbytes\b/.test(prompt)?'バイト':prompt.includes('秒')?'秒':prompt.includes('種類')?'種類':prompt.includes('件')?'件':'';if(unit)forms.push(String(answer)+unit);}
    if(/^\d\d:\d\d:\d\d$/.test(String(answer)))forms.push(answer+' UTC');
    c.tasks.push({id,label,prompt,placeholder:'値を入力',answer:String(answer),accepted:[...new Set([String(answer),...forms,...alts])],explanation,evidence:refs.map(([p,n])=>c._e(p,n)),hints:[{text:'関連するイベントを絞り込みます。',command:first},{text:'同じIDや項目で照合・集計します。',command:second}]});
  };
  const walk=(c,title,command,explanation)=>c.walkthrough.push({title,command,explanation});
  const finish=c=>{delete c._e;return c;};

  // Canonical paths and OS reads distinguish blocked/failed requests from disclosure.
  const P='/var/log/audit/file.log';
  const ps=base('pathtraversal','download-01',14,P,(at,rid)=>at+' download-01 fs_audit event=stat user=download-web path=/srv/downloads/manual.pdf result=success request_id='+rid);
  const pb=logs(ps),pi='198.51.100.141';
  event(ps,iso(14,5,1),pi,'/download?file=..%2F..%2Fetc%2Fhostname',403,80,'req-path-301',{action:'file_read',result:'denied',handler:'validated',allowed_root:'/srv/downloads',resolved_path:'/etc/hostname',reason:'outside_root',read_bytes:0});
  line(ps,iso(14,5,1),'fs_audit event=read user=download-web path=/etc/hostname result=denied bytes=0 request_id=req-path-301');
  event(ps,iso(14,6,10),pi,'/download-legacy?file=..%2F..%2Fetc%2Fapp%2Fservice.conf',200,384,'req-path-302',{action:'file_read',result:'success',handler:'legacy',allowed_root:'/srv/downloads',resolved_path:'/etc/app/service.conf',read_bytes:384});
  line(ps,iso(14,6,10),'fs_audit event=read user=download-web path=/etc/app/service.conf result=success bytes=384 request_id=req-path-302');
  event(ps,iso(14,6,40),pi,'/download-legacy?file=..%2F..%2Fvar%2Flog%2Fmissing.log',404,84,'req-path-303',{action:'file_read',result:'error',handler:'legacy',allowed_root:'/srv/downloads',resolved_path:'/var/log/missing.log',reason:'not_found',read_bytes:0});
  line(ps,iso(14,6,40),'fs_audit event=read user=download-web path=/var/log/missing.log result=ENOENT bytes=0 request_id=req-path-303');
  const pc=build(ps,'パストラバーサルとファイル参照','要求パスの正規化、許可範囲、OSの読取結果を照合します。',pb,'ファイル参照の異常を追加',['正規のダウンロードと旧式ハンドラーが共存します。許可ルートと実際の参照パスを比較してください。','パスの試行だけでは読取成功と判断できません。OS監査の結果とバイト数を確認します。']);
  const pg="grep 'req-path-' ",pj="jq -r 'select(.request_id == \"req-path-302\") | ";
  q(pc,'source','要求元','不正な相対パスを試した送信元IPは？',pi,'3要求の送信元と監査のsrc_ipが一致します。',[[A,'req-path-301'],[J,'req-path-302']],pg+A,pj+".src_ip' "+J);
  q(pc,'root','許可ルート','ダウンロードのallowed_rootは？','/srv/downloads','成功した参照先は、このルートの外にあります。',[[J,'req-path-302']],pg+T,pj+".allowed_root' "+J);
  q(pc,'path','実際の参照先','OS監査でも読取成功が確認できる絶対パスは？','/etc/app/service.conf','URLの文字列だけでなく正規化後のパスとOSの成功記録が根拠です。',[[J,'req-path-302'],[P,'req-path-302']],"grep 'result=success' "+P,pj+".resolved_path' "+J);
  q(pc,'bytes','読取バイト数','この成功した参照でOSが記録した読取バイト数は？',384,'アプリのread_bytesとOS監査のbytesが384で一致します。',[[P,'req-path-302'],[J,'req-path-302']],"grep 'req-path-302' "+P,pj+".read_bytes' "+J);
  q(pc,'os-user','OSの実行主体','このファイルを読んだOSユーザー名は？','download-web','HTTP送信元とサーバー上のOS実行主体を区別します。',[[P,'req-path-302']],"grep 'req-path-302' "+P,"grep 'req-path-302' "+P+" | awk '{print $5}'",['user=download-web']);
  q(pc,'confirmed','読取成功の要求','アプリとOSの両方で読取成功を確認できるrequest_idは？','req-path-302','403の拒否や404の不存在と区別して照合できます。',[[T,'req-path-302'],[P,'req-path-302']],pg+T,"grep 'req-path-302' "+T+' '+P);
  q(pc,'blocked','拒否された要求','許可ルート外として拒否されたrequest_idは？','req-path-301','validatedハンドラーはoutside_rootとして拒否し、OS監査もdeniedです。',[[T,'req-path-301'],[P,'req-path-301']],"grep 'outside_root' "+T,"grep 'req-path-301' "+T+' '+P);
  q(pc,'missing','失敗の区別','不存在ファイルの参照でOS監査が返したresult値は？','ENOENT','パス探索はありましたが、このファイルの読取成功は確認できません。',[[P,'req-path-303']],"grep 'req-path-303' "+T+' '+P,"grep 'req-path-303' "+P+" | awk '{print $7}'",['result=ENOENT']);
  q(pc,'request-count','試行数の集計','対象送信元のHTTP要求は合計何件？',3,'アクセスログだけを数え、重複する監査ビューを加算しません。',[[A,'req-path-301'],[A,'req-path-303']],"grep '198.51.100.141' "+A,"grep '198.51.100.141' "+A+' | wc -l');
  q(pc,'read-count','成功数の集計','対象3要求のうちOSで成功したreadは何件？',1,'拒否とENOENTは成功数に含めません。',[[P,'req-path-302']],pg+P,pg+P+" | grep 'result=success ' | wc -l");
  walk(pc,'正規化とOS結果を照合する',pg+T+' '+P,'許可ルート外でも旧式ハンドラーが読取を行った記録を確認します。');
  walk(pc,'要求数と成功数を区別する',pg+P+" | awk '{print $7}' | sort | uniq -c",'成功・拒否・不存在はそれぞれ1件です。');

  // Web authentication includes session issue, use, and revocation.
  const W='/var/log/session/events.log';
  const ws=base('webauth','portal-02',15,W,(at,rid,i)=>at+' portal-02 session_audit event=validate session_id=sess-normal-'+i+' actor=staff-a result=success request_id='+rid);
  const wb=logs(ws),wi='203.0.113.142';
  for(let i=0;i<4;i++)event(ws,iso(15,6,i*10),wi,'/login',401,88,'req-wa-'+(501+i),{action:'login',result:'failure',actor:i<2?'admin':'report-viewer',reason:'invalid_password'},'POST');
  event(ws,iso(15,7,2),wi,'/login',302,145,'req-wa-505',{action:'login',result:'success',actor:'report-viewer',session_id:'sess-lab-42',mfa_used:false},'POST');
  line(ws,iso(15,7,2),'session_audit event=issue session_id=sess-lab-42 actor=report-viewer client_ip=203.0.113.142 result=success request_id=req-wa-505');
  event(ws,iso(15,8,4),wi,'/reports/private?period=august',200,4920,'req-wa-506',{action:'report_view',result:'success',actor:'report-viewer',session_id:'sess-lab-42',resource:'/reports/private',rows:18});
  line(ws,iso(15,8,4),'session_audit event=validate session_id=sess-lab-42 actor=report-viewer client_ip=203.0.113.142 result=success request_id=req-wa-506');
  event(ws,iso(15,9,20),wi,'/logout',302,145,'req-wa-507',{action:'logout',result:'success',actor:'report-viewer',session_id:'sess-lab-42',revoked:true},'POST');
  line(ws,iso(15,9,20),'session_audit event=revoke session_id=sess-lab-42 actor=report-viewer result=success request_id=req-wa-507');
  const wc=build(ws,'Web認証試行とセッション追跡','認証失敗からセッション発行、利用、失効までを追います。',wb,'Web認証の異常を追加',['短時間のパスワード試行と、その後のセッション利用が調査対象です。認証成功だけで全操作を推測しないでください。','MFAの値はこのログインで使用したかを示し、アカウント全体の設定を示すものではありません。']);
  const wq=id=>"jq -r 'select(.request_id == \""+id+"\") | ";
  q(wc,'source','認証試行元','連続する失敗と後の成功に共通する送信元IPは？',wi,'認証監査の送信元とアクセスの行頭が一致します。',[[A,'req-wa-501'],[J,'req-wa-505']],"grep 'req-wa-' "+T,wq('req-wa-505')+".src_ip' "+J);
  q(wc,'failure-count','認証失敗の集計','この送信元によるログイン失敗は何件？',4,'adminとreport-viewerへの失敗を合計し、成功は含めません。',[[T,'req-wa-501'],[T,'req-wa-504']],"grep 'src_ip=203.0.113.142' "+T,"grep 'src_ip=203.0.113.142' "+T+" | grep 'action=login ' | grep 'result=failure ' | wc -l");
  q(wc,'name-count','試行した名前の種類','この送信元がログインを試したactorは何種類？',2,'adminとreport-viewerの2種類。成功と失敗で同じ名前を重複加算しません。',[[J,'req-wa-501'],[J,'req-wa-503']],"jq -r 'select(.action == \"login\" and .src_ip == \"203.0.113.142\") | .actor' "+J,"jq -r 'select(.action == \"login\" and .src_ip == \"203.0.113.142\") | .actor' "+J+' | sort | uniq | wc -l');
  q(wc,'account','成功したアカウント','認証に成功してセッションを受け取ったactorは？','report-viewer','セッション発行ログも同じアカウントを記録しています。',[[J,'req-wa-505'],[W,'req-wa-505']],"grep 'req-wa-505' "+T+' '+W,wq('req-wa-505')+".actor' "+J);
  q(wc,'login-time','認証成功の時刻','認証成功は何時何分何秒？（UTC）','15:07:02','認証監査とセッション発行の時刻が一致します。',[[T,'req-wa-505'],[W,'req-wa-505']],"grep 'req-wa-505' "+T,wq('req-wa-505')+".timestamp' "+J,['2026-08-12T15:07:02Z']);
  q(wc,'session','セッションの照合値','ログインと非公開レポート閲覧に共通するsession_idは？','sess-lab-42','同じセッションの発行と検証が独立ログでも確認できます。',[[W,'req-wa-505'],[W,'req-wa-506']],"grep 'req-wa-50' "+W,wq('req-wa-506')+".session_id' "+J);
  q(wc,'resource','閲覧されたリソース','このセッションで閲覧成功が記録されたresourceのパスは？','/reports/private','HTTP 200に加え、アプリ監査のreport_view成功とセッション検証が根拠です。',[[J,'req-wa-506'],[W,'req-wa-506']],"grep 'req-wa-506' "+T+' '+W,wq('req-wa-506')+".resource' "+J);
  q(wc,'rows','閲覧結果の行数','アプリが記録したレポートの行数は？',18,'4920はHTTPの応答サイズで、行数は監査のrows=18です。',[[J,'req-wa-506'],[A,'req-wa-506']],"grep 'req-wa-506' "+A+' '+T,wq('req-wa-506')+".rows' "+J);
  q(wc,'mfa','MFAの観測値','この成功ログインのmfa_usedの真偽値は？','false','このログインでMFAを使わなかった記録です。設定や他のログインについては断定しません。',[[J,'req-wa-505']],"grep 'req-wa-505' "+J,wq('req-wa-505')+".mfa_used' "+J);
  q(wc,'revoke-time','失効時刻','このセッションのrevoke成功は何時何分何秒？（UTC）','15:09:20','アプリのlogout成功と独立セッション監査のrevokeが対応します。',[[T,'req-wa-507'],[W,'req-wa-507']],"grep 'event=revoke' "+W,"grep 'req-wa-507' "+T+' '+W,['2026-08-12T15:09:20Z']);
  walk(wc,'認証対象の分布を見る',"jq -r 'select(.action == \"login\") | .actor' "+J+' | sort | uniq -c','失敗と成功を含む試行の分布です。認証失敗件数とは異なります。');
  walk(wc,'セッションの一生を追う',"grep 'sess-lab-42' "+W,'発行・検証・失効をそれぞれ確認します。');

  // A redirect is followed by the server; a separate egress log proves the fetch.
  const N='/var/log/egress/http.log';
  const ss=base('ssrf','preview-01',16,N,(at,rid)=>at+' preview-01 egress_audit src=192.0.2.60 dst=198.51.100.40 host=docs.vendor.example status=200 bytes=256 result=success request_id='+rid);
  const sb=logs(ss),si='203.0.113.143';
  event(ss,iso(16,5,0),si,'/preview?url=http%3A%2F%2Fconfig.internal.test%2Fadmin',400,80,'req-ssrf-401',{action:'url_fetch',result:'denied',reason:'destination_policy',initial_url:'http://config.internal.test/admin',bytes:0});
  event(ss,iso(16,6,5),si,'/preview?url=http%3A%2F%2Fpreview.vendor.example%2Fredirect',200,512,'req-ssrf-402',{action:'url_fetch',result:'success',initial_url:'http://preview.vendor.example/redirect',final_url:'http://config.internal.test/status',redirects:1,bytes:512});
  line(ss,iso(16,6,4),'egress_audit src=192.0.2.60 dst=198.51.100.41 host=preview.vendor.example status=302 bytes=145 result=redirect location=http://config.internal.test/status request_id=req-ssrf-402');
  line(ss,iso(16,6,5),'egress_audit src=192.0.2.60 dst=192.0.2.80 host=config.internal.test status=200 bytes=512 result=success request_id=req-ssrf-402');
  event(ss,iso(16,7,8),si,'/preview?url=http%3A%2F%2Fstatus.vendor.example%2Fhealth',200,64,'req-ssrf-403',{action:'url_fetch',result:'error',reason:'timeout',initial_url:'http://status.vendor.example/health',bytes:0});
  line(ss,iso(16,7,8),'egress_audit src=192.0.2.60 dst=198.51.100.42 host=status.vendor.example status=none bytes=0 result=timeout request_id=req-ssrf-403');
  const sc=build(ss,'SSRFとサーバー外向き通信','利用者の要求とサーバー自身の通信、リダイレクト先を照合します。',sb,'URL取得の異常を追加',['URLプレビューサービスです。利用者のIPと、サーバーが外向き通信に使うIPを区別します。','リダイレクト先の再検証が調査対象です。内部サービス取得の事実と、内容の機密性は別に判断してください。']);
  const sq=id=>"jq -r 'select(.request_id == \""+id+"\") | ";
  q(sc,'source','外部要求元','調査対象のURL取得を要求した利用者の送信元IPは？',si,'アクセス元はサーバーの外向きsrcとは別です。',[[A,'req-ssrf-402'],[J,'req-ssrf-402']],"grep 'req-ssrf-' "+T,sq('req-ssrf-402')+".src_ip' "+J);
  q(sc,'blocked','拒否された要求','destination_policyで拒否されたrequest_idは？','req-ssrf-401','入力の要求はありますが、対応する外向き通信は記録されていません。',[[T,'req-ssrf-401']],"grep 'destination_policy' "+T,"grep 'req-ssrf-401' "+T);
  q(sc,'confirmed','取得を確認した要求','内部サービスの応答取得を別の通信ログでも確認できるrequest_idは？','req-ssrf-402','アプリの成功と内部宛てegressの200・512バイトが一致します。',[[T,'req-ssrf-402'],[N,'host=config.internal.test']],"grep 'req-ssrf-' "+N,"grep 'req-ssrf-402' "+T+' '+N);
  q(sc,'internal-ip','最終接続先IP','実際に応答を取得した内部サービスのdst IPは？','192.0.2.80','初期URLの外部IPではなく、リダイレクト後の接続先です。',[[N,'host=config.internal.test']],"grep 'req-ssrf-402' "+N,"grep 'host=config.internal.test ' "+N+" | awk '{print $5}'",['dst=192.0.2.80']);
  q(sc,'worker-ip','通信したサーバー','内部宛て通信を発信したサーバーのsrc IPは？','192.0.2.60','外部利用者の203.0.113.143が直接接続した記録ではありません。',[[N,'host=config.internal.test']],"grep 'host=config.internal.test ' "+N,"grep 'host=config.internal.test ' "+N+" | awk '{print $4}'",['src=192.0.2.60']);
  q(sc,'redirect','転送応答のコード','初期接続先が返したリダイレクトのHTTPステータスは？',302,'同じrequest_idの次の接続が内部ホストへ進んでいます。',[[N,'result=redirect']],"grep 'req-ssrf-402' "+N,"grep 'result=redirect ' "+N+" | awk '{print $7}'",['status=302']);
  q(sc,'bytes','取得した応答量','内部サービスから取得した応答は何バイト？',512,'アプリのbytesとegressのbytesが一致します。HTTP 200だけに依存しません。',[[J,'req-ssrf-402'],[N,'host=config.internal.test']],"grep 'req-ssrf-402' "+N,sq('req-ssrf-402')+".bytes' "+J);
  q(sc,'egress-count','外向き試行数','対象req-ssrf-40で始まる要求の外向き通信記録は合計何件？',3,'転送元、転送先、タイムアウトの3件。拒否要求は含まれません。',[[N,'result=redirect'],[N,'result=timeout']],"grep 'req-ssrf-40' "+N,"grep 'req-ssrf-40' "+N+' | wc -l');
  q(sc,'success-count','取得成功数','対象3要求のうち、アプリが取得成功を記録したものは何件？',1,'外向き通信数3件、利用者のHTTP 200が2件、取得成功1件を区別します。',[[T,'req-ssrf-402'],[T,'req-ssrf-403']],"grep 'req-ssrf-40' "+T,"grep 'req-ssrf-40' "+T+" | grep 'result=success ' | wc -l");
  q(sc,'final-url','最終URL','取得成功のfinal_url全文は？','http://config.internal.test/status','初期URLと最終URLのホストが違うことが調査の要点です。',[[J,'req-ssrf-402'],[N,'result=redirect']],"grep 'req-ssrf-402' "+T,sq('req-ssrf-402')+".final_url' "+J);
  walk(sc,'一つの要求の転送を追う',"grep 'req-ssrf-402' "+T+' '+N,'外部利用者の要求、302、内部サービス応答の順に照合します。');
  walk(sc,'HTTP 200と取得成功を分ける',"grep 'req-ssrf-40' "+T,'取得失敗でもフロント側HTTPが200の要求があります。');

  // Artifact IDs link uploads to file creation and a later process observation.
  const U='/var/log/audit/artifact.log';
  const us=base('upload','media-01',17,U,(at,rid)=>at+' media-01 artifact_audit event=stat path=/srv/www/assets/logo.png user=media-web result=success request_id='+rid);
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
  const uq=id=>"jq -r 'select(.request_id == \""+id+"\") | ";
  q(uc,'source','要求元','関連するアップロードと参照を行った送信元IPは？',ui,'アップロードと参照要求の送信元が一致します。',[[A,'req-up-403'],[A,'req-up-404']],"grep 'req-up-' "+A,uq('req-up-403')+".src_ip' "+J);
  q(uc,'denied','検証で拒否された要求','拡張子の検証で拒否されたrequest_idは？','req-up-402','同じ名前でも正規入口では拒否され、作成イベントがありません。',[[T,'req-up-402']],"grep 'extension_blocked' "+T,"grep 'req-up-402' "+T+' '+A);
  q(uc,'route','保存を許した入口','疑わしいファイルを保存したHTTP入口のパスは？','/upload-legacy','アプリのlegacy保存結果と、実際のcreateイベントが対応します。',[[A,'req-up-403'],[U,'req-up-403']],"grep 'req-up-403' "+A+' '+U,"grep 'req-up-403' "+A+" | awk '{print $7}'");
  q(uc,'type','実体の種類','画像と申告された疑わしいファイルのdetected_typeは？','text/plain','申告のimage/pngと実体のtext/plainが一致していません。',[[J,'req-up-403']],"grep 'req-up-403' "+T,uq('req-up-403')+".detected_type' "+J);
  q(uc,'path','保存先','ファイル作成監査でも確認できる疑わしいファイルの保存先は？','/srv/www/uploads/f-702.php','利用者のfilenameと実際の保存先を分けて読みます。',[[J,'req-up-403'],[U,'req-up-403']],"grep 'req-up-403' "+T+' '+U,uq('req-up-403')+".stored_path' "+J);
  q(uc,'file-id','成果物の照合値','保存と後の参照・プロセス記録を結ぶfile_idは？','f-702','request_idは保存と参照で変わりますが、file_idは同じです。',[[U,'req-up-403'],[U,'event=exec']],"grep 'f-702' "+U,uq('req-up-404')+".file_id' "+J);
  q(uc,'exe','予期しない子プロセス','execと終了コード0の両方が確認できる実行ファイルは？','/usr/bin/id','参照HTTP 200に加えて独立プロセス監査が実行を裏付けます。',[[U,'event=exec'],[U,'event=exit']],"grep 'req-up-404' "+U,"grep 'event=exec ' "+U+" | awk '{print $7}'",['exe=/usr/bin/id']);
  q(uc,'user','実行権限','この予期しない子プロセスを動かしたOSユーザーは？','www-data','アップロード保存のmedia-webと実行のwww-dataは別の主体です。',[[U,'event=exec'],[U,'req-up-403']],"grep 'event=exec ' "+U,"grep 'event=exec ' "+U+" | awk '{print $8}'",['user=www-data']);
  q(uc,'stored-count','保存数の集計','対象送信元のアップロードのうち保存成功は何件？',2,'正常なPNGと疑わしいPHPの2件。拒否と後の参照は加算しません。',[[T,'req-up-401'],[T,'req-up-403']],"grep 'req-up-' "+T,"grep 'req-up-' "+T+" | grep 'action=upload ' | grep 'result=stored ' | wc -l");
  q(uc,'stored-bytes','保存量の合計','対象送信元が保存できたファイルのbytesの合計は？',2196,'2048バイトと148バイトで2196。HTTP応答サイズや拒否入力を加算しません。',[[J,'req-up-401'],[J,'req-up-403']],"jq -r 'select(.action == \"upload\" and .result == \"stored\") | .bytes' "+J,"jq -r 'select(.action == \"upload\" and .result == \"stored\") | .bytes' "+J+' | sort | uniq -c');
  walk(uc,'保存から参照へIDで追う',"grep 'f-702' "+T+' '+U,'保存と参照は異なるrequest_idです。共通file_idで作成・利用を照合します。');
  walk(uc,'実行主体と終了を確認する',"grep 'req-up-404' "+U,'execの主体はwww-data、同じpidのexitは0です。実行内容の拡大は推測しません。');

  // Deliberate removal is visible locally; the independent collector retains requests.
  const F='/var/log/auth.log', C='/var/log/collector/nginx-access.log';
  const ts=base('tamper','edge-02',18,F,(at,rid,i)=>at+' edge-02 sshd['+(8000+i)+']: Accepted publickey for ops from 192.0.2.10 port '+(55000+i)+' ssh2: ED25519 SHA256:FICTIONALTRAININGKEY');
  const normalAccess=ts.a.slice(),activeBefore=txt(normalAccess.slice(-20));
  const tb=logs(ts);tb[A]=activeBefore;tb[C]=txt(normalAccess);
  ts.x.push(iso(18,4,0)+' edge-02 sshd[9010]: Accepted publickey for maint from 192.0.2.77 port 56100 ssh2');
  ts.x.push(iso(18,6,0)+' edge-02 sudo[9020]: maint : TTY=pts/2 ; PWD=/home/maint ; USER=root ; COMMAND=/usr/bin/editor /var/log/nginx/access.log');
  pair(ts,iso(18,6,2),{action:'file_truncate',result:'success',actor:'maint',auid:1005,euid:0,pid:9024,ppid:9020,exe:'/usr/bin/editor',path:A,old_size:activeBefore.length,new_size:0,audit_serial:4801,request_id:'local-4801'});
  const after=[http(iso(18,7,0),'192.0.2.20','/health',200,32,'req-after-1'),http(iso(18,8,0),'192.0.2.21','/help',200,96,'req-after-2')];
  pair(ts,iso(18,7,1),{action:'file_append',result:'success',actor:'nginx',path:A,bytes:after[0].length+1,new_size:after[0].length+1,audit_serial:4802,request_id:'local-4802'});
  pair(ts,iso(18,8,1),{action:'file_append',result:'success',actor:'nginx',path:A,bytes:after[1].length+1,new_size:txt(after).length,audit_serial:4803,request_id:'local-4803'});
  ts.a=after;ts.x.sort();
  const tc=build(ts,'ログ改変と独立監査の照合','失われたローカルログを、別収集ログ・sudo・ファイル監査で調べます。',tb,'ログ改変の記録を追加',['このケースでは対象access.logの正常行が意図的に消えます。別収集ログには元の要求が残ります。','通常のローテーション等と即断せず、sudoの主体、PID、ファイル監査の操作と実効権限を照合します。']);
  tc.files[C]=txt(normalAccess.concat(after));tc.logPaths.push(C);
  tc.files['/home/analyst/README.txt']=readme(tc.title,tc.logPaths,false);
  tc.baselineFiles['/home/analyst/README.txt']=readme(tc.title,tc.logPaths,true);
  const tq="jq -r 'select(.audit_serial == 4801) | ";
  q(tc,'actor','操作主体','sudoとファイル改変監査に共通する操作アカウントは？','maint','sudoの実行者と監査actorが一致します。rootは実効権限であり元の操作主体と別です。',[[F,'sudo[9020]'],[J,'"audit_serial":4801']],"grep 'sudo' "+F,tq+".actor' "+J);
  q(tc,'source','SSH接続元','このアカウントがSSH認証に成功した送信元IPは？','192.0.2.77','SSH成功とその後のsudo操作を時系列で結びます。接続元だけで実在人物までは特定できません。',[[F,'sshd[9010]']],"grep 'Accepted publickey for maint' "+F,"grep 'Accepted publickey for maint' "+F+" | awk '{print $9}'");
  q(tc,'path','改変されたログ','file_truncate成功の対象パスは？',A,'ローカルの対象ログと別収集ログは異なる保存先です。',[[J,'"audit_serial":4801'],[F,'sudo[9020]']],"grep 'action=file_truncate ' "+T,tq+".path' "+J);
  q(tc,'old-size','改変直前のサイズ','監査が記録した改変直前のold_sizeは何バイト？',activeBefore.length,'監査のold_sizeは正常スナップショットの対象ファイルのバイト数と一致します。',[[J,'"audit_serial":4801']],"grep 'action=file_truncate ' "+T,tq+".old_size' "+J);
  q(tc,'active-count','残ったローカル要求','攻撃後の対象access.logに残る要求は何件？',2,'後から追記された2件だけで、先行する正常20行は残っていません。',[[A,'req-after-1'],[A,'req-after-2']],"cat "+A,'wc -l '+A);
  q(tc,'collector-count','別収集ログの要求数','別収集ログに残る要求は全部で何件？',62,'正常60件と後の2件が保全されています。ローカル2件だけで通信が2件だったとは判断できません。',[[C,'normal-000'],[C,'req-after-2']],"grep 'request_id=' "+C,"grep 'request_id=' "+C+' | wc -l');
  q(tc,'euid','操作の実効権限','file_truncate時のeuidの数値は？',0,'euid=0の操作です。元のログイン主体を表すauid=1005とは区別します。',[[J,'"audit_serial":4801']],"grep 'action=file_truncate ' "+T,tq+".euid' "+J);
  q(tc,'pid','操作プロセス','実際にfile_truncateを行ったpidは？',9024,'そのppid=9020がsudoログのプロセス番号と一致します。',[[J,'"audit_serial":4801'],[F,'sudo[9020]']],"grep 'action=file_truncate ' "+T,tq+".pid' "+J);
  q(tc,'serial','独立監査の識別子','file_truncate成功のaudit_serialは？',4801,'後の通常追記4802・4803とは違うイベント識別子です。',[[J,'"audit_serial":4801']],"grep 'file_truncate' "+T,"jq -r 'select(.action == \"file_truncate\") | .audit_serial' "+J);
  q(tc,'gap','認証から改変まで','SSH認証成功からfile_truncate成功までは何秒？',122,'18:04:00から18:06:02まで122秒です。sudoの時刻18:06:00と実際の改変時刻を分けます。',[[F,'sshd[9010]'],[T,'audit_serial=4801']],"grep 'Accepted publickey for maint' "+F,"grep 'audit_serial=4801' "+T);
  walk(tc,'ローカルと独立収集の件数を比べる','wc -l '+A+' '+C,'攻撃後は2行対62行。保存先の違いを意識します。');
  walk(tc,'sudoと監査の親子関係を見る',"grep -F 'sudo[9020]' "+F+"; grep 'audit_serial=4801' "+T,'操作の主体、ppid、実効権限、0バイトへの変更を照合します。');
  globalThis.LOG_LAB_CASES.push(...[pc,wc,sc,uc,tc].map(finish));
})();
