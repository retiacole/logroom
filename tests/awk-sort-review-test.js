'use strict';
const assert = require('node:assert/strict');
require('../src/shell.js');
const files = {
  '/tmp/access': '203.0.113.2 - - [25/Oct/2026:10:00:00 +0000] "GET /ok HTTP/1.1" 200 12\n198.51.100.4 - - [25/Oct/2026:10:01:00 +0000] "GET /bad HTTP/1.1" 503 81\n',
  '/tmp/events': 'b 500 api\na 200 api\nb 403 web\nc 500 api\n',
  '/tmp/fields': ' a:bc:def \nx:y:z\n',
  '/tmp/bytes': '1024 bytes\n4096 bytes\n512 bytes\n',
  '/tmp/ordering': '2 x api\n10 x api\n3 x web\n2 y api\n',
  '/tmp/months': 'Dec 2 10:00:00 last\nJan 30 09:00:00 later\nFeb 1 08:00:00 middle\nJan 2 11:00:00 first\n',
  '/tmp/month-case': 'February\nJAN\nunknown\ndec\n',
  '/tmp/ties': 'a 2\nb 1\nc 2\nd 1\n',
  '/tmp/empty': ''
};
const shell = new LogLabShell(files);
let checks = 0;
function run(command, expected) {
  const result = shell.run(command); checks++;
  assert.equal(result.code, 0, command + '\n' + result.stderr);
  assert.equal(result.stderr, '', command);
  if (expected !== undefined) assert.equal(result.stdout, expected, command);
  return result.stdout;
}
function rejects(command, message) {
  const result = shell.run(command); checks++;
  assert.notEqual(result.code, 0, command);
  assert.match(result.stderr, message, command);
  return result;
}

