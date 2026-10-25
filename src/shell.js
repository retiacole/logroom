/* Browser-only virtual text shell for LogLab. No host processes or network access. */
(function (root) {
  'use strict';
  const MAX_INPUT = 8192, MAX_OUTPUT = 524288, MAX_FILE = 2097152;
  const COMMANDS = ['help','man','which','whoami','id','hostname','sudo','pwd','cd','ls','cat','zcat','zgrep','zless','tac','less','more','grep','rg','sort','uniq','cut','tr','column','nl','diff','jq','base64','tee','head','tail','wc','sed','awk','find','echo','printf','paste','comm','join','xargs','rev','strings','basename','dirname','realpath','file','stat','du','date','clear','history','mkdir','touch','cp','mv','rm','rmdir','vi','view','sl'];
  const USAGE = {
    help: 'help [command]  (LogRoom training guide)', man: 'man command  (training manual subset)', which: 'which command ...',
    whoami: 'whoami', id: 'id [-u|-g|-G] [-n]', hostname: 'hostname', sudo: 'sudo command [argument ...]  (simulated privileges)',
    pwd: 'pwd', cd: 'cd [directory|-]',
    ls: 'ls [-alhdtRSr] [--sort=time|size|name] [path ...]', cat: 'cat [-n] [file ...]', tac: 'tac [file ...]',
    zcat: 'zcat [file.gz ...]  (simulated decompression)', zgrep: 'zgrep [grep options] pattern [file.gz ...]', zless: 'zless [file.gz ...]  (simulated decompression viewer)',
    less: 'less [file ...]  (read-only viewer; q closes)', more: 'more [file ...]  (read-only viewer; q closes)',
    grep: 'grep [-EFiwvncrRlhHLqxo] [-m N] [-A N|-B N|-C N] [-e pattern ...] [--include glob|--exclude glob|--exclude-dir glob] [--] pattern [file ...]',
    rg: 'rg [-FiwvnclHhqo] [-A N|-B N|-C N] [-e pattern] [-g glob] [--no-heading] [--count] [pattern] [path ...] | rg --files [-g glob] [path ...]',
    sort: 'sort [-nrufbscM] [-k N[,M][nrfbM] ...] [-t delimiter] [file ...]', uniq: 'uniq [-cdui] [-f fields] [-s characters] [file]',
    cut: 'cut [-d delimiter] -f fields [-s] [--complement] [--output-delimiter text] [file ...] | cut -c characters [file ...]',
    tr: 'tr [-cds] [--] SET1 [SET2]  (reads standard input)',
    column: 'column -t [-s delimiter-characters] [file ...]', nl: 'nl [-ba|-bt] [-w width] [-s separator] [file]',
    diff: 'diff [-u] [--] file1 file2', jq: 'jq [-rcs] [--] [filter] [file ...]',
    base64: 'base64 [-d|--decode] [-w columns] [file]', tee: 'tee [-a] [file ...]',
    head: 'head [-n N|-c N] [file ...]', tail: 'tail [-n N|+N] [-c N|+N] [file ...]', wc: 'wc [-lwmcL] [file ...]',
    sed: "sed [-nE] [-i[backup-suffix]] [-e script ...] [script] [file ...]",
    awk: "awk [-F separator] [-v name=value ...] '[BEGIN {...}] [/regex/|expression] {print field, ...} [END {...}]' [file ...]",
    find: 'find [path] [-type f|d] [-name glob|-iname glob] [-path glob] [-maxdepth N] [-mindepth N]', echo: 'echo [-n] [text ...]',
    printf: 'printf format [argument ...]', paste: 'paste [-s] [-d delimiters] [file ...]', comm: 'comm [-123] file1 file2',
    join: 'join [-1 N] [-2 N] [-t delimiter] [-a 1|2|-v 1|2] [-e text] [-o field-list] file1 file2',
    xargs: 'xargs [-0r] [-d delimiter] [-n N] [-I token] [virtual-command [argument ...]]', rev: 'rev [file ...]',
    strings: 'strings [-a] [-n minimum] [-t d|o|x] [file ...]', basename: 'basename [-a] [-s suffix] path [suffix]',
    dirname: 'dirname path ...', realpath: 'realpath [-m|-e] path ...', file: 'file [-bi] path ...',
    stat: 'stat [-c format] path ...', du: 'du [-ashb] [--max-depth N] [path ...]',
    date: 'date [-u] [-d ISO-date|@epoch] [+format]', mv: 'mv [-n] source destination', rmdir: 'rmdir [-p] directory ...',
    vi: 'vi [file]  (standalone only)', view: 'view [file]  (read-only editor; standalone only)',
    sl: 'sl  (steam locomotive; standalone only; wait until it passes)',
    clear: 'clear', history: 'history', mkdir: 'mkdir [-p] directory ...',
    touch: 'touch file ...', cp: 'cp source destination', rm: 'rm [-f] file ... | rm -rf --no-preserve-root /  (GAME OVER / reset current case)'
  };
  class ShellError extends Error { constructor(message, code = 2) { super(message); this.code = code; } }
  const fail = (message, code) => { throw new ShellError(message, code); };
  const escRE = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cmp = (a,b) => a < b ? -1 : a > b ? 1 : 0;
  const asLines = text => text === '' ? [] : text.endsWith('\n') ? text.slice(0,-1).split('\n') : text.split('\n');
  const lineChunks = text => text.match(/[^\n]*\n|[^\n]+$/g) || [];
  const lineOutput = rows => rows.length ? rows.join('\n') + '\n' : '';
  const bytes = s => new TextEncoder().encode(s).length;
  const basename = p => p === '/' ? '/' : p.slice(p.lastIndexOf('/')+1);
  const dirname = p => p.slice(0,p.lastIndexOf('/')) || '/';
  const usageError = (cmd, message) => fail(cmd + ': ' + message + '\nUsage: ' + USAGE[cmd]);
  const posixClasses = p => p.replace(/\[:(alnum|alpha|blank|cntrl|digit|graph|lower|print|punct|space|upper|xdigit):\]/g, (_, k) => ({alnum:'A-Za-z0-9',alpha:'A-Za-z',blank:' \\t',cntrl:'\\x00-\\x1f\\x7f',digit:'0-9',graph:'!-~',lower:'a-z',print:' -~',punct:'!-/:-@\\[-`{-~',space:'\\s',upper:'A-Z',xdigit:'A-Fa-f0-9'}[k]));
  function basicRegex(pattern) {
    let out = '', bracket = false;
    for (let i=0; i<pattern.length; i++) {
      let c=pattern[i];
      if (c==='\\' && i+1<pattern.length) { let n=pattern[++i]; out += /[+?(){}|]/.test(n) && !bracket ? n : '\\'+n; }
      else { if(c==='[') bracket=true; if(c===']') bracket=false; out += !bracket && /[+?(){}|]/.test(c) ? '\\'+c : c; }
    }
    return out;
  }
  function regex(pattern, extended = true, insensitive = false) {
    if (pattern.length > 512) fail('regular expression exceeds 512 characters');
    let source=posixClasses(extended ? pattern : basicRegex(pattern));
    if (/\(\?/.test(source)) fail('regular expression lookarounds and special groups are unsupported');
    if (/\([^)]*[*+][^)]*\)[*+{]/.test(source)) fail('nested repeated groups are unsupported in this browser exercise; for an IPv4-shaped token use [0-9]{1,3}(\\.[0-9]{1,3}){3} with grep -E (this does not validate octet ranges)');
    try { return new RegExp(source, insensitive ? 'i' : ''); }
    catch (e) { fail('invalid regular expression: ' + e.message); }
  }
  function lex(input) {
    const tokens=[]; let value='', mask=[], started=false, quote=null,plain=true,tilde=false,tildeEnd=false;
    const add=(c,unquoted) => { if(!started&&c==='~'&&unquoted)tilde=true;if(tilde&&c==='/'&&unquoted)tildeEnd=true;value+=c; mask.push(Boolean(unquoted && (c==='*'||c==='?'))); started=true; };
    const flush=()=>{ if(started) tokens.push({kind:'word',value,mask,tilde}); value=''; mask=[]; started=false;plain=true;tilde=false;tildeEnd=false; };
    for(let i=0;i<input.length;i++) {
      const c=input[i];
      if(quote) {
        if(c===quote) { quote=null; continue; }
        if(quote==='"' && c==='\\' && i+1<input.length && /["\\$`\n]/.test(input[i+1])) { add(input[++i],false); continue; }
        if(quote==='"' && (c==='`'||(c==='$'&&input[i+1]==='('))) fail('command substitution is unsupported');
        if(quote==='"' && c==='$' && /[A-Za-z_?{0-9]/.test(input[i+1]||'')) fail('shell variable expansion is unsupported; use literal paths');
        add(c,false); continue;
      }
      if(c==='\''||c==='"') { if(!tildeEnd)tilde=false;quote=c; started=true;plain=false; continue; }
      if(c==='\\') { if(i+1===input.length) fail('unfinished escape');if(!tildeEnd)tilde=false;plain=false; add(input[++i],false); continue; }
      if(c==='`'||(c==='$'&&input[i+1]==='(')) fail('command substitution is unsupported; quote awk programs with single quotes');
      if(c==='$' && /[A-Za-z_?{0-9]/.test(input[i+1]||'')) fail('shell variable expansion is unsupported; use literal paths');
      if(c==='\n'||c===';') { flush(); tokens.push({kind:'op',value:';'}); continue; }
      if(/\s/.test(c)) { flush(); continue; }
      if(c==='#'&&!started) break;
      if('|&><'.includes(c)) {
        const ioNumber=started&&plain&&/^\d+$/.test(value)?value:null;
        flush(); let op=c;
        if(input[i+1]===c && (c==='|'||c==='&'||c==='>')) op+=input[++i];
        else if(c==='>'&&input[i+1]==='&')op+=input[++i];
        if(op==='&') fail('background commands are unsupported');
        if(c==='<'&&input[i+1]==='<') fail('here documents are unsupported');
        tokens.push({kind:'op',value:op,ioNumber}); continue;
      }
      if(c==='('||c===')') fail('subshells are unsupported; quote expressions passed to awk');
      add(c,true);
    }
    if(quote) fail('unclosed '+(quote==='\''?'single':'double')+' quote');
    flush(); return tokens;
  }
  function parse(tokens) {
    const chains=[]; let pipeline=[], words=[], redirs=[], connector=';';
    const finishCommand=()=>{ if(!words.length) fail('expected command'); pipeline.push({words,redirs}); words=[]; redirs=[]; };
    for(let i=0;i<tokens.length;i++) {
      const token=tokens[i];
      if(token.kind==='word') { words.push(token); continue; }
      const op=token.value;
      if(op==='>'||op==='>>'||op==='<'||op==='>&') {
        if(!tokens[i+1]||tokens[i+1].kind!=='word') fail('redirection requires a filename');
        const fd=token.ioNumber===null||token.ioNumber===undefined?(op==='<'?0:1):Number(token.ioNumber);
        if(token.ioNumber!==null&&token.ioNumber!==undefined)words.pop();
        if(op==='<'?fd!==0:fd!==1&&fd!==2)fail('this file descriptor redirection is unsupported');
        const target=tokens[++i];if(op==='>&'&&!/^[12]$/.test(target.value))fail('descriptor duplication supports only 1 and 2');
        redirs.push({op,fd,target}); continue;
      }
      if(op==='|') { finishCommand(); continue; }
      if(op===';'||op==='&&'||op==='||') {
        if(!words.length&&!pipeline.length) { if(op===';') continue; fail('unexpected '+op); }
        finishCommand(); chains.push({connector,pipeline}); pipeline=[]; connector=op;
      }
    }
    if(words.length||pipeline.length) { finishCommand(); chains.push({connector,pipeline}); }
    else if(connector==='&&'||connector==='||') fail('expected command after '+connector);
    if(chains.reduce((n,c)=>n+c.pipeline.length,0)>32) fail('a command line may contain at most 32 commands');
    return chains;
  }
  function takeValue(args, i, tail, cmd, option) {
    const value=tail||args[i+1];
    if(value===undefined) usageError(cmd,option+' requires a value');
    return {value,next:tail?i:i+1};
  }
  function simpleOptions(args, allowed, cmd) {
    const flags=new Set(), rest=[]; let end=false;
    for(const arg of args) {
      if(!end&&arg==='--') { end=true; continue; }
      if(!end&&arg.startsWith('-')&&arg!=='-') { for(const f of arg.slice(1)) { if(!allowed.includes(f)) usageError(cmd,'unsupported option -'+f); flags.add(f); } }
      else rest.push(arg);
    }
    return {flags,rest};
  }
  function rangeSelector(spec, cmd) {
    if(!spec) usageError(cmd,'a nonempty field list is required');
    const ranges=spec.split(',').map(s=>{
      let m=s.match(/^(\d+)(?:-(\d*))?$/);
      if(m) { const a=+m[1], b=m[2]===undefined?a:m[2]===''?Infinity:+m[2]; if(!a||b<a) usageError(cmd,'invalid range '+s); return [a,b]; }
      m=s.match(/^-(\d+)$/); if(m&&+m[1]) return [1,+m[1]];
      usageError(cmd,'invalid range '+s);
    });
    return index=>ranges.some(([a,b])=>index>=a&&index<=b);
  }
  function inferMtime(text) {
    let latest=0;const keep=stamp=>{const time=Date.parse(stamp);if(Number.isFinite(time))latest=Math.max(latest,time);};text=String(text);
    for(const stamp of text.match(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})/g)||[])keep(stamp);
    for(const m of text.matchAll(/\b(\d{2})\/([A-Z][a-z]{2})\/(\d{4}):(\d{2}:\d{2}:\d{2}) ([+-]\d{4})/g))keep(m[2]+' '+m[1]+' '+m[3]+' '+m[4]+' '+m[5]);
    for(const m of text.matchAll(/(?:^|\n)([A-Z][a-z]{2}) +(\d{1,2}) (\d{2}:\d{2}:\d{2})/g))keep(m[1]+' '+m[2]+' 2026 '+m[3]+' GMT');
    return latest;
  }
  function modeText(mode,dir) {return (dir?'d':'-')+[6,3,0].map(shift=>[4,2,1].map((bit,i)=>(mode>>shift)&bit?'rwx'[i]:'-').join('')).join('');}
  function lsTimestamp(time) {const date=new Date(time),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return months[date.getUTCMonth()]+' '+String(date.getUTCDate()).padStart(2)+' '+String(date.getUTCHours()).padStart(2,'0')+':'+String(date.getUTCMinutes()).padStart(2,'0');}
  class LogLabShell {
    constructor(files={},options={}) {
      this.files=Object.create(null); this.directories=new Set(['/','/home','/home/analyst','/tmp']);
      this.cwd='/home/analyst'; this.oldcwd=this.cwd; this.history=[]; this.supportedCommands=COMMANDS.slice();
      this.groups=Array.isArray(options.groups)?[...new Set(['analyst',...options.groups])]:['analyst','adm'];
      this.metadata=Object.create(null);this.elevated=false;this.decompressing=false;this.clock=typeof options.now==='function'?options.now:()=>options.now===undefined?Date.now():new Date(options.now).getTime();
      for(const [path,content] of Object.entries(files)) { const p=this.resolve(path); this.files[p]=String(content); this.addParents(p); }
      const timestamps=Object.values(this.files).map(inferMtime);this.snapshotTime=Math.max(Date.UTC(2026,0,1),...timestamps);
      for(const p of this.allPaths()){const dir=this.isDir(p),auth=/\/auth\.log(?:\.\d+)?(?:\.gz)?$/.test(p),systemDir=dir&&(/^\/(?:var|etc|baseline)(?:\/|$)/.test(p)||p==='/'||p==='/home');this.metadata[p]={mode:dir?p==='/tmp'?0o777:0o755:auth?0o640:0o644,owner:auth?'syslog':systemDir?'root':'analyst',group:auth?'adm':systemDir?'root':'analyst',mtime:dir?this.snapshotTime:inferMtime(this.files[p])||this.snapshotTime,compressed:!dir&&p.endsWith('.gz')};}
      for(const [path,entry] of Object.entries(options.metadata||{})){const p=this.resolve(path),meta=this.getMetadata(p);this.metadata[p]={...meta,...entry,mode:typeof entry.mode==='string'?parseInt(entry.mode,8):entry.mode===undefined?meta.mode:entry.mode,mtime:entry.mtime===undefined?meta.mtime:new Date(entry.mtime).getTime()};}
    }
    resolve(path) {
      const parts=(String(path).startsWith('/')?String(path):this.cwd+'/'+String(path)).split('/'), out=[];
      for(const part of parts) { if(!part||part==='.') continue; if(part==='..') out.pop(); else out.push(part); }
      return '/'+out.join('/');
    }
    addParents(path) { let p=dirname(path); while(true) { this.directories.add(p); if(p==='/') break; p=dirname(p); } }
    isFile(path) { return Object.prototype.hasOwnProperty.call(this.files,path); }
    isDir(path) { return this.directories.has(path) || Object.keys(this.files).some(p=>p.startsWith(path==='/'?'/':path+'/')); }
    allPaths() { for(const p of Object.keys(this.files)) this.addParents(p); return [...new Set([...this.directories,...Object.keys(this.files)])].sort(cmp); }
    getMetadata(path) {const p=this.resolve(path);return this.metadata[p]||(this.metadata[p]={mode:this.isDir(p)?0o755:0o644,owner:'analyst',group:'analyst',mtime:this.snapshotTime||0,compressed:false});}
    checkAccess(path,cmd,access) {const p=this.resolve(path),meta=this.getMetadata(p),shift=meta.owner==='analyst'?6:this.groups.includes(meta.group)?3:0;if(!this.elevated&&((meta.mode>>shift)&access)!==access)fail(cmd+': '+path+': Permission denied',1);}
    checkRead(path,cmd) {this.checkAccess(path,cmd,4);}
    checkWrite(path,cmd='write') {this.checkAccess(path,cmd,2);}
    checkParentWrite(path,cmd) {this.checkAccess(dirname(this.resolve(path)),cmd,3);}
    expand(token) {
      if(token.tilde&&(token.value==='~'||token.value.startsWith('~/'))){const prefix='/home/analyst';token={...token,value:prefix+token.value.slice(1),mask:[...Array(prefix.length).fill(false),...token.mask.slice(1)]};}
      if(!token.mask.some(Boolean)) return [token.value];
      const segments=[]; let segment=[], offset=0;
      for(const part of token.value.split('/')) { const masks=token.mask.slice(offset,offset+part.length); offset+=part.length+1; if(!part||part==='.') continue; if(part==='..') segments.push({parent:true}); else segments.push({part,masks}); }
      const resolved=token.value.startsWith('/')?[]:this.cwd.split('/').filter(Boolean).map(part=>({part,masks:[]}));
      for(const seg of segments) { if(seg.parent) resolved.pop(); else resolved.push(seg); }
      const source='^/'+resolved.map(seg=>Array.from(seg.part).map((c,i)=>seg.masks[i]?(c==='*'?'[^/]*':'[^/]'):escRE(c)).join('')).join('/')+'$';
      const matcher=new RegExp(source), found=this.allPaths().filter(p=>matcher.test(p)&&resolved.every((seg,i)=>!seg.masks.some(Boolean)||seg.part[0]==='.'||!p.split('/')[i+1].startsWith('.'))).map(p=>token.value.startsWith('/')?p:this.relative(p));
      return found.length?found:[token.value];
    }
    relative(path) { const a=this.cwd.split('/').filter(Boolean),b=path.split('/').filter(Boolean); while(a.length&&b.length&&a[0]===b[0]) { a.shift();b.shift(); } return [...a.map(()=>'..'),...b].join('/')||'.'; }
    read(path, cmd='read') { const p=this.resolve(path);if(p==='/dev/null')return '';if(this.isDir(p)) fail(cmd+': '+path+': Is a directory',1); if(!this.isFile(p)) fail(cmd+': '+path+': No such file or directory',1);this.checkRead(p,cmd);if(this.getMetadata(p).compressed&&!this.decompressing)fail(cmd+': '+path+': gzip fixture requires zcat, zgrep, or zless; this text-only emulator stores decompressed backing text and does not expose it through ordinary readers',1);return this.files[p]; }
    inputs(paths, stdin, cmd) { return paths.length?paths.map(name=>({name,text:name==='-'?stdin:this.read(name,cmd)})):[{name:'-',text:stdin}]; }
    write(path,text,append=false) { const p=this.resolve(path);if(p==='/dev/null')return;if(this.isDir(p)) fail('redirection: '+path+': Is a directory',1); if(!this.isDir(dirname(p))) fail('redirection: '+path+': No such file or directory',1);const exists=this.isFile(p);if(exists)this.checkWrite(p,'write');else this.checkParentWrite(p,'write');if(append&&exists&&this.getMetadata(p).compressed)fail('write: appending binary bytes to a gzip fixture is unsupported; decompress into a new text file first',1);const value=(append&&exists?this.files[p]:'')+text; if(value.length>MAX_FILE) fail('virtual file exceeds the 2 MiB text limit',1);if(!exists)this.metadata[p]={mode:0o644,owner:this.elevated?'root':'analyst',group:this.elevated?'root':'analyst',mtime:this.clock(),compressed:false};this.files[p]=value;this.getMetadata(p).mtime=this.clock();this.getMetadata(p).compressed=false; this.addParents(p); }
    getHelp(command) {
      if(command) {
        if(!USAGE[command]) fail('help: unknown command '+command,1);
        let extra='';
        if(command==='grep') extra='\nDefault grep uses basic regex: + ? | ( ) are literal unless escaped; -E enables extended regex.\n-F matches literal text. -r/-R recurse (virtual filesystem has no symlinks); -m limits selected lines per file.\n-L lists files without matching lines. Exit status still follows line matches: 0 match, 1 no match, 2 error.\nLong aliases: --recursive, --ignore-case, --invert-match, --line-number, --count, --regexp,\n--fixed-strings, --extended-regexp, --word-regexp, --line-regexp, --only-matching, --quiet,\n--files-with-matches, --files-without-match, --max-count, --after-context, --before-context, --context.\n--include/--exclude filter basenames; --exclude-dir filters directory names with * and ? globs.\nPCRE (-P), binary options, and color flags are unsupported.';
        if(command==='rg') extra='\nSubset: extended regex by default, recursive paths, no headings; -n adds line numbers.\nWith piped input and no paths, search standard input. -g accepts quoted * / ** / ? patterns; ! excludes.\n--files lists files. Hidden paths are skipped unless --hidden. --count counts matching lines.\nPCRE (-P), replacements, ignore files, multiline matching, and other options are unsupported.';
        if(command==='awk') extra='\nSubset: fields $N/$NF/$(NF-3), expression concatenation, print and printf; -F separator; -v name=value.\nMultiple BEGIN, record, and END blocks; scalar/array assignments, counters, if/else, bounded for loops.\nFilters: /regex/, comparisons, ~ !~, && ||. Functions: substr, split, length, tolower, toupper, int.\nfor (key in array) uses deterministic hash order, not insertion or sorted order; pipe to sort for guaranteed order.\nLimits: 10,000 iterations per loop and 1,000,000 execution steps. system(), while, and field assignment are unsupported.';
        if(command==='sed') extra='\nAddresses: numbers, $, /regex/, and address ranges; actions p, d, and s/old/new/g.\n-n suppresses automatic printing. Multiple -e scripts and semicolon-separated commands run in sequence.\nSubstitution supports &, \\1…\\9, escaped delimiters, and g/p/i flags; -E enables extended regex.\n-i edits named virtual files only; an attached suffix (e.g. -i.bak) saves a backup.\nBranches, hold space, arbitrary insertion, and other sed actions are unsupported.';
        if(command==='sort') extra='\nRepeated field keys, including -k1,1M -k2,2n; field-position syntax is unsupported.\n-n numeric, -r reverse, -f ignore case, -b ignore leading blanks, -s stable, -u unique, -c check order.\n-M/--month-sort orders English month names. Default fields split on whitespace; -t changes the separator.\n-u keeps the first line per equal key. Sorting uses deterministic character order (no locale collation).';
        if(command==='tr') extra='\nTranslate, delete (-d), squeeze consecutive characters (-s), or complement SET1 (-c).\nSets support ASCII ranges, \\n \\r \\t \\\\, octal escapes, and [:lower:] [:upper:] [:digit:] [:alpha:]\n[:alnum:] [:space:] [:blank:] [:punct:] [:xdigit:] [:print:] [:graph:] [:cntrl:].\nComplemented translation requires one output character. Repeated-set syntax is unsupported.';
        if(command==='column') extra='\nOnly table mode is supported. Default input splits on whitespace; -s uses each delimiter character.\nCells are padded with two spaces. Quoted CSV fields and ANSI styling are unsupported.';
        if(command==='nl') extra='\nDefault numbers nonempty lines; -ba numbers every line, -bt numbers nonempty lines.\nDefault width 6 and tab separator. Page delimiters and numbering formats are unsupported.';
        if(command==='diff') extra='\nCompare two virtual text files. Default is normal diff; -u shows unified diff with 3 context lines.\nExit status: 0 identical, 1 different, 2 error. Comparison is limited to 2 million line-pair cells.\nUse filtered excerpts for larger comparisons. Whitespace-ignore and recursive modes are unsupported.';
        if(command==='jq') extra='\nSubset for JSON and JSONL: . , .field, .nested.field, .[N], .["key"], .[]; pipes and comma outputs.\nselect(.field == "value") supports comparisons and and/or; missing fields return null.\nAlso: length, keys, values, type, has("key"), contains("text"), test("regex"),\nsort, unique, sort_by(.field), group_by(.field), unique_by(.field), arrays [filter],\nobject projections {key: .field}, @csv, @tsv, and // fallback. -r raw strings, -c compact, -s slurp.\nAssignments, variables, functions, reduce, recursion, and other jq language features are unsupported.';
        if(command==='head'||command==='tail') extra='\n-n counts lines; -c counts UTF-8 bytes. -q hides headings; -v forces them.\nhead -n -N omits the final N lines; tail -n +N / -c +N starts at the Nth line/byte.\nA byte slice through a UTF-8 character displays a replacement character in this text terminal.\nLogs are static snapshots. tail -f/--follow cannot track new events; re-run tail after editing a file.';
        if(command==='base64') extra='\nEncode UTF-8 text or decode Base64 into UTF-8 text. Default output wraps at 76 columns.\n-w 0 disables wrapping. Binary data that is not valid UTF-8 is unsupported in this text filesystem.';
        if(command==='tee') extra='\nCopy standard input to virtual files and standard output. -a appends. All writes stay in memory.';
        if(command==='uniq') extra='\nConsecutive equal lines only. -i ignores case, -f skips fields, -s skips characters for comparison.\nOriginal first lines are retained. Use sort before uniq to group scattered equal values.';
        if(command==='wc') extra='\n-l newline count, -w whitespace-separated words, -m Unicode characters, -c UTF-8 bytes.\n-L maximum display width with 8-column tab stops. Multiple-file totals use the maximum for -L.';
        if(command==='cut') extra='\nFields/ranges: 1,3-5,7-, -3. -s omits lines without a delimiter; otherwise those lines pass through.\n--complement reverses selection; --output-delimiter changes field separation (or gaps between character ranges).';
        if(command==='ls') extra='\n-a includes dotfiles; -l shows mode, links, owner, group, text bytes, month, day, time, and name.\n-t/--sort=time sorts newest first; -S/--sort=size sorts size; -r reverses; -d lists directories; -R recurses.\nVirtual mtimes derive from the latest log timestamp (ISO/nginx/syslog); timestamps display in UTC.\nYearless syslog assumes 2026. Files without timestamps use the case snapshot date, or 2026-01-01.\n-h shows human sizes. Symlinks, permission changes, and real compressed byte sizes are unsupported.';
        if(command==='find') extra='\nOne starting path. Name/path predicates combine with AND; -iname/-ipath ignore case.\nQuoted * and ? globs are supported. The starting path has depth 0; no -exec or boolean expressions.';
        if(command==='printf') extra='\nFormats: %s %b %c %d %i %u %o %x %X %f %e %E %g %G and %%.\nSupports numeric width/precision, -/0 padding, standard backslash escapes, \\xHH and octal.\nFormat repeats for extra arguments. Safe JavaScript integers only; %q/%n and dynamic widths are unsupported.';
        if(command==='paste') extra='\nDefault joins corresponding lines with tabs; -s joins each file in sequence.\n-d cycles delimiter characters; standard backslash escapes and \\0 for an empty delimiter are supported.';
        if(command==='comm') extra='\nInputs must be sorted in this lab\'s character order. Columns: only file1, only file2, common.\n-1/-2/-3 suppress columns; comm -12 shows shared lines. Unsorted inputs report an error.';
        if(command==='join') extra='\nInputs must be sorted by the join fields. -1/-2 select 1-based keys; -t selects one delimiter.\nRepeated -a1/-a2 retain unmatched rows; -v1/-v2 output only unmatched rows.\n-o supports comma/space-separated 0 (key), 1.N, 2.N; -e fills missing fields. Duplicate keys produce all pairs.';
        if(command==='xargs') extra='\nDefault splits quoted/escaped whitespace arguments; -0 and -d use literal delimiters.\n-n limits arguments per batch; -I replaces a token once per nonempty input line; -r skips empty input.\nDispatches existing virtual commands directly; no shell re-parsing, host commands, -P, or shell -c.\nNested xargs and editors are unsupported; at most 256 batches.';
        if(command==='strings') extra='\nExtract ASCII printable sequences (including tabs), default minimum length 4.\n-n sets the minimum; -t d/o/x prefixes UTF-8 byte offsets. -a scans the full virtual text.';
        if(command==='basename') extra='\nStrip directory and optional suffix. -a processes multiple paths; -s suffix also enables multiple paths.';
        if(command==='dirname') extra='\nReturn the lexical parent of each path; paths need not exist.';
        if(command==='realpath') extra='\nNormalize virtual absolute paths and .. / .; there are no symlinks.\nDefault requires an existing parent; -e requires the path to exist; -m permits missing parents.';
        if(command==='file') extra='\nClassify virtual text using its contents: empty, ASCII, UTF-8, JSON/JSONL, or data.\n.gz files are labeled as simulated gzip fixtures; stored backing text is not real compressed data.\n-b suppresses filenames; -i gives a basic MIME/charset description. No executable inspection.';
        if(command==='stat') extra='\nSimulated metadata only; no real inode allocation or device numbers.\n-c formats: %n name, %s text bytes, %F type, %a octal mode, %A mode letters, %U owner, %G group,\n%y UTC modification time, %Y epoch modification seconds, %%. .gz size reports decompressed backing text bytes.';
        if(command==='du') extra='\nVirtual logical text size, not physical disk allocation. Default units are rounded-up KiB.\n-b reports bytes, -h human sizes, -s summarizes, -a includes files; --max-depth limits display depth.';
        if(command==='date') extra='\nBrowser clock by default; -u formats UTC. -d accepts timezone-qualified ISO, YYYY-MM-DD (UTC), or @epoch.\nFormats: %Y %m %d %e %H %M %S %F %T %s %z %Z %a %A %b %B %u %w %j %n %t %%.\nRelative dates, setting the clock, locale modes, and nanoseconds are unsupported.';
        if(command==='mv') extra='\nMove one virtual file or directory; -n preserves an existing destination. No interactive mode or merging directories.';
        if(command==='rmdir') extra='\nRemove empty virtual directories; -p also removes empty parents. Current directory and its ancestors are protected.';
        if(command==='vi'||command==='view') extra='\nOpens the browser editor. vi can open an unsaved new buffer in an existing parent; :w creates the virtual file.\nview requires an existing file and opens read-only. Editors must be standalone, without pipes/redirection/command lists.';
        if(command==='sl') extra='\nA steam locomotive crosses the terminal for about five seconds. Wait until it passes; Ctrl+C cannot stop it.\nNo options are supported. Standalone only: no pipes, redirection, command lists, or xargs.\nWith reduced motion enabled, a stationary train is displayed for the same duration. Files and progress are preserved.';
        if(command==='rm') extra='\n-f removes virtual files without errors for missing files. Ordinary recursive deletion is unsupported.\nrm -rf / refuses to operate on root, following GNU preserve-root behavior.\nEaster egg: standalone rm -rf --no-preserve-root / plays GAME OVER and resets the current case.\nIts answers, notes, history, and virtual edits are cleared; other cases and layout are preserved.\nThis is a simulated scene; host files are never accessed. Pipes, redirection, lists, and xargs do not trigger it.';
        if(command==='help')extra='\nLogRoom convenience guide for every simulated command. In Bash, help documents shell builtins;\nuse man ls or ls --help for external tools on a real Linux system.';
        if(command==='man')extra='\nDisplays the LogRoom command subset in the pager. Real Linux man pages document installed tools more fully.';
        if(command==='which')extra='\nShows simulated external command paths. Shell builtins have no virtual executable; real which behavior varies by system.';
        if(command==='sudo')extra='\nSimulates file read/write privileges for one supported command; no passwords, policy checks, or host privileges.\nUse sudo cat /var/log/auth.log when the analyst is not in adm. Shell redirects are opened before sudo.\nIdentity and elevation reset after each command. sudo vi/view and nested sudo are unsupported; use sudo tee.\nShell-state builtins (cd, pwd, help, history, clear) are also unsupported under sudo in this subset.\nBasic owner/group mode checks apply; ACLs, sticky bits, and full directory traversal permissions are not simulated.';
        if(['zcat','zgrep','zless'].includes(command))extra='\nTraining boundary: .gz fixtures contain decompressed backing text in memory, not gzip bytes.\nThese commands simulate decompression; ordinary readers reject .gz so they cannot silently teach plain-text access.\nThe fixture marker survives cp/mv; a .gz filename alone does not compress new text.\nzcat/zless require named gzip fixtures; zgrep also searches plain files. zless opens the pager.\nNo binary gzip decoding or gzip creation is simulated; overwrites produce plain text and binary append is rejected.';
        if(command==='rev') extra='\nReverse Unicode characters within each line; preserve line endings.';
        return USAGE[command]+extra+'\n';
      }
      return 'LogLab virtual Linux-like text shell — browser-only training subset\n'+
        'Commands: '+COMMANDS.join(', ')+'\n'+
        'Syntax: quotes, escapes, |, <, >, >>, 2>, 2>&1, ;, &&, ||, unquoted ~, * and ? globs.\n'+
        'Use help COMMAND for exact options. Files and redirects stay in virtual memory.\nUse >file 2>&1 to share output; independent redirects to the same file are unsupported.\n'+
        'No host OS, server execution, package installation, shell variables, scripts, or network.\n'+
        'less/more open the viewer; q closes, / searches, n finds the next result.\n';
    }
    complete(input) {
      const m=input.match(/(?:^|[\s|;])([^\s|;]*)$/); if(!m) return [];
      const prefix=m[1], first=!input.trim().includes(' ');
      const paths=this.allPaths().map(p=>prefix.startsWith('/')?p:this.relative(p)).filter(p=>p.startsWith(prefix)).map(p=>this.isDir(this.resolve(p))?p+'/':p);
      return [...new Set([...(first?COMMANDS.filter(c=>c.startsWith(prefix)):[]),...paths])].sort(cmp);
    }
    isRootResetCommand(input) {
      input=String(input);
      if(input.length>MAX_INPUT||input.includes('\0'))return false;
      try {
        const chains=parse(lex(input));
        if(chains.length!==1||chains[0].pipeline.length!==1)return false;
        const command=chains[0].pipeline[0];
        if(command.redirs.length||command.words[0]?.value!=='rm')return false;
        const flags=new Set(),paths=[];let end=false;
        for(const word of command.words.slice(1)) {
          const value=word.value;
          if(!end&&value==='--'){end=true;continue;}
          if(!end&&value==='--recursive'){flags.add('r');continue;}
          if(!end&&value==='--force'){flags.add('f');continue;}
          if(!end&&value==='--no-preserve-root'){flags.add('no-preserve-root');continue;}
          if(!end&&/^-[rfR]+$/.test(value)){for(const flag of value.slice(1))flags.add(flag.toLowerCase());continue;}
          if(!end&&value.startsWith('-'))return false;
          paths.push(value);
        }
        return flags.has('r')&&flags.has('f')&&flags.has('no-preserve-root')&&paths.length===1&&paths[0]==='/';
      } catch(_){return false;}
    }
    run(input) {
      input=String(input); if(input.length>MAX_INPUT) return {stdout:'',stderr:'shell: input exceeds 8192 characters\n',code:2};
      if(input.includes('\0')) return {stdout:'',stderr:'shell: NUL bytes are unsupported\n',code:2};
      if(this.isRootResetCommand(input))return {stdout:'',stderr:'',code:0,gameOver:true};
      if(input.trim()) this.history.push(input);
      let stdout='',stderr='',code=0,clear=false,pager=false,editor=null,train=false;
      try {
        const chains=parse(lex(input));
        for(const chain of chains)for(const node of chain.pipeline)if(['vi','view'].includes(node.words[0].value)&&(chains.length!==1||chain.pipeline.length!==1||node.redirs.length))fail('vi/view must be a standalone command without pipes, redirection, or command lists');
        for(const chain of chains)for(const node of chain.pipeline)if(node.words[0].value==='sl'&&(chains.length!==1||chain.pipeline.length!==1||node.redirs.length))fail('sl must be a standalone command without pipes, redirection, or command lists');
        for(const chain of chains) {
          if(chain.connector==='&&'&&code!==0 || chain.connector==='||'&&code===0) continue;
          let data='',last={stdout:'',stderr:'',code:0};
          for(let nodeIndex=0;nodeIndex<chain.pipeline.length;nodeIndex++) {
            const node=chain.pipeline[nodeIndex],pipeSink={kind:'stdout'},errorSink={kind:'stderr'},fds={1:pipeSink,2:errorSink},openedOutputs=new Set();
            try {
              const words=node.words.flatMap(t=>this.expand(t)); let stdin=data;
              for(const r of node.redirs) {
                if(r.op==='>&'){fds[r.fd]=fds[Number(r.target.value)];continue;}
                const targets=this.expand(r.target);if(targets.length!==1)fail('ambiguous '+(r.op==='<'?'input':'output')+' redirection');
                if(r.op==='<')stdin=this.read(targets[0],'redirection');else{const path=this.resolve(targets[0]);if(path!=='/dev/null'&&openedOutputs.has(path))fail('independent redirects to the same file are unsupported; use > file 2>&1 to share one descriptor');openedOutputs.add(path);this.write(targets[0],'',r.op==='>>');fds[r.fd]={kind:'file',path:targets[0]};}
              }
              last=this.execute(words[0],words.slice(1),stdin,{hasStdin:nodeIndex>0||node.redirs.some(r=>r.op==='<')});
            }
            catch(e) { if(!(e instanceof ShellError)) throw e; last={stdout:'',stderr:e.message+'\n',code:e.code}; }
            last.stdout=last.stdout||''; last.stderr=last.stderr||''; last.code=last.code||0;
            if(last.stdout.length>MAX_OUTPUT) { last.stdout=last.stdout.slice(0,MAX_OUTPUT);last.stderr+='shell: output truncated at 512 KiB; filter the data or redirect a smaller result\n';delete last.events;last.code=1; }
            data='';
            for(const [fd,chunk] of last.events||[[1,last.stdout],[2,last.stderr]]){const sink=fds[fd];if(!chunk)continue;if(sink.kind==='stdout')data+=chunk;else if(sink.kind==='stderr')stderr+=chunk;else try{this.write(sink.path,chunk,true);}catch(e){if(!(e instanceof ShellError))throw e;stderr+=e.message+'\n';last.code=e.code;}}
            if(last.clear) clear=true;
            if(last.editor)editor=last.editor;
            if(last.train)train=true;
            if(nodeIndex===chain.pipeline.length-1)pager=Boolean(last.pager&&fds[1]===pipeSink);
          }
          stdout+=data; code=last.code;
          if(stdout.length>MAX_OUTPUT) { stdout=stdout.slice(0,MAX_OUTPUT); stderr+='shell: total output truncated at 512 KiB\n'; code=1; break; }
        }
      } catch(e) { stderr+=(e instanceof ShellError?e.message:'shell: internal error')+'\n'; code=e instanceof ShellError?e.code:2; }
      return {stdout,stderr,code,...(clear?{clear:true}:{}),...(pager?{pager:true}:{}),...(editor?{editor}:{}),...(train?{train:true}:{})};
    }
    execute(cmd,args,stdin,context={}) {
      if(!COMMANDS.includes(cmd)) fail(cmd+': command not found. Type help for the supported training commands.',127);
      const result=(stdout='',code=0,extra={})=>({stdout,stderr:'',code,...extra});
      if((cmd!=='sudo'||args[0]==='--help')&&args.includes('--help')&&(args.indexOf('--')<0||args.indexOf('--help')<args.indexOf('--'))) return result(this.getHelp(cmd));
      switch(cmd) {
        case 'help': if(args.length>1) usageError(cmd,'too many arguments'); return result(this.getHelp(args[0]));
        case 'man': if(args.length!==1)usageError(cmd,'one command name is required');return result('LOGROOM TRAINING MANUAL — subset, not the host manual\n\n'+this.getHelp(args[0]),0,{pager:true});
        case 'whoami': if(args.length)usageError(cmd,'no arguments are supported');return result(this.elevated?'root\n':'analyst\n');
        case 'hostname': if(args.length)usageError(cmd,'changing the hostname is unsupported');return result((this.files['/etc/hostname']||'logroom').trim()+'\n');
        case 'id': {const {flags,rest}=simpleOptions(args,'ugGn',cmd);if(rest.length||['u','g','G'].filter(f=>flags.has(f)).length>1||flags.has('n')&&!['u','g','G'].some(f=>flags.has(f)))usageError(cmd,'use -u, -g, or -G, optionally with -n');const root=this.elevated,user=root?'root':'analyst',uid=root?0:1000,groups=root?['root']:this.groups,gid=name=>name==='root'?0:name==='adm'?4:1000;if(flags.has('u')||flags.has('g'))return result((flags.has('n')?user:uid)+'\n');if(flags.has('G'))return result(groups.map(g=>flags.has('n')?g:gid(g)).join(' ')+'\n');return result('uid='+uid+'('+user+') gid='+uid+'('+user+') groups='+groups.map(g=>gid(g)+'('+g+')').join(',')+'\n');}
        case 'which': {if(!args.length)usageError(cmd,'missing command');const builtins=['help','cd','pwd','echo','printf','history','clear'],out=[],errors=[];for(const name of args){if(COMMANDS.includes(name)&&!builtins.includes(name))out.push('/usr/bin/'+name);else errors.push('which: '+name+': '+(builtins.includes(name)?'shell builtin; no external executable in the virtual PATH':'not found in the virtual PATH'));}return {stdout:lineOutput(out),stderr:lineOutput(errors),code:errors.length?1:0};}
        case 'sudo': {if(!args.length)usageError(cmd,'missing command');if(args[0]==='--')args=args.slice(1);if(!args.length||args[0].startsWith('-'))usageError(cmd,'only sudo command [arguments] is supported');if(['cd','pwd','help','history','clear'].includes(args[0]))usageError(cmd,'this training shell builtin is unsupported under sudo; sudo cannot change the parent shell state');if(['vi','view','sl','sudo'].includes(args[0]))usageError(cmd,'interactive or nested sudo commands are unsupported; copy a log to ~/ to edit it, or use sudo tee');const elevated=this.elevated;this.elevated=true;try{return this.execute(args[0],args.slice(1),stdin,context);}finally{this.elevated=elevated;}}
        case 'pwd': if(args.length) usageError(cmd,'no options are supported'); return result(this.cwd+'\n');
        case 'clear': if(args.length) usageError(cmd,'no arguments are supported'); return result('',0,{clear:true});
        case 'sl': if(args.length)usageError(cmd,'no options or arguments are supported');return result('',0,{train:true});
        case 'history': if(args.length) usageError(cmd,'no arguments are supported'); return result(lineOutput(this.history.map((x,i)=>String(i+1).padStart(4)+'  '+x)));
        case 'cd': { if(args.length>1) usageError(cmd,'too many arguments'); const dest=args[0]==='-'?this.oldcwd:this.resolve(args[0]||'/home/analyst'); if(!this.isDir(dest)) fail('cd: '+(args[0]||dest)+': No such file or directory',1); const old=this.cwd;this.cwd=dest;this.oldcwd=old;return result(args[0]==='-'?dest+'\n':''); }
        case 'echo': { let n=false; if(args[0]==='-n'){n=true;args=args.slice(1);} if(args[0]==='-e'||args[0]==='-E') usageError(cmd,'escape expansion options are unsupported'); return result(args.join(' ')+(n?'':'\n')); }
        case 'ls': return result(runLs(this,args));
        case 'cat': {const {flags,rest}=simpleOptions(args,'n',cmd);let text='',stderr='',code=0,lineNumber=0,lineStart=true;const events=[];for(const path of rest.length?rest:['-']){try{let chunk=path==='-'?stdin:this.read(path,cmd);if(flags.has('n'))chunk=lineChunks(chunk).map(line=>{const numbered=(lineStart?String(++lineNumber).padStart(6)+'\t':'')+line;lineStart=line.endsWith('\n');return numbered;}).join('');text+=chunk;events.push([1,chunk]);}catch(e){if(!(e instanceof ShellError))throw e;stderr+=e.message+'\n';events.push([2,e.message+'\n']);code=1;}}return {stdout:text,stderr,code,events};}
        case 'zcat': case 'zgrep': case 'zless': {const decompression=this.decompressing;this.decompressing=true;try{if(cmd==='zgrep')return this.grep(args,stdin);const {rest}=simpleOptions(args,'',cmd);if(!rest.length||rest.includes('-'))usageError(cmd,'named gzip fixtures are required; binary standard input is unsupported');const texts=rest.map(path=>{const text=this.read(path,cmd);if(!this.getMetadata(path).compressed)fail(cmd+': '+path+': not in gzip format (use cat for plain text)',1);return text;});return result(texts.join(''),0,cmd==='zless'?{pager:true}:{});}finally{this.decompressing=decompression;}}
        case 'tac': {const {rest}=simpleOptions(args,'',cmd);return result(this.inputs(rest,stdin,cmd).map(f=>lineChunks(f.text).reverse().join('')).join(''));}
        case 'base64': return result(runBase64(this,args,stdin));
        case 'tee': {const {flags,rest}=simpleOptions(args,'a',cmd);let stderr='',code=0;for(const path of rest){try{this.write(path,stdin,flags.has('a'));}catch(e){if(!(e instanceof ShellError))throw e;stderr+=e.message+'\n';code=1;}}return {stdout:stdin,stderr,code};}
        case 'less': case 'more': { const {rest}=simpleOptions(args,'',cmd); return result(this.inputs(rest,stdin,cmd).map(f=>f.text).join(''),0,{pager:true}); }
        case 'grep': return this.grep(args,stdin);
        case 'rg': return this.rg(args,stdin,context.hasStdin);
        case 'sort': return runSort(this,args,stdin);
        case 'uniq': return result(runUniq(this,args,stdin));
        case 'cut': return result(runCut(this,args,stdin));
        case 'tr': return result(runTr(args,stdin));
        case 'column': return result(runColumn(this,args,stdin));
        case 'nl': return result(runNl(this,args,stdin));
        case 'diff': return runDiff(this,args,stdin);
        case 'jq': return result(runJq(this,args,stdin));
        case 'head': case 'tail': return result(runEnds(this,cmd,args,stdin));
        case 'wc': return result(runWc(this,args,stdin));
        case 'sed': return result(runSed(this,args,stdin));
        case 'awk': return result(this.awk(args,stdin));
        case 'find': return result(runFind(this,args));
        case 'printf': return result(runPrintf(args));
        case 'paste': return result(runPaste(this,args,stdin));
        case 'comm': return result(runComm(this,args,stdin));
        case 'join': return result(runJoin(this,args,stdin));
        case 'xargs': return runXargs(this,args,stdin);
        case 'rev': {const {rest}=simpleOptions(args,'',cmd);return result(this.inputs(rest,stdin,cmd).map(f=>lineChunks(f.text).map(chunk=>{const nl=chunk.endsWith('\n');return Array.from(nl?chunk.slice(0,-1):chunk).reverse().join('')+(nl?'\n':'');}).join('')).join(''));}
        case 'strings': return result(runStrings(this,args,stdin));
        case 'basename': case 'dirname': case 'realpath': return result(runPaths(this,cmd,args));
        case 'file': case 'stat': case 'du': return result(runMetadata(this,cmd,args));
        case 'date': return result(runDate(args));
        case 'mv': case 'rmdir': return result(runMove(this,cmd,args));
        case 'vi': case 'view': {const {rest}=simpleOptions(args,'',cmd);if(rest.length>1)usageError(cmd,'only one file is supported');const path=this.resolve(rest[0]||'/home/analyst/untitled.txt');if(this.isDir(path))fail(cmd+': '+path+': Is a directory',1);if(!this.isFile(path)){if(cmd==='view')fail('view: '+path+': No such file or directory',1);if(!this.isDir(dirname(path)))fail('vi: parent directory does not exist',1);}return result('',0,{editor:{path,text:this.isFile(path)?this.read(path,cmd):'',readonly:cmd==='view'}});}
        case 'mkdir': { const {flags,rest}=simpleOptions(args,'p',cmd); if(!rest.length) usageError(cmd,'missing directory'); for(const name of rest) {const p=this.resolve(name);if(this.isFile(p)) fail('mkdir: '+name+': File exists',1);if(this.isDir(p)&&!flags.has('p')) fail('mkdir: '+name+': File exists',1);if(!flags.has('p')&&!this.isDir(dirname(p)))fail('mkdir: '+name+': No such file or directory',1);const missing=[];for(let parent=p;!this.isDir(parent);parent=dirname(parent)){if(this.isFile(parent))fail('mkdir: '+parent+': Not a directory',1);missing.unshift(parent);}for(const dir of missing){this.checkParentWrite(dir,cmd);this.directories.add(dir);this.metadata[dir]={mode:0o755,owner:this.elevated?'root':'analyst',group:this.elevated?'root':'analyst',mtime:this.clock()};}}return result(); }
        case 'touch': { const {rest}=simpleOptions(args,'',cmd);if(!rest.length)usageError(cmd,'missing file');for(const name of rest){const p=this.resolve(name);if(!this.isFile(p)&&!this.isDir(p))this.write(name,'');else{this.checkWrite(p,cmd);this.getMetadata(p).mtime=this.clock();}}return result(); }
        case 'cp': { const {rest}=simpleOptions(args,'',cmd);if(rest.length!==2)usageError(cmd,'exactly two paths are required');const source=this.resolve(rest[0]);let to=this.resolve(rest[1]);if(this.isDir(to))to+=(to==='/'?'':'/')+basename(source);if(to===source)fail('cp: source and destination are the same file',1);const compressed=this.isFile(source)&&this.getMetadata(source).compressed;if(compressed)this.checkRead(source,cmd);const content=compressed?this.files[source]:this.read(rest[0],cmd);this.write(to,content);if(to!=='/dev/null')this.getMetadata(to).compressed=Boolean(compressed);return result(); }
        case 'rm': {let after=false;args=args.filter(arg=>{if(arg==='--')after=true;return after||!['--preserve-root','--no-preserve-root'].includes(arg);});args=longOptions(args,{'--force':'f','--recursive':'r'},{},cmd);const {flags,rest}=simpleOptions(args,'frR',cmd);if(!rest.length&&!flags.has('f'))usageError(cmd,'missing file');for(const name of rest){const p=this.resolve(name);if(p==='/'&&(flags.has('r')||flags.has('R')))fail("rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe (LogRoom requires a standalone explicit command)",1);if(this.isDir(p))fail('rm: '+name+': Is a directory; ordinary recursive deletion is unsupported in this exercise',1);if(!this.isFile(p)&&!flags.has('f'))fail('rm: '+name+': No such file or directory',1);if(this.isFile(p))this.checkParentWrite(p,cmd);delete this.files[p];delete this.metadata[p];}return result(); }
      }
    }
    ls(args) { return runLs(this,args); }
    rg(args,stdin,hasStdin) {
      const passed=[],patterns=[],paths=[],globs=[];let filesMode=false,hidden=false,after=false,fixed=false;
      const longFlags={'--no-heading':'','--count':'c','--line-number':'n','--no-filename':'h','--with-filename':'H','--files-with-matches':'l','--fixed-strings':'F','--ignore-case':'i','--invert-match':'v','--word-regexp':'w','--only-matching':'o','--quiet':'q'};
      for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}
        if(!after&&arg==='--files'){filesMode=true;continue;}if(!after&&arg==='--hidden'){hidden=true;continue;}
        if(!after&&Object.prototype.hasOwnProperty.call(longFlags,arg)){if(longFlags[arg])passed.push('-'+longFlags[arg]);if(arg==='--fixed-strings')fixed=true;continue;}
        if(!after&&(arg==='--glob'||arg.startsWith('--glob='))){const t=takeValue(args,i,arg.startsWith('--glob=')?arg.slice(7):'','rg','--glob');globs.push(t.value);i=t.next;continue;}
        if(!after&&(arg==='--regexp'||arg.startsWith('--regexp='))){const t=takeValue(args,i,arg.startsWith('--regexp=')?arg.slice(9):'','rg','--regexp');patterns.push(t.value);i=t.next;continue;}
        if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if('egABC'.includes(f)){const t=takeValue(args,i,arg.slice(j+1),'rg','-'+f);i=t.next;if(f==='g')globs.push(t.value);else if(f==='e')patterns.push(t.value);else passed.push('-'+f,t.value);break;}if(!'FiwvnclHhqo'.includes(f))usageError('rg','unsupported option -'+f);passed.push('-'+f);if(f==='F')fixed=true;}continue;}
        paths.push(arg);
      }
      if(!filesMode&&!patterns.length){if(!paths.length)usageError('rg','missing pattern');patterns.push(paths.shift());}
      if(filesMode&&patterns.length)usageError('rg','--files does not accept a search pattern');
      const fromStdin=!filesMode&&!paths.length&&hasStdin;
      const finish=result=>{if(passed.includes('-c')&&!passed.includes('-q'))result.stdout=lineOutput(asLines(result.stdout).filter(line=>line!=='0'&&!/:0$/.test(line)));return result;};
      if(fromStdin){if(globs.length)usageError('rg','-g requires filesystem input');return finish(this.grep([...(!fixed?['-E']:[]),...passed,...patterns.flatMap(p=>['-e',p])],stdin,{allowDigitEscapes:true}));}
      let recurse=false;const candidates=[];
      for(const path of paths.length?paths:['.']){const p=this.resolve(path);if(this.isDir(p)){recurse=true;for(const file of Object.keys(this.files).filter(f=>f.startsWith(p==='/'?'/':p+'/')).sort(cmp))candidates.push({p:file,name:path.startsWith('/')?file:this.relative(file)});}else{if(!this.isFile(p))fail('rg: '+path+': No such file or directory',2);candidates.push({p,name:path});}}
      const matchGlob=(pattern,path)=>{const target=pattern.includes('/')?path:basename(path);let s='';for(let i=0;i<pattern.length;i++){const c=pattern[i];if(c==='*'&&pattern[i+1]==='*'){i++;if(pattern[i+1]==='/'){i++;s+='(?:.*/)?';}else s+='.*';}else s+=c==='*'?'[^/]*':c==='?'?'[^/]':escRE(c);}return new RegExp('^'+s+'$').test(target)||new RegExp('^'+s+'$').test(path.replace(/^\//,''));};
      const includes=globs.filter(g=>!g.startsWith('!')),excludes=globs.filter(g=>g.startsWith('!')).map(g=>g.slice(1));
      const seen=new Set(),selected=candidates.filter(f=>{if(seen.has(f.p))return false;seen.add(f.p);return (hidden||!this.relative(f.p).split('/').some(seg=>seg.startsWith('.')&&seg!=='.'&&seg!=='..'))&&(!includes.length||includes.some(g=>matchGlob(g,f.name)))&&!excludes.some(g=>matchGlob(g,f.name));});
      if(filesMode)return {stdout:lineOutput(selected.map(f=>f.name)),stderr:'',code:selected.length?0:1};
      if(!selected.length)return {stdout:'',stderr:'',code:1};
      return finish(this.grep([...(!fixed?['-E']:[]),...(recurse?['-H']:[]),...passed,...patterns.flatMap(p=>['-e',p]),'--',...selected.map(f=>f.name)],stdin,{allowDigitEscapes:true}));
    }
    grep(args,stdin,options={}) {
      args=longOptions(args,{'--recursive':'r','--dereference-recursive':'R','--ignore-case':'i','--invert-match':'v','--line-number':'n','--count':'c','--files-with-matches':'l','--files-without-match':'L','--only-matching':'o','--quiet':'q','--word-regexp':'w','--line-regexp':'x','--fixed-strings':'F','--extended-regexp':'E','--no-filename':'h','--with-filename':'H'},{'--regexp':'e','--max-count':'m','--after-context':'A','--before-context':'B','--context':'C','--include':'--include','--exclude':'--exclude','--exclude-dir':'--exclude-dir'},'grep');
      const flags=new Set(), patterns=[],paths=[],includes=[],excludes=[],excludedDirs=[];let after=false,A=0,B=0,maxCount=Infinity;
      for(let i=0;i<args.length;i++){
        const arg=args[i];if(!after&&arg==='--'){after=true;continue;}
        if(!after&&['--include','--exclude','--exclude-dir'].includes(arg)){const t=takeValue(args,i,'','grep',arg);i=t.next;(arg==='--include'?includes:arg==='--exclude'?excludes:excludedDirs).push(t.value);continue;}
        if(!after&&arg.startsWith('-')&&arg!=='-'){
          for(let j=1;j<arg.length;j++){
            const f=arg[j];
            if('eABCm'.includes(f)){const taken=takeValue(args,i,arg.slice(j+1),'grep','-'+f);i=taken.next;if(f==='e')patterns.push(taken.value);else if(f==='m'){if(!/^\d+$/.test(taken.value))usageError('grep','max count must be nonnegative');maxCount=+taken.value;}else{if(!/^\d+$/.test(taken.value)||+taken.value>10000)usageError('grep','context must be 0–10000');if(f==='A'||f==='C')A=+taken.value;if(f==='B'||f==='C')B=+taken.value;}break;}
            if(!'EFiwvncrRlhHLqxo'.includes(f))usageError('grep','unsupported option -'+f);if(f==='H')flags.delete('h');if(f==='h')flags.delete('H');if(f==='L')flags.delete('l');if(f==='l')flags.delete('L');flags.add(f);
          }
        } else if(!patterns.length)patterns.push(arg);else paths.push(arg);
      }
      if(!patterns.length)usageError('grep','missing pattern');
      if(flags.has('E')&&flags.has('F'))usageError('grep','-E and -F cannot be combined');
      const matchers=patterns.flatMap(p=>p.split('\n')).map(p=>{
        if(flags.has('F'))return {fixed:flags.has('i')?p.toLowerCase():p};
        if(!options.allowDigitEscapes){for(let i=0;i<p.length;i++)if(p[i]==='\\'){if(/[dD]/.test(p[i+1]||''))usageError('grep','\\d/\\D are not supported by BRE/ERE grep; use [0-9] or [[:digit:]] (negate with [^0-9]); PCRE -P is unavailable');i++;}}
        return {re:regex(p,flags.has('E'),flags.has('i'))};
      });
      const isWord=c=>Boolean(c&&/[A-Za-z0-9_]/.test(c));
      const matches=line=>{
        let hits=[];
        for(const matcher of matchers){
          if(matcher.fixed!==undefined){const hay=flags.has('i')?line.toLowerCase():line;let offset=0;while(offset<=hay.length){const n=hay.indexOf(matcher.fixed,offset);if(n<0)break;hits.push({index:n,text:line.slice(n,n+matcher.fixed.length)});offset=n+Math.max(1,matcher.fixed.length);}}
          else {const re=new RegExp(matcher.re.source,matcher.re.flags+'g');let m;while((m=re.exec(line))!==null){hits.push({index:m.index,text:m[0]});if(!m[0])re.lastIndex++;}}
        }
        hits=hits.filter(h=>(!flags.has('x')||(h.index===0&&h.text.length===line.length))&&(!flags.has('w')||(!isWord(line[h.index-1])&&!isWord(line[h.index+h.text.length]))));
        return hits.sort((a,b)=>a.index-b.index||b.text.length-a.text.length);
      };
      let expanded=paths;
      let recursiveDirectory=false;
      if(flags.has('r')||flags.has('R')){expanded=[];for(const name of paths.length?paths:['.']){const p=this.resolve(name);if(this.isDir(p)){recursiveDirectory=true;expanded.push(...Object.keys(this.files).filter(x=>x.startsWith(p==='/'?'/':p+'/')).sort(cmp).map(x=>name.startsWith('/')?x:name.replace(/\/$/,'')+'/'+x.slice(p.length+1)));}else expanded.push(name);}}
      expanded=expanded.filter(path=>path==='-'||(!includes.length||includes.some(g=>globMatch(g,basename(path))))&&!excludes.some(g=>globMatch(g,basename(path)))&&!excludedDirs.some(g=>dirname(this.resolve(path)).split('/').some(d=>globMatch(g,d))));
      if(!expanded.length&&paths.length)return {stdout:'',stderr:'',code:1};
      const inputs=expanded.length?expanded.map(name=>({name})):[{name:'-',text:stdin}],withName=flags.has('H')||(!flags.has('h')&&(inputs.length>1||recursiveDirectory));let any=false,out=[],stderr='';
      for(const file of inputs){try{file.text=file.name==='-'?stdin:this.read(file.name,'grep');}catch(e){if(!(e instanceof ShellError))throw e;stderr+=e.message+'\n';continue;}const lines=asLines(file.text),chosen=[],hits=[];for(let i=0;i<lines.length;i++){hits[i]=matches(lines[i]);if(chosen.length<maxCount&&(flags.has('v')?!hits[i].length:hits[i].length)){chosen.push(i);any=true;}}
        if(flags.has('q'))continue;
        const prefix=withName?(file.name==='-'?'(standard input)':file.name)+':':'';
        if(flags.has('l')){if(chosen.length)out.push(file.name==='-'?'(standard input)':file.name);continue;}
        if(flags.has('L')){if(!chosen.length)out.push(file.name==='-'?'(standard input)':file.name);continue;}
        if(flags.has('c')){out.push(prefix+chosen.length);continue;}
        if(flags.has('o')){if(!flags.has('v'))for(const i of chosen){let end=-1;for(const h of hits[i])if(h.text&&h.index>=end){out.push(prefix+(flags.has('n')?(i+1)+':':'')+h.text);end=h.index+h.text.length;}}continue;}
        const selected=new Set(chosen),visible=new Set();for(const n of chosen)for(let i=Math.max(0,n-B);i<=Math.min(lines.length-1,n+A);i++)visible.add(i);
        let previous=-2;for(const i of [...visible].sort((a,b)=>a-b)){if((A||B)&&previous>=0&&i>previous+1)out.push('--');const sep=selected.has(i)?':':'-';out.push((withName?(file.name==='-'?'(standard input)':file.name)+sep:'')+(flags.has('n')?(i+1)+sep:'')+lines[i]);previous=i;}
      }
      return {stdout:lineOutput(out),stderr,code:flags.has('q')&&any?0:stderr?2:any?0:1};
    }
    sort(args,stdin) {
      const flags=new Set(),paths=[];let key=null,delim=null,after=false,keyNumeric=false,keyReverse=false;
      for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='k'||f==='t'){const t=takeValue(args,i,arg.slice(j+1),'sort','-'+f);i=t.next;if(f==='k'){if(key)usageError('sort','only one key range is supported');const m=t.value.match(/^(\d+)([nr]*)(?:,(\d+)([nr]*))?$/);if(!m||!+m[1]||(m[3]&&+m[3]<+m[1]))usageError('sort','key must be N or N,M with optional n/r suffixes');key=[+m[1],m[3]?+m[3]:Infinity];keyNumeric=(m[2]+(m[4]||'')).includes('n');keyReverse=(m[2]+(m[4]||'')).includes('r');}else{if(t.value.length!==1)usageError('sort','delimiter must be one character');delim=t.value;}break;}if(!'nru'.includes(f))usageError('sort','unsupported option -'+f);flags.add(f);}}else paths.push(arg);}
      const rows=this.inputs(paths,stdin,'sort').flatMap(f=>asLines(f.text));
      const getKey=line=>{if(!key)return line;const fields=delim===null?line.trim().split(/\s+/):line.split(delim);return fields.slice(key[0]-1,key[1]).join(delim===null?' ':delim);};
      const compareKey=(a,b)=>{a=getKey(a);b=getKey(b);if(flags.has('n')||keyNumeric){const n=s=>{const m=s.match(/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);return m?Number(m[1]):0;};return Math.sign(n(a)-n(b));}return cmp(a,b);};
      rows.sort((a,b)=>compareKey(a,b)*((flags.has('r')||keyReverse)?-1:1)||(flags.has('u')?0:cmp(a,b)*(flags.has('r')?-1:1)));
      return lineOutput(flags.has('u')?rows.filter((row,i)=>!i||compareKey(row,rows[i-1])!==0):rows);
    }
    uniq(args,stdin) {
      const {flags,rest}=simpleOptions(args,'cdu','uniq');if(rest.length>1)usageError('uniq','only one input file is supported; use > to save output');const rows=asLines(this.inputs(rest,stdin,'uniq')[0].text),groups=[];
      for(const row of rows){const last=groups[groups.length-1];if(last&&last.line===row)last.n++;else groups.push({line:row,n:1});}
      return lineOutput(groups.filter(g=>(!flags.has('d')||g.n>1)&&(!flags.has('u')||g.n===1)).map(g=>(flags.has('c')?String(g.n).padStart(7)+' ':'')+g.line));
    }
    cut(args,stdin) {
      let delimiter='\t',field=null,characters=null,suppress=false,after=false;const paths=[];
      for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if('dfc'.includes(f)){const t=takeValue(args,i,arg.slice(j+1),'cut','-'+f);i=t.next;if(f==='d')delimiter=t.value;else if(f==='f')field=t.value;else characters=t.value;break;}if(f!=='s')usageError('cut','unsupported option -'+f);suppress=true;}}else paths.push(arg);}
      if(delimiter.length!==1)usageError('cut','delimiter must be one character');if((field===null)===(characters===null))usageError('cut','choose either -f or -c');if(characters!==null&&(delimiter!=='\t'||suppress))usageError('cut','-d and -s require -f');const select=rangeSelector(field===null?characters:field,'cut');
      const out=[];for(const f of this.inputs(paths,stdin,'cut'))for(const line of asLines(f.text)){if(field!==null&&!line.includes(delimiter)){if(!suppress)out.push(line);continue;}out.push((field===null?Array.from(line):line.split(delimiter)).filter((_,i)=>select(i+1)).join(field===null?'':delimiter));}return lineOutput(out);
    }
    ends(cmd,args,stdin) {
      let count=10,after=false;const paths=[];for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){if(cmd==='tail'&&(arg==='-f'||arg==='--follow'||arg.startsWith('--follow=')))usageError(cmd,'logs are static snapshots; continuous follow is unavailable. Re-run tail to inspect the current file');let v;if(arg==='-n'){if(args[++i]===undefined)usageError(cmd,'-n requires a number');v=args[i];}else if(arg.startsWith('-n'))v=arg.slice(2);else if(/^-\d+$/.test(arg))v=arg.slice(1);else usageError(cmd,'unsupported option '+arg);if(!/^\d+$/.test(v)||+v>100000)usageError(cmd,'line count must be 0–100000');count=+v;}else paths.push(arg);}
      const inputs=this.inputs(paths,stdin,cmd);return inputs.map((f,i)=>{const chunks=lineChunks(f.text),rows=cmd==='head'?chunks.slice(0,count):count?chunks.slice(-count):[];return (inputs.length>1?(i?'\n':'')+'==> '+f.name+' <==\n':'')+rows.join('');}).join('');
    }
    wc(args,stdin) {
      const {flags,rest}=simpleOptions(args,'lwc','wc'),chosen=['l','w','c'].filter(f=>!flags.size||flags.has(f));const inputs=this.inputs(rest,stdin,'wc'),totals={l:0,w:0,c:0};const rows=inputs.map(f=>{const counts={l:(f.text.match(/\n/g)||[]).length,w:(f.text.match(/\S+/g)||[]).length,c:bytes(f.text)};for(const k of chosen)totals[k]+=counts[k];return chosen.map(k=>String(counts[k])).join(' ')+(rest.length?' '+f.name:'');});if(inputs.length>1)rows.push(chosen.map(k=>totals[k]).join(' ')+' total');return lineOutput(rows);
    }
    sed(args,stdin) {
      let quiet=false,extended=false,script=null,after=false;const paths=[];
      for(const arg of args){if(!after&&arg==='--'){after=true;continue;}if(script===null&&!after&&arg.startsWith('-')&&arg!=='-'){for(const f of arg.slice(1)){if(f==='n')quiet=true;else if(f==='E')extended=true;else usageError('sed','unsupported option -'+f);}continue;}if(script===null)script=arg;else paths.push(arg);}
      if(script===null)usageError('sed','missing script');const records=this.inputs(paths,stdin,'sed').flatMap(f=>lineChunks(f.text)).map(chunk=>({line:chunk.endsWith('\n')?chunk.slice(0,-1):chunk,ending:chunk.endsWith('\n')?'\n':''})),rows=records.map(r=>r.line);let match=script.match(/^(\d+|\$)(?:,(\d+|\$))?p$/),predicate;
      if(match){const start=match[1]==='$'?rows.length:+match[1],end=match[2]==='$'?rows.length:match[2]?+match[2]:start;if(start<1||end<start)usageError('sed','invalid line address');predicate=(_,i)=>i+1>=start&&i+1<=end;}
      else if(/^\/.*\/p$/.test(script)){const re=regex(script.slice(1,-2),extended);predicate=line=>re.test(line);}
      if(predicate){const out=[];rows.forEach((line,i)=>{const text=line+records[i].ending;if(!quiet)out.push(text);if(predicate(line,i))out.push(text);});return out.join('');}
      if(script[0]!=='s'||script.length<4)usageError('sed','unsupported script; use help sed');const delim=script[1];if(/[\\\n\w]/.test(delim))usageError('sed','use a punctuation substitution delimiter');let parts=[],piece='',i=2;
      for(;i<script.length;i++){const c=script[i];if(c==='\\'&&i+1<script.length){const n=script[++i];piece+=(n===delim?n:'\\'+n);continue;}if(c===delim){parts.push(piece);piece='';if(parts.length===2){i++;break;}}else piece+=c;}
      if(parts.length!==2)usageError('sed','unterminated substitution');const flags=script.slice(i);if(!/^[gpi]*$/.test(flags))usageError('sed','only g, p and i substitution flags are supported');const base=regex(parts[0],extended,flags.includes('i')),re=new RegExp(base.source,base.flags+(flags.includes('g')?'g':''));const replacement=parts[1];
      const out=[];for(const record of records){const line=record.line,changed=base.test(line),value=line.replace(re,(...args)=>{const full=args[0],groups=args.slice(1,-2);return replacement.replace(/\\([1-9&\\])|&/g,(m,g)=>g?g==='&'?'&':g==='\\'?'\\':groups[+g-1]||'':full);})+record.ending;if(!quiet)out.push(value);if(changed&&flags.includes('p'))out.push(value);}return out.join('');
    }
    find(args) {
      let path='.',type=null,name=null,i=0;if(args[0]&&!args[0].startsWith('-'))path=args[i++];
      for(;i<args.length;i++){if(args[i]==='-type'){type=args[++i];if(type!=='f'&&type!=='d')usageError('find','-type supports f or d');}else if(args[i]==='-name'){name=args[++i];if(name===undefined)usageError('find','-name requires a quoted pattern');}else usageError('find','unsupported predicate '+args[i]);}
      const start=this.resolve(path);if(!this.isFile(start)&&!this.isDir(start))fail('find: '+path+': No such file or directory',1);const matcher=name===null?null:new RegExp('^'+Array.from(name).map(c=>c==='*'?'.*':c==='?'?'.':escRE(c)).join('')+'$');
      return lineOutput(this.allPaths().filter(p=>(p===start||p.startsWith(start==='/'?'/':start+'/'))&&(!type||(type==='f'?this.isFile(p):this.isDir(p)))&&(!matcher||matcher.test(basename(p)))).map(p=>path.startsWith('/')?p:path==='.'?(p===this.cwd?'.':'./'+this.relative(p)):path.replace(/\/$/,'')+p.slice(start.length)));
    }
    awk(args,stdin) { return runAwk(this,args,stdin); }
  }
  LogLabShell.supportedCommands=COMMANDS.slice();

  function longOptions(args,flags,valued,cmd) {
    const out=[];let after=false;
    for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--'){after=true;out.push(arg);continue;}if(!after&&arg.startsWith('--')){const at=arg.indexOf('='),name=at<0?arg:arg.slice(0,at);if(Object.prototype.hasOwnProperty.call(flags,name)){if(at>=0)usageError(cmd,name+' does not accept a value');out.push('-'+flags[name]);}else if(Object.prototype.hasOwnProperty.call(valued,name)){const value=at>=0?arg.slice(at+1):args[++i];if(value===undefined)usageError(cmd,name+' requires a value');out.push(valued[name].startsWith('--')?valued[name]:'-'+valued[name],value);}else usageError(cmd,'unsupported option '+name);}else out.push(arg);}return out;
  }
  function globMatch(pattern,value,insensitive=false) {return new RegExp('^'+Array.from(pattern).map(c=>c==='*'?'.*':c==='?'?'.':escRE(c)).join('')+'$',insensitive?'i':'').test(value);}
  function parseValued(args,allowed,valued,cmd) {
    const flags=new Set(),values={},rest=[];let after=false;
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(valued.includes(f)){const t=takeValue(args,i,arg.slice(j+1),cmd,'-'+f);i=t.next;values[f]=t.value;break;}if(!allowed.includes(f))usageError(cmd,'unsupported option -'+f);flags.add(f);}}else rest.push(arg);}return {flags,values,rest};
  }
  function positive(value,cmd,name,zero=false) {if(!/^\d+$/.test(value)||+value<(zero?0:1)||+value>1000000)usageError(cmd,name+' must be '+(zero?'nonnegative':'positive')+' and at most 1000000');return +value;}
  function humanSize(n) {if(n<1024)return String(n);const units=['K','M','G'];let i=-1;do{n/=1024;i++;}while(n>=1024&&i<units.length-1);return n.toFixed(n<10?1:0)+units[i];}
  function runLs(shell,args) {
    let sort='name',after=false;const cleaned=[];for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--'){after=true;cleaned.push(arg);continue;}if(!after&&(arg==='--sort'||arg.startsWith('--sort='))){sort=arg==='--sort'?args[++i]:arg.slice(7);if(!['time','size','name'].includes(sort))usageError('ls','--sort supports time, size, or name');}else{if(!after&&/^-[^-]/.test(arg))for(const f of arg.slice(1))if(f==='t'||f==='S')sort=f==='t'?'time':'size';cleaned.push(arg);}}
    args=longOptions(cleaned,{'--all':'a','--directory':'d','--recursive':'R','--reverse':'r','--human-readable':'h'},{},'ls');
    const {flags,rest}=simpleOptions(args,'alhdtRSr','ls'),paths=rest.length?rest:['.'],sections=[],fileRows=[];
    const format=(p,name)=>{if(!flags.has('l'))return name;const dir=shell.isDir(p),size=dir?0:bytes(shell.files[p]),meta=shell.getMetadata(p);return modeText(meta.mode,dir)+' 1 '+meta.owner+' '+meta.group+' '+(flags.has('h')?humanSize(size):String(size)).padStart(7)+' '+lsTimestamp(meta.mtime)+' '+name;};
    const compare=(a,b)=>(sort==='time'?shell.getMetadata(b).mtime-shell.getMetadata(a).mtime:sort==='size'?(shell.isDir(b)?0:bytes(shell.files[b]))-(shell.isDir(a)?0:bytes(shell.files[a])):0)||cmp(basename(a),basename(b));
    const visit=(p,label,heading)=>{let children=shell.allPaths().filter(x=>x!==p&&dirname(x)===p).filter(x=>flags.has('a')||!basename(x).startsWith('.'));children.sort(compare);if(flags.has('r'))children.reverse();const rows=children.map(x=>format(x,basename(x)));if(flags.has('a'))rows.unshift(format(p,'.'),format(dirname(p),'..'));sections.push((heading?label+':\n':'')+rows.join('\n'));if(flags.has('R'))for(const child of children)if(shell.isDir(child))visit(child,label.replace(/\/$/,'')+'/'+basename(child),true);};
    for(const name of paths){const p=shell.resolve(name);if(shell.isFile(p)||flags.has('d')&&shell.isDir(p))fileRows.push({p,name});else if(!shell.isDir(p))fail('ls: '+name+': No such file or directory',1);}
    fileRows.sort((a,b)=>compare(a.p,b.p));if(flags.has('r'))fileRows.reverse();if(fileRows.length)sections.push(fileRows.map(f=>format(f.p,f.name)).join('\n'));
    for(const name of paths){const p=shell.resolve(name);if(!flags.has('d')&&shell.isDir(p))visit(p,name,paths.length>1||flags.has('R'));}
    return sections.join('\n\n')+(sections.some(Boolean)?'\n':'');
  }
  function runSort(shell,args,stdin) {
    args=longOptions(args,{'--numeric-sort':'n','--month-sort':'M','--reverse':'r','--unique':'u','--ignore-case':'f','--ignore-leading-blanks':'b','--stable':'s','--check':'c'},{'--key':'k','--field-separator':'t'},'sort');
    const flags=new Set(),keys=[],rest=[];let delim,after=false;
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='k'||f==='t'){const value=takeValue(args,i,arg.slice(j+1),'sort','-'+f);i=value.next;if(f==='t')delim=value.value;else{const m=value.value.match(/^(\d+)([nrfbM]*)(?:,(\d+)([nrfbM]*))?$/);if(!m||!+m[1]||m[3]&&+m[3]<+m[1])usageError('sort','key must be N[,M] with optional n/r/f/b/M suffixes');keys.push({start:+m[1],end:m[3]?+m[3]:Infinity,options:m[2]+(m[4]||'')});}break;}if(!'nrufbscM'.includes(f))usageError('sort','unsupported option -'+f);flags.add(f);}}else rest.push(arg);}
    if(delim!==undefined&&delim.length!==1)usageError('sort','delimiter must be one character');
    const globalOptions=[...flags].join(''),ranges=keys.length?keys:[{start:null,options:''}];
    for(const key of ranges){key.options=key.options||globalOptions;if(key.options.includes('n')&&key.options.includes('M'))usageError('sort','numeric and month ordering cannot be combined for one key');}
    const rows=shell.inputs(rest,stdin,'sort').flatMap(f=>asLines(f.text));
    const get=(line,key)=>{if(key.start!==null){const fields=delim===undefined?line.trim().split(/\s+/):line.split(delim);line=fields.slice(key.start-1,key.end).join(delim===undefined?' ':delim);}if(key.options.includes('b'))line=line.replace(/^\s+/,'');if(key.options.includes('f'))line=line.toUpperCase();return line;};
    const numeric=s=>{const m=s.match(/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/);return m?+m[1]:0;},months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],month=s=>months.indexOf(s.trimStart().slice(0,3).toUpperCase());
    const compareKey=(a,b)=>{for(const key of ranges){const x=get(a,key),y=get(b,key),order=key.options.includes('n')?Math.sign(numeric(x)-numeric(y)):key.options.includes('M')?Math.sign(month(x)-month(y)):cmp(x,y);if(order)return order*(key.options.includes('r')?-1:1);}return 0;};
    const compare=(a,b)=>compareKey(a,b)||((flags.has('s')||flags.has('u'))?0:cmp(a,b)*(flags.has('r')?-1:1));
    if(flags.has('c')){for(let i=1;i<rows.length;i++)if(compare(rows[i-1],rows[i])>0||flags.has('u')&&compareKey(rows[i-1],rows[i])===0)return {stdout:'',stderr:'sort: disorder at line '+(i+1)+': '+rows[i]+'\n',code:1};return {stdout:'',stderr:'',code:0};}
    rows.sort(compare);return {stdout:lineOutput(flags.has('u')?rows.filter((row,i)=>!i||compareKey(rows[i-1],row)!==0):rows),stderr:'',code:0};
  }
  function runUniq(shell,args,stdin) {
    args=longOptions(args,{'--count':'c','--repeated':'d','--unique':'u','--ignore-case':'i'},{'--skip-fields':'f','--skip-chars':'s'},'uniq');const {flags,values,rest}=parseValued(args,'cdui','fs','uniq');if(rest.length>1)usageError('uniq','only one input file is supported');const skipFields=values.f===undefined?0:positive(values.f,'uniq','field skip',true),skipChars=values.s===undefined?0:positive(values.s,'uniq','character skip',true);
    const key=line=>{for(let n=0;n<skipFields;n++)line=line.replace(/^\s*\S+/,'');line=Array.from(line).slice(skipChars).join('');return flags.has('i')?line.toLowerCase():line;},groups=[];
    for(const line of asLines(shell.inputs(rest,stdin,'uniq')[0].text)){const k=key(line),last=groups[groups.length-1];if(last&&last.key===k)last.n++;else groups.push({line,key:k,n:1});}return lineOutput(groups.filter(g=>(!flags.has('d')||g.n>1)&&(!flags.has('u')||g.n===1)).map(g=>(flags.has('c')?String(g.n).padStart(7)+' ':'')+g.line));
  }
  function runCut(shell,args,stdin) {
    let complement=false,output=null;const cleaned=[];let after=false;
    for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--'){after=true;cleaned.push(arg);continue;}if(!after&&arg==='--complement'){complement=true;continue;}if(!after&&(arg==='--output-delimiter'||arg.startsWith('--output-delimiter='))){output=arg.includes('=')?arg.slice(arg.indexOf('=')+1):args[++i];if(output===undefined)usageError('cut','--output-delimiter requires text');continue;}cleaned.push(arg);}
    const {flags,values,rest}=parseValued(cleaned,'s','dfc','cut'),field=values.f,characters=values.c,delimiter=values.d===undefined?'\t':values.d;if((field===undefined)===(characters===undefined))usageError('cut','choose either -f or -c');if(delimiter.length!==1)usageError('cut','delimiter must be one character');if(characters!==undefined&&(values.d!==undefined||flags.has('s')))usageError('cut','-d and -s require -f');const chosen=rangeSelector(field===undefined?characters:field,'cut'),select=i=>chosen(i)!==complement,out=[];
    for(const f of shell.inputs(rest,stdin,'cut'))for(const line of asLines(f.text)){if(field!==undefined&&!line.includes(delimiter)){if(!flags.has('s'))out.push(line);continue;}const items=field===undefined?Array.from(line):line.split(delimiter);if(field!==undefined)out.push(items.filter((_,i)=>select(i+1)).join(output===null?delimiter:output));else{let value='',previous=-2;items.forEach((v,i)=>{if(select(i+1)){if(output!==null&&previous>=0&&i>previous+1)value+=output;value+=v;previous=i;}});out.push(value);}}return lineOutput(out);
  }
  function runEnds(shell,cmd,args,stdin) {
    const end=args.indexOf('--');if(args.some((a,i)=>(end<0||i<end)&&(a==='--follow'||a.startsWith('--follow='))))usageError(cmd,'logs are static snapshots; continuous follow is unavailable. Re-run tail to inspect the current file');
    args=longOptions(args,{'--quiet':'q','--silent':'q','--verbose':'v'},{'--lines':'n','--bytes':'c'},cmd);const paths=[];let count=10,mode='n',fromStart=false,excludeEnd=false,quiet=false,verbose=false,after=false;
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&(arg==='-f'||arg==='--follow'))usageError(cmd,'logs are static snapshots; continuous follow is unavailable. Re-run tail to inspect the current file');if(!after&&arg==='-q'){quiet=true;continue;}if(!after&&arg==='-v'){verbose=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){let value;if(arg[1]==='n'||arg[1]==='c'){mode=arg[1];const t=takeValue(args,i,arg.slice(2),cmd,'-'+mode);i=t.next;value=t.value;}else if(/^-\d+$/.test(arg))value=arg.slice(1);else usageError(cmd,'unsupported option '+arg);fromStart=value.startsWith('+');excludeEnd=value.startsWith('-');if(fromStart&&cmd==='head')usageError(cmd,'+N is supported only by tail');if(excludeEnd&&cmd==='tail')excludeEnd=false;count=positive(value.replace(/^[+-]/,''),cmd,'count',true);}else paths.push(arg);}
    const inputs=shell.inputs(paths,stdin,cmd),headings=!quiet&&(verbose||inputs.length>1);
    return inputs.map((f,index)=>{let text;if(mode==='n'){const chunks=lineChunks(f.text);text=(cmd==='head'?(excludeEnd?chunks.slice(0,Math.max(0,chunks.length-count)):chunks.slice(0,count)):fromStart?chunks.slice(Math.max(0,count-1)):count?chunks.slice(-count):[]).join('');}else{const data=new TextEncoder().encode(f.text),part=cmd==='head'?(excludeEnd?data.slice(0,Math.max(0,data.length-count)):data.slice(0,count)):fromStart?data.slice(Math.max(0,count-1)):count?data.slice(-count):data.slice(0,0);text=new TextDecoder().decode(part);}return (headings?(index?'\n':'')+'==> '+f.name+' <==\n':'')+text;}).join('');
  }
  function runWc(shell,args,stdin) {
    args=longOptions(args,{'--lines':'l','--words':'w','--bytes':'c','--chars':'m','--max-line-length':'L'},{},'wc');const {flags,rest}=simpleOptions(args,'lwmcL','wc'),chosen=['l','w','m','c','L'].filter(f=>flags.size?flags.has(f):'lwc'.includes(f)),inputs=shell.inputs(rest,stdin,'wc'),total={l:0,w:0,m:0,c:0,L:0};
    const rows=inputs.map(f=>{const counts={l:(f.text.match(/\n/g)||[]).length,w:(f.text.match(/\S+/g)||[]).length,m:Array.from(f.text).length,c:bytes(f.text),L:asLines(f.text).reduce((max,line)=>{let col=0;for(const c of line)col=c==='\t'?col+8-col%8:col+displayWidth(c);return Math.max(max,col);},0)};for(const k of chosen)total[k]=k==='L'?Math.max(total[k],counts[k]):total[k]+counts[k];return chosen.map(k=>counts[k]).join(' ')+(rest.length?' '+f.name:'');});if(inputs.length>1)rows.push(chosen.map(k=>total[k]).join(' ')+' total');return lineOutput(rows);
  }
  function runFind(shell,args) {
    let path='.',type=null,min=0,max=Infinity,i=0;const predicates=[];if(args[0]&&!args[0].startsWith('-'))path=args[i++];
    for(;i<args.length;i++){const flag=args[i],value=args[++i];if(value===undefined)usageError('find',flag+' requires a value');if(flag==='-type'){if(value!=='f'&&value!=='d')usageError('find','-type supports f or d');type=value;}else if(flag==='-maxdepth')max=positive(value,'find','maximum depth',true);else if(flag==='-mindepth')min=positive(value,'find','minimum depth',true);else if(['-name','-iname','-path','-ipath'].includes(flag))predicates.push({flag,value});else usageError('find','unsupported predicate '+flag);}
    const start=shell.resolve(path);if(!shell.isFile(start)&&!shell.isDir(start))fail('find: '+path+': No such file or directory',1);const label=p=>path.startsWith('/')?p:path==='.'?(p===shell.cwd?'.':'./'+shell.relative(p)):path.replace(/\/$/,'')+p.slice(start.length);
    return lineOutput(shell.allPaths().filter(p=>{if(p!==start&&!p.startsWith(start==='/'?'/':start+'/'))return false;const depth=p===start?0:p.slice(start==='/'?1:start.length+1).split('/').length;return depth>=min&&depth<=max&&(!type||(type==='f'?shell.isFile(p):shell.isDir(p)))&&predicates.every(pred=>globMatch(pred.value,pred.flag.includes('path')?label(p):basename(p),pred.flag.startsWith('-i')));}).map(label));
  }
  function sedScripts(source) {
    const out=[];let at=0;
    while(at<source.length){while(/[\s;]/.test(source[at]||'')&&at<source.length)at++;if(at>=source.length)break;const start=at;let address=true,slashes=0,delimiter=null;
      for(;at<source.length;at++){const c=source[at];if(c==='\\'){at++;continue;}if(delimiter){if(c===delimiter){slashes--;if(!slashes)delimiter=null;}continue;}if(address&&c==='/'){delimiter='/';slashes=1;continue;}if(address&&(c==='s'||c==='p'||c==='d')){address=false;if(c==='s'){delimiter=source[++at];if(!delimiter||/[\\\n\w\s]/.test(delimiter))usageError('sed','invalid substitution delimiter');slashes=2;}continue;}if(c===';'||c==='\n')break;}
      if(delimiter)usageError('sed','unterminated regular expression or substitution');out.push(source.slice(start,at).trim());at++;
    }return out;
  }
  function compileSed(source,extended) {
    let at=0;
    const address=()=>{while(/\s/.test(source[at]||'')&&at<source.length)at++;if(source[at]==='/'){let pattern='',closed=false;at++;for(;at<source.length;at++){const c=source[at];if(c==='\\'&&at+1<source.length){pattern+=c+source[++at];continue;}if(c==='/'){at++;closed=true;break;}pattern+=c;}if(!closed)usageError('sed','unterminated address');const re=regex(pattern,extended),test=line=>re.test(line);test.regex=true;return test;}const m=source.slice(at).match(/^(\d+|\$)/);if(!m)return null;at+=m[0].length;if(m[0]==='$')return (_,i,n)=>i===n-1;const number=+m[0];if(!number)usageError('sed','line addresses start at 1');const test=(_,i)=>i+1===number;test.number=number;return test;};
    const first=address();let last=null;if(source[at]===','){at++;last=address();if(!last)usageError('sed','missing range end');}while(/\s/.test(source[at]||'')&&at<source.length)at++;const action=source[at++];let substitute=null;
    if(action==='s'){const delim=source[at++];if(!delim||/[\\\n\w\s]/.test(delim))usageError('sed','invalid substitution delimiter');const pieces=[];let piece='';for(;at<source.length;at++){const c=source[at];if(c==='\\'&&at+1<source.length){const next=source[++at];piece+=next===delim?next:'\\'+next;continue;}if(c===delim){pieces.push(piece);piece='';if(pieces.length===2){at++;break;}}else piece+=c;}if(pieces.length!==2)usageError('sed','unterminated substitution');const flags=source.slice(at).trim();if(!/^[gpi]*$/.test(flags))usageError('sed','only g/p/i substitution flags are supported');const base=regex(pieces[0],extended,flags.includes('i')),re=new RegExp(base.source,base.flags+(flags.includes('g')?'g':''));substitute={base,re,replacement:pieces[1],print:flags.includes('p')};at=source.length;
    }else if(action!=='p'&&action!=='d')usageError('sed','unsupported action '+(action||'(missing)'));
    if(source.slice(at).trim())usageError('sed','unexpected text after command');return {first,last,action,substitute,active:false};
  }
  function runSed(shell,args,stdin) {
    args=longOptions(args,{'--quiet':'n','--silent':'n','--regexp-extended':'E'},{'--expression':'e'},'sed');let quiet=false,extended=false,inplace=false,suffix='',after=false;const scripts=[],paths=[];
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='n')quiet=true;else if(f==='E')extended=true;else if(f==='i'){inplace=true;suffix=arg.slice(j+1);break;}else if(f==='e'){const t=takeValue(args,i,arg.slice(j+1),'sed','-e');scripts.push(t.value);i=t.next;break;}else usageError('sed','unsupported option -'+f);}continue;}paths.push(arg);}
    if(!scripts.length){if(!paths.length)usageError('sed','missing script');scripts.push(paths.shift());}const commands=scripts.flatMap(sedScripts).map(s=>compileSed(s,extended));if(!commands.length)usageError('sed','empty scripts are unsupported');if(inplace&&(!paths.length||paths.includes('-')))usageError('sed','-i requires named virtual files');
    const apply=(text,provided)=>{for(const c of commands)c.active=false;const records=provided||lineChunks(text),out=[];for(let i=0;i<records.length;i++){const ending=records[i].endsWith('\n')?'\n':'',original=ending?records[i].slice(0,-1):records[i];let line=original,deleted=false;
        for(const command of commands){let selected=!command.first;if(command.first){if(command.last){const alreadyActive=command.active;if(!command.active&&command.first(line,i,records.length))command.active=true;selected=command.active;if(selected&&(alreadyActive||!command.last.regex)&&(command.last.number!==undefined?i+1>=command.last.number:command.last(line,i,records.length)))command.active=false;}else selected=command.first(line,i,records.length);}if(!selected)continue;
          if(command.action==='p')out.push(line+ending);else if(command.action==='d'){deleted=true;break;}else{const s=command.substitute,changed=s.base.test(line);line=line.replace(s.re,(...a)=>{const full=a[0],groups=a.slice(1,-2);return s.replacement.replace(/\\([1-9&\\])|&/g,(m,g)=>g?g==='&'?'&':g==='\\'?'\\':groups[+g-1]||'':full);});if(changed&&s.print)out.push(line+ending);}}
        if(!quiet&&!deleted)out.push(line+ending);
      }return out.join('');};
    const inputs=shell.inputs(paths,stdin,'sed');if(inplace){for(const input of inputs){shell.checkParentWrite(input.name,'sed');const output=apply(input.text);if(suffix)shell.write(input.name+suffix,input.text);shell.write(input.name,output);}return '';}return apply('',inputs.flatMap(f=>lineChunks(f.text)));
  }
  function decodeTextEscapes(source,cmd) {
    let out='';for(let i=0;i<source.length;i++){if(source[i]!=='\\'){out+=source[i];continue;}const c=source[++i];if(c===undefined)usageError(cmd,'unfinished backslash escape');const map={n:'\n',r:'\r',t:'\t',a:'\x07',b:'\b',f:'\f',v:'\v','\\':'\\'};if(Object.prototype.hasOwnProperty.call(map,c)){out+=map[c];continue;}if(c==='x'){const m=source.slice(i+1).match(/^[0-9a-fA-F]{1,2}/);if(!m)usageError(cmd,'\\x requires hexadecimal digits');out+=String.fromCharCode(parseInt(m[0],16));i+=m[0].length;continue;}if(/[0-7]/.test(c)){const m=source.slice(i).match(/^[0-7]{1,3}/);out+=String.fromCharCode(parseInt(m[0],8));i+=m[0].length-1;continue;}usageError(cmd,'unsupported escape \\'+c);}return out;
  }
  function runPrintf(args) {
    if(args[0]==='--')args=args.slice(1);if(!args.length)usageError('printf','missing format');const format=decodeTextEscapes(args[0],'printf'),values=args.slice(1),tokens=[];let at=0;
    for(let i=0;i<format.length;){if(format[i]!=='%'){let end=format.indexOf('%',i);if(end<0)end=format.length;tokens.push({text:format.slice(i,end)});i=end;continue;}const m=format.slice(i).match(/^%([-0]*)(\d+)?(?:\.(\d+))?([%sdifuoxXfcbeEgG])/);if(!m)usageError('printf','unsupported format conversion near '+format.slice(i,i+12));const width=m[2]?+m[2]:0,precision=m[3]===undefined?null:+m[3];if(width>4096||precision!==null&&precision>100)usageError('printf','format width/precision is too large');tokens.push({flags:m[1],width,precision,type:m[4]});i+=m[0].length;}
    let out='';const consumes=tokens.some(t=>t.type&&t.type!=='%');do{for(const token of tokens){if(token.text!==undefined){out+=token.text;continue;}const t=token.type;if(t==='%'){out+='%';continue;}const value=values[at++]===undefined?'':values[at-1];let rendered;
        if(t==='s')rendered=token.precision===null?value:Array.from(value).slice(0,token.precision).join('');else if(t==='b')rendered=decodeTextEscapes(value,'printf');else if(t==='c')rendered=Array.from(value)[0]||'\0';else{let n=value===''?0:value[0]==="'"?value.codePointAt(1)||0:Number(value);if(!Number.isFinite(n))usageError('printf','invalid number '+value);if('diuoxX'.includes(t)){n=Math.trunc(n);if(!Number.isSafeInteger(n)||'uoxX'.includes(t)&&n<0)usageError('printf','integer is outside the supported safe range');rendered=t==='o'?n.toString(8):t==='x'||t==='X'?n.toString(16):String(n);if(t==='X')rendered=rendered.toUpperCase();if(token.precision!==null){const negative=rendered.startsWith('-');rendered=(negative?rendered.slice(1):rendered).padStart(token.precision,'0');if(token.precision===0&&n===0)rendered='';if(negative)rendered='-'+rendered;}}else if(t==='f')rendered=n.toFixed(token.precision===null?6:token.precision);else if(t==='e'||t==='E')rendered=n.toExponential(token.precision===null?6:token.precision);else rendered=Number(n.toPrecision(token.precision===null?6:Math.max(1,token.precision))).toString();if(t==='E'||t==='G')rendered=rendered.toUpperCase();}
        const padding=' '.repeat(Math.max(0,token.width-Array.from(rendered).length));if(token.flags.includes('-'))rendered+=padding;else if(token.flags.includes('0')&&t!=='s'&&t!=='b'&&t!=='c'){const zeros='0'.repeat(padding.length);rendered=rendered.startsWith('-')?'-'+zeros+rendered.slice(1):zeros+rendered;}else rendered=padding+rendered;out+=rendered;
      }if(out.length>MAX_OUTPUT)fail('printf: output exceeds the browser text limit',1);}while(consumes&&at<values.length);return out;
  }
  function runPaste(shell,args,stdin) {
    const {flags,values,rest}=parseValued(args,'s','d','paste'),delimiter=values.d===undefined?'\t':decodeTextEscapes(values.d,'paste'),delimiters=Array.from(delimiter).map(c=>c==='\0'?'':c);if(!delimiters.length)delimiters.push('');const inputs=shell.inputs(rest,stdin,'paste').map(f=>asLines(f.text));
    if(flags.has('s'))return lineOutput(inputs.map(rows=>rows.map((row,i)=>row+(i<rows.length-1?delimiters[i%delimiters.length]:'')).join('')));const count=Math.max(0,...inputs.map(rows=>rows.length));return lineOutput(Array.from({length:count},(_,i)=>inputs.map((rows,j)=>(rows[i]||'')+(j<inputs.length-1?delimiters[j%delimiters.length]:'')).join('')));
  }
  function sortedRows(shell,path,stdin,cmd,getKey=x=>x) {const rows=asLines(path==='-'?stdin:shell.read(path,cmd));for(let i=1;i<rows.length;i++)if(cmp(getKey(rows[i-1]),getKey(rows[i]))>0)usageError(cmd,'input '+path+' is not sorted; use sort first');return rows;}
  function runComm(shell,args,stdin) {
    const {flags,rest}=simpleOptions(args,'123','comm');if(rest.length!==2)usageError('comm','exactly two sorted files are required');const a=sortedRows(shell,rest[0],stdin,'comm'),b=sortedRows(shell,rest[1],stdin,'comm'),out=[];let i=0,j=0;const emit=(column,line)=>{if(flags.has(String(column)))return;let tabs=0;for(let c=1;c<column;c++)if(!flags.has(String(c)))tabs++;out.push('\t'.repeat(tabs)+line);};
    while(i<a.length||j<b.length){if(j===b.length||i<a.length&&cmp(a[i],b[j])<0)emit(1,a[i++]);else if(i===a.length||cmp(a[i],b[j])>0)emit(2,b[j++]);else{emit(3,a[i]);i++;j++;}}return lineOutput(out);
  }
  function runJoin(shell,args,stdin) {
    const include=new Set(),only=new Set(),cleaned=[];let after=false;for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--'){after=true;cleaned.push(arg);continue;}if(!after&&/^-[av]/.test(arg)){const t=takeValue(args,i,arg.slice(2),'join',arg.slice(0,2));i=t.next;if(!['1','2'].includes(t.value))usageError('join','-a/-v requires 1 or 2');(arg[1]==='a'?include:only).add(t.value);}else cleaned.push(arg);}
    const {values,rest}=parseValued(cleaned,'','12teo','join');if(rest.length!==2)usageError('join','exactly two sorted files are required');const field1=values['1']===undefined?1:positive(values['1'],'join','field'),field2=values['2']===undefined?1:positive(values['2'],'join','field'),delimiter=values.t;if(delimiter!==undefined&&delimiter.length!==1)usageError('join','delimiter must be one character');const split=line=>delimiter===undefined?line.trim().split(/\s+/):line.split(delimiter),key=(line,n)=>split(line)[n-1]||'',a=sortedRows(shell,rest[0],stdin,'join',l=>key(l,field1)).map(split),b=sortedRows(shell,rest[1],stdin,'join',l=>key(l,field2)).map(split),out=[],output=values.o===undefined?null:values.o.split(/[ ,]+/).map(s=>{if(s==='0')return [0,0];const m=s.match(/^([12])\.(\d+)$/);if(!m||!+m[2])usageError('join','-o uses 0, 1.N, and 2.N fields');return [+m[1],+m[2]-1];});
    const emit=(left,right,k)=>{const cells=output?output.map(([source,n])=>source===0?k:(source===1?left:right)?.[n]||values.e||''):[k,...(left?left.filter((_,n)=>n!==field1-1):[]),...(right?right.filter((_,n)=>n!==field2-1):[])];out.push(cells.join(delimiter===undefined?' ':delimiter));};let i=0,j=0;
    while(i<a.length||j<b.length){const x=i<a.length?a[i][field1-1]||'':null,y=j<b.length?b[j][field2-1]||'':null;if(j===b.length||i<a.length&&cmp(x,y)<0){if(include.has('1')||only.has('1'))emit(a[i],null,x);i++;}else if(i===a.length||cmp(x,y)>0){if(include.has('2')||only.has('2'))emit(null,b[j],y);j++;}else{let endA=i+1,endB=j+1;while(endA<a.length&&(a[endA][field1-1]||'')===x)endA++;while(endB<b.length&&(b[endB][field2-1]||'')===y)endB++;if(!only.size){if((endA-i)*(endB-j)>100000)usageError('join','duplicate-key expansion exceeds the browser limit');for(let p=i;p<endA;p++)for(let q=j;q<endB;q++)emit(a[p],b[q],x);}i=endA;j=endB;}}
    return lineOutput(out);
  }
  function xargsWords(text) {const words=[];let word='',started=false,quote=null;for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c===quote)quote=null;else word+=c;continue;}if(c==='"'||c==="'"){quote=c;started=true;continue;}if(c==='\\'){if(i+1===text.length)usageError('xargs','unfinished input escape');word+=text[++i];started=true;continue;}if(/\s/.test(c)){if(started){words.push(word);word='';started=false;}}else{word+=c;started=true;}}if(quote)usageError('xargs','unclosed input quote');if(started)words.push(word);return words;}
  function runXargs(shell,args,stdin) {
    let zero=false,noEmpty=false,delimiter=null,number=null,replace=null,at=0;
    for(;at<args.length;at++){const arg=args[at];if(arg==='--'){at++;break;}if(!arg.startsWith('-')||arg==='-')break;for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='0')zero=true;else if(f==='r')noEmpty=true;else if('dnI'.includes(f)){const t=takeValue(args,at,arg.slice(j+1),'xargs','-'+f);at=t.next;if(f==='d'){delimiter=decodeTextEscapes(t.value,'xargs');if(Array.from(delimiter).length!==1)usageError('xargs','delimiter must be one character');}else if(f==='n')number=positive(t.value,'xargs','batch size');else replace=t.value;break;}else usageError('xargs','unsupported option -'+f);}}
    if(zero&&delimiter!==null||replace!==null&&(zero||delimiter!==null||number!==null))usageError('xargs','-0/-d/-I/-n combination is unsupported');if(replace==='')usageError('xargs','replacement token must not be empty');const command=args[at]||'echo',fixed=args.slice(at+1);if(!COMMANDS.includes(command)||['xargs','vi','view','sl'].includes(command))usageError('xargs','only existing virtual commands may run; '+command+' is unsupported');
    let items=replace!==null?asLines(stdin).filter(s=>s.trim()!==''):zero||delimiter!==null?stdin.split(zero?'\0':delimiter):xargsWords(stdin);if((zero||delimiter!==null)&&items[items.length-1]==='')items.pop();if(!items.length&&noEmpty)return {stdout:'',stderr:'',code:0};const size=replace!==null?1:number||Math.max(1,items.length),batches=[];for(let i=0;i<items.length;i+=size)batches.push(items.slice(i,i+size));if(!batches.length)batches.push([]);if(batches.length>256)usageError('xargs','at most 256 batches may run');let stdout='',stderr='',code=0;
    for(const batch of batches){const argv=replace!==null?fixed.map(arg=>arg.split(replace).join(batch[0]||'')):[...fixed,...batch];let result;try{result=shell.execute(command,argv,'',{hasStdin:false});}catch(e){if(!(e instanceof ShellError))throw e;result={stdout:'',stderr:e.message+'\n',code:e.code};}stdout+=result.stdout||'';stderr+=result.stderr||'';if(result.code)code=123;if(stdout.length>MAX_OUTPUT)usageError('xargs','combined output exceeds the browser limit');}return {stdout,stderr,code};
  }
  function runStrings(shell,args,stdin) {
    const {values,rest}=parseValued(args,'a','nt','strings'),minimum=values.n===undefined?4:positive(values.n,'strings','minimum length');if(values.t!==undefined&&!['d','o','x'].includes(values.t))usageError('strings','offset radix must be d, o, or x');const out=[];
    for(const input of shell.inputs(rest,stdin,'strings')){const re=new RegExp('[\\x20-\\x7e\\t]{'+minimum+',}','g');let match;while((match=re.exec(input.text))!==null){let prefix='';if(values.t!==undefined)prefix=bytes(input.text.slice(0,match.index)).toString(values.t==='d'?10:values.t==='o'?8:16).padStart(7)+' ';out.push(prefix+match[0]);}}return lineOutput(out);
  }
  function pathBase(path) {path=String(path).replace(/\/+$/,'');if(!path)return '/';return path.slice(path.lastIndexOf('/')+1);}
  function pathDir(path) {path=String(path).replace(/\/+$/,'');if(!path)return '/';const at=path.lastIndexOf('/');if(at<0)return '.';return path.slice(0,at).replace(/\/+$/,'')||'/';}
  function runPaths(shell,cmd,args) {
    if(cmd==='basename'){const {flags,values,rest}=parseValued(args,'a','s',cmd);if(!rest.length)usageError(cmd,'missing path');let suffix=values.s,names=rest;if(!flags.has('a')&&values.s===undefined){if(rest.length>2)usageError(cmd,'too many operands; use -a for multiple paths');names=[rest[0]];suffix=rest[1];}return lineOutput(names.map(path=>{let name=pathBase(path);if(suffix&&name!==suffix&&name.endsWith(suffix))name=name.slice(0,-suffix.length);return name;}));}
    if(cmd==='dirname'){const {rest}=simpleOptions(args,'',cmd);if(!rest.length)usageError(cmd,'missing path');return lineOutput(rest.map(pathDir));}
    const {flags,rest}=simpleOptions(args,'me',cmd);if(!rest.length)usageError(cmd,'missing path');if(flags.has('m')&&flags.has('e'))usageError(cmd,'choose -m or -e');return lineOutput(rest.map(path=>{const p=shell.resolve(path);if(flags.has('e')&&!shell.isFile(p)&&!shell.isDir(p)||!flags.has('m')&&!shell.isDir(dirname(p)))fail('realpath: '+path+': No such file or directory',1);return p;}));
  }
  function runMetadata(shell,cmd,args) {
    if(cmd==='file'){const {flags,rest}=simpleOptions(args,'bi',cmd);if(!rest.length)usageError(cmd,'missing path');return lineOutput(rest.map(path=>{const p=shell.resolve(path);let description;if(shell.isDir(p))description=flags.has('i')?'inode/directory; charset=binary':'directory';else if(!shell.isFile(p))fail('file: '+path+': No such file or directory',1);else if(shell.getMetadata(p).compressed){shell.checkRead(p,cmd);description=flags.has('i')?'application/gzip; charset=binary (simulated fixture)':'gzip compressed data (simulated fixture; decompressed text backing)';}else{shell.checkRead(p,cmd);const text=shell.files[p],ascii=/^[\x00-\x7f]*$/.test(text),binary=/[\x00-\x08\x0e-\x1f]/.test(text);if(flags.has('i'))description=(binary?'application/octet-stream':text.trim()&&(()=>{try{JSON.parse(text);return true;}catch(_){return false;}})()?'application/json':'text/plain')+'; charset='+(binary?'binary':ascii?'us-ascii':'utf-8');else if(!text)description='empty';else if(binary)description='data';else{let json=false,jsonl=false;try{JSON.parse(text);json=true;}catch(_){try{const rows=asLines(text).filter(s=>s.trim());if(rows.length>1){rows.forEach(s=>JSON.parse(s));jsonl=true;}}catch(_){}}description=json?'JSON text data':jsonl?'JSON Lines text data':ascii?'ASCII text':'UTF-8 Unicode text';}}return (flags.has('b')?'':path+': ')+description;}));}
    if(cmd==='stat'){const {values,rest}=parseValued(args,'','c',cmd);if(!rest.length)usageError(cmd,'missing path');return lineOutput(rest.map(path=>{const p=shell.resolve(path),dir=shell.isDir(p);if(!dir&&!shell.isFile(p))fail('stat: '+path+': No such file or directory',1);const meta=shell.getMetadata(p),data={n:path,s:String(dir?0:bytes(shell.files[p])),F:dir?'directory':'regular file',a:meta.mode.toString(8),A:modeText(meta.mode,dir),U:meta.owner,G:meta.group,y:new Date(meta.mtime).toISOString().replace('T',' ').replace('Z',' +0000'),Y:String(Math.floor(meta.mtime/1000))};if(values.c!==undefined)return values.c.replace(/%(%|[A-Za-z])/g,(_,key)=>{if(key==='%')return '%';if(!Object.prototype.hasOwnProperty.call(data,key))usageError(cmd,'unsupported format %'+key);return data[key];});return '  File: '+path+'\n  Size: '+data.s+' bytes\n  Type: '+data.F+'\n  Mode: '+data.a+' ('+data.A+', virtual)\n Owner: '+data.U+' '+data.G+'\nModify: '+data.y;}));}
    let depth=Infinity;const cleaned=[];let after=false;for(let i=0;i<args.length;i++){const arg=args[i];if(arg==='--'){after=true;cleaned.push(arg);continue;}if(!after&&(arg==='--max-depth'||arg.startsWith('--max-depth='))){const value=arg.includes('=')?arg.slice(arg.indexOf('=')+1):args[++i];depth=positive(value,'du','maximum depth',true);}else cleaned.push(arg);}const {flags,rest}=simpleOptions(cleaned,'ashb',cmd),paths=rest.length?rest:['.'],out=[];if(flags.has('b')&&flags.has('h'))usageError(cmd,'choose -b or -h');const logical=p=>shell.isFile(p)?bytes(shell.files[p]):Object.entries(shell.files).reduce((n,[file,text])=>n+(file.startsWith(p==='/'?'/':p+'/')?bytes(text):0),0),show=n=>flags.has('b')?String(n):flags.has('h')?humanSize(n):String(Math.ceil(n/1024));
    for(const path of paths){const start=shell.resolve(path);if(!shell.isFile(start)&&!shell.isDir(start))fail('du: '+path+': No such file or directory',1);if(flags.has('s')||shell.isFile(start)){out.push(show(logical(start))+'\t'+path);continue;}const all=shell.allPaths().filter(p=>p===start||p.startsWith(start==='/'?'/':start+'/')).filter(p=>flags.has('a')||shell.isDir(p)).filter(p=>(p===start?0:p.slice(start==='/'?1:start.length+1).split('/').length)<=depth).sort((a,b)=>b.split('/').length-a.split('/').length||cmp(a,b));for(const p of all)out.push(show(logical(p))+'\t'+(p===start?path:path.replace(/\/$/,'')+p.slice(start.length)));}return lineOutput(out);
  }
  function runDate(args) {
    args=longOptions(args,{'--utc':'u','--universal':'u'},{'--date':'d'},'date');const {flags,values,rest}=parseValued(args,'u','d','date');if(rest.length>1||rest.length&&rest[0][0]!=='+')usageError('date','use one +format operand');let date=new Date();if(values.d!==undefined){const value=values.d;if(/^@-?\d+(?:\.\d+)?$/.test(value))date=new Date(+value.slice(1)*1000);else{let normalized=value.replace(/ UTC$/,'Z').replace(' ','T');if(/^\d{4}-\d{2}-\d{2}$/.test(normalized))normalized+='T00:00:00Z';if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized))usageError('date','-d accepts an ISO date with timezone, YYYY-MM-DD, or @epoch; relative dates are unsupported');const y=+normalized.slice(0,4),m=+normalized.slice(5,7),d=+normalized.slice(8,10);if(m<1||m>12||d<1||d>new Date(Date.UTC(y,m,0)).getUTCDate())usageError('date','invalid calendar date');date=new Date(normalized);}if(!Number.isFinite(date.getTime()))usageError('date','invalid date');}
    const utc=flags.has('u'),get=method=>date[(utc?'getUTC':'get')+method](),pad=(n,width=2)=>String(n).padStart(width,'0'),year=get('FullYear'),month=get('Month'),day=get('Date'),week=get('Day'),hour=get('Hours'),minute=get('Minutes'),second=get('Seconds'),offset=utc?0:-date.getTimezoneOffset(),zone=(offset>=0?'+':'-')+pad(Math.floor(Math.abs(offset)/60))+pad(Math.abs(offset)%60),shortDays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],longDays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],shortMonths=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],longMonths=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const formats={Y:String(year),m:pad(month+1),d:pad(day),e:String(day).padStart(2),H:pad(hour),M:pad(minute),S:pad(second),F:year+'-'+pad(month+1)+'-'+pad(day),T:pad(hour)+':'+pad(minute)+':'+pad(second),s:String(Math.floor(date.getTime()/1000)),z:zone,Z:utc?'UTC':Intl.DateTimeFormat('en',{timeZoneName:'short'}).formatToParts(date).find(p=>p.type==='timeZoneName').value,a:shortDays[week],A:longDays[week],b:shortMonths[month],B:longMonths[month],u:String(week||7),w:String(week),j:pad(Math.floor((Date.UTC(year,month,day)-Date.UTC(year,0,1))/86400000)+1,3),n:'\n',t:'\t','%':'%'};const format=rest.length?rest[0].slice(1):'%a %b %e %T %Z %Y';return format.replace(/%(.|$)/g,(_,key)=>{if(!Object.prototype.hasOwnProperty.call(formats,key))usageError('date','unsupported format %'+key);return formats[key];})+'\n';
  }
  function runMove(shell,cmd,args) {
    const {flags,rest}=simpleOptions(args,cmd==='mv'?'n':'p',cmd);
    if(cmd==='rmdir'){
      if(!rest.length)usageError(cmd,'missing directory');
      for(const path of rest){let p=shell.resolve(path);while(true){if(!shell.isDir(p))fail('rmdir: '+p+': No such file or directory',1);if(shell.cwd===p||shell.cwd.startsWith(p==='/'?'/':p+'/'))fail('rmdir: cannot remove the current directory or an ancestor',1);if(shell.allPaths().some(x=>x!==p&&dirname(x)===p))fail('rmdir: '+p+': Directory not empty',1);shell.checkParentWrite(p,cmd);shell.directories.delete(p);delete shell.metadata[p];if(!flags.has('p')||dirname(p)==='/')break;p=dirname(p);}}
      return '';
    }
    if(rest.length!==2)usageError(cmd,'exactly two paths are required');
    const source=shell.resolve(rest[0]);if(!shell.isFile(source)&&!shell.isDir(source))fail('mv: '+rest[0]+': No such file or directory',1);
    let destination=shell.resolve(rest[1]);if(shell.isDir(destination))destination+=(destination==='/'?'':'/')+basename(source);if(source===destination)return '';
    if(destination.startsWith(source+'/'))fail('mv: cannot move a directory inside itself',1);if(!shell.isDir(dirname(destination)))fail('mv: destination parent does not exist',1);if(flags.has('n')&&(shell.isFile(destination)||shell.isDir(destination)))return '';
    shell.checkParentWrite(source,cmd);shell.checkParentWrite(destination,cmd);
    const moveMeta=p=>{const next=destination+p.slice(source.length);shell.metadata[next]={...shell.getMetadata(p)};delete shell.metadata[p];};
    if(shell.isDir(source)){
      if(shell.isFile(destination)||shell.isDir(destination))fail('mv: destination already exists',1);
      const files=Object.entries(shell.files).filter(([p])=>p.startsWith(source+'/')),dirs=[...shell.directories].filter(p=>p===source||p.startsWith(source+'/'));
      for(const [p,text] of files){shell.files[destination+p.slice(source.length)]=text;moveMeta(p);delete shell.files[p];}
      for(const p of dirs){moveMeta(p);shell.directories.delete(p);shell.directories.add(destination+p.slice(source.length));}
      if(shell.cwd===source||shell.cwd.startsWith(source+'/'))shell.cwd=destination+shell.cwd.slice(source.length);if(shell.oldcwd===source||shell.oldcwd.startsWith(source+'/'))shell.oldcwd=destination+shell.oldcwd.slice(source.length);
    }else{if(shell.isDir(destination))fail('mv: '+destination+': Is a directory',1);shell.files[destination]=shell.files[source];moveMeta(source);delete shell.files[source];}
    shell.addParents(destination);return '';
  }

  function trSet(source) {
    if(/\[[^\]]*\*/.test(source))usageError('tr','repeated-set syntax is unsupported');
    const classes={};const chars=(a,b)=>Array.from({length:b-a+1},(_,i)=>String.fromCharCode(a+i));
    classes.lower=chars(97,122);classes.upper=chars(65,90);classes.digit=chars(48,57);classes.alpha=[...classes.upper,...classes.lower];classes.alnum=[...classes.digit,...classes.alpha];classes.space=['\t','\n','\v','\f','\r',' '];classes.blank=['\t',' '];classes.cntrl=[...chars(0,31),'\x7f'];classes.print=chars(32,126);classes.graph=chars(33,126);classes.punct=classes.graph.filter(c=>!/[A-Za-z0-9]/.test(c));classes.xdigit=[...classes.digit,...chars(65,70),...chars(97,102)];
    const tokens=[];
    for(let i=0;i<source.length;){if(source.slice(i,i+2)==='[:'){const end=source.indexOf(':]',i+2);if(end<0)usageError('tr','unterminated character class');const name=source.slice(i+2,end);if(!classes[name])usageError('tr','unsupported character class '+name);tokens.push({chars:classes[name]});i=end+2;continue;}
      let c=source[i++],escaped=false;if(c==='\\'){escaped=true;if(i===source.length)usageError('tr','unfinished escape');const oct=source.slice(i).match(/^[0-7]{1,3}/);if(oct){c=String.fromCharCode(parseInt(oct[0],8));i+=oct[0].length;}else{const e=source[i++],map={n:'\n',r:'\r',t:'\t',a:'\x07',b:'\b',f:'\f',v:'\v','\\':'\\','-':'-'};if(!Object.prototype.hasOwnProperty.call(map,e))usageError('tr','unsupported escape \\'+e);c=map[e];}}
      else if(c.codePointAt(0)>=0xd800&&c.codePointAt(0)<=0xdbff&&i<source.length)c+=source[i++];tokens.push({chars:[c],literal:true,escaped});
    }
    const out=[];for(let i=0;i<tokens.length;i++){const a=tokens[i],dash=tokens[i+1],b=tokens[i+2];if(a.literal&&dash&&dash.literal&&dash.chars[0]==='-'&&!dash.escaped&&b&&b.literal){const lo=a.chars[0].codePointAt(0),hi=b.chars[0].codePointAt(0);if(lo>hi||hi>127)usageError('tr','ranges must be ascending ASCII characters');out.push(...chars(lo,hi));i+=2;}else out.push(...a.chars);}return out;
  }
  function runTr(args,stdin) {
    const {flags,rest}=simpleOptions(args,'cds','tr');if(!rest.length||rest.length>2)usageError('tr','one or two sets are required');
    const a=trSet(rest[0]),b=rest[1]===undefined?null:trSet(rest[1]);if(!flags.has('d')&&!flags.has('s')&&b===null)usageError('tr','translation requires SET2');if(flags.has('d')&&b!==null&&!flags.has('s'))usageError('tr','SET2 requires -s when deleting');if(!flags.has('d')&&b!==null&&!b.length)usageError('tr','SET2 must not be empty');if(flags.has('c')&&!flags.has('d')&&b&&b.length!==1)usageError('tr','complemented translation supports one output character');
    const set=new Set(a),squeeze=new Set(b===null?a:b),mapping=new Map();if(b)for(let i=0;i<a.length;i++)if(!mapping.has(a[i]))mapping.set(a[i],b[Math.min(i,b.length-1)]);
    let out='',previous=null;for(const c of Array.from(stdin)){const member=flags.has('c')?!set.has(c):set.has(c);if(flags.has('d')&&member)continue;const v=!flags.has('d')&&b!==null&&member?(flags.has('c')?b[0]:mapping.get(c)):c;const squeezed=flags.has('s')&&(b!==null?squeeze.has(v):flags.has('c')?!set.has(v):set.has(v));if(squeezed&&v===previous)continue;out+=v;previous=v;}return out;
  }
  function displayWidth(text) { return Array.from(text).reduce((n,c)=>{const k=c.codePointAt(0);if(/[\u0300-\u036f\ufe00-\ufe0f]/.test(c))return n;return n+(k>=0x1100&&(k<=0x115f||k>=0x2e80&&k<=0xa4cf||k>=0xac00&&k<=0xd7a3||k>=0xf900&&k<=0xfaff||k>=0xfe10&&k<=0xfe6f||k>=0xff00&&k<=0xff60||k>=0x1f300)?2:1);},0); }
  function runColumn(shell,args,stdin) {
    let table=false,separator=null,after=false;const paths=[];
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='t')table=true;else if(f==='s'){const t=takeValue(args,i,arg.slice(j+1),'column','-s');separator=t.value;i=t.next;break;}else usageError('column','unsupported option -'+f);}}else paths.push(arg);}
    if(!table)usageError('column','only table mode -t is supported');if(separator==='')usageError('column','separator must not be empty');const split=separator===null?null:new RegExp('['+separator.replace(/[\\\]\[\-^]/g,'\\$&')+']');
    const rows=shell.inputs(paths,stdin,'column').flatMap(f=>asLines(f.text)).filter(line=>line.trim()!=='').map(line=>split?line.split(split):line.trim().split(/\s+/)),widths=[];
    for(const row of rows)row.forEach((v,i)=>widths[i]=Math.max(widths[i]||0,displayWidth(v)));return lineOutput(rows.map(row=>row.map((v,i)=>v+(i<row.length-1?' '.repeat(widths[i]-displayWidth(v)+2):'')).join('')));
  }
  function runNl(shell,args,stdin) {
    let all=false,width=6,separator='\t',after=false;const paths=[];
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){const f=arg[1];if(!'bws'.includes(f))usageError('nl','unsupported option '+arg);const t=takeValue(args,i,arg.slice(2),'nl','-'+f);i=t.next;if(f==='b'){if(t.value!=='a'&&t.value!=='t')usageError('nl','-b supports a or t');all=t.value==='a';}else if(f==='w'){if(!/^\d+$/.test(t.value)||+t.value<1||+t.value>100)usageError('nl','width must be 1–100');width=+t.value;}else separator=t.value;}else paths.push(arg);}
    if(paths.length>1)usageError('nl','only one input file is supported');let n=0;return lineChunks(shell.inputs(paths,stdin,'nl')[0].text).map(chunk=>{const body=chunk.endsWith('\n')?chunk.slice(0,-1):chunk;if(!all&&body==='')return chunk;return String(++n).padStart(width)+separator+chunk;}).join('');
  }
  function runDiff(shell,args,stdin) {
    const {flags,rest}=simpleOptions(args,'u','diff');if(rest.length!==2)usageError('diff','exactly two files are required');let a,b;try{a=lineChunks(rest[0]==='-'?stdin:shell.read(rest[0],'diff'));b=lineChunks(rest[1]==='-'?stdin:shell.read(rest[1],'diff'));}catch(e){if(e instanceof ShellError)e.code=2;throw e;}
    if(a.length===b.length&&a.every((line,i)=>line===b[i]))return {stdout:'',stderr:'',code:0};
    if((a.length+1)*(b.length+1)>2000000)usageError('diff','comparison exceeds 2 million line-pair cells; compare filtered excerpts');
    const columns=b.length+1,matrix=new Uint32Array((a.length+1)*columns);
    for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)matrix[i*columns+j]=a[i]===b[j]?matrix[(i+1)*columns+j+1]+1:Math.max(matrix[(i+1)*columns+j],matrix[i*columns+j+1]);
    const ops=[];let i=0,j=0;while(i<a.length||j<b.length){if(i<a.length&&j<b.length&&a[i]===b[j]){ops.push({kind:' ',text:a[i],old:i+1,new:j+1});i++;j++;}else if(i<a.length&&(j===b.length||matrix[(i+1)*columns+j]>=matrix[i*columns+j+1])){ops.push({kind:'-',text:a[i],old:i+1,new:j+1});i++;}else{ops.push({kind:'+',text:b[j],old:i+1,new:j+1});j++;}}
    const printLine=(op,prefix)=>prefix+(op.text.endsWith('\n')?op.text:op.text+'\n\\ No newline at end of file\n');
    let out='';
    if(flags.has('u')){out='--- '+rest[0]+'\n+++ '+rest[1]+'\n';const ranges=[];ops.forEach((op,index)=>{if(op.kind===' ')return;const start=Math.max(0,index-3),end=Math.min(ops.length,index+4),last=ranges[ranges.length-1];if(last&&start<=last[1])last[1]=Math.max(last[1],end);else ranges.push([start,end]);});
      for(const [start,end] of ranges){const slice=ops.slice(start,end),oldCount=slice.filter(op=>op.kind!=='+').length,newCount=slice.filter(op=>op.kind!=='-').length;const address=(n,count)=>count===1?String(n):String(count?n:n-1)+','+count;out+='@@ -'+address(ops[start].old,oldCount)+' +'+address(ops[start].new,newCount)+' @@\n';for(const op of slice)out+=printLine(op,op.kind);}
    }else{for(let at=0;at<ops.length;){if(ops[at].kind===' '){at++;continue;}const group=[];while(at<ops.length&&ops[at].kind!==' ')group.push(ops[at++]);const del=group.filter(op=>op.kind==='-'),add=group.filter(op=>op.kind==='+'),span=(first,last)=>first===last?String(first):first+','+last;if(del.length&&add.length)out+=span(del[0].old,del[del.length-1].old)+'c'+span(add[0].new,add[add.length-1].new)+'\n';else if(del.length)out+=span(del[0].old,del[del.length-1].old)+'d'+(del[0].new-1)+'\n';else out+=(add[0].old-1)+'a'+span(add[0].new,add[add.length-1].new)+'\n';for(const op of del)out+=printLine(op,'< ');if(del.length&&add.length)out+='---\n';for(const op of add)out+=printLine(op,'> ');}}
    return {stdout:out,stderr:'',code:1};
  }
  function runBase64(shell,args,stdin) {
    let decode=false,width=76,after=false;const paths=[];
    for(let i=0;i<args.length;i++){const arg=args[i];if(!after&&arg==='--'){after=true;continue;}if(!after&&arg==='--decode'){decode=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(let j=1;j<arg.length;j++){const f=arg[j];if(f==='d')decode=true;else if(f==='w'){const t=takeValue(args,i,arg.slice(j+1),'base64','-w');i=t.next;if(!/^\d+$/.test(t.value)||+t.value>10000)usageError('base64','wrap width must be 0–10000');width=+t.value;break;}else usageError('base64','unsupported option -'+f);}}else paths.push(arg);}
    if(paths.length>1)usageError('base64','only one input file is supported');const text=shell.inputs(paths,stdin,'base64')[0].text;
    if(decode){const value=text.replace(/\s/g,'');if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))fail('base64: invalid input',1);let binary;try{binary=atob(value);}catch(_){fail('base64: invalid input',1);}try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,c=>c.charCodeAt(0)));}catch(_){fail('base64: decoded data is not UTF-8 text; binary output is unsupported',1);}}
    const data=new TextEncoder().encode(text);let binary='';for(const byte of data)binary+=String.fromCharCode(byte);const encoded=btoa(binary);if(!encoded)return '';return width?lineOutput(encoded.match(new RegExp('.{1,'+width+'}','g'))||[]):encoded;
  }

  // A deliberately bounded jq filter parser; filters are data, never JavaScript.
  function jqSplit(source,separator) {
    const parts=[];let start=0,quote=false,depth=0;
    for(let i=0;i<source.length;i++){const c=source[i];if(quote){if(c==='\\')i++;else if(c==='"')quote=false;continue;}if(c==='"'){quote=true;continue;}if('([{'.includes(c)){depth++;continue;}if(')]}'.includes(c)){depth--;if(depth<0)fail('jq: unmatched delimiter',3);continue;}if(depth===0&&source.slice(i,i+separator.length)===separator){parts.push(source.slice(start,i).trim());start=i+separator.length;i+=separator.length-1;}}
    if(quote||depth!==0)fail('jq: unclosed string or delimiter',3);parts.push(source.slice(start).trim());return parts;
  }
  const jqTruth=v=>v!==null&&v!==false;
  const jqEqual=(a,b)=>jqCompare(a,b)===0;
  const jqCompare=(a,b)=>{
    const rank=v=>v===null?0:typeof v==='boolean'?1:typeof v==='number'?2:typeof v==='string'?3:Array.isArray(v)?4:5,d=rank(a)-rank(b);if(d)return Math.sign(d);
    if(a===null)return 0;
    if(Array.isArray(a)){for(let i=0;i<Math.min(a.length,b.length);i++){const n=jqCompare(a[i],b[i]);if(n)return n;}return Math.sign(a.length-b.length);}
    if(typeof a==='object'){const keysA=Object.keys(a).sort(cmp),keysB=Object.keys(b).sort(cmp),keyOrder=jqCompare(keysA,keysB);if(keyOrder)return keyOrder;for(const key of keysA){const n=jqCompare(a[key],b[key]);if(n)return n;}return 0;}
    return typeof a==='number'?Math.sign(a-b):cmp(a,b);
  };
  function jqOne(filter,input) {const values=filter(input);if(values.length!==1)fail('jq: this expression requires exactly one value',5);return values[0];}
  function jqPredicate(source) {
    source=source.trim();const or=jqSplit(source,' or ');if(or.length>1){const predicates=or.map(jqPredicate);return v=>predicates.some(p=>p(v));}const and=jqSplit(source,' and ');if(and.length>1){const predicates=and.map(jqPredicate);return v=>predicates.every(p=>p(v));}
    if(source.startsWith('(')&&source.endsWith(')'))return jqPredicate(source.slice(1,-1));
    for(const op of ['==','!=','>=','<=','>','<']){const parts=jqSplit(source,op);if(parts.length>1){if(parts.length!==2)fail('jq: chained comparisons are unsupported',3);const a=jqFilter(parts[0]),b=jqFilter(parts[1]);return v=>{const x=jqOne(a,v),y=jqOne(b,v),n=jqCompare(x,y);return op==='=='?jqEqual(x,y):op==='!='?!jqEqual(x,y):op==='>'?n>0:op==='>='?n>=0:op==='<'?n<0:n<=0;};}}
    const filter=jqFilter(source);return v=>jqTruth(jqOne(filter,v));
  }
  function jqFilter(source) {
    source=source.trim();if(!source)fail('jq: empty filter stage',3);
    const pipes=jqSplit(source,'|');if(pipes.length>1){const compiled=pipes.map(jqFilter);return v=>compiled.reduce((values,f)=>values.flatMap(item=>f(item)),[v]);}
    const alternatives=jqSplit(source,',');if(alternatives.length>1){const compiled=alternatives.map(jqFilter);return v=>compiled.flatMap(f=>f(v));}
    const defaults=jqSplit(source,'//');if(defaults.length>1){const compiled=defaults.map(jqFilter);return v=>{for(let i=0;i<compiled.length;i++){const values=compiled[i](v);if(i===compiled.length-1)return values;const kept=values.filter(jqTruth);if(kept.length)return kept;}return [];};}
    if(source==='.')return v=>[v];if(source==='empty')return ()=>[];
    if(source[0]==='['&&source.endsWith(']')){const inside=source.slice(1,-1).trim(),filter=inside?jqFilter(inside):null;return v=>[filter?filter(v):[]];}
    if(source[0]==='{'&&source.endsWith('}')){const inside=source.slice(1,-1).trim(),fields=inside?jqSplit(inside,',').map(field=>{const parts=jqSplit(field,':');if(parts.length!==2)fail('jq: object fields must use key: filter',3);let key=parts[0];if(key.startsWith('"')){try{key=JSON.parse(key);}catch(_){fail('jq: invalid object key',3);}}else if(!/^[A-Za-z_]\w*$/.test(key))fail('jq: object keys must be names or quoted strings',3);return {key,filter:jqFilter(parts[1])};}):[];return v=>{const output=Object.create(null);for(const f of fields)output[f.key]=jqOne(f.filter,v);return [output];};}
    let call=source.match(/^(select|has|contains|startswith|endswith|test|sort_by|group_by|unique_by)\(([\s\S]*)\)$/);
    if(call){const name=call[1],argument=call[2];if(name==='select'){const predicate=jqPredicate(argument);return v=>predicate(v)?[v]:[];}
      const filter=jqFilter(argument);
      if(['sort_by','group_by','unique_by'].includes(name))return v=>{if(!Array.isArray(v))fail('jq: '+name+' requires an array',5);const items=v.map((item,i)=>({item,key:jqOne(filter,item),i})).sort((a,b)=>jqCompare(a.key,b.key)||a.i-b.i);if(name==='sort_by')return [items.map(x=>x.item)];const groups=[];for(const x of items){const last=groups[groups.length-1];if(last&&jqEqual(last.key,x.key))last.items.push(x.item);else groups.push({key:x.key,items:[x.item]});}return [name==='unique_by'?groups.map(g=>g.items[0]):groups.map(g=>g.items)];};
      return v=>{const arg=jqOne(filter,v);if(name==='has'){if(v===null)return [false];if(typeof v!=='object')fail('jq: has requires an object or array',5);return [Object.prototype.hasOwnProperty.call(v,arg)];}if(name==='contains'){if(typeof v==='string'&&typeof arg==='string')return [v.includes(arg)];if(Array.isArray(v)&&Array.isArray(arg))return [arg.every(x=>v.some(y=>jqEqual(x,y)))];if(v&&arg&&typeof v==='object'&&typeof arg==='object')return [Object.keys(arg).every(k=>Object.prototype.hasOwnProperty.call(v,k)&&jqEqual(v[k],arg[k]))];fail('jq: contains supports strings, arrays, or shallow objects of matching types',5);}if(typeof v!=='string'||typeof arg!=='string')fail('jq: '+name+' requires strings',5);return [name==='test'?regex(arg).test(v):name==='startswith'?v.startsWith(arg):v.endsWith(arg)];};
    }
    if(['length','keys','values','type','sort','unique','not','@csv','@tsv'].includes(source))return v=>{
      if(source==='type')return [v===null?'null':Array.isArray(v)?'array':typeof v];
      if(source==='not')return [!jqTruth(v)];if(source==='values')return v===null?[]:[v];
      if(source==='length'){if(v===null)return [0];if(typeof v==='string')return [Array.from(v).length];if(Array.isArray(v))return [v.length];if(typeof v==='object')return [Object.keys(v).length];if(typeof v==='number')return [Math.abs(v)];fail('jq: length is unsupported for booleans',5);}
      if(source==='keys'){if(v===null||typeof v!=='object')fail('jq: keys requires an object or array',5);return [Array.isArray(v)?v.map((_,i)=>i):Object.keys(v).sort(cmp)];}
      if(!Array.isArray(v))fail('jq: '+source+' requires an array',5);
      if(source==='sort'||source==='unique'){const items=v.slice().sort(jqCompare);return [source==='sort'?items:items.filter((x,i)=>i===0||!jqEqual(x,items[i-1]))];}
      const cells=v.map(value=>{if(value!==null&&typeof value==='object')fail('jq: '+source+' requires scalar array values',5);if(value===null)return '';if(source==='@csv')return typeof value==='string'?'"'+value.replace(/"/g,'""')+'"':String(value);return String(value).replace(/\\/g,'\\\\').replace(/\t/g,'\\t').replace(/\n/g,'\\n').replace(/\r/g,'\\r');});return [cells.join(source==='@csv'?',':'\t')];
    };
    if(source[0]==='.'){
      const steps=[];let i=1,needName=true;
      while(i<source.length){if(source[i]==='.'){if(needName)fail('jq: recursive descent is unsupported',3);needName=true;i++;continue;}
        if(source[i]==='['){let end=i+1,quote=false;for(;end<source.length;end++){const c=source[end];if(quote){if(c==='\\')end++;else if(c==='"')quote=false;}else if(c==='"')quote=true;else if(c===']')break;}if(end===source.length)fail('jq: unclosed index',3);const index=source.slice(i+1,end).trim();if(index==='')steps.push({iterate:true});else if(/^-?\d+$/.test(index))steps.push({key:+index});else if(/^"/.test(index)){let key;try{key=JSON.parse(index);}catch(_){fail('jq: unsupported index',3);}if(typeof key!=='string')fail('jq: index must be a string or integer',3);steps.push({key});}else fail('jq: slices and computed indices are unsupported',3);i=end+1;needName=false;continue;}
        if(!needName)fail('jq: unsupported path syntax near '+source.slice(i),3);const name=source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);if(!name)fail('jq: unsupported field syntax',3);steps.push({key:name[0]});i+=name[0].length;needName=false;
      }
      if(needName&&steps.length)fail('jq: incomplete field path',3);
      return v=>steps.reduce((values,step)=>values.flatMap(value=>{if(step.iterate){if(value===null||typeof value!=='object')fail('jq: cannot iterate over '+(value===null?'null':typeof value),5);return Array.isArray(value)?value:Object.values(value);}if(value===null)return [null];if(typeof step.key==='number'){if(!Array.isArray(value))fail('jq: numeric index requires an array',5);const n=step.key<0?value.length+step.key:step.key;return [n>=0&&n<value.length?value[n]:null];}if(Array.isArray(value)||typeof value!=='object')fail('jq: field access requires an object',5);return [Object.prototype.hasOwnProperty.call(value,step.key)?value[step.key]:null];}),[v]);
    }
    try{const value=JSON.parse(source);return ()=>[value];}catch(_){fail('jq: unsupported filter syntax: '+source+'; use help jq',3);}
  }
  function jsonValues(text) {
    if(!text.trim())return [];
    try{return [JSON.parse(text)];}catch(_){}
    const values=[];let line=0;for(const record of asLines(text)){line++;if(!record.trim())continue;try{values.push(JSON.parse(record));}catch(_){fail('jq: invalid JSON on line '+line+' (supports JSON documents or one JSON value per line)',4);}}return values;
  }
  function runJq(shell,args,stdin) {
    const {flags,rest}=simpleOptionsBeforeFilter(args,'rcs','jq'),source=rest.length?rest[0]:'.',paths=rest.slice(1),filter=jqFilter(source),inputs=shell.inputs(paths,stdin,'jq').flatMap(f=>jsonValues(f.text));
    const values=(flags.has('s')?[inputs]:inputs).flatMap(v=>filter(v));
    return values.map(value=>flags.has('r')&&typeof value==='string'?value:JSON.stringify(value,null,flags.has('c')?0:2)).join('\n')+(values.length?'\n':'');
  }
  function simpleOptionsBeforeFilter(args,allowed,cmd) {
    const flags=new Set(),rest=[];let after=false;
    for(const arg of args){if(!after&&arg==='--'){after=true;continue;}if(!after&&arg.startsWith('-')&&arg!=='-'){for(const f of arg.slice(1)){if(!allowed.includes(f))usageError(cmd,'unsupported option -'+f);flags.add(f);}}else{after=true;rest.push(arg);}}
    return {flags,rest};
  }

  /* Parsed awk subset: no eval, host access, or unbounded loops. */
  function awkTokens(source) {
    const tokens=[];let i=0;
    const push=(kind,value)=>tokens.push({kind,value});
    while(i<source.length){const c=source[i];if(c==='\n'){push('op',';');i++;continue;}if(/\s/.test(c)){i++;continue;}
      if(c==='#'){while(i<source.length&&source[i]!=='\n')i++;continue;}
      if(c==='"'){let value='',closed=false;i++;while(i<source.length){let x=source[i++];if(x==='"'){closed=true;break;}if(x==='\\'&&i<source.length){x=source[i++];value+=({n:'\n',t:'\t',r:'\r',b:'\b',f:'\f',v:'\v'}[x]||x);}else value+=x;}if(!closed)usageError('awk','unclosed string');push('literal',value);continue;}
      const last=tokens[tokens.length-1],canEnd=last&&(last.kind==='literal'||last.kind==='regex'||last.kind==='id'&&!['print','printf','else','BEGIN','END'].includes(last.value)||last.kind==='op'&&[')',']','++','--'].includes(last.value));
      if(c==='/'&&!canEnd){let pattern='',closed=false;i++;while(i<source.length){const x=source[i++];if(x==='\\'&&i<source.length){pattern+=x+source[i++];continue;}if(x==='/'){closed=true;break;}pattern+=x;}if(!closed)usageError('awk','unclosed regex');push('regex',regex(pattern));continue;}
      const number=source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);if(number){push('literal',+number[0]);i+=number[0].length;continue;}
      const id=source.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);if(id){push('id',id[0]);i+=id[0].length;continue;}
      const op=source.slice(i).match(/^(?:\+\+|--|\+=|-=|\*=|\/=|%=|&&|\|\||==|!=|<=|>=|!~|[{}\[\];=~<>+*/%$(),!\-])/);if(op){push('op',op[0]);i+=op[0].length;continue;}
      usageError('awk','unsupported expression near '+source.slice(i,20));
    }
    tokens.push({kind:'end',value:'(end)'});return tokens;
  }
  function compileAwk(program) {
    const tokens=awkTokens(program);let at=0,depth=0,loopDepth=0,expressionDepth=0,statementDepth=0;
    const token=()=>tokens[at],is=value=>token().kind!=='literal'&&token().kind!=='regex'&&token().value===value,accept=value=>is(value)?(at++,true):false,need=value=>{if(!accept(value))usageError('awk','expected '+value);},separators=()=>{while(accept(';')){};};
    const literal=value=>({type:'literal',value}),binary=(op,left,right)=>({type:'binary',op,left,right});
    const checkTarget=node=>{if(!['var','array'].includes(node.type))usageError('awk',node.type==='field'?'field assignment is unsupported':'assignment requires a variable or array element');if(node.type==='var'&&['NR','NF','FNR','FILENAME'].includes(node.name))usageError('awk','assigning record counters is unsupported');};
    function primary(){const t=tokens[at++];if(t.kind==='literal'||t.kind==='regex')return {type:t.kind,value:t.value};if(t.kind==='op'&&t.value==='('){const node=expression();need(')');return node;}if(t.kind==='op'&&t.value==='$')return {type:'field',index:unary()};
      if(t.kind==='id'){if(accept('(')){if(!['tolower','toupper','length','int','substr','split'].includes(t.value))usageError('awk','unsupported action or function '+t.value);const args=[];if(!is(')'))do{args.push(expression());}while(accept(','));need(')');const bounds={tolower:[1,1],toupper:[1,1],length:[0,1],int:[1,1],substr:[2,3],split:[2,3]}[t.value];if(args.length<bounds[0]||args.length>bounds[1])usageError('awk','invalid arguments for '+t.value);if(t.value==='split'&&args[1].type!=='var')usageError('awk','split requires an array name as its second argument');return {type:'call',name:t.value,args};}if(accept('[')){const key=expression();need(']');return {type:'array',name:t.value,key};}return {type:'var',name:t.value};}
      usageError('awk','incomplete or unsupported expression near '+String(t.value));
    }
    function postfix(){let node=primary();if(is('++')||is('--')){const op=tokens[at++].value;checkTarget(node);node={type:'update',target:node,delta:op==='++'?1:-1,prefix:false};}return node;}
    function unary(){if(++expressionDepth>100)usageError('awk','expression nesting limit exceeded');let node;if(is('!')||is('-')||is('+'))node={type:'unary',op:tokens[at++].value,value:unary()};else if(is('++')||is('--')){const op=tokens[at++].value,target=unary();checkTarget(target);node={type:'update',target,delta:op==='++'?1:-1,prefix:true};}else node=postfix();expressionDepth--;return node;}
    function multiply(){let node=unary();while(is('*')||is('/')||is('%'))node=binary(tokens[at++].value,node,unary());return node;}
    function add(){let node=multiply();while(is('+')||is('-'))node=binary(tokens[at++].value,node,multiply());return node;}
    const startsValue=()=>token().kind==='literal'||token().kind==='regex'||token().kind==='id'&&!['in','else','print','printf','if','for','while','break','continue','next','BEGIN','END'].includes(token().value)||is('$')||is('(');
    function concat(){let node=add();while(startsValue())node=binary('concat',node,add());return node;}
    function compare(){let node=concat();while(['==','!=','<','<=','>','>=','~','!~','in'].some(is)){const op=tokens[at++].value,right=concat();if(op==='in'&&right.type!=='var')usageError('awk','in requires an array name');node=binary(op,node,right);}return node;}
    function and(){let node=compare();while(accept('&&'))node=binary('&&',node,compare());return node;}
    function or(){let node=and();while(accept('||'))node=binary('||',node,and());return node;}
    function expression(){if(++expressionDepth>100)usageError('awk','expression nesting limit exceeded');let node=or();if(['=','+=','-=','*=','/=','%='].some(is)){const op=tokens[at++].value;checkTarget(node);node={type:'assign',op,target:node,value:expression()};}expressionDepth--;return node;}
    function block(){need('{');if(++depth>100)usageError('awk','block nesting limit exceeded');const body=[];separators();while(!is('}')){if(token().kind==='end')usageError('awk','unclosed block');body.push(statement());if(!is('}')&&!is(';')&&body[body.length-1].type!=='block'&&!['if','for','forin'].includes(body[body.length-1].type))usageError('awk','expected semicolon between statements');separators();}need('}');depth--;return {type:'block',body};}
    function statement(){if(++statementDepth>100)usageError('awk','statement nesting limit exceeded');const node=parseStatement();statementDepth--;return node;}
    function parseStatement(){if(is('{'))return block();if(accept('if')){need('(');const condition=expression();need(')');separators();const yes=statement();const saved=at;separators();let no=null;if(accept('else')){separators();no=statement();}else at=saved;return {type:'if',condition,yes,no};}
      if(accept('for')){need('(');let init=null,condition=null,step=null,name=null,array=null;if(token().kind==='id'&&tokens[at+1].kind==='id'&&tokens[at+1].value==='in'){name=tokens[at++].value;checkTarget({type:'var',name});at++;if(token().kind!=='id')usageError('awk','for in requires an array name');array=tokens[at++].value;need(')');}else{if(!is(';'))init=expression();need(';');if(!is(';'))condition=expression();need(';');if(!is(')'))step=expression();need(')');}separators();loopDepth++;const body=statement();loopDepth--;return name?{type:'forin',name,array,body}:{type:'for',init,condition,step,body};}
      if(is('print')||is('printf')){const type=tokens[at++].value,args=[];let wrapped=false;if(is('(')){let nesting=0,close=at;for(;close<tokens.length;close++){if(tokens[close].kind!=='op')continue;if(tokens[close].value==='(')nesting++;if(tokens[close].value===')'&&!--nesting)break;}const following=tokens[close+1];wrapped=following&&(following.kind==='end'||following.kind==='op'&&[';','}'].includes(following.value)||following.kind==='id'&&following.value==='else');}if(wrapped)at++;if(!is(';')&&!is('}')&&!is('else')&&!(wrapped&&is(')'))&&token().kind!=='end')do{args.push(expression());}while(accept(','));if(wrapped)need(')');if(type==='printf'&&!args.length)usageError('awk','printf requires a format');return {type,args};}
      if(is('break')||is('continue')){const type=tokens[at++].value;if(!loopDepth)usageError('awk',type+' requires a loop');return {type};}
      if(accept('next'))return {type:'next'};
      if(is('while')||is('do')||is('delete')||is('exit'))usageError('awk','unsupported action '+token().value);
      const value=expression();if(!['assign','update','call'].includes(value.type))usageError('awk','unsupported action; use help awk');return {type:'expression',value};
    }
    const blocks=[];separators();while(token().kind!=='end'){let phase='record',condition=null;if(is('BEGIN')||is('END'))phase=tokens[at++].value;else if(!is('{'))condition=expression();let action;if(is('{'))action=block();else{if(phase!=='record')usageError('awk',phase+' requires a block');if(token().kind!=='end'&&!is(';'))usageError('awk','expected action block');action={type:'print',args:[]};}blocks.push({phase,condition,action});separators();}return blocks;
  }
  function runAwk(shell,args,stdin) {
    let separator=' ',program=null,after=false;const paths=[],initial=Object.create(null);
    // Input numeric strings retain their spelling; literal strings remain strings.
    const unset=Symbol('uninitialized'),inputValue=value=>/^[\s]*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[\s]*$/.test(value)?{awkNumber:Number(value),awkText:value}:value,isNumeric=value=>value===unset||typeof value==='number'||value!==null&&typeof value==='object'&&Object.prototype.hasOwnProperty.call(value,'awkNumber');
    for(let i=0;i<args.length;i++){const arg=args[i];if(program===null&&!after&&arg==='--'){after=true;continue;}if(program===null&&!after&&arg.startsWith('-')&&arg!=='-'){if(!arg.startsWith('-F')&&!arg.startsWith('-v'))usageError('awk','unsupported option '+arg);const t=takeValue(args,i,arg.slice(2),'awk',arg.slice(0,2));i=t.next;if(arg[1]==='F')separator=t.value;else{const m=t.value.match(/^([A-Za-z_]\w*)=([\s\S]*)$/);if(!m)usageError('awk','-v requires name=value');initial[m[1]]=inputValue(decodeTextEscapes(m[2],'awk'));}continue;}if(program===null)program=arg;else paths.push(arg);}
    if(program===null||!program.trim())usageError('awk','missing program');const blocks=compileAwk(program);if(!blocks.length)usageError('awk','empty program');
    const env={line:'',fields:[],NR:0,FNR:0,FILENAME:'',vars:Object.assign(Object.create(null),{FS:separator,OFS:' ',ORS:'\n'},initial),arrays:new Map()},out=[];let steps=0,size=0,phase='BEGIN';
    const tick=()=>{if(++steps>1000000)usageError('awk','execution step limit exceeded (1000000)');},text=value=>value===unset?'':value instanceof RegExp?String(+value.test(env.line)):typeof value==='object'&&value!==null&&Object.prototype.hasOwnProperty.call(value,'awkText')?value.awkText:String(value),number=value=>parseFloat(text(value))||0,truth=value=>value instanceof RegExp?value.test(env.line):isNumeric(value)?number(value)!==0:text(value)!=='',bounded=value=>{if(typeof value==='string'&&value.length>MAX_OUTPUT)usageError('awk','value exceeds the browser text limit');return value;};
    const getArray=name=>{if(Object.prototype.hasOwnProperty.call(env.vars,name))usageError('awk','cannot use scalar '+name+' as an array');if(!env.arrays.has(name))env.arrays.set(name,new Map());return env.arrays.get(name);};
    const getVar=name=>{if(env.arrays.has(name))usageError('awk','cannot use array '+name+' as a scalar');return name==='NF'?env.fields.length:['NR','FNR','FILENAME'].includes(name)?env[name]:Object.prototype.hasOwnProperty.call(env.vars,name)?env.vars[name]:unset;};
    const reference=node=>{if(node.type==='array'){const array=getArray(node.name),key=text(evaluate(node.key));return {get:()=>{if(!array.has(key))array.set(key,unset);return array.get(key);},set:value=>array.set(key,value)};}if(env.arrays.has(node.name))usageError('awk','cannot use array '+node.name+' as a scalar');return {get:()=>getVar(node.name),set:value=>env.vars[node.name]=value};};
    const splitFields=(value,sep)=>{const line=text(value),source=sep instanceof RegExp?sep:text(sep);if(source===' ')return line.trim()?line.trim().split(/\s+/):[];if(source==='')return Array.from(line);if(!line)return [];if(typeof source==='string'&&source.length===1)return line.split(source);const pattern=source instanceof RegExp?source:regex(source),re=new RegExp(pattern.source,pattern.flags+'g'),parts=[];let start=0,match;while((match=re.exec(line))){if(!match[0].length){re.lastIndex++;continue;}parts.push(line.slice(start,match.index));start=re.lastIndex;}parts.push(line.slice(start));return parts;};
    const arithmetic=(op,a,b)=>{const x=number(a),y=number(b);if((op==='/'||op==='%')&&!y)usageError('awk','division by zero');const value=op==='+'?x+y:op==='-'?x-y:op==='*'?x*y:op==='/'?x/y:x%y;if(!Number.isFinite(value))usageError('awk','numeric result is outside the supported range');return value;};
    function evaluate(node){tick();if(node.type==='literal')return node.value;if(node.type==='regex')return +node.value.test(env.line);if(node.type==='var')return getVar(node.name);if(node.type==='array')return reference(node).get();if(node.type==='field'){const n=Math.trunc(number(evaluate(node.index)));if(n<0)usageError('awk','negative field index');return inputValue(n===0?env.line:env.fields[n-1]||'');}
      if(node.type==='assign'){const target=reference(node.target),value=evaluate(node.value),next=node.op==='='?value:arithmetic(node.op[0],target.get(),value);target.set(next);return next;}
      if(node.type==='update'){const target=reference(node.target),previous=number(target.get()),next=previous+node.delta;target.set(next);return node.prefix?next:previous;}
      if(node.type==='call'){const name=node.name;if(name==='split'){const value=evaluate(node.args[0]),array=getArray(node.args[1].name),sep=node.args[2]?node.args[2].type==='regex'?node.args[2].value:evaluate(node.args[2]):env.vars.FS,parts=splitFields(value,sep);array.clear();parts.forEach((part,i)=>array.set(String(i+1),inputValue(part)));return parts.length;}if(name==='length'&&node.args[0]&&node.args[0].type==='var'&&env.arrays.has(node.args[0].name))return env.arrays.get(node.args[0].name).size;const values=node.args.map(evaluate),value=values.length?values[0]:env.line;if(name==='substr'){const start=Math.max(1,Math.trunc(number(values[1])))-1,length=values.length>2?Math.max(0,Math.trunc(number(values[2]))):undefined;return Array.from(text(value)).slice(start,length===undefined?undefined:start+length).join('');}return name==='tolower'?text(value).toLowerCase():name==='toupper'?text(value).toUpperCase():name==='length'?Array.from(text(value)).length:Math.trunc(number(value));}
      if(node.type==='unary'){const value=evaluate(node.value);return node.op==='!'?+!truth(value):node.op==='-'?-number(value):number(value);}
      const a=evaluate(node.left);if(node.op==='&&')return +(truth(a)&&truth(evaluate(node.right)));if(node.op==='||')return +(truth(a)||truth(evaluate(node.right)));if(node.op==='in')return +getArray(node.right.name).has(text(a));const b=(node.op==='~'||node.op==='!~')&&node.right.type==='regex'?node.right.value:evaluate(node.right);
      if(node.op==='concat')return bounded(text(a)+text(b));if(node.op==='~'||node.op==='!~'){const re=b instanceof RegExp?b:regex(text(b));return +(re.test(text(a))!==(node.op==='!~'));}if(['+','-','*','/','%'].includes(node.op))return arithmetic(node.op,a,b);
      const both=isNumeric(a)&&isNumeric(b),x=both?number(a):text(a),y=both?number(b):text(b);return +(node.op==='=='?x===y:node.op==='!='?x!==y:node.op==='<'?x<y:node.op==='<='?x<=y:node.op==='>'?x>y:x>=y);
    }
    const emit=value=>{size+=value.length;if(size>MAX_OUTPUT)usageError('awk','output exceeds the browser text limit');out.push(value);};
    // Array traversal intentionally uses hash order. Portable awk programs sort their output.
    const hash=key=>{let value=2166136261;for(const c of key)value=Math.imul(value^c.codePointAt(0),16777619);return value>>>0;};
    function execute(node){tick();if(node.type==='block'){for(const statement of node.body){const signal=execute(statement);if(signal)return signal;}return;}
      if(node.type==='print'){emit((node.args.length?node.args.map(arg=>text(evaluate(arg))).join(text(env.vars.OFS)):env.line)+text(env.vars.ORS));return;}
      if(node.type==='printf'){const values=node.args.map(evaluate),format=text(values.shift());emit(awkPrintf(format,values,number,text));return;}
      if(node.type==='expression'){evaluate(node.value);return;}
      if(node.type==='if')return truth(evaluate(node.condition))?execute(node.yes):node.no?execute(node.no):undefined;
      if(node.type==='next'){if(phase!=='record')usageError('awk','next is only valid in a record action');return 'next';}
      if(node.type==='break'||node.type==='continue')return node.type;
      if(node.type==='forin'){const keys=[...getArray(node.array).keys()].sort((a,b)=>hash(a)-hash(b)||cmp(a,b));if(keys.length>10000)usageError('awk','loop iteration limit exceeded (10000)');for(const key of keys){if(env.arrays.has(node.name))usageError('awk','loop variable must be a scalar');env.vars[node.name]=key;const signal=execute(node.body);if(signal==='break')break;if(signal==='next')return signal;}return;}
      if(node.type==='for'){if(node.init)evaluate(node.init);let iterations=0;while(!node.condition||truth(evaluate(node.condition))){if(++iterations>10000)usageError('awk','loop iteration limit exceeded (10000)');const signal=execute(node.body);if(signal==='break')break;if(signal==='next')return signal;if(node.step)evaluate(node.step);}return;}
    }
    for(const block of blocks)if(block.phase==='BEGIN')execute(block.action);
    phase='record';for(const input of shell.inputs(paths,stdin,'awk')){env.FNR=0;env.FILENAME=input.name;for(const line of asLines(input.text)){env.line=line;env.fields=splitFields(line,env.vars.FS);env.NR++;env.FNR++;for(const block of blocks)if(block.phase==='record'&&(!block.condition||truth(evaluate(block.condition))))if(execute(block.action)==='next')break;}}
    phase='END';for(const block of blocks)if(block.phase==='END')execute(block.action);return out.join('');
  }
  function awkPrintf(format,values,number,text) {
    let at=0,out='';for(let i=0;i<format.length;){if(format[i]!=='%'){out+=format[i++];continue;}const match=format.slice(i).match(/^%([-+ 0]*)(\d+)?(?:\.(\d+))?([%sdifceEgGouxX])/);if(!match)usageError('awk','unsupported printf format near '+format.slice(i,i+12));i+=match[0].length;const flags=match[1],width=+(match[2]||0),precision=match[3]===undefined?null:+match[3],kind=match[4];if(width>4096||precision!==null&&precision>100)usageError('awk','printf width/precision is too large');if(kind==='%'){out+='%';continue;}if(at>=values.length)usageError('awk','not enough arguments for printf format');const value=values[at++],n=number(value);if(kind!=='s'&&!Number.isFinite(n))usageError('awk','printf number is outside the supported range');let rendered;
      if(kind==='s')rendered=precision===null?text(value):Array.from(text(value)).slice(0,precision).join('');else if(kind==='c')rendered=typeof value==='number'?String.fromCodePoint((Math.trunc(n)%256+256)%256):Array.from(text(value))[0]||'\0';else if('diouxX'.includes(kind)){const integer=Math.trunc(n);if(!Number.isSafeInteger(integer)||'uoxX'.includes(kind)&&integer<0)usageError('awk','printf integer is outside the supported safe range');rendered=integer.toString(kind==='o'?8:kind==='x'||kind==='X'?16:10);if(precision!==null){const negative=rendered.startsWith('-');rendered=(negative?rendered.slice(1):rendered).padStart(precision,'0');if(!integer&&!precision)rendered='';if(negative)rendered='-'+rendered;}}else rendered=kind==='f'?n.toFixed(precision===null?6:precision):kind==='e'||kind==='E'?n.toExponential(precision===null?6:precision):Number(n.toPrecision(precision===null?6:Math.max(1,precision))).toString();
      if('XEG'.includes(kind))rendered=rendered.toUpperCase();if(!['s','c'].includes(kind)&&n>=0){if(flags.includes('+'))rendered='+'+rendered;else if(flags.includes(' '))rendered=' '+rendered;}const padding=Math.max(0,width-Array.from(rendered).length);if(flags.includes('-'))rendered+=' '.repeat(padding);else if(flags.includes('0')&&!['s','c'].includes(kind)&&precision===null){const sign=/^[+ -]/.test(rendered)?rendered[0]:'';rendered=sign+'0'.repeat(padding)+rendered.slice(sign.length);}else rendered=' '.repeat(padding)+rendered;out+=rendered;if(out.length>MAX_OUTPUT)usageError('awk','output exceeds the browser text limit');
    }return out;
  }
  root.LogLabShell=LogLabShell;
})(globalThis);
