/* Optional entry practice and evidence-based exit checks. Original case IDs and scores stay unchanged. */
(function(root){
  'use strict';
  root.LOGROOM_UI_TRANSLATIONS ||= {en:{},th:{}};
  root.LOGROOM_CASE_TRANSLATIONS ||= {en:{},th:{}};
  const L=(ja,en,th)=>{for(const [lang,value]of [['en',en],['th',th]]){root.LOGROOM_UI_TRANSLATIONS[lang]||={};root.LOGROOM_UI_TRANSLATIONS[lang][ja]=value;}return ja;};
  const refs=(c,items)=>items.map(([id,path,fragment])=>{const lines=c.files[path].trimEnd().split('\n'),index=lines.findIndex(line=>line.includes(fragment));if(index<0)throw Error('Missing exit evidence '+c.id+'/'+id);return{id,path,line:index+1,quote:lines[index]};});
  const originalCases=root.LOG_LAB_CASES;
  const path='/var/log/entry.log',out='/home/analyst/evidence.txt';
  const rows=[
    'Aug 12 09:00:01 entry-01 sshd[101]: Failed password for invalid user guest from 198.51.100.41 port 50001 ssh2',
    'Aug 12 09:00:02 entry-01 sshd[102]: Accepted publickey for ops from 192.0.2.10 port 50002 ssh2',
    'Aug 12 09:00:03 entry-01 sshd[103]: Failed password for deploy from 198.51.100.41 port 50003 ssh2',
    'Aug 12 09:00:04 entry-01 sshd[104]: Failed password for invalid user test from 203.0.113.19 port 50004 ssh2',
    'Aug 12 09:00:05 entry-01 sshd[105]: pam_unix(sshd:session): session opened for user ops(uid=1001) by (uid=0)',
    'Aug 12 09:00:06 entry-01 sshd[106]: Failed password for root from 198.51.100.41 port 50006 ssh2'
  ];
  const failureRows=rows.filter(line=>line.includes('Failed password'));
  const introReadme=L('ケース0：検索・抽出・集計・保存\n2026年8月12日、採取条件はUTC。6行の架空SSHログです。\n使い慣れている方は左のケース一覧から既存演習へ進めます。\n調査対象: /var/log/entry.log\n保存先: /home/analyst/evidence.txt\n',
    'Case 0: Search, extract, count and save\nCaptured on 12 August 2026 in UTC. Six fictional SSH log lines.\nExperienced learners can select any existing case from the case list.\nInvestigate: /var/log/entry.log\nSave to: /home/analyst/evidence.txt\n',
    'กรณี 0: ค้นหา แยกข้อมูล นับ และบันทึก\nเก็บข้อมูลวันที่ 12 สิงหาคม 2026 เวลา UTC มีบันทึก SSH จำลอง 6 บรรทัด\nผู้ที่คุ้นเคยแล้วเลือกกรณีเดิมจากรายการได้ทันที\nตรวจสอบ: /var/log/entry.log\nบันทึกที่: /home/analyst/evidence.txt\n');
  const intro={id:'entry',entry:true,title:L('検索から根拠保存までの4歩','Four steps from search to saved evidence','4 ขั้นตอนจากการค้นหาถึงการบันทึกหลักฐาน'),shortTitle:L('導入：4つの基本操作','Start: four basic operations','เริ่มต้น: 4 การทำงานพื้นฐาน'),level:L('導入','Entry','เริ่มต้น'),minutes:15,
    summary:L('6行のログで操作を思い出します。既存ケースへ自由に進めます。','Refresh your skills with six log lines. You can freely select any existing case.','ทบทวนทักษะด้วยบันทึก 6 บรรทัด และเลือกกรณีเดิมได้อย่างอิสระ'),
    briefing:[L('失敗、成功、セッションの記録が混在します。数える対象を決めてから抽出します。','Failure, success and session records are mixed. Define what you are counting before extracting it.','มีบันทึกความล้มเหลว ความสำเร็จ และเซสชันปะปนกัน กำหนดสิ่งที่จะนับก่อนแยกข้อมูล'),L('invalid userの有無で列数が変わります。末尾からの位置はこの教材のFailed password行で使えます。','The number of columns changes with invalid user. Counting from the end works for the Failed password records in this exercise.','จำนวนคอลัมน์เปลี่ยนเมื่อมี invalid user การนับจากท้ายใช้ได้กับบรรทัด Failed password ในแบบฝึกนี้')],
    files:{[path]:rows.join('\n')+'\n','/etc/hostname':'entry-01\n','/home/analyst/README.txt':introReadme},
    logPaths:[path],clockNote:L('採取条件：2026年8月12日・UTC。','Capture conditions: 12 August 2026, UTC.','เงื่อนไขการเก็บข้อมูล: 12 สิงหาคม 2026 เวลา UTC'),initialCommand:'cat /home/analyst/README.txt',
    tasks:[],walkthrough:[],preparation:[],context:{},debrief:{knowledge:[],history:[],references:[],stages:[]}
  };
  const task=(id,label,prompt,answer,hints,evidenceRows,explanation)=>({id,label,prompt,answer,accepted:[answer],placeholder:L('値を入力','Enter a value','ป้อนค่า'),hints,evidence:evidenceRows.map(i=>({path,line:i+1,quote:rows[i]})),explanation});
  intro.tasks=[
    task('select',L('1. 対象を選ぶ','1. Select the records','1. เลือกบันทึก'),L('認証失敗だけを取り出す検索文字列は？（行中の連続した英語2語）','Which two consecutive English words select password authentication failures?','คำภาษาอังกฤษ 2 คำที่ติดกันในบรรทัดใดใช้เลือกการยืนยันตัวตนด้วยรหัสผ่านที่ล้มเหลว?'),'Failed password',[
      {text:L('catで6行を読み、失敗・成功・セッションの表記を比べます。','Use cat to compare the failure, success and session wording in all six lines.','ใช้ cat เปรียบเทียบข้อความความล้มเหลว ความสำเร็จ และเซสชันทั้ง 6 บรรทัด'),command:'cat '+path},
      {text:L('grep -Fは入力した文字列をそのまま検索します。','grep -F searches for the literal string.','grep -F ค้นหาข้อความตามตัวอักษร'),command:"grep -F 'Failed password' "+path}
    ],[0,2],L('Failed passwordの4行が対象です。成功やセッション開始は失敗に数えません。','The four Failed password lines are relevant. Success and session starts are not failures.','เลือก 4 บรรทัด Failed password ไม่นับความสำเร็จหรือการเริ่มเซสชันเป็นความล้มเหลว')),
    task('extract',L('2. 列の違いを確かめる','2. Handle different columns','2. ตรวจสอบคอลัมน์ที่ต่างกัน'),L('最初の失敗行と09:00:03の失敗行に共通する送信元IPは？','What source IP is shared by the first failure and the failure at 09:00:03?','IP ต้นทางใดตรงกันในบรรทัดความล้มเหลวแรกและเวลา 09:00:03?'),'198.51.100.41',[
      {text:L('invalid userがある行とない行で、固定列を指定した結果を比べます。','Compare a fixed column in records with and without invalid user.','เปรียบเทียบคอลัมน์ตำแหน่งคงที่ในบรรทัดที่มีและไม่มี invalid user'),command:"grep -F 'Failed password' "+path+" | awk '{print $11}'"},
      {text:L('NFは列数です。$(NF-3)は末尾から4番目。この形式では送信元IPです。','NF is the number of fields. $(NF-3) is the fourth field from the end: the source IP in this format.','NF คือจำนวนฟิลด์ $(NF-3) คือฟิลด์ที่ 4 จากท้าย ซึ่งเป็น IP ต้นทางในรูปแบบนี้'),command:"grep -F 'Failed password' "+path+" | awk '{print $(NF-3)}'"}
    ],[0,2],L('同じ送信元です。固定列ではinvalid userの有無により異なる値を取り出す場合があります。','The source is the same. A fixed column may extract different values when invalid user changes the field count.','เป็นต้นทางเดียวกัน คอลัมน์ตำแหน่งคงที่อาจให้ค่าต่างกันเมื่อ invalid user เปลี่ยนจำนวนฟิลด์')),
    task('count',L('3. 条件をそろえて集計する','3. Count a consistent event type','3. นับเหตุการณ์ภายใต้เงื่อนไขเดียวกัน'),L('198.51.100.41からのFailed passwordは何件？','How many Failed password records come from 198.51.100.41?','มีบันทึก Failed password จาก 198.51.100.41 กี่รายการ?'),'3',[
      {text:L('同じIPを隣に並べてから数えます。','Sort matching IPs next to each other before counting them.','จัดเรียง IP เดียวกันให้อยู่ติดกันก่อนนับ'),command:"grep -F 'Failed password' "+path+" | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr"}
    ],[0,2,5],L('このIPは3件、別IPは1件です。認証失敗の行数を数え、利用者数やセッション数とは区別します。','This IP has three failures and the other IP has one. Count failure records, not users or sessions.','IP นี้มีความล้มเหลว 3 รายการ อีก IP มี 1 รายการ นับบันทึกความล้มเหลว ไม่ใช่จำนวนผู้ใช้หรือเซสชัน')),
    {...task('save',L('4. 根拠をファイルへ残す','4. Save the evidence to a file','4. บันทึกหลักฐานลงไฟล์'),L('失敗4行を元の順序・元の内容のまま /home/analyst/evidence.txt に保存し、提出してください。','Save all four failure lines, unchanged and in their original order, to /home/analyst/evidence.txt, then submit the file.','บันทึกบรรทัดความล้มเหลวทั้ง 4 บรรทัดตามลำดับเดิมโดยไม่แก้ไขลง /home/analyst/evidence.txt แล้วส่งไฟล์'),failureRows.join('\n')+'\n',[
      {text:L('>は出力をファイルに保存します。保存後にcatで内容を確かめます。','> saves output to a file. Read it with cat after saving.','> บันทึกผลลัพธ์ลงไฟล์ ใช้ cat ตรวจสอบหลังบันทึก'),command:"grep -F 'Failed password' "+path+' > '+out},
      {text:L('保存したファイルを読んで4行を確認します。','Read the saved file and check all four lines.','อ่านไฟล์ที่บันทึกและตรวจสอบทั้ง 4 บรรทัด'),command:'cat '+out}
    ],[0,2,3,5],L('根拠は元のログ行を残します。IPだけの集計表では、どの記録を数えたか後から確認できません。','Preserve the original log lines as evidence. An IP-only count does not show which records were counted.','เก็บบรรทัดบันทึกต้นฉบับเป็นหลักฐาน ตารางนับเฉพาะ IP ไม่บอกว่ามาจากบันทึกใด')),kind:'file',outputPath:out}
  ];
  intro.baselineFiles={...intro.files};
  intro.attack={label:L('導入用ログ','Entry practice logs','บันทึกสำหรับแบบฝึกเริ่มต้น'),summary:intro.summary};
  intro.context={situation:intro.summary,objective:intro.briefing[0],period:intro.clockNote,hosts:[{name:'entry-01',role:L('練習用ログのホスト','Practice log host','โฮสต์ของบันทึกแบบฝึก'),address:L('この演習では不要','Not needed for this exercise','ไม่จำเป็นสำหรับแบบฝึกนี้'),services:['SSH']}],network:L('操作端末 → entry-01のSSHサービス、という接続の認証・セッション記録を /var/log/entry.log にまとめています。このケースでは1つの採取済みログを読みます。','Authentication and session records for client → entry-01 SSH connections are collected in /var/log/entry.log. This case uses one captured log file.','รวบรวมบันทึกการยืนยันตัวตนและเซสชันของการเชื่อมต่อจากเครื่องลูกข่าย → บริการ SSH บน entry-01 ไว้ใน /var/log/entry.log กรณีนี้ใช้ไฟล์บันทึกที่เก็บไว้หนึ่งไฟล์'),normalBehavior:[intro.briefing[0]],logSources:[{path,description:L('6行の認証・セッション記録','Six authentication and session records','บันทึกการยืนยันตัวตนและเซสชัน 6 บรรทัด')}],assumptions:[intro.clockNote]};
  intro.debrief={title:intro.title,summary:intro.summary,knowledge:[],history:[],references:[],stages:[],cause:L('対象を選び、形式を確かめ、集計して元の根拠を保存します。','Select relevant records, inspect their format, count them and preserve the original evidence.','เลือกบันทึกที่เกี่ยวข้อง ตรวจสอบรูปแบบ นับ และเก็บหลักฐานต้นฉบับ'),impact:L('失敗の件数を確認できました。認証成功や侵害を示すものではありません。','You established the failure count. This does not prove successful authentication or compromise.','ยืนยันจำนวนความล้มเหลวได้ แต่ไม่ได้พิสูจน์การยืนยันตัวตนสำเร็จหรือการบุกรุก'),limits:[],remediation:[],lessons:[]};
  root.LOG_LAB_CASES=[intro,...originalCases];

  const countNote=L('まず対象期間・イベント種別・数える単位を決めます。','First define the time range, event type and counting unit.','กำหนดช่วงเวลา ชนิดเหตุการณ์ และหน่วยนับก่อน');
  const jsonCountNote=L('まず対象期間・イベント種別・数える単位を決めます。同じイベントのテキスト版とJSONL版は二重に数えません。','First define the time range, event type and counting unit. Text and JSONL views of the same event are not separate events.','กำหนดช่วงเวลา ชนิดเหตุการณ์ และหน่วยนับก่อน มุมมองข้อความและ JSONL ของเหตุการณ์เดียวกันไม่ใช่คนละเหตุการณ์');
  const httpNote=L('HTTPは要求と応答を記録します。認証・認可・データ処理の成功は、対応するアプリ監査で別に確認します。','HTTP records requests and responses. Confirm authentication, authorization and business processing separately in the matching application audit.','HTTP บันทึกคำขอและคำตอบ ตรวจสอบความสำเร็จของการยืนยันตัวตน การอนุญาต และการประมวลผลธุรกิจแยกในบันทึกตรวจสอบแอปที่ตรงกัน');
  const idNote=L('共通IDは同じ処理を照合する手掛かりです。IDの意味、ホスト、期間、対象が整合するかも確かめます。','A shared ID helps correlate a process. Also verify what the ID means and whether the host, time range and target agree.','ID ร่วมช่วยเชื่อมโยงการประมวลผล ต้องตรวจสอบความหมายของ ID โฮสต์ ช่วงเวลา และเป้าหมายให้สอดคล้องกันด้วย');
  const principles={
    entry:[intro.briefing[0],intro.briefing[1]],
    ssh:[L('SSHのFailedは認証失敗、Acceptedは認証成功です。セッション開始・終了は別の記録です。sudoは元の利用者と実効権限、COMMANDを分けて読みます。','In SSH logs, Failed means authentication failure and Accepted means success. Session start/end are separate records. In sudo logs, distinguish the original user, effective privileges and COMMAND.','ในบันทึก SSH Failed คือยืนยันตัวตนล้มเหลว Accepted คือสำเร็จ การเริ่มและจบเซสชันเป็นคนละบันทึก สำหรับ sudo ให้แยกผู้ใช้เดิม สิทธิ์ที่ใช้จริง และ COMMAND'),countNote],
    web:[httpNote,idNote,L('Z/+0000はUTC、+0900は日本時間です。同じ瞬間でも表示時刻が9時間違います。時刻だけで同じ要求と決めません。','Z/+0000 is UTC; +0900 is Japan time. The same instant has a nine-hour display difference. Time alone does not identify a request.','Z/+0000 คือ UTC ส่วน +0900 คือเวลาญี่ปุ่น เวลาแสดงต่างกัน 9 ชั่วโมงแม้เป็นขณะเดียวกัน อย่าใช้เวลาเพียงอย่างเดียวระบุคำขอ')],
    egress:[L('DNSは名前に関する回答です。回答があっても接続・転送成功は別の記録で確かめます。プロキシの送受信量は、この教材の計測方向と単位で読みます。','DNS provides answers about names. Check separate records for connection or transfer success. Interpret proxy byte counts using the direction and units defined for this exercise.','DNS ให้คำตอบเกี่ยวกับชื่อ การเชื่อมต่อหรือถ่ายโอนสำเร็จต้องตรวจจากบันทึกอื่น อ่านปริมาณข้อมูลพร็อกซีตามทิศทางและหน่วยที่แบบฝึกกำหนด'),L('SMTPのキューIDで受付から配送まで追えます。status=sentと250応答は配送先による受付を示し、人の読了や内容の機密性は示しません。','An SMTP queue ID links acceptance and delivery. status=sent with a 250 response shows acceptance by the receiving server, not human readership or confidentiality of the content.','ID คิว SMTP เชื่อมโยงการรับและนำส่ง status=sent พร้อมคำตอบ 250 แสดงว่าเซิร์ฟเวอร์ปลายทางรับแล้ว ไม่ได้แสดงว่ามีคนอ่านหรือเนื้อหาเป็นความลับ'),countNote],
    sqli:[L('SQLインジェクションは入力が問い合わせの構造に影響する問題です。パラメータ化は構造と値を分離します。記号があるだけでは不正とは判断できません。','SQL injection occurs when input affects query structure. Parameterization separates structure from values. Punctuation alone does not establish malicious input.','SQL injection เกิดเมื่ออินพุตมีผลต่อโครงสร้างคำสั่งค้นหา การใช้พารามิเตอร์แยกโครงสร้างออกจากค่า เครื่องหมายเพียงอย่างเดียวไม่ได้บ่งชี้อินพุตอันตราย'),httpNote,countNote],
    cmdinj:[L('入力をシェル用文字列へ連結すると、その一部が命令の区切りとして解釈される場合があります。入力の記号だけで実行成功と決めず、プロセスのexecとexitを照合します。','Concatenating input into a shell string can make some input act as command syntax. Check process exec and exit records; punctuation alone does not prove execution.','การนำอินพุตมาต่อเป็นข้อความเชลล์อาจทำให้บางส่วนกลายเป็นไวยากรณ์คำสั่ง ตรวจสอบบันทึก exec และ exit ของโปรเซส เครื่องหมายเพียงอย่างเดียวไม่พิสูจน์การทำงาน'),L('pidはプロセス、ppidは親プロセスのIDです。同じホスト・時間範囲で親子を照合し、実行ユーザーと終了状態も読みます。','pid identifies a process and ppid its parent. Correlate them on the same host and within the relevant time range, then check execution identity and exit status.','pid ระบุโปรเซสและ ppid ระบุโปรเซสแม่ เชื่อมโยงบนโฮสต์เดียวกันและช่วงเวลาที่เกี่ยวข้อง แล้วตรวจผู้ใช้ที่รันและสถานะการจบ'),countNote],
    pathtraversal:[L('入力パス、正規化された絶対パス、許可ルートを分けます。領域外への要求と、OSで実際に読めた結果は別の観測です。','Distinguish input paths, normalized absolute paths and the allowed root. A request outside the root and an actual successful OS read are different observations.','แยกพาธอินพุต พาธสัมบูรณ์ที่ปรับรูปแบบแล้ว และรูทที่อนุญาต คำขอนอกขอบเขตกับการอ่านสำเร็จจริงใน OS เป็นคนละสิ่งที่สังเกตได้'),httpNote,countNote],
    webauth:[L('認証、セッション発行、利用、失効は別の段階です。要求IDは1要求、セッションの照合値は複数の要求をつなぐことがあります。','Authentication, session issuance, use and revocation are separate stages. A request ID identifies one request; a session correlation value may link multiple requests.','การยืนยันตัวตน ออกเซสชัน ใช้งาน และเพิกถอนเป็นคนละขั้น ID คำขอระบุคำขอหนึ่งรายการ ส่วนค่าเชื่อมโยงเซสชันอาจเชื่อมหลายคำขอ'),L('mfa_usedはそのイベントでの観測です。アカウント全体の設定や他のログインの状況には広げません。','mfa_used describes the observed event. It does not establish account-wide settings or other login behavior.','mfa_used อธิบายเหตุการณ์ที่สังเกต ไม่ได้บอกการตั้งค่าทั้งบัญชีหรือพฤติกรรมการเข้าสู่ระบบอื่น'),countNote],
    ssrf:[L('SSRFでは、利用者の要求を受けたサーバー自身が別の宛先へ通信します。利用者の接続元とサーバー外向き通信のsrcを区別し、リダイレクト後の宛先も追います。','In SSRF, a server receiving a user request communicates with another destination. Distinguish the user connection source from the server egress source, and follow redirected destinations.','ใน SSRF เซิร์ฟเวอร์ที่รับคำขอผู้ใช้จะสื่อสารกับปลายทางอื่น แยกต้นทางผู้ใช้จาก src ของการส่งออกจากเซิร์ฟเวอร์ และติดตามปลายทางหลังเปลี่ยนเส้นทาง'),httpNote,idNote],
    upload:[L('申告されたファイル名・種類、検出された種類、保存先は別の情報です。保存、後の参照、実行を独立監査で確かめます。','Declared file name/type, detected type and stored path are different facts. Check independent audits for storage, later access and execution.','ชื่อและชนิดไฟล์ที่แจ้ง ชนิดที่ตรวจพบ และพาธที่บันทึกเป็นคนละข้อมูล ตรวจบันทึกอิสระสำหรับการบันทึก การเข้าถึงภายหลัง และการรัน'),L('保存と参照では要求IDが変わることがあります。file_idなど、同じ成果物を指す照合値を使います。','Upload and later access may have different request IDs. Use a correlation value such as file_id that identifies the same artifact.','การอัปโหลดและการเข้าถึงภายหลังอาจมี ID คำขอต่างกัน ใช้ค่าเช่น file_id ที่ระบุไฟล์เดียวกัน'),countNote],
    tamper:[L('ローカルに行がないだけでは削除とは限りません。保持期間・ローテーション・収集範囲を確認し、別収集ログとファイル操作監査を照合します。','Missing local lines do not by themselves prove deletion. Check retention, rotation and collection scope, then correlate independent collection and file-operation audits.','บรรทัดที่หายไปในเครื่องไม่ได้พิสูจน์การลบ ตรวจระยะเก็บ การหมุนเวียน และขอบเขตการเก็บ แล้วเทียบบันทึกจากแหล่งอื่นกับการตรวจสอบการทำงานกับไฟล์'),L('操作の事実と意図は別です。監査から主体や切り詰めを確認できても、承認された保守かどうかは業務資料が必要です。','An action and its intent are different. An audit may establish the actor and truncation, while maintenance approval requires business records.','การกระทำกับเจตนาเป็นคนละเรื่อง บันทึกตรวจสอบอาจยืนยันผู้กระทำและการตัดไฟล์ แต่การอนุมัติบำรุงรักษาต้องใช้เอกสารงาน'),countNote]
  };
  for(const c of root.LOG_LAB_CASES)c.preparation=principles[c.id].map(note=>note===countNote&&c.logPaths.some(path=>path.endsWith('.jsonl'))?jsonCountNote:note);

  // These optional checks use general examples, never the case's incident answers.
  const check=(question,right,wrong,explanation)=>({question,answer:'supported',options:[{value:'unsupported',label:wrong},{value:'supported',label:right}],explanation});
  const checks={
    ssh:check(L('SSHログイン成功だけで、sudoの成功も分かりますか？','Does an SSH login success also prove successful sudo use?','การเข้าสู่ระบบ SSH สำเร็จพิสูจน์ว่าใช้ sudo สำเร็จด้วยหรือไม่?'),L('いいえ。sudoの実行と結果を別に確認する。','No. Check sudo execution and its outcome separately.','ไม่ ต้องตรวจการรัน sudo และผลแยกต่างหาก'),L('はい。同じユーザーなら特権操作も成功している。','Yes. The same user must have completed privileged operations.','ใช่ หากเป็นผู้ใช้เดียวกันก็ต้องใช้สิทธิ์พิเศษสำเร็จ'),L('認証成功と特権操作は別イベントです。','Authentication success and privileged activity are separate events.','การยืนยันตัวตนสำเร็จและกิจกรรมสิทธิ์พิเศษเป็นคนละเหตุการณ์')),
    web:check(L('HTTP 200だけで、業務処理の成功を確定できますか？','Does HTTP 200 alone establish successful business processing?','HTTP 200 เพียงอย่างเดียวยืนยันการประมวลผลธุรกิจสำเร็จได้หรือไม่?'),L('いいえ。対応する業務監査を確認する。','No. Check the corresponding business audit.','ไม่ ต้องตรวจบันทึกตรวจสอบธุรกิจที่ตรงกัน'),L('はい。200ならすべての処理が成功している。','Yes. A 200 response means all processing succeeded.','ใช่ คำตอบ 200 หมายถึงทุกขั้นตอนสำเร็จ'),L('応答の成功と、認可・出力などの業務結果は分けて読みます。','Distinguish a successful response from authorization, export and other business outcomes.','แยกคำตอบที่สำเร็จจากผลธุรกิจ เช่น การอนุญาตและการส่งออก')),
    egress:check(L('SMTPのstatus=sentは何を裏付けますか？','What does SMTP status=sent support?','SMTP status=sent สนับสนุนข้อสรุปใด?'),L('配送先サーバーが受け付けたこと。','Acceptance by the receiving server.','เซิร์ฟเวอร์ปลายทางรับข้อความแล้ว'),L('宛先の人が内容を読んだこと。','The recipient has read the content.','ผู้รับได้อ่านเนื้อหาแล้ว'),L('読了や内容の機密性は、この配送結果だけでは分かりません。','Delivery status alone establishes neither readership nor content confidentiality.','สถานะนำส่งเพียงอย่างเดียวไม่ยืนยันการอ่านหรือความลับของเนื้อหา')),
    sqli:check(L('SQLインジェクションを防ぐパラメータ化の役割は？','What does parameterization do to prevent SQL injection?','การใช้พารามิเตอร์ช่วยป้องกัน SQL injection อย่างไร?'),L('問い合わせの構造と入力値を分離する。','Separate query structure from input values.','แยกโครงสร้างคำสั่งค้นหาออกจากค่าอินพุต'),L('あらゆる記号を正常入力とみなす。','Treat every punctuation mark as safe input.','ถือว่าเครื่องหมายทุกชนิดเป็นอินพุตปลอดภัย'),L('入力に記号があるかではなく、入力が命令の構造になるかを考えます。','The issue is whether input becomes command structure, not merely whether it contains punctuation.','ประเด็นคืออินพุตกลายเป็นโครงสร้างคำสั่งหรือไม่ ไม่ใช่เพียงมีเครื่องหมายหรือไม่')),
    cmdinj:check(L('入力にシェルの区切り文字があるとき、実行成功を調べる根拠は？','When input contains shell delimiters, what helps verify actual execution?','เมื่ออินพุตมีตัวคั่นคำสั่งเชลล์ หลักฐานใดช่วยตรวจการรันจริง?'),L('対応するプロセスのexec・exit記録。','Matching process exec and exit records.','บันทึก exec และ exit ของโปรเซสที่ตรงกัน'),L('入力文字列に区切り文字があることだけ。','The delimiter in the input alone.','ตัวคั่นในอินพุตเพียงอย่างเดียว'),L('入力の特徴は手掛かりです。実行と結果はプロセス記録で確かめます。','Input features are clues. Verify execution and its outcome in process records.','ลักษณะอินพุตเป็นเบาะแส ต้องตรวจการรันและผลในบันทึกโปรเซส')),
    pathtraversal:check(L('許可領域外のパスを要求した記録だけで、読み出し成功は分かりますか？','Does a request outside the allowed root prove a successful read?','คำขอพาธนอกรูทที่อนุญาตพิสูจน์ว่าอ่านสำเร็จหรือไม่?'),L('いいえ。正規化パスとOSの読み出し結果を確認する。','No. Check the normalized path and OS read outcome.','ไม่ ต้องตรวจพาธที่ปรับรูปแบบแล้วและผลการอ่านของ OS'),L('はい。領域外の要求は必ず読み出しに成功する。','Yes. Requests outside the root always succeed.','ใช่ คำขอนอกรูทอ่านสำเร็จเสมอ'),L('要求・解決されたパス・実際の結果は独立して確認します。','Verify the request, resolved path and actual outcome separately.','ตรวจคำขอ พาธที่แก้ไขแล้ว และผลจริงแยกจากกัน')),
    webauth:check(L('要求IDとセッションの照合値は同じ単位ですか？','Do request IDs and session correlation values represent the same unit?','ID คำขอกับค่าเชื่อมโยงเซสชันเป็นหน่วยเดียวกันหรือไม่?'),L('いいえ。1つのセッションに複数の要求があり得る。','No. One session may contain multiple requests.','ไม่ หนึ่งเซสชันอาจมีหลายคำขอ'),L('はい。1つのセッションには要求が必ず1件だけある。','Yes. A session always has exactly one request.','ใช่ หนึ่งเซสชันมีคำขอหนึ่งรายการเสมอ'),L('IDが何を識別するかを確認してから結び付けます。','Verify what each ID identifies before correlating records.','ตรวจว่าแต่ละ ID ระบุสิ่งใดก่อนเชื่อมโยงบันทึก')),
    ssrf:check(L('SSRFのサーバー外向き通信でsrcとして現れるのは？','What appears as src in a server egress record during SSRF?','สิ่งใดปรากฏเป็น src ในบันทึกการส่งออกจากเซิร์ฟเวอร์ระหว่าง SSRF?'),L('通信を実行したサーバーのアドレス。','The address of the server making the connection.','ที่อยู่เซิร์ฟเวอร์ที่สร้างการเชื่อมต่อ'),L('必ず最初に要求を送った利用者のアドレス。','Always the address of the original user.','เป็นที่อยู่ผู้ใช้ที่ส่งคำขอแรกเสมอ'),L('利用者からの接続と、サーバーからの接続を分けて追います。','Trace the user connection and the server connection separately.','ติดตามการเชื่อมต่อจากผู้ใช้และจากเซิร์ฟเวอร์แยกกัน')),
    upload:check(L('保存後の参照で要求IDが変わった場合、何を照合しますか？','If later access has a different request ID, what can link it to an upload?','หากการเข้าถึงภายหลังมี ID คำขอต่างกัน อะไรเชื่อมกับการอัปโหลดได้?'),L('同じ成果物を指すfile_idなど。','A file_id or other value identifying the same artifact.','file_id หรือค่าอื่นที่ระบุไฟล์เดียวกัน'),L('時刻が近ければ、どのファイルでも同一とみなす。','Treat any file as the same artifact if the times are close.','ถือว่าเป็นไฟล์เดียวกันหากเวลาใกล้กัน'),L('別要求でも同じ成果物を指す値を探し、対象と期間も確認します。','Find a shared artifact identifier across requests, and verify the target and time range.','หาตัวระบุไฟล์ร่วมระหว่างคำขอ และตรวจเป้าหมายกับช่วงเวลา')),
    tamper:check(L('ローカルログに行がないとき、最初に妥当なのは？','What is a sound first step when local log lines are absent?','เมื่อไม่มีบรรทัดในบันทึกภายในเครื่อง ควรทำอะไรเป็นขั้นแรก?'),L('保持・収集範囲を確認し、独立ログと照合する。','Check retention and collection scope, then compare independent logs.','ตรวจระยะเก็บและขอบเขตการเก็บ แล้วเทียบบันทึกอิสระ'),L('行がないことだけで攻撃者による削除と断定する。','Conclude that an attacker deleted them based only on their absence.','สรุปว่าผู้โจมตีลบจากการไม่มีบรรทัดเพียงอย่างเดียว'),L('ローテーションや未収集も候補です。欠落と意図を混同しません。','Rotation and collection gaps are also possibilities. Absence does not establish intent.','การหมุนเวียนและช่องว่างการเก็บก็เป็นไปได้ การไม่มีข้อมูลไม่ได้ยืนยันเจตนา'))
  };
  // Keep answer values stable for saved progress; vary the displayed position by case.
  const firstAnswerCases=new Set(['ssh','sqli','webauth','ssrf','tamper']);
  for(const c of originalCases){
    c.conceptCheck=checks[c.id];
    if(firstAnswerCases.has(c.id))c.conceptCheck.options.reverse();
  }
  root.LOGROOM_LEARNING_GUIDE=[
    L('操作を思い出す：ケース0。対象選択・列の違い・集計・根拠保存の4操作を小さいログで確認します。省略できます。','Refresh operations: Case 0 uses small logs to practice selection, variable columns, counting and evidence saving. It is optional.','ทบทวนการทำงาน: กรณี 0 ใช้บันทึกขนาดเล็กฝึกเลือกข้อมูล คอลัมน์ที่ต่างกัน นับ และบันทึกหลักฐาน ข้ามได้'),
    L('基本の調査：SSH → Web監査 → DNS・メール・プロキシ。単一ログの検索から、複数ログの照合と引継ぎまで練習します。','Core investigation: SSH → Web audit → DNS/mail/proxy. Practice searching one log, correlating multiple sources and writing a handoff.','การตรวจสอบพื้นฐาน: SSH → ตรวจสอบเว็บ → DNS/เมล/พร็อกซี ฝึกค้นหาบันทึกเดียว เชื่อมหลายแหล่ง และส่งต่องาน'),
    L('攻撃別の応用：SQLインジェクションからログ改変までの7ケース。入力・処理・結果を別ログで確かめます。任意のケースを選んで復習できます。','Apply by attack type: seven cases from SQL injection through log tampering. Verify input, processing and outcome across logs. Choose any case for review.','ประยุกต์ตามชนิดการโจมตี: 7 กรณีตั้งแต่ SQL injection ถึงแก้ไขบันทึก ตรวจอินพุต การประมวลผล และผลจากหลายบันทึก เลือกกรณีใดเพื่อทบทวนได้'),
    L('負荷を上げる目安：根拠を説明できたら実践モードへ。正常コピーなし・権限・過去ログ・大量ログを扱います。順番とモードは自由に選べます。','Increase difficulty when you can explain your evidence: practice mode adds permissions, historical and large logs without a baseline copy. Order and mode remain your choice.','เพิ่มความยากเมื่ออธิบายหลักฐานได้: โหมดฝึกมีสิทธิ์เข้าถึง บันทึกเก่าและขนาดใหญ่ โดยไม่มีสำเนาปกติ เลือกลำดับและโหมดได้อิสระ')
  ];

  const web=originalCases.find(c=>c.id==='web'),egress=originalCases.find(c=>c.id==='egress');
  web.exitExercise={title:L('出口演習：Web調査を引き継ぐ','Exit check: hand off the Web investigation','แบบฝึกท้ายกรณี: ส่งต่องานตรวจสอบเว็บ'),
    mission:L('usersの出力成功について、同じ要求のHTTP結果と業務結果を示す根拠を2件選び、報告の範囲を決めます。','Select two sources showing the HTTP and business outcomes of the same successful users export, then define the reporting scope.','เลือกหลักฐาน 2 แหล่งที่แสดงผล HTTP และผลธุรกิจของคำขอส่งออก users ที่สำเร็จเดียวกัน แล้วกำหนดขอบเขตรายงาน'),
    evidence:refs(web,[['http-export','/var/log/nginx/access.log','request_id=req-2048'],['audit-denied','/var/log/app/audit.log','request_id=req-2031'],['audit-export','/var/log/app/audit.log','request_id=req-2048'],['http-login','/var/log/nginx/access.log','request_id=req-2041']]),requiredEvidence:['http-export','audit-export'],
    questions:[
      {id:'fact',label:L('言える事実','Supported finding','ข้อเท็จจริงที่มีหลักฐาน'),answer:'export',options:[
        {value:'all',label:L('HTTPが成功したので全データを取得した。','The successful HTTP response proves that all data was obtained.','HTTP สำเร็จจึงพิสูจน์ว่าได้ข้อมูลทั้งหมด')},
        {value:'export',label:L('同じreq-2048で、HTTP応答とusers 320行の出力成功を確認した。','The same req-2048 links the HTTP response to a successful export of 320 users rows.','req-2048 เดียวกันเชื่อมคำตอบ HTTP กับการส่งออก users สำเร็จ 320 แถว')},
        {value:'failed',label:L('9時間の差があるため、HTTPと監査は別の要求である。','The nine-hour difference means the HTTP and audit records refer to different requests.','เวลาต่างกัน 9 ชั่วโมงจึงเป็นคำขอคนละรายการ')}]},
      {id:'unknown',label:L('未確認事項','Not yet established','สิ่งที่ยังไม่ยืนยัน'),answer:'authorization',options:[
        {value:'authorization',label:L('操作が承認されていたか、取得後に何をしたか。','Whether the action was approved and what happened to the output afterward.','การกระทำได้รับอนุมัติหรือไม่ และเกิดอะไรกับข้อมูลหลังส่งออก')},
        {value:'rows',label:L('出力行数は、監査を読んでも全く分からない。','The row count cannot be known even from the audit record.','แม้อ่านบันทึกตรวจสอบก็ไม่สามารถทราบจำนวนแถวได้เลย')},
        {value:'request',label:L('両ログには同じ要求を結ぶ情報がない。','The two logs have no information linking the request.','บันทึกทั้งสองไม่มีข้อมูลเชื่อมคำขอ')}]},
      {id:'next',label:L('次の確認','Next check','การตรวจสอบถัดไป'),answer:'approval',options:[
        {value:'size',label:L('応答サイズから、取得後の行動を断定する。','Infer subsequent behavior from response size alone.','สรุปพฤติกรรมภายหลังจากขนาดคำตอบเพียงอย่างเดียว')},
        {value:'close',label:L('200応答なので調査を終了する。','Close the investigation because the response was 200.','ปิดการตรวจสอบเพราะคำตอบเป็น 200')},
        {value:'approval',label:L('作業承認・担当者確認と、必要なら端末側の取得後の記録を確認する。','Check work approval and the owner, then obtain endpoint records of subsequent activity if needed.','ตรวจการอนุมัติงานและผู้รับผิดชอบ และหากจำเป็นตรวจบันทึกกิจกรรมภายหลังบนเครื่องปลายทาง')}]}
    ],model:L('事実：req-2048でusers 320行の出力成功を確認。\n根拠：アクセスログ19:12:08 +0900と監査10:12:08Zは同じ瞬間で、要求IDも一致。\n未確認・次：承認と取得後の扱いは未確認。作業資料・担当者・必要な端末記録を確認する。','Finding: req-2048 records a successful export of 320 users rows.\nEvidence: access time 19:12:08 +0900 and audit time 10:12:08Z are the same instant, with the same request ID.\nUnknown/next: approval and later handling are unverified. Check work records, the owner and relevant endpoint records.','ข้อเท็จจริง: req-2048 บันทึกการส่งออก users สำเร็จ 320 แถว\nหลักฐาน: เวลาเข้าถึง 19:12:08 +0900 และเวลาตรวจสอบ 10:12:08Z เป็นขณะเดียวกันและ ID คำขอตรงกัน\nยังไม่ยืนยัน/ถัดไป: การอนุมัติและการจัดการภายหลังยังไม่ยืนยัน ตรวจเอกสารงาน ผู้รับผิดชอบ และบันทึกเครื่องปลายทางที่เกี่ยวข้อง')};
  egress.exitExercise={title:L('出口演習：通信の事実と流出の断定を分ける','Exit check: distinguish traffic evidence from proven disclosure','แบบฝึกท้ายกรณี: แยกหลักฐานการสื่อสารจากการยืนยันข้อมูลรั่วไหล'),
    mission:L('対象端末の名前解決、HTTP送信、メールの受付元と配送先による受付を支える4行（3種類のログ）を選びます。通信内容の機密性や正当性まで広げない報告を作ります。','Select four records from three log sources supporting the endpoint DNS lookup, HTTP upload, mail submission source and receiving mail server acceptance. Do not extend the finding to content confidentiality or authorization.','เลือก 4 บรรทัดจากบันทึก 3 แหล่งที่สนับสนุนการค้นหา DNS การส่ง HTTP ต้นทางที่ส่งเมล และการรับของเซิร์ฟเวอร์เมลปลายทาง อย่าขยายข้อสรุปถึงความลับของเนื้อหาหรือการอนุมัติ'),
    evidence:refs(egress,[['dns-target','/var/log/named/query.log','query_id=dns-7301'],['proxy-health','/var/log/proxy/access.log','request_id=px-9010'],['mail-client','/var/log/mail.log','C6D71A20F1: client='],['mail-sent','/var/log/mail.log','to=<drop@archive-sync.example>'],['proxy-upload','/var/log/proxy/access.log','request_id=px-9001'],['proxy-metrics','/var/log/proxy/access.log','request_id=px-metrics-1']]),requiredEvidence:['dns-target','mail-client','mail-sent','proxy-upload'],
    questions:[
      {id:'fact',label:L('言える事実','Supported finding','ข้อเท็จจริงที่มีหลักฐาน'),answer:'observed',options:[
        {value:'observed',label:L('対象端末の名前解決・HTTP送信と、関連キューの配送先による受付を観測した。','The endpoint DNS lookup and HTTP upload, and receiving-server acceptance for the related mail queue, were observed.','สังเกตพบการค้นหา DNS และส่ง HTTP ของเครื่องเป้าหมาย รวมทั้งการรับของเซิร์ฟเวอร์ปลายทางสำหรับคิวเมลที่เกี่ยวข้อง')},
        {value:'same-content',label:L('メールとHTTPは同じ機密ファイルを送信した。','The mail and HTTP traffic sent the same confidential file.','เมลและ HTTP ส่งไฟล์ลับเดียวกัน')},
        {value:'read',label:L('status=sentにより宛先の人がメールを読んだと分かる。','status=sent proves the recipient read the email.','status=sent พิสูจน์ว่าผู้รับอ่านอีเมลแล้ว')}]},
      {id:'unknown',label:L('未確認事項','Not yet established','สิ่งที่ยังไม่ยืนยัน'),answer:'content',options:[
        {value:'dns',label:L('DNS回答の宛先アドレスは確認できない。','The DNS answer address cannot be established.','ไม่สามารถยืนยันที่อยู่ในคำตอบ DNS ได้')},
        {value:'content',label:L('送信内容、機密性、業務上の承認、端末侵害の有無。','The transmitted content, its confidentiality, business approval and whether the endpoint was compromised.','เนื้อหาที่ส่ง ความลับของข้อมูล การอนุมัติทางธุรกิจ และเครื่องถูกบุกรุกหรือไม่')},
        {value:'host',label:L('送信先ホスト名はどの記録にも存在しない。','No record contains the destination hostname.','ไม่มีบันทึกใดมีชื่อโฮสต์ปลายทาง')}]},
      {id:'next',label:L('次の確認','Next check','การตรวจสอบถัดไป'),answer:'context',options:[
        {value:'add',label:L('メールサイズとHTTP送信量を加え、その全量を流出量とする。','Add mail size and HTTP bytes and call the total leaked data.','รวมขนาดเมลกับข้อมูล HTTP แล้วเรียกทั้งหมดว่าข้อมูลรั่วไหล')},
        {value:'dns-only',label:L('DNSだけで端末侵害を確定する。','Confirm endpoint compromise using DNS alone.','ยืนยันการบุกรุกเครื่องด้วย DNS เพียงอย่างเดียว')},
        {value:'context',label:L('業務用途・承認を確認し、端末の送信処理や対象ファイルの記録を追加で調べる。','Check business purpose and approval, and investigate endpoint sending processes and relevant file records.','ตรวจวัตถุประสงค์งานและการอนุมัติ แล้วตรวจโปรเซสที่ส่งข้อมูลและบันทึกไฟล์บนเครื่องเพิ่มเติม')}]}
    ],model:L('事実：対象端末のDNSとHTTP送信、関連メールの配送先による受付を観測。\n根拠：端末IP・宛先名・時刻・メールキューIDを照合した。別経路が同じ内容を運んだとは言えない。\n未確認・次：内容・承認・侵害の有無は未確認。業務資料と端末の送信処理・ファイル記録を確認する。','Finding: the endpoint DNS and HTTP upload, and receiving-server acceptance of the related email, were observed.\nEvidence: endpoint IP, destination, times and mail queue ID were correlated. Separate channels do not prove identical content.\nUnknown/next: content, approval and compromise remain unverified. Check business records and endpoint sending processes/file records.','ข้อเท็จจริง: พบ DNS และการส่ง HTTP ของเครื่องเป้าหมาย รวมทั้งการรับอีเมลที่เกี่ยวข้องโดยเซิร์ฟเวอร์ปลายทาง\nหลักฐาน: เชื่อมโยง IP เครื่อง ชื่อปลายทาง เวลา และ ID คิวเมล ช่องทางต่างกันไม่ได้พิสูจน์ว่าเนื้อหาเหมือนกัน\nยังไม่ยืนยัน/ถัดไป: เนื้อหา การอนุมัติ และการบุกรุกยังไม่ยืนยัน ตรวจเอกสารงาน โปรเซสส่งข้อมูล และบันทึกไฟล์บนเครื่อง')};

  // Shared UI strings; the application never grades the meaning of learner prose.
  const ui=[
    ['学習の目安（順番は自由）','Learning guide (choose your own order)','แนวทางการเรียน (เลือกลำดับได้เอง)'],
    ['基礎の確認（任意・進捗には算入しません）','Concept check (optional; not counted toward progress)','ตรวจความเข้าใจพื้นฐาน (ไม่บังคับ ไม่นับในความคืบหน้า)'],
    ['基礎の回答を確認','Check the concept answer','ตรวจคำตอบพื้นฐาน'],
    ['基礎を確認できました。','Concept confirmed.','ยืนยันความเข้าใจแล้ว'],
    ['基礎の説明を読み直してみましょう。','Review the foundation explanation.','ลองทบทวนคำอธิบายพื้นฐาน'],
    ['導入ケースを初期状態に戻しますか？','Reset the entry case?','เริ่มกรณีเริ่มต้นใหม่หรือไม่?'],
    ['導入ケースの解答・メモ・履歴・作成ファイルを初期化します。他のケースは保持します。','Reset this entry case’s answers, notes, history and created files. Other cases are kept.','ล้างคำตอบ บันทึก ประวัติ และไฟล์ที่สร้างของกรณีเริ่มต้นนี้ กรณีอื่นยังคงอยู่'],
    ['導入ケースを初期化','Reset entry case','เริ่มกรณีเริ่มต้นใหม่'],
    ['演習前に読める基礎','Foundations available before answering','พื้นฐานที่อ่านได้ก่อนตอบ'],
    ['対象選択・抽出・集計・根拠保存の意味を振り返れます。','Review the purpose of selection, extraction, counting and saving evidence.','ทบทวนจุดประสงค์ของการเลือก แยกข้อมูล นับ และบันทึกหลักฐาน'],
    ['4問を終えると、基本操作の振り返りを読めます。','Complete the four questions to review these basic operations.','ตอบ 4 ข้อให้ครบเพื่อทบทวนการทำงานพื้นฐาน'],
    ['事例に照らした補足知識','Knowledge applied to this case','ความรู้เพิ่มเติมที่ใช้กับกรณีนี้'],
    ['導入用ログ','Entry practice logs','บันทึกสำหรับแบบฝึกเริ่มต้น'],
    ['導入4問は省略できます。既存ケースは一覧からいつでも選べます。','You may skip these four entry questions. Existing cases remain available in the case list.','ข้ามคำถามเริ่มต้น 4 ข้อได้ และเลือกกรณีเดิมจากรายการได้ทุกเมื่อ'],
    ['SSHケースを選ぶ','Choose the SSH case','เลือกกรณี SSH'],
    ['提出ファイルを確認','Check the submitted file','ตรวจสอบไฟล์ที่ส่ง'],
    ['ファイルの内容・行の不足や重複・順序を確認してください。','Check file contents, missing or duplicate lines, and their order.','ตรวจเนื้อหาไฟล์ บรรทัดที่ขาดหรือซ้ำ และลำดับ'],
    ['保存した根拠を確認しました。','The saved evidence has been verified.','ตรวจสอบหลักฐานที่บันทึกแล้ว'],
    ['ケースの解説を見る','Read the case explanation','อ่านคำอธิบายกรณี'],
    ['入口・出口の追加演習は、従来のケース完了とは別に保存します。','Entry and exit practice is saved separately from the original case completion.','แบบฝึกเริ่มต้นและท้ายกรณีบันทึกแยกจากสถานะสำเร็จของกรณีเดิม'],
    ['このケースの設問を完了すると、調査した根拠を使う出口演習が開きます。','Complete this case’s questions to open an exit check using the evidence you investigated.','ตอบคำถามกรณีนี้ให้ครบเพื่อเปิดแบบฝึกท้ายกรณีที่ใช้หลักฐานที่ตรวจสอบแล้ว'],
    ['根拠を選ぶ（必要な行だけ）','Select evidence (only the necessary records)','เลือกหลักฐาน (เฉพาะบรรทัดที่จำเป็น)'],
    ['選んでください','Choose an answer','เลือกคำตอบ'],
    ['短い引継ぎメモ（自己比較用）','Short handoff note (for self-comparison)','บันทึกส่งต่องานสั้น ๆ (สำหรับเปรียบเทียบด้วยตนเอง)'],
    ['事実・根拠・未確認事項と次の確認を3行でまとめます。文章の意味は自動採点しません。','Summarize findings, evidence, and unknowns/next checks in three lines. The meaning of your prose is not automatically graded.','สรุปข้อเท็จจริง หลักฐาน และสิ่งที่ยังไม่ยืนยัน/การตรวจถัดไปใน 3 บรรทัด ระบบไม่ให้คะแนนความหมายของข้อความโดยอัตโนมัติ'],
    ['構造化した回答を確認','Check the structured answers','ตรวจคำตอบที่มีโครงสร้าง'],
    ['根拠の組合せと、事実・未確認事項・次の確認を見直してください。','Review the evidence combination, finding, unknowns and next check.','ทบทวนชุดหลักฐาน ข้อเท็จจริง สิ่งที่ยังไม่ยืนยัน และการตรวจถัดไป'],
    ['根拠と判断の選択は正解です。文章は下の例と自分で比較してください。','Your evidence and judgment choices are correct. Compare your prose with the example below yourself.','การเลือกหลักฐานและข้อสรุปถูกต้อง โปรดเปรียบเทียบข้อความของคุณกับตัวอย่างด้านล่างด้วยตนเอง'],
    ['引継ぎ例（自分の文章と比較）','Example handoff (compare with your own prose)','ตัวอย่างส่งต่องาน (เปรียบเทียบกับข้อความของคุณ)'],
    ['出口演習：完了','Exit check: complete','แบบฝึกท้ายกรณี: สำเร็จ'],
    ['出口演習：未完了','Exit check: not complete','แบบฝึกท้ายกรณี: ยังไม่สำเร็จ'],
    ['Logroomの卒業確認を完了しました','Logroom graduation checks complete','ผ่านการตรวจสอบจบ Logroom แล้ว'],
    ['既存10ケースと2つの出口演習を完了しました。このまま復習や実践モードを続けられます。','You completed the ten original cases and both exit checks. You can continue reviewing or practicing here.','คุณทำกรณีเดิมทั้ง 10 และแบบฝึกท้ายกรณี 2 ชุดสำเร็จแล้ว ทบทวนหรือฝึกต่อที่นี่ได้'],
    ['次のおすすめ：pcaproom-easy（任意）','Suggested next: pcaproom-easy (optional)','แนะนำถัดไป: pcaproom-easy (ไม่บังคับ)'],
    ['新しいタブで開きます。進捗は共有されません。','Opens in a new tab. Progress is not shared.','เปิดในแท็บใหม่ ไม่มีการแชร์ความคืบหน้า'],
    ['このroomで続ける','Continue in this room','ทำต่อใน room นี้']
  ];ui.forEach(values=>L(...values));

  const protectedKeys=new Set(['id','command','commands','answer','accepted','evidence','url','files','baselineFiles','logPaths']);
  function addTranslations(c,value,prefix=''){
    if(typeof value==='string'){
      if(!/[\u3040-\u30ff\u3400-\u9fff]/.test(value))return;
      for(const language of ['en','th']){
        const translated=root.LOGROOM_UI_TRANSLATIONS[language][value];
        if(translated===undefined)continue; // Existing case text is covered by its original catalog.
        (root.LOGROOM_CASE_TRANSLATIONS[language][c.id]||={})[prefix]=translated;
      }
    }else if(Array.isArray(value))value.forEach((item,index)=>addTranslations(c,item,prefix?prefix+'.'+index:String(index)));
    else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value))if(!protectedKeys.has(key))addTranslations(c,item,prefix?prefix+'.'+key:key);
  }
  for(const c of root.LOG_LAB_CASES)addTranslations(c,c);
  for(const language of ['en','th'])for(const name of ['normalReadme','attackedReadme'])root.LOGROOM_CASE_TRANSLATIONS[language].entry['fileTexts.'+name]=root.LOGROOM_UI_TRANSLATIONS[language][introReadme];
  function gradeFile(task,value){return task.kind==='file'&&typeof value==='string'&&value.replace(/\r\n/g,'\n').replace(/\n$/,'')===task.answer.replace(/\n$/,'');}
  function gradeExit(c,submission){
    const spec=c.exitExercise;if(!spec||!submission||!Array.isArray(submission.evidence))return false;
    const selected=submission.evidence;
    if(selected.length!==spec.requiredEvidence.length||new Set(selected).size!==selected.length||!spec.requiredEvidence.every(id=>selected.includes(id)))return false;
    if(!selected.every(id=>{const e=spec.evidence.find(row=>row.id===id);return e&&c.files[e.path]?.split('\n')[e.line-1]===e.quote;}))return false;
    return spec.questions.every(q=>submission.answers?.[q.id]===q.answer);
  }
  function graduated(cases,saved){return cases.filter(c=>!c.entry).every(c=>{const s=saved[c.id];return s?.attackApplied===true&&c.tasks.every(t=>s.solved?.includes(t.id)&&[t.answer,...t.accepted].some(a=>root.LogroomPractice.normalizeAnswer(a)===root.LogroomPractice.normalizeAnswer(s.answers?.[t.id])))&&(!c.exitExercise||(s.exit?.checked===true&&gradeExit(c,s.exit)));});}
  root.LogroomCurriculum=Object.freeze({gradeFile,gradeExit,graduated});
})(globalThis);