// The nginx status column and explicit concatenation must transfer to real awk.
run(`awk '{print $1" "$9}' /tmp/access`, '203.0.113.2 200\n198.51.100.4 503\n');
run(`awk 'BEGIN {OFS=":"} {print $1 " " $2, "service=" $3}' /tmp/events`, 'b 500:service=api\na 200:service=api\nb 403:service=web\nc 500:service=api\n');
run(`awk 'BEGIN {print "value=" 2+3; print 2+3 "!"; print "a" "b"}'`, 'value=5\n5!\nab\n');
run(`awk 'BEGIN {print substr("abcdef",2,3), substr("abcdef",4), substr("abc",0,2), substr("abc",2,0)}'`, 'bcd def ab \n');
run(`awk 'BEGIN {print substr("日本語",2,1), length("日本語")}'`, '本 3\n');
run(`awk '{n=split($0,fields," "); print n,fields[1],fields[n]}' /tmp/events`, '3 b api\n3 a api\n3 b web\n3 c api\n');
run(`awk 'BEGIN {a[99]="stale"; n=split("x:y:z",a,/:/); print n,a[1],a[3],(99 in a)}'`, '3 x z 0\n');
run(`awk -F: '{print split($0,a), a[2]}' /tmp/fields`, '3 bc\n3 y\n');
run(`awk 'BEGIN {print split("",a,":"), length(a); print split("ab",a,""),a[2]}'`, '0 0\n2 b\n');
run(`awk '{printf "%s %03d %.1f%%\\n",$1,$2,$2/10}' /tmp/events`, 'b 500 50.0%\na 200 20.0%\nb 403 40.3%\nc 500 50.0%\n');
run(`awk 'BEGIN {printf("[%5s] %-4s %+.2f\\n", "a", "bc", 3.5)}'`, '[    a] bc   +3.50\n');
run(`awk 'BEGIN {printf "%s", "a", "ignored"; printf "%s", "b"; print "c"}'`, 'abc\n');
run(`awk '{if ($2 >= 400) {failures++; print $1} else print "ok"} END {printf "%d failures\\n",failures}' /tmp/events`, 'b\nok\nb\nc\n3 failures\n');
run(`awk '{if ($2 >= 500) print "error"; else if ($2 >= 400) print "deny"; else print "ok"}' /tmp/events`, 'error\nok\ndeny\nerror\n');
run(`awk 'BEGIN {for(i=1;i<=4;i++) {if(i==2) continue; if(i==4) break; printf "%d ",i}; print i}'`, '1 3 4\n');
run(`awk '{for(i=1;i<=NF;i++) printf "%s%s",(i==1),i; print ""}' /tmp/events`, '110203\n110203\n110203\n110203\n');
run(`awk 'BEGIN {for(i=1;i<=2;i++) for(j=1;j<=2;j++) print i,j}'`, '1 1\n1 2\n2 1\n2 2\n');
run(`awk 'BEGIN {n=1; n+=5; n-=2; n*=3; n/=2; n%=4; print n}'`, '2\n');
run(`awk '{sum += $1} END {print sum}' /tmp/bytes`, '5632\n');
run(`awk '{count[$1]++; total[$1]+=$2} END {for(k in count) print k,count[k],total[k]}' /tmp/events | sort`, 'a 1 200\nb 2 903\nc 1 500\n');
run(`awk 'BEGIN {a["__proto__"]=1; a["constructor"]=2; for(k in a) print k,a[k]}' | sort`, '__proto__ 1\nconstructor 2\n');
run(`awk 'BEGIN {print "start"} BEGIN {OFS=":"} /api/ {api++} $2 >= 400 {bad++; print $1,$2} END {print "api",api} END {print "bad",bad}' /tmp/events`, 'start\nb:500\nb:403\nc:500\napi:3\nbad:3\n');
run(`awk '$2 < 400 {next} {count++} END {print count}' /tmp/events`, '3\n');
run(`awk 'BEGIN { FS=":" } FNR==1 {print NR,FNR,$1} END {print NR,FNR}' /tmp/fields /tmp/events`, '1 1  a\n3 1 b 500 api\n6 4\n');
run(`awk 'BEGIN {print "begin"} END {print NR} END {print "end"}' /tmp/empty`, 'begin\n0\nend\n');
run(`awk 'BEGIN {print (1,2); print (1+2),4}'`, '1 2\n3 4\n');
run(`awk 'BEGIN {# comment\n x=2\n if (x) { print "yes" }\n}'`, 'yes\n');

run(`awk 'BEGIN {print (n==0),(n==""),n "x"; if("0") print "literal"; print ("01"=="1")}'`, '1 1 x\nliteral\n0\n');
run(`printf '01\n0\n' | awk '{print $1, ($1==1); if($1) print "numeric"}'`, '01 1\nnumeric\n0 0\n');
run(`awk -v n=001 'BEGIN {print n, (n==1)}'`, '001 1\n');
run(`awk 'BEGIN {print (a["x"]==0); print ("x" in a)}'`, '1\n1\n');
run(`awk '{matched=/api/; print matched}' /tmp/events`, '1\n1\n0\n1\n');

run(`printf 'a|b|c\n' | awk -F'|' '{print NF,$2}'`, '3 b\n');
run(`awk 'BEGIN {print split("a:b:c",a,/(:)/),a[2]; print split("ab",a,/x*/),a[1]}'`, '3 b\n1 ab\n');
run(`awk 'BEGIN {print split(" a  b ",a,/ /),"[" a[1] "]","[" a[3] "]"}'`, '5 [] []\n');

const iterationA=run(`awk 'BEGIN {a["z"]=1;a["a"]=2;a["m"]=3; for(k in a) print k}'`);
const iterationB=run(`awk 'BEGIN {a["m"]=3;a["z"]=1;a["a"]=2; for(k in a) print k}'`);
checks++; assert.equal(iterationA, iterationB, 'array iteration must not depend on insertion order');
checks++; assert.deepEqual(iterationA.trim().split('\n').sort(), ['a','m','z']);

