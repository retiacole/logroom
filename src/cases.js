/* Fictional, deterministic training data. No network access or real accounts. */
(() => {
  'use strict';
  const textFile = lines => lines.join('\n') + '\n';
  const utc = (hour, minute = 0, second = 0) => new Date(Date.UTC(2026, 7, 12, hour, minute, second)).toISOString().replace('.000Z', 'Z');
  const stamp = seconds => new Date(Date.UTC(2026, 7, 12, 0, 0, seconds)).toISOString().replace('.000Z', 'Z');
  const ordered = records => records.sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order).map(item => item.line);
  const evidence = (files, path, fragment) => {
    const lines = files[path].trimEnd().split('\n');
    const index = lines.findIndex(line => line.includes(fragment));
    if (index < 0) throw new Error('Missing training evidence: ' + fragment);
    return { path, line: index + 1, quote: lines[index] };
  };
  const readme = (title, incident, paths, clock = '日時: 2026年8月12日。全ログのタイムゾーンはUTCです（日本時間は+9時間）。') => textFile([
    title,
    '',
    'この演習の組織、人物、アカウント、通信、ログはすべて架空です。',
    'IPアドレスには文書用の範囲、ドメインには .test / .example を使っています。',
    clock,
    '',
    incident,
    '',
    '調査対象:',
    ...paths.map(path => '  ' + path),
    '',
    '使える基本操作: pwd, ls, cd, cat, head, tail, less, grep, awk, cut, sort, uniq, wc, sed',
    '例: grep -n "キーワード" /var/log/対象.log',
    'パイプで絞り込みや集計を組み合わせられます。ヘルプは help。',
    'この端末はログ分析用のシミュレーターです。実際のOSや外部通信は使いません。',
    'ログの観測事実と推測を分け、複数ログの一致を確かめてください。',
  ]);

  // Case 1: standard OpenSSH / sudo shapes, including invalid-user variants.
  const authRecords = [];
  let authOrder = 0;
  const auth = (seconds, message) => authRecords.push({ at: stamp(seconds), order: authOrder++, line: 'Aug 12 ' + stamp(seconds).slice(11, 19) + ' edge-01 ' + message });
  for (let i = 0; i < 30; i++) {
    const at = 8 * 3600 + 55 * 60 + i * 60;
    auth(at, 'CRON[' + (1000 + i) + ']: pam_unix(cron:session): session opened for user root(uid=0) by (uid=0)');
    auth(at + 1, 'CRON[' + (1000 + i) + ']: pam_unix(cron:session): session closed for user root');
  }
  for (let i = 0; i < 8; i++) {
    const at = 9 * 3600 + i * 170;
    auth(at, 'sshd[' + (1800 + i) + ']: Accepted publickey for ops from 192.0.2.10 port ' + (52000 + i) + ' ssh2: ED25519 SHA256:FICTIONALTRAININGKEY');
    auth(at + 2, 'sshd[' + (1800 + i) + ']: pam_unix(sshd:session): session opened for user ops(uid=1001) by (uid=0)');
    auth(at + 39 + i % 4 * 7, 'sshd[' + (1800 + i) + ']: pam_unix(sshd:session): session closed for user ops');
  }
  const failedAuth = (at, pid, account, source, port) => {
    const invalid = account.startsWith('invalid user '), user = account.replace('invalid user ', '');
    const prefix = 'sshd[' + pid + ']: ';
    if (invalid) auth(at - 3, prefix + 'Invalid user ' + user + ' from ' + source + ' port ' + port);
    auth(at - 2, prefix + 'pam_unix(sshd:auth): authentication failure; logname= uid=0 euid=0 tty=ssh ruser= rhost=' + source + (invalid ? '' : ' user=' + user));
    auth(at, prefix + 'Failed password for ' + account + ' from ' + source + ' port ' + port + ' ssh2');
    auth(at + 1, prefix + 'Connection closed by ' + (invalid ? 'invalid user ' : 'authenticating user ') + user + ' ' + source + ' port ' + port + ' [preauth]');
  };
  for (let i = 0; i < 12; i++) failedAuth(9 * 3600 + 2 * 60 + i * 41 + i % 3, 2200 + i, 'invalid user guest', '203.0.113.44', 43000 + i);
  for (let i = 0; i < 7; i++) failedAuth(9 * 3600 + 4 * 60 + i * 73 + i % 4, 2300 + i, 'ops', '198.51.100.25', 44000 + i);
  for (let i = 0; i < 60; i++) {
    const account = i < 30 ? 'invalid user admin' : i < 50 ? 'root' : 'deploy';
    const jitter = i === 0 || i === 59 ? 0 : [0, 2, -1, 1, -2][i % 5];
    failedAuth(9 * 3600 + 10 * 60 + i * 8 + jitter, 3000 + i, account, '198.51.100.73', 45000 + i);
  }
  auth(9 * 3600 + 18 * 60 + 42, 'sshd[4100]: Accepted password for deploy from 198.51.100.73 port 45100 ssh2');
  auth(9 * 3600 + 18 * 60 + 43, 'sshd[4100]: pam_unix(sshd:session): session opened for user deploy(uid=1002) by (uid=0)');
  auth(9 * 3600 + 19 * 60 + 4, 'sudo: deploy : TTY=pts/1 ; PWD=/home/deploy ; USER=root ; COMMAND=/usr/bin/id');
  auth(9 * 3600 + 19 * 60 + 4, 'sudo[4110]: pam_unix(sudo:session): session opened for user root(uid=0) by deploy(uid=1002)');
  auth(9 * 3600 + 19 * 60 + 5, 'sudo[4110]: pam_unix(sudo:session): session closed for user root');
  auth(9 * 3600 + 20 * 60 + 11, 'sudo: deploy : TTY=pts/1 ; PWD=/home/deploy ; USER=root ; COMMAND=/usr/bin/systemctl restart nginx');
  auth(9 * 3600 + 20 * 60 + 11, 'sudo[4117]: pam_unix(sudo:session): session opened for user root(uid=0) by deploy(uid=1002)');
  auth(9 * 3600 + 20 * 60 + 13, 'sudo[4117]: pam_unix(sudo:session): session closed for user root');
  auth(9 * 3600 + 22 * 60 + 31, 'sshd[4100]: pam_unix(sshd:session): session closed for user deploy');
  auth(9 * 3600 + 5 * 60, 'sudo: ops : TTY=pts/0 ; PWD=/home/ops ; USER=root ; COMMAND=/usr/bin/journalctl -u nginx');
  auth(9 * 3600 + 26 * 60, 'sshd[4500]: Accepted publickey for backup from 192.0.2.12 port 53100 ssh2: ED25519 SHA256:FICTIONALBACKUPKEY');
  const sshFiles = {
    '/home/analyst/README.txt': readme('ケース1: SSH認証の異常とsudoの追跡', '監視担当が短時間のSSH認証失敗増加を報告しました。認証に成功した記録と、その後の特権コマンドを調べます。', ['/var/log/auth.log']),
    '/etc/hostname': 'edge-01\n',
    '/var/log/auth.log': textFile(ordered(authRecords)),
  };
  const ssh = {
    id: 'ssh', title: 'SSH認証の異常とsudoの追跡', level: '初級', minutes: 15,
    summary: '認証失敗を集計し、成功したログインと特権コマンドを時系列で追います。',
    briefing: [
      '対象は edge-01。ログ期間は2026年8月12日 08:55〜09:26 UTCです。',
      '定期処理や正規管理者のログも含まれます。失敗件数だけで侵入成功とは判断できません。',
      '認証成功の記録とsudoの記録を分けて確認してください。sudoの記録だけではサービスの正常な再起動完了までは分かりません。',
    ], files: sshFiles,
    tasks: [
      { id: 'source', label: '認証失敗の送信元', prompt: 'SSHの「Failed password」が最も多い送信元IPは？', placeholder: '例: 198.51.100.10', accepted: ['198.51.100.73'], answer: '198.51.100.73', explanation: 'Failed passwordの行から送信元を取り出して集計すると、このIPが60件で最多です。invalid userの有無で列数が変わるため、末尾からIPの位置を数えると揃います。', evidence: [evidence(sshFiles, '/var/log/auth.log', 'Failed password for invalid user admin from 198.51.100.73 port 45000'), evidence(sshFiles, '/var/log/auth.log', 'Failed password for deploy from 198.51.100.73 port 45059')], hints: [{ text: 'まず認証失敗だけを抽出します。', command: "grep 'Failed password' /var/log/auth.log" }, { text: 'IPを抽出し、同じ値を数えて件数の多い順に並べます。', command: "grep 'Failed password' /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr" }] },
      { id: 'count', label: '失敗回数', prompt: '最多の送信元IPによる「Failed password」は何件？', placeholder: '件数を数字で入力', accepted: ['60', '60件'], answer: '60', explanation: '対象IPとFailed passwordの両方に一致する行は60行です。認証成功やセッション開始の行を混ぜないことが集計のポイントです。', evidence: [evidence(sshFiles, '/var/log/auth.log', 'Failed password for invalid user admin from 198.51.100.73 port 45000'), evidence(sshFiles, '/var/log/auth.log', 'Failed password for deploy from 198.51.100.73 port 45059')], hints: [{ text: '認証失敗で絞ってから、前問で得たIPでさらに絞ります。' }, { text: 'wc -lで一致行の数を確認できます。', command: "grep 'Failed password' /var/log/auth.log | grep -F 'from 198.51.100.73 port ' | wc -l" }] },
      { id: 'account', label: '認証に成功したアカウント', prompt: 'その送信元からパスワード認証に成功したアカウント名は？', placeholder: 'アカウント名', accepted: ['deploy'], answer: 'deploy', explanation: '同じIPからdeployへのAccepted passwordが記録されています。失敗したadminやrootとは区別して読みます。', evidence: [evidence(sshFiles, '/var/log/auth.log', 'Accepted password for deploy')], hints: [{ text: '認証に成功した行はAcceptedで始まる認証結果を含みます。', command: "grep 'Accepted' /var/log/auth.log" }, { text: '前問のIPに絞り、forの後のアカウント名を確認します。', command: "grep -F 'from 198.51.100.73 port ' /var/log/auth.log | grep 'Accepted'" }] },
      { id: 'login-time', label: '成功した時刻', prompt: 'このパスワード認証が成功した時刻は？（UTC、HH:MM:SS）', placeholder: 'HH:MM:SS', accepted: ['09:18:42', '09:18:42 UTC', '2026-08-12T09:18:42Z', '2026-08-12 09:18:42'], answer: '09:18:42', explanation: 'Accepted passwordの行の先頭はAug 12 09:18:42です。従来型syslogの時刻には年とタイムゾーンがないため、READMEの2026年・UTCという採取条件で補います。直後のセッション開始時刻09:18:43とは1秒違います。', evidence: [evidence(sshFiles, '/var/log/auth.log', 'Accepted password for deploy')], hints: [{ text: '先頭の月・日・時刻を読み、年とタイムゾーンはREADMEで確認します。', command: "grep 'Accepted password' /var/log/auth.log" }] },
      { id: 'sudo', label: '後続の特権コマンド', prompt: 'deployがsudoで実行した、nginxの再起動を指示するコマンド全文は？', placeholder: '/usr/bin/…', accepted: ['/usr/bin/systemctl restart nginx', 'systemctl restart nginx', 'sudo /usr/bin/systemctl restart nginx'], answer: '/usr/bin/systemctl restart nginx', explanation: 'deployのsudoログにUSER=rootとCOMMAND=/usr/bin/systemctl restart nginxがあります。これはroot権限でのコマンド実行記録で、再起動が正常に完了したかは別のサービスログで確認する必要があります。', evidence: [evidence(sshFiles, '/var/log/auth.log', 'COMMAND=/usr/bin/systemctl restart nginx')], hints: [{ text: 'sudoとdeployの両方を含む行に絞ります。', command: "grep 'sudo' /var/log/auth.log | grep 'deploy'" }, { text: 'COMMAND=の後が実行したコマンドです。', command: "grep 'COMMAND=' /var/log/auth.log | grep 'deploy'" }] },
    ],
    walkthrough: [
      { title: '調査対象を読む', command: 'cat /home/analyst/README.txt', explanation: 'syslog本文には年とタイムゾーンがありません。READMEの採取条件（2026年・UTC）と対象ファイルの日付を先に確認します。' },
      { title: '失敗元を集計する', command: "grep 'Failed password' /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr", explanation: '60件、12件、7件の順になります。sortで同じIPを隣り合わせにしてからuniq -cで数えます。' },
      { title: '同じIPの認証成功を探す', command: "grep -F 'from 198.51.100.73 port ' /var/log/auth.log | grep 'Accepted'", explanation: '09:18:42 UTC、deployへのパスワード認証成功が1件見つかります。' },
      { title: '後続の権限使用を追う', command: "grep 'sudo' /var/log/auth.log | grep 'deploy'", explanation: 'idの実行に続き、09:20:11 UTCにnginxの再起動コマンドがroot権限で実行された記録があります。' },
    ], initialCommand: 'cat /home/analyst/README.txt',
  };

  // Case 2: request IDs join access observations to application-confirmed events.
  const webRecords = [];
  const auditRecords = [];
  let webOrder = 0;
  const nginxTime = (at, offsetHours = 0) => { const d = new Date(Date.parse(at) + offsetHours * 3600000); return '12/Aug/2026:' + [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map(x => String(x).padStart(2, '0')).join(':') + (offsetHours === 9 ? ' +0900' : ' +0000'); };
  const access = (at, ip, method, path, status, bytes, requestId, agent = 'LabBrowser/1.0') => webRecords.push({ at, order: webOrder++, line: ip + ' - - [' + nginxTime(at, 9) + '] "' + method + ' ' + path + ' HTTP/1.1" ' + status + ' ' + bytes + ' "-" "' + agent + '" request_id=' + requestId });
  const audit = (at, message) => auditRecords.push({ at, order: webOrder++, line: at + ' portal-01 app_audit ' + message });
  const publicPaths = ['/', '/products', '/assets/app.css', '/assets/app.js', '/help', '/health', '/favicon.ico'];
  const publicIps = ['192.0.2.20', '192.0.2.21', '192.0.2.22', '198.51.100.18', '203.0.113.19'];
  for (let i = 0; i < 135; i++) {
    const at = stamp(10 * 3600 + i * 9);
    const status = i % 31 === 0 ? 304 : 200;
    access(at, publicIps[i % publicIps.length], 'GET', publicPaths[i % publicPaths.length], status, status === 304 ? 0 : 280 + (i % 19) * 71, 'req-normal-' + String(i).padStart(3, '0'));
  }
  const discovered = ['/admin', '/admin/login', '/api/config', '/backup', '/old', '/admin/users', '/api/admin/users', '/admin/export/users.csv', '/admin/settings', '/server-status', '/admin/reports', '/backup.zip'];
  discovered.forEach((path, i) => access(stamp(10 * 3600 + 5 * 60 + i * 12), '203.0.113.88', 'GET', path, path === '/admin/login' ? 200 : i % 3 === 0 ? 401 : 404, 78, 'req-scan-' + i, 'TrainingClient/1.0'));
  access(utc(10, 8, 10), '203.0.113.88', 'GET', '/admin/export/users.csv', 403, 81, 'req-2031', 'TrainingClient/1.0');
  audit(utc(10, 8, 10), 'action=data_export result=denied actor=anonymous src_ip=203.0.113.88 resource=users reason=authentication_required request_id=req-2031');
  access(utc(10, 8, 52), '203.0.113.88', 'POST', '/admin/login', 401, 92, 'req-2038', 'TrainingClient/1.0');
  audit(utc(10, 8, 52), 'action=login result=failure actor=report-admin src_ip=203.0.113.88 reason=invalid_password request_id=req-2038');
  access(utc(10, 9, 21), '203.0.113.88', 'POST', '/admin/login', 302, 145, 'req-2041', 'TrainingClient/1.0');
  audit(utc(10, 9, 21), 'action=login result=success actor=report-admin src_ip=203.0.113.88 request_id=req-2041');
  access(utc(10, 9, 23), '203.0.113.88', 'GET', '/admin', 200, 4120, 'req-2042', 'TrainingClient/1.0');
  access(utc(10, 10, 5), '203.0.113.88', 'GET', '/admin/reports', 200, 5190, 'req-2044', 'TrainingClient/1.0');
  access(utc(10, 12, 8), '203.0.113.88', 'GET', '/admin/export/users.csv', 200, 128460, 'req-2048', 'TrainingClient/1.0');
  audit(utc(10, 12, 8), 'action=data_export result=success actor=report-admin src_ip=203.0.113.88 resource=users format=csv rows=320 request_id=req-2048');
  access(utc(10, 12, 24), '203.0.113.88', 'GET', '/admin/export/payments.csv', 403, 81, 'req-2049', 'TrainingClient/1.0');
  audit(utc(10, 12, 24), 'action=data_export result=denied actor=report-admin src_ip=203.0.113.88 resource=payments reason=insufficient_permission request_id=req-2049');
  for (let i = 0; i < 25; i++) audit(stamp(10 * 3600 + 20 + i * 47), 'action=page_view result=success actor=' + (i % 2 ? 'staff-a' : 'staff-b') + ' src_ip=' + publicIps[i % 3] + ' resource=dashboard request_id=req-audit-' + i);
  access(utc(10, 3, 1), '192.0.2.20', 'POST', '/admin/login', 302, 145, 'req-staff-login');
  audit(utc(10, 3, 1), 'action=login result=success actor=staff-a src_ip=192.0.2.20 request_id=req-staff-login');
  access(utc(10, 4, 12), '192.0.2.20', 'GET', '/admin/export/users.csv', 200, 18000, 'req-staff-export');
  audit(utc(10, 4, 12), 'action=data_export result=success actor=staff-a src_ip=192.0.2.20 resource=users format=csv rows=45 request_id=req-staff-export');
  const webFiles = {
    '/home/analyst/README.txt': readme('ケース2: Web探索とデータ出力の照合', '管理画面への探索的なアクセスが観測されました。Webアクセスログとアプリ監査ログを照合し、実際に成功した操作を特定します。', ['/var/log/nginx/access.log', '/var/log/app/audit.log']),
    '/etc/hostname': 'portal-01\n',
    '/var/log/nginx/access.log': textFile(ordered(webRecords)),
    '/var/log/app/audit.log': textFile(ordered(auditRecords)),
  };
  const web = {
    id: 'web', title: 'Web探索とデータ出力の照合', level: '中級', minutes: 20,
    summary: 'Webのステータスコードとアプリの操作結果を、リクエストIDで照合します。',
    briefing: [
      '対象は portal-01。2026年8月12日 10:00〜10:20 UTCのログです。',
      '管理画面、設定、バックアップを探すアクセスが混在しています。URLへのアクセスやHTTP 200だけでは、認証やデータ出力の成功を断定できません。',
      '同じrequest_idをアプリ監査ログで照合してください。正規スタッフのログインとCSV出力も含まれます。',
    ], files: webFiles,
    tasks: [
      { id: 'source', label: '探索的アクセスの送信元', prompt: '短時間に /backup、/api/config、/server-status などを探した送信元IPは？', placeholder: '送信元IP', accepted: ['203.0.113.88'], answer: '203.0.113.88', explanation: '同じ送信元が管理画面や設定、バックアップ関連の複数パスを短時間に要求しています。要求の存在が分かる段階であり、この事実だけで成功とは判断しません。', evidence: [evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-scan-2'), evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-scan-3'), evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-scan-9')], hints: [{ text: '特徴的なパスで検索し、行頭の送信元IPを確認します。', command: "grep '/backup' /var/log/nginx/access.log" }, { text: '同じIPの他のリクエストも並べると探索の範囲が分かります。', command: "grep '203.0.113.88' /var/log/nginx/access.log" }] },
      { id: 'account', label: '成功したログイン', prompt: 'そのIPからログインに成功したアカウント名は？', placeholder: 'アカウント名', accepted: ['report-admin', 'actor=report-admin'], answer: 'report-admin', explanation: 'アプリ監査ログのaction=login、result=successがreport-adminの成功を確認しています。その前には同じアカウントの認証失敗も1件あります。', evidence: [evidence(webFiles, '/var/log/app/audit.log', 'request_id=req-2041')], hints: [{ text: 'アプリ側でログイン結果を確認します。', command: "grep 'action=login' /var/log/app/audit.log" }, { text: '対象IPかつresult=successの行を探します。', command: "grep '203.0.113.88' /var/log/app/audit.log | grep 'action=login'" }] },
      { id: 'endpoint', label: '成功したデータ出力のパス', prompt: '対象IPからのデータ出力成功と対応するURLパスは？', placeholder: '/admin/…', accepted: ['/admin/export/users.csv'], answer: '/admin/export/users.csv', explanation: '10:12:08 UTCのアクセスに対応するアプリ監査イベントがdata_export、success、resource=usersを記録しています。08分台の同じURLへの要求やpaymentsの出力要求は拒否されています。', evidence: [evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-2048'), evidence(webFiles, '/var/log/app/audit.log', 'request_id=req-2048')], hints: [{ text: 'まず監査ログで成功した出力を確認します。', command: "grep 'action=data_export' /var/log/app/audit.log" }, { text: 'そのrequest_idをアクセスログで照合するとURLが分かります。' }] },
      { id: 'rows', label: '出力された件数', prompt: 'この成功イベントで記録された出力行数は？', placeholder: '数字で入力', accepted: ['320', '320行', '320件', 'rows=320'], answer: '320', explanation: '対応する監査イベントにrows=320があります。アクセスログの128460は応答サイズで、出力行数ではありません。', evidence: [evidence(webFiles, '/var/log/app/audit.log', 'request_id=req-2048')], hints: [{ text: 'アプリ監査ログの成功した出力イベントにrowsという項目があります。', command: "grep 'action=data_export' /var/log/app/audit.log | grep 'result=success'" }] },
      { id: 'request-id', label: 'ログ同士を結ぶ値', prompt: 'この出力成功のアクセスログと監査ログに共通するrequest_idの値は？', placeholder: 'req-…', accepted: ['req-2048', 'request_id=req-2048'], answer: 'req-2048', explanation: '両方のログが同じrequest_idを持つため、同じ要求のHTTP結果とアプリの処理結果を結び付けられます。時刻、送信元IP、対象リソースも整合します。', evidence: [evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-2048'), evidence(webFiles, '/var/log/app/audit.log', 'request_id=req-2048')], hints: [{ text: '両ログの各行の末尾を確認します。', command: "grep '/admin/export/users.csv' /var/log/nginx/access.log" }, { text: 'アクセス側とアプリ側でrequest_idの値が一致するか照合します。', command: "grep 'rows=320' /var/log/app/audit.log" }] },
    ],
    walkthrough: [
      { title: '探索パスを確認する', command: "grep '203.0.113.88' /var/log/nginx/access.log", explanation: '探索的なGET、拒否された出力、ログイン、その後の操作が同じ送信元に並びます。' },
      { title: '認証結果をアプリ側で確認する', command: "grep 'action=login' /var/log/app/audit.log", explanation: '正規スタッフのログインに加え、対象IPからreport-adminへの失敗と成功が分かります。' },
      { title: '出力結果を比較する', command: "grep 'action=data_export' /var/log/app/audit.log", explanation: '拒否、正規スタッフによる45行出力、対象IPによる320行出力を区別します。' },
      { title: '同じリクエストを照合する', command: "grep 'req-2048' /var/log/nginx/access.log /var/log/app/audit.log", explanation: 'アクセス側はusers.csvのHTTP 200、アプリ側は成功と320行を記録しています。この組み合わせが出力の根拠です。' },
    ], initialCommand: 'cat /home/analyst/README.txt',
  };

  // Case 3: the logs establish observable transfer facts, not file contents.
  const proxyRecords = [], dnsRecords = [], mailRecords = [];
  let egressOrder = 0;
  const record = (records, at, line) => records.push({ at, order: egressOrder++, line });
  const proxy = (at, source, method, host, path, status, bytesOut, bytesIn, id) => record(proxyRecords, at, at + ' proxy-01 src=' + source + ' method=' + method + ' host=' + host + ' path=' + path + ' status=' + status + ' bytes_out=' + bytesOut + ' bytes_in=' + bytesIn + ' request_id=' + id);
  const dns = (at, source, qname, answer, id) => record(dnsRecords, at, at + ' dns-01 normalized_dns client=' + source + '#53000 query_id=' + id + ' qname=' + qname + ' qtype=A result=NOERROR answer=' + answer);
  const mail = (at, message) => record(mailRecords, at, at + ' mail-01 ' + message);
  const normalHosts = ['updates.vendor.example', 'docs.team.test', 'status.service.example', 'portal.lab.test'];
  const normalSources = ['192.0.2.11', '192.0.2.12', '192.0.2.20', '192.0.2.21', '192.0.2.34'];
  for (let i = 0; i < 70; i++) proxy(stamp(11 * 3600 + i * 22), normalSources[i % 5], 'GET', normalHosts[i % 4], i % 2 ? '/index.html' : '/health', 200, 120 + i % 17, 800 + i * 13, 'px-normal-' + i);
  for (let i = 0; i < 55; i++) dns(stamp(11 * 3600 + i * 29), normalSources[i % 5], normalHosts[i % 4], ['198.51.100.10', '192.0.2.80', '203.0.113.90', '192.0.2.81'][i % 4], 'dns-normal-' + i);
  for (let i = 0; i < 10; i++) {
    const at = 11 * 3600 + i * 91;
    const id = 'A' + String(100000 + i) + 'B01';
    mail(stamp(at), 'postfix/submission/smtpd[' + (5100 + i) + ']: ' + id + ': client=ws-20.lab.test[192.0.2.20], sasl_method=PLAIN, sasl_username=staff-a');
    mail(stamp(at + 1), 'postfix/qmgr[5200]: ' + id + ': from=<staff-a@lab.test>, size=' + (2048 + i * 23) + ', nrcpt=1 (queue active)');
    mail(stamp(at + 2), 'postfix/smtp[5300]: ' + id + ': to=<team@lab.test>, relay=mx.lab.test[192.0.2.25]:25, delay=0.2, delays=0.1/0/0.1/0, dsn=2.0.0, status=sent (250 2.0.0 queued)');
    mail(stamp(at + 2), 'postfix/qmgr[5200]: ' + id + ': removed');
  }
  dns(utc(11, 15, 2), '192.0.2.34', 'archive-sync.example', '198.51.100.202', 'dns-7301');
  dns(utc(11, 16, 40), '192.0.2.34', 'mx.archive-sync.example', '198.51.100.203', 'dns-7302');
  mail(utc(11, 16, 41), 'postfix/submission/smtpd[4201]: C6D71A20F1: client=ws-34.lab.test[192.0.2.34], sasl_method=PLAIN, sasl_username=svc-reports');
  mail(utc(11, 16, 42), 'postfix/cleanup[4202]: C6D71A20F1: message-id=<report-341@lab.test>');
  mail(utc(11, 16, 42), 'postfix/qmgr[4203]: C6D71A20F1: from=<svc-reports@lab.test>, size=846120, nrcpt=1 (queue active)');
  mail(utc(11, 16, 43), 'postfix/smtp[4204]: C6D71A20F1: to=<drop@archive-sync.example>, relay=mx.archive-sync.example[198.51.100.203]:25, delay=1.2, delays=0.1/0.1/0.4/0.6, dsn=2.0.0, status=sent (250 2.0.0 queued as TRAIN-884)');
  mail(utc(11, 16, 43), 'postfix/qmgr[4203]: C6D71A20F1: removed');
  const uploads = [[20, 5, 196608], [20, 58, 327680], [22, 17, 286720], [23, 5, 237568]];
  uploads.forEach(([minute, second, bytes], i) => proxy(utc(11, minute, second), '192.0.2.34', 'POST', 'archive-sync.example', '/v1/upload', 200, bytes, 96, 'px-900' + (i + 1)));
  dns(utc(11, 22, 1), '192.0.2.34', 'archive-sync.example', '198.51.100.202', 'dns-7303');
  proxy(utc(11, 23, 50), '192.0.2.11', 'POST', 'portal.lab.test', '/api/metrics', 204, 2048, 0, 'px-metrics-1');
  proxy(utc(11, 24, 10), '192.0.2.34', 'GET', 'archive-sync.example', '/health', 200, 148, 32, 'px-9010');
  const egressFiles = {
    '/home/analyst/README.txt': readme('ケース3: DNS・プロキシ・メールの横断調査', '外部宛ての通信量増加が報告されました。DNS、プロキシ、メールのログを照合し、共通する端末と観測できる通信の事実を整理します。', ['/var/log/proxy/access.log', '/var/log/named/query.log', '/var/log/mail.log']),
    '/etc/hostname': 'log-hub-01\n',
    '/var/log/proxy/access.log': textFile(ordered(proxyRecords)),
    '/var/log/named/query.log': textFile(ordered(dnsRecords)),
    '/var/log/mail.log': textFile(ordered(mailRecords)),
  };
  const egress = {
    id: 'egress', title: 'DNS・プロキシ・メールの横断調査', level: '中級', minutes: 25,
    summary: '3種類のログを送信元、宛先、キューIDで結び、外向き通信の経緯を整理します。',
    briefing: [
      '2026年8月12日 11:00〜11:25 UTCに、外部宛て通信の増加が観測されました。',
      'プロキシのbytes_outは送信元端末から外向きのバイト数です。定期GETや社内メトリクス送信も含まれます。',
      'DNSへの問い合わせだけでは接続成功を示しません。プロキシの成功応答やメール配送結果を別に確認します。',
      'このログには送信内容がありません。機密情報の流出や端末侵害の確定には、端末・業務・本文等の追加証拠が必要です。',
    ], files: egressFiles,
    tasks: [
      { id: 'workstation', label: '共通の端末', prompt: '繰り返す /v1/upload へのPOST、関連するDNS問い合わせ、メール送信元に共通する端末IPは？', placeholder: '端末IP', accepted: ['192.0.2.34'], answer: '192.0.2.34', explanation: 'プロキシのsrc、DNSのclient、メール受付のclientが192.0.2.34で一致します。共有NAT等の追加情報がないこの演習では、同じ端末の通信として関連付けます。', evidence: [evidence(egressFiles, '/var/log/proxy/access.log', 'request_id=px-9001'), evidence(egressFiles, '/var/log/named/query.log', 'query_id=dns-7301'), evidence(egressFiles, '/var/log/mail.log', 'client=ws-34.lab.test')], hints: [{ text: 'まずアップロード先の要求を探し、srcの値を確認します。', command: "grep '/v1/upload' /var/log/proxy/access.log" }, { text: 'DNSとメールでも同じ送信元を探します。', command: "grep '192.0.2.34' /var/log/named/query.log /var/log/mail.log" }] },
      { id: 'domain', label: '外部の宛先', prompt: '4回のアップロード先で、関連メールの宛先ドメインでもある名前は？', placeholder: 'ホスト名・ドメイン名', accepted: ['archive-sync.example', 'host=archive-sync.example'], answer: 'archive-sync.example', explanation: 'POST先のhostはarchive-sync.example。メールの宛先もdrop@archive-sync.exampleで、同じドメインに関連します。通常の社内メトリクスPOSTと区別してください。', evidence: [evidence(egressFiles, '/var/log/proxy/access.log', 'request_id=px-9001'), evidence(egressFiles, '/var/log/mail.log', 'to=<drop@archive-sync.example>')], hints: [{ text: 'プロキシでPOSTだけを抽出し、hostの項目を見ます。', command: "grep 'method=POST' /var/log/proxy/access.log" }, { text: 'mail.logのto=<…>とホスト名を比べます。', command: "grep 'status=sent' /var/log/mail.log" }] },
      { id: 'dns-answer', label: 'DNSの回答', prompt: 'アップロード先ホストそのもののAレコード回答IPは？（mxのホストとは区別）', placeholder: '回答IP', accepted: ['198.51.100.202', 'answer=198.51.100.202'], answer: '198.51.100.202', explanation: 'qname=archive-sync.exampleのA応答が198.51.100.202です。メール中継先mx.archive-sync.exampleの198.51.100.203とは異なります。', evidence: [evidence(egressFiles, '/var/log/named/query.log', 'query_id=dns-7301'), evidence(egressFiles, '/var/log/named/query.log', 'query_id=dns-7302')], hints: [{ text: '対象ドメインを含むDNSログを探します。', command: "grep 'archive-sync.example' /var/log/named/query.log" }, { text: 'qnameが完全に一致する行のanswerを確認します。', command: "grep 'qname=archive-sync.example ' /var/log/named/query.log" }] },
      { id: 'post-count', label: 'アップロード要求の数', prompt: 'この端末から、この外部ホストの /v1/upload へのPOSTは何件？', placeholder: '数字で入力', accepted: ['4', '4件', '4回'], answer: '4', explanation: '11:20:05、11:20:58、11:22:17、11:23:05 UTCの4件です。同じホストへのGET /healthや社内宛てのPOSTは含めません。bytes_outは196608、327680、286720、237568で、一定量・一定間隔ではありません。', evidence: [evidence(egressFiles, '/var/log/proxy/access.log', 'request_id=px-9001'), evidence(egressFiles, '/var/log/proxy/access.log', 'request_id=px-9004')], hints: [{ text: '送信元、メソッド、ホスト、パスを絞って行数を数えます。' }, { text: '対象のPOSTだけに絞った行数をwc -lで数えます。', command: "grep 'src=192.0.2.34 ' /var/log/proxy/access.log | grep 'method=POST' | grep 'host=archive-sync.example ' | grep 'path=/v1/upload ' | wc -l" }] },
      { id: 'mail-account', label: 'SMTP認証アカウント', prompt: 'この端末からの関連メール受付で記録されたSMTP認証ユーザーは？', placeholder: 'アカウント名', accepted: ['svc-reports', 'sasl_username=svc-reports'], answer: 'svc-reports', explanation: 'メールの受付行にsasl_username=svc-reportsがあります。これはSMTP認証ユーザーであり、メッセージのFromアドレスだけから推測した値ではありません。', evidence: [evidence(egressFiles, '/var/log/mail.log', 'client=ws-34.lab.test')], hints: [{ text: '端末IPを含むメール受付の行を探します。', command: "grep '192.0.2.34' /var/log/mail.log" }, { text: 'sasl_usernameがSMTP認証に使われたユーザーです。' }] },
      { id: 'queue', label: '配送結果を結ぶキューID', prompt: 'そのメールの受付と外部への配送成功記録に共通するメールキューIDは？', placeholder: 'メールキューID', accepted: ['C6D71A20F1', 'C6D71A20F1:'], answer: 'C6D71A20F1', explanation: '受付から配送までC6D71A20F1で追跡できます。status=sentと相手サーバーの250応答は相手がメッセージを受け付けたことを示し、人が読んだことや内容の機密性までは示しません。', evidence: [evidence(egressFiles, '/var/log/mail.log', 'client=ws-34.lab.test'), evidence(egressFiles, '/var/log/mail.log', 'to=<drop@archive-sync.example>')], hints: [{ text: 'メール受付行では、プロセス名の後にキューIDがあります。', command: "grep 'sasl_username=svc-reports' /var/log/mail.log" }, { text: '見つけたキューIDで絞ると、受付・送信元・宛先・配送結果を続けて読めます。', command: "grep 'C6D71A20F1' /var/log/mail.log" }] },
    ],
    walkthrough: [
      { title: 'POSTの送信元と宛先を見る', command: "grep 'method=POST' /var/log/proxy/access.log | awk '{print $3, $5, $6, $8}'", explanation: '192.0.2.34から外部ホストへの4回の送信と、別端末からの社内メトリクス送信を区別できます。' },
      { title: '関連するDNS回答を調べる', command: "grep 'archive-sync.example' /var/log/named/query.log", explanation: 'アップロード先のA応答とメール中継ホストのA応答は異なります。DNSの問い合わせ時刻が後続通信より前にあることも確認します。' },
      { title: 'メールの入口を特定する', command: "grep '192.0.2.34' /var/log/mail.log", explanation: '同じ端末がsvc-reportsでSMTP認証し、メールキューIDが割り当てられています。' },
      { title: 'キューIDで配送まで追う', command: "grep 'C6D71A20F1' /var/log/mail.log", explanation: '外部宛て配送のstatus=sentと250応答が確認できます。ここから読了や送信内容までは判断できません。' },
      { title: '対象アップロードの数を確認する', command: "grep 'src=192.0.2.34 ' /var/log/proxy/access.log | grep 'method=POST' | grep 'host=archive-sync.example ' | grep 'path=/v1/upload ' | wc -l", explanation: '該当するPOSTは4件です。観測事実をまとめた後は、通信の業務上の必要性や端末側の証拠を追加調査します。' },
    ], initialCommand: 'cat /home/analyst/README.txt',
  };
  // Before/after snapshots are separate; the full datasets above keep their line numbers.
  const snapshotReadme = (exercise, paths) => readme(
    exercise.title + ' — 攻撃前の正常ログ',
    '現在は攻撃前の正常ログです。通常の業務処理や管理操作が記録されています。画面の攻撃ボタンを押すと、静的に作成した演習イベントを加えたログへ切り替わります。通信やコマンドの送信・実行は行いません。正常に戻す操作でこの状態に戻せます。',
    paths
  ) + '\n正常状態と攻撃後を比較すると、増えた行や処理結果の違いを調べられます。正常な入力にもアポストロフィなどの記号が含まれる場合があります。\n';
  const setBaseline = (exercise, logFiles, label, summary) => {
    exercise.logPaths = Object.keys(logFiles);
    exercise.baselineFiles = {
      '/etc/hostname': exercise.files['/etc/hostname'],
      '/home/analyst/README.txt': snapshotReadme(exercise, exercise.logPaths),
      ...logFiles,
    };
    exercise.attack = { label, summary };
  };
  const selectLines = (content, predicate) => textFile(content.trimEnd().split('\n').filter(predicate));
  setBaseline(ssh, {
    '/var/log/auth.log': selectLines(sshFiles['/var/log/auth.log'], line => !line.includes('198.51.100.73') && !line.includes('203.0.113.44') && !line.includes('deploy') && !['sshd[4100]', 'sudo[4110]', 'sudo[4117]'].some(process => line.includes(process))),
  }, 'SSH認証異常を追加', '認証異常と後続のsudo操作を追加しました。');
  setBaseline(web, {
    '/var/log/nginx/access.log': selectLines(webFiles['/var/log/nginx/access.log'], line => !line.startsWith('203.0.113.88 ')),
    '/var/log/app/audit.log': selectLines(webFiles['/var/log/app/audit.log'], line => !line.includes('src_ip=203.0.113.88 ')),
  }, 'Web探索・出力イベントを追加', '探索要求と認証・データ出力の記録を追加しました。');
  setBaseline(egress, {
    '/var/log/proxy/access.log': selectLines(egressFiles['/var/log/proxy/access.log'], line => !line.includes('host=archive-sync.example ')),
    '/var/log/named/query.log': selectLines(egressFiles['/var/log/named/query.log'], line => !line.includes('archive-sync.example')),
    '/var/log/mail.log': selectLines(egressFiles['/var/log/mail.log'], line => !line.includes('C6D71A20F1:')),
  }, '外向き通信の異常を追加', '外部宛てのDNS・アップロード・メール記録を追加しました。');

  // New cases use paired text/JSONL audit views of exactly the same events.
  let scenarioOrder = 0;
  const put = (records, at, line) => records.push({ at, order: scenarioOrder++, line });
  const newAccess = (records, at, ip, method, path, status, bytes, id) => put(records, at, ip + ' - - [' + nginxTime(at) + '] "' + method + ' ' + path + ' HTTP/1.1" ' + status + ' ' + bytes + ' "-" "LabBrowser/1.0" request_id=' + id);
  const auditPair = (records, jsonRecords, at, host, fields) => {
    const value = item => typeof item === 'string' && /\s/.test(item) ? JSON.stringify(item) : String(item);
    put(records, at, at + ' ' + host + ' app_audit ' + Object.entries(fields).map(([key, item]) => key + '=' + value(item)).join(' '));
    put(jsonRecords, at, JSON.stringify({ timestamp: at, host, ...fields }));
  };

  // Case 4: a normal apostrophe is a deliberate false-positive control.
  const sqlAccess = [], sqlAudit = [], sqlJson = [], sqlDb = [];
  const searchTerms = ['router', 'cable', 'switch', 'adapter', 'monitor'];
  for (let i = 0; i < 100; i++) {
    const at = stamp(12 * 3600 + i * 10), id = 'req-search-' + String(i).padStart(3, '0');
    const ip = i % 2 ? '192.0.2.20' : '192.0.2.21';
    if (i % 4 === 0) {
      const term = i === 40 ? "O'Brien" : searchTerms[(i / 4) % searchTerms.length];
      const rows = i === 40 ? 1 : i % 7 + 1;
      const encoded = term === "O'Brien" ? 'O%27Brien' : term;
      newAccess(sqlAccess, at, ip, 'GET', '/api/search?q=' + encoded, 200, 100 + rows * 82, id);
      auditPair(sqlAudit, sqlJson, at, 'catalog-01', { action: 'search', result: 'success', actor: 'staff-b', src_ip: ip, input: term, expected_max_rows: 10, db_rows_read: rows, rows_returned: rows, query_shape_changed: false, query_id: 'sql-normal-' + i, request_id: id });
      put(sqlDb, at, at + ' catalog-01 db_audit op=select database=catalog app_user=search_ro mode=prepared expected_shape=title_equals observed_shape=title_equals query_shape_changed=false rows_read=' + rows + ' rows_returned=' + rows + ' result=success query_id=sql-normal-' + i + ' request_id=' + id + ' bound_q=' + JSON.stringify(term));
    } else {
      newAccess(sqlAccess, at, ip, 'GET', ['/health', '/assets/search.js', '/catalog'][i % 3], 200, 180 + i, id);
    }
  }
  const sqlBaselineLogs = {
    '/var/log/nginx/access.log': textFile(ordered(sqlAccess.slice())),
    '/var/log/app/audit.log': textFile(ordered(sqlAudit.slice())),
    '/var/log/app/audit.jsonl': textFile(ordered(sqlJson.slice())),
    '/var/log/db/query.log': textFile(ordered(sqlDb.slice())),
  };
  newAccess(sqlAccess, utc(12, 8, 3), '198.51.100.164', 'GET', '/api/search?q=%27', 500, 86, 'req-sql-201');
  auditPair(sqlAudit, sqlJson, utc(12, 8, 3), 'catalog-01', { action: 'search', result: 'error', actor: 'guest', src_ip: '198.51.100.164', input: "'", reason: 'db_syntax', expected_max_rows: 10, db_rows_read: 0, rows_returned: 0, query_shape_changed: 'unknown', query_id: 'sql-901', request_id: 'req-sql-201' });
  put(sqlDb, utc(12, 8, 3), utc(12, 8, 3) + ' catalog-01 db_audit op=select database=catalog app_user=search_ro mode=interpolated expected_shape=title_equals observed_shape=parse_error query_shape_changed=unknown rows_read=0 rows_returned=0 result=error sqlstate=42601 query_id=sql-901 request_id=req-sql-201');
  newAccess(sqlAccess, utc(12, 8, 21), '198.51.100.164', 'GET', '/api/search?q=%27%20OR%20%271%27%3D%271', 200, 198432, 'req-sql-202');
  auditPair(sqlAudit, sqlJson, utc(12, 8, 21), 'catalog-01', { action: 'search', result: 'success', actor: 'guest', src_ip: '198.51.100.164', input: "' OR '1'='1", expected_max_rows: 10, db_rows_read: 2400, rows_returned: 2400, query_shape_changed: true, query_id: 'sql-902', request_id: 'req-sql-202' });
  put(sqlDb, utc(12, 8, 21), utc(12, 8, 21) + ' catalog-01 db_audit op=select database=catalog app_user=search_ro mode=interpolated expected_shape=title_equals observed_shape=title_equals_or_true query_shape_changed=true rows_read=2400 rows_returned=2400 result=success query_id=sql-902 request_id=req-sql-202');
  const sqlFiles = {
    '/home/analyst/README.txt': readme('ケース4: SQLインジェクションの痕跡', '正常検索と不正入力の試行を比較します。構文エラーやHTTP 200だけで成功と決めず、DB監査とアプリ監査でクエリ構造と行数を確認してください。', ['/var/log/nginx/access.log', '/var/log/app/audit.log', '/var/log/app/audit.jsonl', '/var/log/db/query.log']) + '\naudit.logとaudit.jsonlは同じアプリイベントのテキスト表示とJSON Lines表示です。query.logのクエリ構造情報は、この教材の監査計測を正規化したものです。正常なO\'Brien検索も比較対象に含まれます。\n',
    '/etc/hostname': 'catalog-01\n',
    '/var/log/nginx/access.log': textFile(ordered(sqlAccess)),
    '/var/log/app/audit.log': textFile(ordered(sqlAudit)),
    '/var/log/app/audit.jsonl': textFile(ordered(sqlJson)),
    '/var/log/db/query.log': textFile(ordered(sqlDb)),
  };
  const sqli = {
    id: 'sqli', title: 'SQLインジェクションと検索結果の異常', shortTitle: 'SQLインジェクション', level: '中級', minutes: 25,
    summary: '普通のアポストロフィ入力と構造が変わったクエリを区別し、過剰な行参照を裏付けます。',
    briefing: [
      '対象はcatalog-01。2026年8月12日 12:00〜12:17 UTCの検索サービスのログです。すべて静的な架空データです。',
      '正常検索にはO\'Brienも含まれます。記号の存在だけでSQLインジェクションとは判断できません。',
      'expected_max_rowsは通常検索で想定する件数の目安です。この教材ではSQLのLIMITによる強制上限を表していません。',
      '最初の構文不正と後の成功イベントを別々に追い、DB監査の構造変化と実際の参照・返却行数を確認します。HTTPの結果だけでデータ取得を断定しないでください。',
      'audit.jsonlはaudit.logと同じイベントのJSON Lines表示です。query.logは教材向けに正規化したDB監査記録です。',
    ], files: sqlFiles,
    tasks: [
      { id: 'source', label: '不正入力を試した送信元', prompt: '構文不正と、その後の構造が変わった検索の両方に共通する送信元IPは？', placeholder: '送信元IP', accepted: ['198.51.100.164'], answer: '198.51.100.164', explanation: 'この送信元による2要求が、アプリ監査でdb_syntaxとquery_shape_changed=trueに対応しています。通常のO\'Brien検索とは送信元と結果が異なります。', evidence: [evidence(sqlFiles, '/var/log/app/audit.log', 'request_id=req-sql-201'), evidence(sqlFiles, '/var/log/app/audit.log', 'request_id=req-sql-202')], hints: [{ text: 'まずDB構文エラーが記録されたアプリイベントを探します。', command: "grep 'reason=db_syntax' /var/log/app/audit.log" }, { text: '構造が変わったイベントの送信元と比べます。', command: "grep 'query_shape_changed=true' /var/log/app/audit.log" }] },
      { id: 'syntax-request', label: 'エラーになった要求', prompt: 'DB構文エラーになり、参照・返却行数とも0だった要求のrequest_idは？', placeholder: 'req-…', accepted: ['req-sql-201', 'request_id=req-sql-201'], answer: 'req-sql-201', explanation: 'req-sql-201はHTTP 500、アプリのdb_syntax、DBのparse_errorと0行が対応します。これは不正な入力の試行を示しますが、データ取得成功の根拠にはなりません。', evidence: [evidence(sqlFiles, '/var/log/nginx/access.log', 'request_id=req-sql-201'), evidence(sqlFiles, '/var/log/db/query.log', 'request_id=req-sql-201')], hints: [{ text: 'DB監査でresult=errorの行を読みます。', command: "grep 'result=error' /var/log/db/query.log" }, { text: '末尾のrequest_idをアクセス・アプリログで照合できます。' }] },
      { id: 'success-request', label: '構造の逸脱を確認した要求', prompt: 'クエリ構造の変化と過剰な行参照・返却の両方が確認できる要求のrequest_idは？', placeholder: 'req-…', accepted: ['req-sql-202', 'request_id=req-sql-202'], answer: 'req-sql-202', explanation: 'DB監査のobserved_shape=title_equals_or_true、query_shape_changed=true、result=successと、アプリの2400行返却が同じrequest_idで結び付きます。HTTP 200だけで成功と判断していません。', evidence: [evidence(sqlFiles, '/var/log/db/query.log', 'request_id=req-sql-202'), evidence(sqlFiles, '/var/log/app/audit.log', 'request_id=req-sql-202')], hints: [{ text: '構造変化を記録したDBイベントを探します。', command: "grep 'query_shape_changed=true' /var/log/db/query.log" }, { text: '同じ要求のアプリ処理結果を照合します。', command: "grep 'req-sql-202' /var/log/app/audit.log /var/log/db/query.log" }] },
      { id: 'rows', label: '実際の参照行数', prompt: 'この構造が変わった検索で、DBが参照した行数は？', placeholder: '数字で入力', accepted: ['2400', '2,400', '2400行', '2400件', 'rows_read=2400', 'db_rows_read=2400'], answer: '2400', explanation: 'DB監査のrows_readとアプリ監査のdb_rows_readが2400で一致し、rows_returnedも2400です。通常の期待上限10件を超えています。応答バイト数と行数は区別してください。', evidence: [evidence(sqlFiles, '/var/log/db/query.log', 'request_id=req-sql-202'), evidence(sqlFiles, '/var/log/app/audit.jsonl', '"request_id":"req-sql-202"')], hints: [{ text: '対象のDBイベントでrows_readの値を確認します。', command: "grep 'req-sql-202' /var/log/db/query.log" }, { text: '同じ値をJSON Linesの監査記録でも確認できます。', command: "grep 'req-sql-202' /var/log/app/audit.jsonl" }] },
      { id: 'benign-mode', label: '誤検知との比較', prompt: '正常なO\'Brien検索を処理したDBイベントのmode値は？', placeholder: 'modeの値', accepted: ['prepared', 'mode=prepared'], answer: 'prepared', explanation: 'req-search-040はmode=preparedで入力をパラメーターとして扱い、構造変化はfalse、結果は1行です。アポストロフィを含んでいても、通常の検索として処理されています。', evidence: [evidence(sqlFiles, '/var/log/nginx/access.log', 'request_id=req-search-040'), evidence(sqlFiles, '/var/log/db/query.log', 'request_id=req-search-040')], hints: [{ text: '通常のアポストロフィはURLで%27と記録されています。', command: "grep 'O%27Brien' /var/log/nginx/access.log" }, { text: 'そのrequest_idをDB監査で検索します。', command: "grep 'req-search-040' /var/log/db/query.log" }] },
    ],
    walkthrough: [
      { title: 'エラーと構造変化を分ける', command: "grep 'req-sql-' /var/log/app/audit.log", explanation: '最初の構文不正は0行。次のイベントは構造変化と2400行返却が記録されています。' },
      { title: 'HTTPとDBの記録を照合する', command: "grep 'req-sql-202' /var/log/nginx/access.log /var/log/db/query.log", explanation: 'HTTP 200に加えて、DB監査が構造変化と2400行の参照・返却を裏付けています。' },
      { title: '普通の記号入力と比べる', command: "grep 'req-search-040' /var/log/nginx/access.log /var/log/db/query.log", explanation: '正常なO\'Brienはpreparedで構造を変えず、1行を返します。文字の存在だけで判定しないための対照です。' },
      { title: 'JSON Linesでも同じイベントを見る', command: "grep 'req-sql-202' /var/log/app/audit.jsonl", explanation: '数値・真偽値・文字列の型があるJSON形式でも、同じ要求と処理結果を確認できます。' },
    ], initialCommand: 'cat /home/analyst/README.txt',
  };
  setBaseline(sqli, sqlBaselineLogs, 'SQLインジェクションのログを追加', '構文不正とクエリ構造の逸脱を示すログを追加しました。');

  // Case 5: exec/exit telemetry establishes a harmless unexpected child execution.
  const cmdAccess = [], cmdAudit = [], cmdJson = [], cmdProcesses = [];
  for (let i = 0; i < 100; i++) {
    const at = stamp(13 * 3600 + i * 10), id = 'req-diag-normal-' + String(i).padStart(3, '0');
    const ip = i % 2 ? '192.0.2.20' : '192.0.2.21';
    if (i % 4 === 0) {
      const target = i % 8 ? '192.0.2.2' : '192.0.2.1', pid = 7300 + i * 3;
      newAccess(cmdAccess, at, ip, 'GET', '/api/diag-legacy?target=' + target, 200, 240, id);
      auditPair(cmdAudit, cmdJson, at, 'diag-01', { action: 'diagnostic', result: 'completed', handler: 'legacy', actor: 'operator', src_ip: ip, target, separator_seen: false, expected_child: '/usr/bin/ping', unexpected_child: 'none', request_id: id });
      put(cmdProcesses, at, at + ' diag-01 process_audit event=exec pid=' + pid + ' ppid=7001 user=diag-web exe=/bin/sh argv="sh -c /usr/bin/ping -c 1 ' + target + '" request_id=' + id);
      put(cmdProcesses, at, at + ' diag-01 process_audit event=exec pid=' + (pid + 1) + ' ppid=' + pid + ' user=diag-web exe=/usr/bin/ping argv="ping -c 1 ' + target + '" request_id=' + id);
    } else {
      newAccess(cmdAccess, at, ip, 'GET', ['/health', '/assets/diag.js', '/diagnostics'][i % 3], 200, 160 + i, id);
    }
  }
  const cmdBaselineLogs = {
    '/var/log/nginx/access.log': textFile(ordered(cmdAccess.slice())),
    '/var/log/app/audit.log': textFile(ordered(cmdAudit.slice())),
    '/var/log/app/audit.jsonl': textFile(ordered(cmdJson.slice())),
    '/var/log/process/exec.log': textFile(ordered(cmdProcesses.slice())),
  };
  newAccess(cmdAccess, utc(13, 9, 2), '203.0.113.166', 'GET', '/api/diag?target=192.0.2.1%3Bid', 200, 74, 'req-diag-401');
  auditPair(cmdAudit, cmdJson, utc(13, 9, 2), 'diag-01', { action: 'diagnostic', result: 'denied', handler: 'validated', actor: 'operator', src_ip: '203.0.113.166', target: '192.0.2.1;id', reason: 'invalid_target', separator_seen: true, child_started: false, request_id: 'req-diag-401' });
  newAccess(cmdAccess, utc(13, 9, 20), '203.0.113.166', 'GET', '/api/diag-legacy?target=192.0.2.1%3Bid', 200, 308, 'req-diag-402');
  auditPair(cmdAudit, cmdJson, utc(13, 9, 20), 'diag-01', { action: 'diagnostic', result: 'completed', handler: 'legacy', actor: 'operator', src_ip: '203.0.113.166', target: '192.0.2.1;id', separator_seen: true, expected_child: '/usr/bin/ping', unexpected_child: '/usr/bin/id', request_id: 'req-diag-402' });
  put(cmdProcesses, utc(13, 9, 19), utc(13, 9, 19) + ' diag-01 process_audit event=exec pid=8840 ppid=7001 user=diag-web exe=/bin/sh argv="sh -c /usr/bin/ping -c 1 192.0.2.1;id" request_id=req-diag-402');
  put(cmdProcesses, utc(13, 9, 19), utc(13, 9, 19) + ' diag-01 process_audit event=exec pid=8841 ppid=8840 user=diag-web exe=/usr/bin/ping argv="ping -c 1 192.0.2.1" request_id=req-diag-402');
  put(cmdProcesses, utc(13, 9, 20), utc(13, 9, 20) + ' diag-01 process_audit event=exec pid=8843 ppid=8840 user=diag-web exe=/usr/bin/id argv="id" request_id=req-diag-402');
  put(cmdProcesses, utc(13, 9, 20), utc(13, 9, 20) + ' diag-01 process_audit event=exit pid=8843 status=0 stdout="uid=1003(diag-web) gid=1003(diag-web) groups=1003(diag-web)" request_id=req-diag-402');
  put(cmdProcesses, utc(13, 9, 20), utc(13, 9, 20) + ' diag-01 process_audit event=exit pid=8840 status=0 request_id=req-diag-402');
  const cmdFiles = {
    '/home/analyst/README.txt': readme('ケース5: コマンドインジェクションと子プロセス', '診断APIへの入力と子プロセスの記録を比較します。HTTP 200でも入力が拒否される場合があるため、アプリ監査とプロセス監査を照合して実行の有無を確認します。', ['/var/log/nginx/access.log', '/var/log/app/audit.log', '/var/log/app/audit.jsonl', '/var/log/process/exec.log']) + '\naudit.logとaudit.jsonlは同じアプリイベントのテキスト表示とJSON Lines表示です。exec.logは教材向けに正規化したプロセス監査です。すべての要求・コマンドはログ内の静的な文字列であり、実行されません。\n',
    '/etc/hostname': 'diag-01\n',
    '/var/log/nginx/access.log': textFile(ordered(cmdAccess)),
    '/var/log/app/audit.log': textFile(ordered(cmdAudit)),
    '/var/log/app/audit.jsonl': textFile(ordered(cmdJson)),
    '/var/log/process/exec.log': textFile(ordered(cmdProcesses)),
  };
  const cmdinj = {
    id: 'cmdinj', title: 'コマンドインジェクションと子プロセス', shortTitle: 'コマンドインジェクション', level: '中級', minutes: 25,
    summary: 'HTTP要求、アプリの入力判定、子プロセスの実行・終了を結び、実行の有無と権限を確認します。',
    briefing: [
      '対象はdiag-01。2026年8月12日 13:00〜13:17 UTCの診断APIの記録です。正常時はpingを子プロセスとして使います。',
      'アクセスログの%3Bはセミコロンを表します。入力の連結記号だけでは実行成功とは断定できません。',
      '検証付きハンドラーと旧式ハンドラーの処理結果が含まれます。HTTP 200でも入力拒否のことがあり、別途プロセス監査のexec・exitを確認します。',
      'この教材のコマンドはログ内の静的な文字列です。外部への要求や実行は発生しません。audit.jsonlはアプリ監査のJSON Lines表示です。',
    ], files: cmdFiles,
    tasks: [
      { id: 'source', label: '連結記号を含む要求元', prompt: 'セミコロンを含むtargetを送った2つの要求に共通する送信元IPは？', placeholder: '送信元IP', accepted: ['203.0.113.166'], answer: '203.0.113.166', explanation: 'アクセスログで%3Bを含む2要求と、アプリ監査のseparator_seen=trueがこの送信元で一致します。この時点では入力の試行が確認できるだけです。', evidence: [evidence(cmdFiles, '/var/log/nginx/access.log', 'request_id=req-diag-401'), evidence(cmdFiles, '/var/log/nginx/access.log', 'request_id=req-diag-402')], hints: [{ text: 'アクセスログでURLエンコードされたセミコロンを探します。', command: "grep '%3B' /var/log/nginx/access.log" }, { text: 'アプリ監査でもseparator_seen=trueの送信元を照合します。', command: "grep 'separator_seen=true' /var/log/app/audit.log" }] },
      { id: 'denied', label: '200でも拒否された要求', prompt: 'HTTP 200でも、アプリが入力を拒否し子プロセスを開始しなかった要求のrequest_idは？', placeholder: 'req-…', accepted: ['req-diag-401', 'request_id=req-diag-401'], answer: 'req-diag-401', explanation: 'req-diag-401はHTTP 200ですが、アプリのresult=denied、reason=invalid_target、child_started=falseが入力拒否を記録しています。HTTPの結果と実行成否は同じではありません。', evidence: [evidence(cmdFiles, '/var/log/nginx/access.log', 'request_id=req-diag-401'), evidence(cmdFiles, '/var/log/app/audit.log', 'request_id=req-diag-401')], hints: [{ text: 'アプリ監査の拒否イベントを読みます。', command: "grep 'result=denied' /var/log/app/audit.log" }, { text: 'child_startedとrequest_idの項目を確認します。' }] },
      { id: 'unexpected-exe', label: '予期しない実行ファイル', prompt: '通常のpingに続いて実行され、終了コード0まで確認できる予期しない実行ファイルの絶対パスは？', placeholder: '/usr/bin/…', accepted: ['/usr/bin/id'], answer: '/usr/bin/id', explanation: 'アプリ監査のunexpected_childに加え、プロセス監査が/usr/bin/idのexecを記録し、同じpid=8843でstatus=0の終了とユーザー情報の出力を確認できます。', evidence: [evidence(cmdFiles, '/var/log/app/audit.log', 'request_id=req-diag-402'), evidence(cmdFiles, '/var/log/process/exec.log', 'exe=/usr/bin/id'), evidence(cmdFiles, '/var/log/process/exec.log', 'event=exit pid=8843')], hints: [{ text: 'アプリ監査で通常と異なる子プロセスの項目を探します。', command: "grep 'req-diag-402' /var/log/app/audit.log" }, { text: '同じ要求のプロセス監査にexecとexitが両方あるか確認します。', command: "grep 'req-diag-402' /var/log/process/exec.log" }] },
      { id: 'run-user', label: '実行された権限', prompt: 'この予期しない実行ファイルを動かしたOSユーザー名は？', placeholder: 'ユーザー名', accepted: ['diag-web', 'user=diag-web'], answer: 'diag-web', explanation: 'exec行のuser=diag-webと、終了時のstdoutにあるuid=1003(diag-web)が整合します。この記録はroot権限の取得を示していません。', evidence: [evidence(cmdFiles, '/var/log/process/exec.log', 'exe=/usr/bin/id'), evidence(cmdFiles, '/var/log/process/exec.log', 'event=exit pid=8843')], hints: [{ text: '対象実行ファイルのexec行でuserを読みます。', command: "grep 'exe=/usr/bin/id' /var/log/process/exec.log" }, { text: '同じpidの終了記録の出力でも確認できます。', command: "grep 'pid=8843 ' /var/log/process/exec.log" }] },
      { id: 'executed-request', label: '実行を確認した要求', prompt: '入力から予期しない子プロセスの実行まで結び付けられるrequest_idは？', placeholder: 'req-…', accepted: ['req-diag-402', 'request_id=req-diag-402'], answer: 'req-diag-402', explanation: '旧式ハンドラーの処理結果、シェルとpingの子プロセス、idのexec・exitが同じreq-diag-402を持ちます。拒否されたreq-diag-401とは区別できます。', evidence: [evidence(cmdFiles, '/var/log/nginx/access.log', 'request_id=req-diag-402'), evidence(cmdFiles, '/var/log/app/audit.jsonl', '"request_id":"req-diag-402"'), evidence(cmdFiles, '/var/log/process/exec.log', 'exe=/usr/bin/id')], hints: [{ text: '予期しない実行ファイルの行の末尾を見ます。', command: "grep 'exe=/usr/bin/id' /var/log/process/exec.log" }, { text: 'そのrequest_idを複数ログで検索して整合を確認します。', command: "grep 'req-diag-402' /var/log/nginx/access.log /var/log/app/audit.log /var/log/process/exec.log" }] },
      { id: 'parent', label: '子プロセスのつながり', prompt: '予期しない子プロセスの親プロセスID（ppid）は？', placeholder: '数字で入力', accepted: ['8840', 'ppid=8840'], answer: '8840', explanation: 'idの実行行はppid=8840です。同じpid=8840のexec行を見ると/bin/shであり、pingとidが同じシェルの子として起動されています。', evidence: [evidence(cmdFiles, '/var/log/process/exec.log', 'exe=/usr/bin/id'), evidence(cmdFiles, '/var/log/process/exec.log', 'event=exec pid=8840')], hints: [{ text: 'idの実行行のppidを読みます。', command: "grep 'exe=/usr/bin/id' /var/log/process/exec.log" }, { text: 'ppidと一致するpidのexec行を探すと親の実行ファイルが分かります。', command: "grep 'event=exec pid=8840 ' /var/log/process/exec.log" }] },
    ],
    walkthrough: [
      { title: '連結記号を含む入力を探す', command: "grep '%3B' /var/log/nginx/access.log", explanation: '入力が似ていてHTTP結果も200ですが、異なるハンドラーが処理しています。要求だけで実行を確定しません。' },
      { title: '入力拒否と完了を比較する', command: "grep 'separator_seen=true' /var/log/app/audit.log", explanation: '検証付きは拒否とchild_started=false。旧式は完了と予期しない子プロセスを記録しています。' },
      { title: '実行と終了の根拠を確認する', command: "grep 'req-diag-402' /var/log/process/exec.log", explanation: 'シェルの親子関係、idのexec、同じpidの終了コードとユーザー情報が揃っています。' },
      { title: 'JSON Linesで型と項目を確認する', command: "grep 'req-diag-40' /var/log/app/audit.jsonl", explanation: '拒否イベントのchild_startedはfalse、旧式イベントはunexpected_childを持ちます。同じアプリ監査をJSONで比較できます。' },
    ], initialCommand: 'cat /home/analyst/README.txt',
  };
  setBaseline(cmdinj, cmdBaselineLogs, 'コマンドインジェクションのログを追加', '入力拒否と予期しない子プロセス実行のログを追加しました。');
  // Additional investigations reuse the same immutable log fixtures and stable task IDs.
  ssh.minutes = 25;
  ssh.tasks.push(
    { id: 'target-count', label: '試行された名前の種類', prompt: '最多の送信元IPがパスワード認証を試したユーザー名は何種類？（存在しない名前も含む）', placeholder: '種類数', accepted: ['3', '3種類'], answer: '3', explanation: '対象名を末尾から抽出して重複を除くとadmin・root・deployの3種類です。invalid userの有無による列位置の違いに注意します。', evidence: [evidence(sshFiles, '/var/log/auth.log', 'Failed password for invalid user admin from 198.51.100.73 port 45000'), evidence(sshFiles, '/var/log/auth.log', 'Failed password for root from 198.51.100.73 port 45030'), evidence(sshFiles, '/var/log/auth.log', 'Failed password for deploy from 198.51.100.73 port 45050')], hints: [{ text: '対象IPの認証失敗から名前を抽出します。', command: "grep 'Failed password' /var/log/auth.log | grep -F 'from 198.51.100.73 port ' | awk '{print $(NF-5)}'" }, { text: '並べ替え、重複除去、行数の順で集計します。', command: "grep 'Failed password' /var/log/auth.log | grep -F 'from 198.51.100.73 port ' | awk '{print $(NF-5)}' | sort | uniq | wc -l" }] },
    { id: 'top-target', label: '最も多い認証対象名', prompt: 'この送信元が最も多く試したユーザー名は？', placeholder: 'ユーザー名', accepted: ['admin'], answer: 'admin', explanation: 'adminが30回、rootが20回、deployが10回です。adminはinvalid userとして記録されており、その名前のアカウントが存在するとは限りません。', evidence: [evidence(sshFiles, '/var/log/auth.log', 'Failed password for invalid user admin from 198.51.100.73 port 45000'), evidence(sshFiles, '/var/log/auth.log', 'Failed password for invalid user admin from 198.51.100.73 port 45029')], hints: [{ text: '対象名ごとの件数を比較します。', command: "grep 'Failed password' /var/log/auth.log | grep -F 'from 198.51.100.73 port ' | awk '{print $(NF-5)}' | sort | uniq -c" }, { text: '件数を大きい順にすると最多の名前が先頭です。', command: "grep 'Failed password' /var/log/auth.log | grep -F 'from 198.51.100.73 port ' | awk '{print $(NF-5)}' | sort | uniq -c | sort -nr" }] },
    { id: 'success-gap', label: '最後の失敗から成功まで', prompt: 'この送信元の最後の認証失敗からパスワード認証成功までは何秒？', placeholder: '秒数', accepted: ['50', '50秒', '50 seconds'], answer: '50', explanation: '最後の失敗は09:17:52 UTC、成功は09:18:42 UTCなので50秒です。成功直後のセッション開始時刻とは区別します。', evidence: [evidence(sshFiles, '/var/log/auth.log', 'Failed password for deploy from 198.51.100.73 port 45059'), evidence(sshFiles, '/var/log/auth.log', 'Accepted password for deploy')], hints: [{ text: '時系列の最後の失敗を確認します。', command: "grep -F 'from 198.51.100.73 port ' /var/log/auth.log | grep 'Failed password' | sed -n '$p'" }, { text: '認証成功時刻との差を秒に直します。', command: "grep -F 'from 198.51.100.73 port ' /var/log/auth.log | grep 'Accepted password'" }] },
    { id: 'sudo-count', label: '特権コマンドの実行数', prompt: 'deployによるsudoのCOMMAND実行記録は何件？（セッション行は除外）', placeholder: '件数', accepted: ['2', '2件', '2回'], answer: '2', explanation: 'COMMAND=があるのはidとsystemctlの2件です。セッションの開始・終了を実行回数に含めません。', evidence: [evidence(sshFiles, '/var/log/auth.log', 'COMMAND=/usr/bin/id'), evidence(sshFiles, '/var/log/auth.log', 'COMMAND=/usr/bin/systemctl')], hints: [{ text: 'まずdeployに関連するsudoログを確認します。', command: "grep 'sudo' /var/log/auth.log | grep 'deploy'" }, { text: 'コマンドが記録された行だけを数えます。', command: "grep 'sudo' /var/log/auth.log | grep 'deploy' | grep 'COMMAND=' | wc -l" }] },
    { id: 'trusted-key-count', label: '正規管理端末との比較', prompt: '192.0.2.10からopsへの公開鍵認証成功は何件？', placeholder: '件数', accepted: ['8', '8件', '8回'], answer: '8', explanation: '正規管理端末からのAccepted publickeyは8件です。別の送信元からのパスワード失敗やdeployへの成功と分けて集計します。', evidence: [evidence(sshFiles, '/var/log/auth.log', 'sshd[1800]:'), evidence(sshFiles, '/var/log/auth.log', 'sshd[1807]:')], hints: [{ text: '認証方式と対象アカウントを合わせて絞ります。', command: "grep 'Accepted publickey for ops' /var/log/auth.log" }, { text: '指定された送信元に絞って行数を数えます。', command: "grep 'Accepted publickey for ops' /var/log/auth.log | grep -F 'from 192.0.2.10 port ' | wc -l" }] }
  );
  ssh.walkthrough.push(
    { title: '試行された名前の分布を調べる', command: "grep 'Failed password' /var/log/auth.log | grep -F 'from 198.51.100.73 port ' | awk '{print $(NF-5)}' | sort | uniq -c | sort -nr", explanation: 'admin 30件、root 20件、deploy 10件。不存在の名前も含めて試行の対象を整理します。' },
    { title: '正規の管理アクセスと比較する', command: "grep 'Accepted publickey for ops' /var/log/auth.log | grep -F 'from 192.0.2.10 port ' | wc -l", explanation: '正規管理端末の公開鍵認証成功は8件。認証方式・名前・送信元を組み合わせて比較します。' }
  );

  web.minutes = 30;
  web.tasks.push(
    { id: 'request-count', label: '対象送信元の要求数', prompt: '探索を行った送信元からのHTTP要求は、成功・失敗を合わせて全部で何件？', placeholder: '件数', accepted: ['19', '19件'], answer: '19', explanation: '203.0.113.88のアクセスは19行です。探索だけでなくログインやその後の操作も含め、監査ログとの重複加算はしません。', evidence: [evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-scan-0'), evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-2049')], hints: [{ text: 'アクセスログを送信元で絞ります。', command: "grep '203.0.113.88' /var/log/nginx/access.log" }, { text: '1行を1要求として数えます。', command: "grep '203.0.113.88' /var/log/nginx/access.log | wc -l" }] },
    { id: 'not-found-count', label: '404応答の件数', prompt: 'この送信元の要求のうち、HTTPステータス404だったものは何件？', placeholder: '件数', accepted: ['7', '7件'], answer: '7', explanation: '送信元で絞ってからステータスの列を数えると404が7件です。URLやバイト数に含まれる数字を誤って数えないようにします。', evidence: [evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-scan-2'), evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-scan-11')], hints: [{ text: 'HTTPステータスはアクセスログの9列目です。', command: "grep '203.0.113.88' /var/log/nginx/access.log | awk '{print $9}' | sort | uniq -c" }, { text: '404と完全一致するステータスだけ数えます。', command: "grep '203.0.113.88' /var/log/nginx/access.log | awk '{print $9}' | grep '^404$' | wc -l" }] },
    { id: 'denied-resource', label: '認証後にも拒否された対象', prompt: 'report-adminでログインした後、権限不足で出力を拒否されたresourceは？', placeholder: 'resourceの値', accepted: ['payments', 'resource=payments'], answer: 'payments', explanation: 'paymentsはreason=insufficient_permissionで拒否されています。usersの出力成功と、未認証時の出力拒否とは別の結果です。', evidence: [evidence(webFiles, '/var/log/app/audit.log', 'request_id=req-2049'), evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-2049')], hints: [{ text: '対象アカウントの拒否イベントを探します。', command: "grep 'actor=report-admin' /var/log/app/audit.log | grep 'result=denied'" }, { text: 'そのrequest_idのアクセス側のURLとステータスも照合します。', command: "grep 'req-2049' /var/log/nginx/access.log /var/log/app/audit.log" }] },
    { id: 'response-bytes', label: '行数と応答サイズの区別', prompt: '320行の出力成功に対応するHTTP応答のバイト数は？', placeholder: 'バイト数', accepted: ['128460', '128,460', '128460バイト', '128460 bytes'], answer: '128460', explanation: 'req-2048のアクセスログでは応答サイズが128460バイトです。アプリ監査の320は出力行数で、単位が異なります。', evidence: [evidence(webFiles, '/var/log/nginx/access.log', 'request_id=req-2048'), evidence(webFiles, '/var/log/app/audit.log', 'request_id=req-2048')], hints: [{ text: '監査の出力成功に対応する要求を探します。', command: "grep 'req-2048' /var/log/nginx/access.log" }, { text: '10列目が応答サイズです。', command: "grep 'req-2048' /var/log/nginx/access.log | awk '{print $10}'" }] },
    { id: 'login-export-gap', label: '認証から出力までの時間', prompt: '対象IPのログイン成功から320行の出力成功まで何秒？', placeholder: '秒数', accepted: ['167', '167秒', '2分47秒', '00:02:47', '02:47'], answer: '167', explanation: '10:09:21 UTCの認証成功から10:12:08 UTCの出力成功まで、2分47秒＝167秒です。時刻だけでなく送信元とアカウントの一致も確認します。', evidence: [evidence(webFiles, '/var/log/app/audit.log', 'request_id=req-2041'), evidence(webFiles, '/var/log/app/audit.log', 'request_id=req-2048')], hints: [{ text: '対象IPの成功イベントだけを並べます。', command: "grep 'src_ip=203.0.113.88' /var/log/app/audit.log | grep 'result=success'" }, { text: 'action=loginとaction=data_exportの時刻差を秒に直します。', command: "grep 'src_ip=203.0.113.88' /var/log/app/audit.log | grep 'result=success' | awk '{print $1, $4}'" }] }
  );
  web.walkthrough.push(
    { title: '送信元ごとの応答結果を集計する', command: "grep '203.0.113.88' /var/log/nginx/access.log | awk '{print $9}' | sort | uniq -c", explanation: '200が4件、302が1件、401が5件、403が2件、404が7件で合計19件です。' },
    { title: '認証後の拒否も確かめる', command: "grep 'req-2049' /var/log/nginx/access.log /var/log/app/audit.log", explanation: 'ログイン成功後でもpaymentsは権限不足で拒否されています。全要求の成功を一括して推測しないようにします。' }
  );

  egress.minutes = 40;
  egress.tasks.push(
    { id: 'upload-bytes', label: 'アップロードの送信量合計', prompt: '4回の対象アップロードで記録されたbytes_outの合計は何バイト？', placeholder: '合計バイト数', accepted: ['1048576', '1,048,576', '1048576バイト', '1 MiB', '1MiB'], answer: '1048576', explanation: '196608＋327680＋286720＋237568＝1048576バイト（1 MiB）です。応答のbytes_inやGET、メールのサイズは含めません。', evidence: [evidence(egressFiles, '/var/log/proxy/access.log', 'request_id=px-9001'), evidence(egressFiles, '/var/log/proxy/access.log', 'request_id=px-9002'), evidence(egressFiles, '/var/log/proxy/access.log', 'request_id=px-9003'), evidence(egressFiles, '/var/log/proxy/access.log', 'request_id=px-9004')], hints: [{ text: '対象アップロードの送信量の列を取り出します。', command: "grep 'path=/v1/upload ' /var/log/proxy/access.log | grep 'src=192.0.2.34 ' | awk '{print $8}'" }, { text: '各bytes_outの数値を取り出して合計します。', command: "grep 'path=/v1/upload ' /var/log/proxy/access.log | grep 'src=192.0.2.34 ' | awk '{print $8}' | cut -d= -f2 | awk '{sum += $1} END {print sum}'" }] },
    { id: 'dns-names', label: '関連DNS名の種類数', prompt: 'この端末のDNSログでarchive-sync.exampleに関連するqnameは何種類？', placeholder: '種類数', accepted: ['2', '2種類'], answer: '2', explanation: 'archive-sync.exampleとmx.archive-sync.exampleの2種類です。前者には2回の問い合わせがあるため、行数の3とは区別します。', evidence: [evidence(egressFiles, '/var/log/named/query.log', 'query_id=dns-7301'), evidence(egressFiles, '/var/log/named/query.log', 'query_id=dns-7302'), evidence(egressFiles, '/var/log/named/query.log', 'query_id=dns-7303')], hints: [{ text: '端末と関連ドメインで絞り、qnameを抽出します。', command: "grep 'client=192.0.2.34#' /var/log/named/query.log | grep 'archive-sync.example' | awk '{print $6}'" }, { text: '同じqnameをまとめてから種類を数えます。', command: "grep 'client=192.0.2.34#' /var/log/named/query.log | grep 'archive-sync.example' | awk '{print $6}' | sort | uniq | wc -l" }] },
    { id: 'mail-size', label: 'キューに入ったメールのサイズ', prompt: '関連するメールのqmgr受付行で記録されたsizeは何バイト？', placeholder: 'バイト数', accepted: ['846120', '846,120', '846120バイト', 'size=846120', 'size=846120,'], answer: '846120', explanation: 'C6D71A20F1のqmgr受付行にsize=846120があります。これはキューに入ったメッセージのサイズであり、添付ファイルだけのサイズや送信内容は分かりません。', evidence: [evidence(egressFiles, '/var/log/mail.log', 'C6D71A20F1: from=')], hints: [{ text: 'キューIDで受付から配送までを読みます。', command: "grep 'C6D71A20F1' /var/log/mail.log" }, { text: 'fromとsizeのあるqmgr行に絞ります。', command: "grep 'C6D71A20F1' /var/log/mail.log | grep 'size='" }] },
    { id: 'mail-delay', label: '配送遅延の記録値', prompt: '外部宛て配送のSMTPログで、delayに記録された値は何秒？', placeholder: '秒数（小数可）', accepted: ['1.2', '1.2秒', 'delay=1.2', 'delay=1.2,'], answer: '1.2', explanation: '配送行のdelay=1.2が総配送遅延です。delays=0.1/0.1/0.4/0.6は区間別の内訳であり、別の値として読みます。', evidence: [evidence(egressFiles, '/var/log/mail.log', 'to=<drop@archive-sync.example>')], hints: [{ text: '関連キューの配送結果に絞ります。', command: "grep 'C6D71A20F1' /var/log/mail.log | grep 'status=sent'" }, { text: 'delay=と、複数区間を表すdelays=を区別してください。', command: "grep 'C6D71A20F1' /var/log/mail.log | grep 'status=sent' | awk '{print $7, $8}'" }] },
    { id: 'first-domain-time', label: '関連通信の最初の観測時刻', prompt: '3種類のログでarchive-sync.example関連の活動を最初に観測した時刻は？（UTC、HH:MM:SS）', placeholder: 'HH:MM:SS', accepted: ['11:15:02', '11:15:02 UTC', '2026-08-12T11:15:02Z'], answer: '11:15:02', explanation: '最初は11:15:02 UTCのDNS問い合わせです。その後にメール受付・配送、アップロードが続きます。DNS問い合わせの時点で接続や転送成功まで証明できるわけではありません。', evidence: [evidence(egressFiles, '/var/log/named/query.log', 'query_id=dns-7301'), evidence(egressFiles, '/var/log/mail.log', 'to=<drop@archive-sync.example>'), evidence(egressFiles, '/var/log/proxy/access.log', 'request_id=px-9001')], hints: [{ text: '関連ドメインを3ログ横断で探します。', command: "grep 'archive-sync.example' /var/log/named/query.log /var/log/mail.log /var/log/proxy/access.log" }, { text: 'DNS・メール・プロキシそれぞれのUTC時刻を比較します。', command: "grep 'archive-sync.example' /var/log/named/query.log | sed -n '1p'" }] },
    { id: 'recipient', label: '配送先のメールアドレス', prompt: '関連キューが外部へ配送した宛先メールアドレス全文は？', placeholder: 'user@domain', accepted: ['drop@archive-sync.example', '<drop@archive-sync.example>', 'to=<drop@archive-sync.example>', 'to=<drop@archive-sync.example>,'], answer: 'drop@archive-sync.example', explanation: '配送行のto=<drop@archive-sync.example>が宛先です。SMTP認証ユーザー、envelope From、宛先、リレーホストを分けて読みます。', evidence: [evidence(egressFiles, '/var/log/mail.log', 'to=<drop@archive-sync.example>')], hints: [{ text: '対象キューの配送結果を確認します。', command: "grep 'C6D71A20F1' /var/log/mail.log | grep 'status=sent'" }, { text: 'to=<…>が宛先です。relay=は中継ホストなので区別してください。', command: "grep 'C6D71A20F1' /var/log/mail.log | grep 'status=sent' | awk '{print $5}'" }] }
  );
  egress.walkthrough.push(
    { title: 'アップロードの値と回数を集計する', command: "grep 'path=/v1/upload ' /var/log/proxy/access.log | awk '{print $8}' | sort | uniq -c", explanation: '異なる4つの送信量（196608、327680、286720、237568）の合計は1048576バイトですが、この値だけでは送信内容の機密性は分かりません。' },
    { title: '問い合わせ行数とホスト名の種類を分ける', command: "grep 'archive-sync.example' /var/log/named/query.log | awk '{print $6}' | sort | uniq -c", explanation: 'アップロード先への問い合わせは2回、MXホストは1回。関連qnameは計2種類です。' }
  );

  sqli.minutes = 40;
  sqli.tasks.push(
    { id: 'observed-shape', label: '観測されたクエリ構造', prompt: '構造が変わった検索について、DB監査のobserved_shapeの値は？', placeholder: 'observed_shapeの値', accepted: ['title_equals_or_true', 'observed_shape=title_equals_or_true'], answer: 'title_equals_or_true', explanation: '期待構造title_equalsに対し、観測構造はtitle_equals_or_trueです。構文エラーのparse_errorや正常検索のtitle_equalsと区別できます。', evidence: [evidence(sqlFiles, '/var/log/db/query.log', 'request_id=req-sql-202')], hints: [{ text: '構造の逸脱を記録したDBイベントに絞ります。', command: "grep 'query_shape_changed=true' /var/log/db/query.log" }, { text: 'expected_shapeとobserved_shapeを並べて読みます。', command: "grep 'req-sql-202' /var/log/db/query.log | awk '{print $8, $9}'" }] },
    { id: 'db-user', label: 'DBの接続ユーザー', prompt: '過剰な行参照を行った検索のDB接続ユーザー（app_user）は？', placeholder: '接続ユーザー名', accepted: ['search_ro', 'app_user=search_ro'], answer: 'search_ro', explanation: 'DB監査のapp_userはsearch_roです。アプリ側のactor=guestやHTTP送信元とは異なる主体です。このログだけでDB接続権限の全範囲までは分かりません。', evidence: [evidence(sqlFiles, '/var/log/db/query.log', 'request_id=req-sql-202'), evidence(sqlFiles, '/var/log/app/audit.log', 'request_id=req-sql-202')], hints: [{ text: '同じrequest_idをDBとアプリで照合します。', command: "grep 'req-sql-202' /var/log/db/query.log /var/log/app/audit.log" }, { text: 'DBログのapp_userを読み、アプリactorと区別します。', command: "grep 'req-sql-202' /var/log/db/query.log | awk '{print $6}'" }] },
    { id: 'prepared-count', label: '正常な検索の件数', prompt: 'DB監査でprepared方式を使い、クエリ構造が変わらなかった検索は何件？', placeholder: '件数', accepted: ['25', '25件'], answer: '25', explanation: 'mode=preparedかつquery_shape_changed=falseの記録は25件です。HTTPの静的ファイル要求や、不正入力の2件を混ぜずに集計します。', evidence: [evidence(sqlFiles, '/var/log/db/query.log', 'request_id=req-search-000'), evidence(sqlFiles, '/var/log/db/query.log', 'request_id=req-search-096')], hints: [{ text: 'DB実行方式と構造変化の2条件で絞ります。', command: "grep 'mode=prepared ' /var/log/db/query.log | grep 'query_shape_changed=false '" }, { text: '一致するDBイベントの行数を数えます。', command: "grep 'mode=prepared ' /var/log/db/query.log | grep 'query_shape_changed=false ' | wc -l" }] },
    { id: 'normal-term-count', label: '正常入力の種類数', prompt: '構造が変わらなかった正常検索のinputは何種類？（同じ入力の繰り返しは1種類）', placeholder: '種類数', accepted: ['6', '6種類'], answer: '6', explanation: 'router、cable、switch、adapter、monitor、O\'Brienの6種類です。JSONのfalseを使って正常イベントを選び、入力値を重複除去します。', evidence: [evidence(sqlFiles, '/var/log/app/audit.jsonl', '"request_id":"req-search-000"'), evidence(sqlFiles, '/var/log/app/audit.jsonl', '"request_id":"req-search-004"'), evidence(sqlFiles, '/var/log/app/audit.jsonl', '"request_id":"req-search-008"'), evidence(sqlFiles, '/var/log/app/audit.jsonl', '"request_id":"req-search-012"'), evidence(sqlFiles, '/var/log/app/audit.jsonl', '"request_id":"req-search-016"'), evidence(sqlFiles, '/var/log/app/audit.jsonl', '"request_id":"req-search-040"')], hints: [{ text: 'JSONLで真偽値falseのイベントを選び、inputだけ出します。', command: "jq -r 'select(.query_shape_changed == false) | .input' /var/log/app/audit.jsonl" }, { text: '同じ入力をまとめて種類数を数えます。', command: "jq -r 'select(.query_shape_changed == false) | .input' /var/log/app/audit.jsonl | sort | uniq | wc -l" }] },
    { id: 'response-bytes', label: '返却行数と通信サイズ', prompt: '2400行が返却された要求のHTTP応答サイズは何バイト？', placeholder: 'バイト数', accepted: ['198432', '198,432', '198432バイト', '198432 bytes'], answer: '198432', explanation: 'req-sql-202の応答サイズは198432バイトで、DBの2400行とは別の値です。HTTPサイズだけでは機密性や全DBの取得を断定できません。', evidence: [evidence(sqlFiles, '/var/log/nginx/access.log', 'request_id=req-sql-202'), evidence(sqlFiles, '/var/log/db/query.log', 'request_id=req-sql-202')], hints: [{ text: 'DBで確認した要求のrequest_idをアクセスログに使います。', command: "grep 'req-sql-202' /var/log/nginx/access.log" }, { text: 'HTTPステータスの次の10列目が応答サイズです。', command: "grep 'req-sql-202' /var/log/nginx/access.log | awk '{print $10}'" }] }
  );
  sqli.walkthrough.push(
    { title: '正常入力の分布をJSONで調べる', command: "jq -r 'select(.query_shape_changed == false) | .input' /var/log/app/audit.jsonl | sort | uniq -c", explanation: '通常の検索語とO\'Brienを含む6種類の入力が見つかります。記号の有無だけで異常と判断しません。' },
    { title: '正常方式のDB検索だけを数える', command: "grep 'mode=prepared ' /var/log/db/query.log | grep 'query_shape_changed=false ' | wc -l", explanation: '正常方式の検索は25件です。アクセスログの全要求数とは集計対象が違います。' }
  );

  cmdinj.minutes = 40;
  cmdinj.tasks.push(
    { id: 'decoded-target', label: 'アプリが受け取った入力', prompt: '実行が確認された要求で、URLデコード後のtargetの値は？', placeholder: 'targetの値', accepted: ['192.0.2.1;id', 'target=192.0.2.1;id'], answer: '192.0.2.1;id', explanation: 'アクセス側の%3Bはセミコロンで、アプリ監査のtargetは192.0.2.1;idです。これはログ中の入力値の確認であり、端末で実行するコマンドではありません。', evidence: [evidence(cmdFiles, '/var/log/nginx/access.log', 'request_id=req-diag-402'), evidence(cmdFiles, '/var/log/app/audit.jsonl', '"request_id":"req-diag-402"')], hints: [{ text: '要求をアプリ監査のJSONと照合します。', command: "grep 'req-diag-402' /var/log/app/audit.jsonl" }, { text: 'JSONからtargetの値だけを取り出せます。', command: "jq -r 'select(.request_id == \"req-diag-402\") | .target' /var/log/app/audit.jsonl" }] },
    { id: 'exec-count', label: '1要求が起動した実行数', prompt: '実行が確認された要求に対応するevent=execの記録は何件？（exit行は除外）', placeholder: '件数', accepted: ['3', '3件'], answer: '3', explanation: '同じrequest_idに/bin/sh、/usr/bin/ping、/usr/bin/idのexecが3件あります。2件のexitは実行数に含めません。', evidence: [evidence(cmdFiles, '/var/log/process/exec.log', 'event=exec pid=8840'), evidence(cmdFiles, '/var/log/process/exec.log', 'event=exec pid=8841'), evidence(cmdFiles, '/var/log/process/exec.log', 'event=exec pid=8843')], hints: [{ text: '要求IDでプロセス監査をまとめます。', command: "grep 'req-diag-402' /var/log/process/exec.log" }, { text: 'event=execだけに絞り行数を数えます。', command: "grep 'req-diag-402' /var/log/process/exec.log | grep 'event=exec ' | wc -l" }] },
    { id: 'normal-exec-count', label: '正常処理の実行数との比較', prompt: 'req-diag-normal-で始まる正常要求に対応するevent=execは、合計何件？', placeholder: '合計件数', accepted: ['50', '50件'], answer: '50', explanation: '正常診断は25要求で、それぞれshとpingの2つのexecがあります。合計50件で、要求数とプロセス実行数は異なります。', evidence: [evidence(cmdFiles, '/var/log/process/exec.log', 'event=exec pid=7300'), evidence(cmdFiles, '/var/log/process/exec.log', 'event=exec pid=7301'), evidence(cmdFiles, '/var/log/process/exec.log', 'event=exec pid=7589')], hints: [{ text: '正常要求だけのプロセス監査を抽出します。', command: "grep 'req-diag-normal-' /var/log/process/exec.log | grep 'event=exec '" }, { text: '同じ実行ファイルごとの件数を見ると総数も確認できます。', command: "grep 'req-diag-normal-' /var/log/process/exec.log | grep 'event=exec ' | awk '{print $8}' | sort | uniq -c" }] },
    { id: 'parent-exe', label: '親プロセスの実行ファイル', prompt: '予期しない子プロセスを起動した親pid=8840の実行ファイルは？', placeholder: '絶対パス', accepted: ['/bin/sh'], answer: '/bin/sh', explanation: 'pid=8840のexec行はexe=/bin/shです。入力を含むargvと、ping・idのppid=8840が結び付き、シェルを経由した実行を裏付けます。', evidence: [evidence(cmdFiles, '/var/log/process/exec.log', 'event=exec pid=8840'), evidence(cmdFiles, '/var/log/process/exec.log', 'exe=/usr/bin/id')], hints: [{ text: '子のppidと親のpidを照合します。', command: "grep 'exe=/usr/bin/id' /var/log/process/exec.log" }, { text: '親自身のexec行のexeを確認します。', command: "grep 'event=exec pid=8840 ' /var/log/process/exec.log" }] },
    { id: 'shell-duration', label: '親プロセスの実行時間', prompt: 'pid=8840のシェルのexecからexitまで、ログの秒単位では何秒？', placeholder: '秒数', accepted: ['1', '1秒', '1 second'], answer: '1', explanation: '親シェルは13:09:19 UTCにexec、13:09:20 UTCにexitしているので、ログの秒単位では1秒です。実際の高精度な経過時間はこのログでは分かりません。', evidence: [evidence(cmdFiles, '/var/log/process/exec.log', 'event=exec pid=8840'), evidence(cmdFiles, '/var/log/process/exec.log', 'event=exit pid=8840')], hints: [{ text: 'ppidではなく、対象自身のpid行を抽出します。', command: "grep ' pid=8840 ' /var/log/process/exec.log" }, { text: 'event=execとevent=exitの先頭UTC時刻の差を取ります。', command: "grep ' pid=8840 ' /var/log/process/exec.log | awk '{print $1, $4}'" }] },
    { id: 'response-delta', label: '同じ200応答のサイズ比較', prompt: '実行が確認された要求のHTTP応答は、拒否された要求より何バイト大きい？', placeholder: '差のバイト数', accepted: ['234', '234バイト', '234 bytes'], answer: '234', explanation: 'req-diag-402は308バイト、req-diag-401は74バイトで、差は234バイトです。両方HTTP 200であり、サイズ差そのものは実行成功の証拠にはなりません。', evidence: [evidence(cmdFiles, '/var/log/nginx/access.log', 'request_id=req-diag-401'), evidence(cmdFiles, '/var/log/nginx/access.log', 'request_id=req-diag-402'), evidence(cmdFiles, '/var/log/app/audit.log', 'request_id=req-diag-401')], hints: [{ text: '2要求のステータスと応答サイズを並べます。', command: "grep 'req-diag-40' /var/log/nginx/access.log | awk '{print $9, $10, $NF}'" }, { text: '拒否・実行の対応を監査で確認してから、308から74を引きます。', command: "grep 'req-diag-40' /var/log/app/audit.log" }] }
  );
  cmdinj.walkthrough.push(
    { title: '正常要求の子プロセス構成を集計する', command: "grep 'req-diag-normal-' /var/log/process/exec.log | grep 'event=exec ' | awk '{print $8}' | sort | uniq -c", explanation: 'shが25件、pingが25件で計50件。正常25要求に対し各2つのexecです。' },
    { title: '親自身の開始と終了を追う', command: "grep ' pid=8840 ' /var/log/process/exec.log", explanation: '親の実行ファイルとargv、execからexitまでの1秒を確認します。子のppid行とは区別します。' }
  );
  // Historical rotations are independent retained periods, not the normal comparison snapshot.
  const sshHistory = {
    '/var/log/auth.log.1': textFile([
      'Aug 11 22:03:11 edge-01 sshd[7101]: Accepted publickey for ops from 192.0.2.10 port 51984 ssh2: ED25519 SHA256:FICTIONALTRAININGKEY',
      'Aug 11 22:03:12 edge-01 sshd[7101]: pam_unix(sshd:session): session opened for user ops(uid=1001) by (uid=0)',
      'Aug 11 22:04:09 edge-01 sudo: ops : TTY=pts/0 ; PWD=/home/ops ; USER=root ; COMMAND=/usr/bin/journalctl -u ssh',
      'Aug 11 22:06:40 edge-01 sshd[7101]: pam_unix(sshd:session): session closed for user ops'
    ]),
    '/var/log/auth.log.2.gz': textFile([
      'Aug  9 03:01:07 edge-01 sshd[6201]: Invalid user test from 203.0.113.56 port 41820',
      'Aug  9 03:01:09 edge-01 sshd[6201]: Failed password for invalid user test from 203.0.113.56 port 41820 ssh2',
      'Aug  9 03:01:10 edge-01 sshd[6201]: Connection closed by invalid user test 203.0.113.56 port 41820 [preauth]'
    ])
  };
  Object.assign(ssh.files, sshHistory);
  Object.assign(ssh.baselineFiles, sshHistory);
  ssh.walkthrough.push({ title: '履歴の期間と件数を確かめる', command: "zgrep -c 'Failed password' /var/log/auth.log.2.gz", explanation: '8月9日の圧縮履歴には失敗が1件あります。8月12日の60件には加えません。auth.log.1は8月11日、/baselineは現行期間の正常比較用です。' });
  ssh.clockNote = 'SSH syslog: 年・TZなし。採取条件は2026年・UTC。現行は8/12、履歴は8/11と8/9。';
  web.clockNote = 'Nginxは+0900（日本時間）、アプリ監査はUTC（Z）。照合時は9時間差を補正します。';
  const notes = {
    ssh: '採取条件: 年は2026年、ホストのタイムゾーンはUTC。auth.logは8月12日、auth.log.1は8月11日、auth.log.2.gzは8月9日です。syslog本文には年・TZがなく、1桁の日付はAug  9のように空白で桁を合わせます。履歴は過去日の保存分で、/baselineは同じ演習期間の正常比較用です。課題の件数は指定がない限り現行auth.logを対象とします。\n圧縮履歴はzcat /var/log/auth.log.2.gzまたはzgrepで読みます。このブラウザでは展開済み文字列を保持し、gzip展開のバイナリ処理は再現しません。\n認証ログの保存先はOS・syslog設定次第で、/var/log/auth.log、/var/log/secure、journal等があります。',
    web: 'このケースのNginx時刻は+0900、アプリ監査はZ（UTC）です。例: 19:12:08 +0900と10:12:08Zは同じ瞬間です。時刻をUTCへそろえて要求ID・送信元も照合してください。',
    egress: '形式: DNSはnormalized_dnsという教材独自の正規化形式で、BIND namedの生のquery logではありません。query_idとanswerは問い合わせ・回答の計測情報をまとめた教材の項目です。\nプロキシも教材独自の正規化形式です。bytes_outは端末から外向き、bytes_inは応答側のHTTPメッセージのバイト数（本文＋HTTPヘッダー、TLS/TCP/IP分は除外）。Squidの標準項目ではなく、この計測規約でのみ解釈します。'
  };
  for (const exercise of [ssh, web, egress, sqli, cmdinj]) {
    exercise.clockNote ||= '時刻はUTC（Z / +0000）。日本時間は+9時間。';
    let note = notes[exercise.id] || '';
    if (exercise.files['/var/log/nginx/access.log']) note += '\nNginxはcombinedにrequest_idを加えたカスタムlog_formatを想定します。標準combinedにはrequest_idはありません。実運用では$request_idを記録し、proxy_set_header X-Request-ID $request_id等でアプリへ渡し、同じ値をアプリ監査にも記録する設定が必要です。教材のreq-…は読みやすい固定IDで、Nginxの$request_idが生成する32桁の16進文字列とは表記が異なります。';
    for (const files of [exercise.files, exercise.baselineFiles]) {
      if (exercise.id === 'ssh') files['/home/analyst/README.txt'] = files['/home/analyst/README.txt'].replace('日時: 2026年8月12日。全ログのタイムゾーンはUTCです（日本時間は+9時間）。', '現行ログの日付: 2026年8月12日。採取条件はUTC。過去日のローテート済みログも別に提供します。');
      if (exercise.id === 'web') files['/home/analyst/README.txt'] = files['/home/analyst/README.txt'].replace('全ログのタイムゾーンはUTCです（日本時間は+9時間）。', 'Nginxは+0900、アプリ監査はUTCです。');
      files['/home/analyst/README.txt'] += '\n' + note + '\n';
    }
  }
  globalThis.LOG_LAB_CASES = [ssh, web, egress, sqli, cmdinj];
})();