run('sort -k3,3 -k1,1nr /tmp/ordering', '10 x api\n2 x api\n2 y api\n3 x web\n');
run('sort --key=3,3 --key=1,1nr /tmp/ordering', '10 x api\n2 x api\n2 y api\n3 x web\n');
run('sort -M -k1,1 -k2,2n -k3,3 /tmp/months', 'Jan 2 11:00:00 first\nJan 30 09:00:00 later\nFeb 1 08:00:00 middle\nDec 2 10:00:00 last\n');
run('sort -k1,1Mr -k2,2n /tmp/months', 'Dec 2 10:00:00 last\nFeb 1 08:00:00 middle\nJan 2 11:00:00 first\nJan 30 09:00:00 later\n');
run('sort --month-sort /tmp/month-case', 'unknown\nJAN\nFebruary\ndec\n');
run('sort -s -k2,2n /tmp/ties', 'b 1\nd 1\na 2\nc 2\n');
run('sort -u -k3,3 -k1,1n /tmp/ordering', '2 x api\n10 x api\n3 x web\n');
run(`printf 'a,10\na,2\nb,1\n' | sort -t, -k1,1 -k2,2n`, 'a,2\na,10\nb,1\n');
run('sort -k3,3 -k1,1nr /tmp/ordering | sort -c -k3,3 -k1,1nr', '');
run('sort -rn -k1,1 /tmp/ordering', '10 x api\n3 x web\n2 y api\n2 x api\n');

rejects(`awk 'BEGIN {for (;;) {}}'`, /loop iteration limit/);
rejects(`awk 'BEGIN {for(i=0;i<10000;i++) for(j=0;j<10000;j++) n++}'`, /execution step limit/);
rejects(`awk 'BEGIN {for(i=0;i<1000;i++) printf "%4096s", "x"}'`, /output exceeds/);
rejects(`awk 'BEGIN {x="xx";for(i=0;i<100;i++) x=x x}'`, /value exceeds/);
rejects(`awk 'BEGIN {while (1) print 1}'`, /unsupported action while/);
rejects(`awk 'BEGIN {system("id")}'`, /unsupported action or function system/);
rejects(`awk 'BEGIN {eval("1+1")}'`, /unsupported action or function eval/);
rejects(`awk '{$1="changed"}' /tmp/events`, /field assignment is unsupported/);
rejects(`awk 'BEGIN {break}'`, /requires a loop/);
rejects(`awk 'BEGIN {next}'`, /only valid in a record action/);
rejects(`awk 'BEGIN {print substr("abc")}'`, /invalid arguments/);
rejects(`awk 'BEGIN {split("a",1)}'`, /array name/);
rejects(`awk 'BEGIN {a=1; split("a",a)}'`, /scalar.*as an array/);
rejects(`awk 'BEGIN {a[1]=1; print a}'`, /array.*as a scalar/);
rejects(`awk 'BEGIN {printf "%d %d",1}'`, /not enough arguments/);
rejects(`awk 'BEGIN {printf "%q",1}'`, /unsupported printf format/);
rejects(`awk 'BEGIN {printf "%99999s","x"}'`, /width\/precision is too large/);
rejects(`awk 'BEGIN {print 1/0}'`, /division by zero/);
rejects(`awk 'BEGIN {if (1) {print "x"}'`, /unclosed block/);
rejects(`awk 'BEGIN {print ${'('.repeat(101)}1${')'.repeat(101)}}'`, /nesting limit/);
rejects(`awk 'BEGIN {print ${'!'.repeat(200)}1}'`, /nesting limit/);
rejects('sort -k3,1 /tmp/ordering', /key must be/);
rejects('sort -k1,1V /tmp/ordering', /key must be/);
rejects('sort -Mn /tmp/months', /numeric and month/);
rejects('sort -c -k3,3 -k1,1nr /tmp/ordering', /disorder/);
rejects('sort -u -c -k2,2n /tmp/ties', /disorder/);
console.log('Awk/sort review regressions: ' + checks + ' passed');
