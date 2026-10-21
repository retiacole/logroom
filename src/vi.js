/* A small, browser-local vi buffer. Implements the documented editing subset. */
(function(root){
  'use strict';
  const tr = (...args) => root.LogroomI18n ? root.LogroomI18n.t(...args) : Array.isArray(args[0]) ? args[0].reduce((s,p,i)=>s+p+(i<args.length-1?args[i+1]:''),'') : args[0];
  function bre(s){let out='',inClass=false;for(let i=0;i<s.length;i++){let c=s[i];if(c==='\\'&&i+1<s.length){const n=s[++i];out+=!inClass&&/[+?(){}|]/.test(n)?n:'\\'+n;}else{if(c==='[')inClass=true;if(c===']')inClass=false;out+=!inClass&&/[+?(){}|]/.test(c)?'\\'+c:c;}}return out;}
  class LogLabVi {
    constructor({path,text='',readonly=false}){this.path=path;this.text=text;this.savedText=text;this.readonly=readonly;this.pos=0;this.mode='normal';this.message=tr('i で編集 / :help で対応操作');this.error=false;this.pending='';this.count='';this.pendingCount=1;this.pendingHadCount=false;this.register='';this.linewise=false;this.undoStack=[];this.redoStack=[];this.insertBefore=null;this.lastSearch='';this.searchDirection=1;this.ignorecase=false;this.lineNumbers=false;this.desiredCol=null;}
    get dirty(){return this.text!==this.savedText;}
    get row(){return this.text.slice(0,this.pos).split('\n').length-1;}
    get col(){return this.pos-this.lineStart();}
    get rows(){const a=this.text.split('\n');if(a.length>1&&a.at(-1)==='')a.pop();return a;}
    lineStart(pos=this.pos){return pos===0?0:this.text.lastIndexOf('\n',pos-1)+1;}
    lineEnd(pos=this.pos){const n=this.text.indexOf('\n',pos);return n<0?this.text.length:n;}
    status(text,error=false){this.message=text;this.error=error;return false;}
    snapshot(){return {text:this.text,pos:this.pos};}
    remember(){this.undoStack.push(this.snapshot());if(this.undoStack.length>120)this.undoStack.shift();this.redoStack=[];}
    restore(s){this.text=s.text;this.pos=s.pos;this.clamp();}
    clamp(){this.pos=Math.max(0,Math.min(this.pos,this.text.length));if(this.mode==='normal'&&this.text.length){if(this.pos===this.text.length&&this.text.endsWith('\n'))this.pos=Math.max(0,this.pos-1);const end=this.lineEnd();if(this.pos>=end&&end>this.lineStart())this.pos=end-1;}return this.pos;}
    goto(row,col=0){const rows=this.rows;row=Math.max(0,Math.min(row,rows.length-1));this.pos=rows.slice(0,row).reduce((n,s)=>n+s.length+1,0)+Math.min(Math.max(0,col),Math.max(0,rows[row].length-(this.mode==='normal'?1:0)));return this.pos;}
    normal(){if(this.mode==='insert'&&this.insertBefore&&this.insertBefore.text!==this.text){this.undoStack.push(this.insertBefore);if(this.undoStack.length>120)this.undoStack.shift();this.redoStack=[];}if(this.mode==='insert'&&this.pos>this.lineStart())this.pos--;this.insertBefore=null;this.mode='normal';this.pending='';this.count='';this.pendingCount=1;this.pendingHadCount=false;this.clamp();this.message='';this.error=false;}
    insert(where='i'){
      if(this.readonly)return this.status(tr('E45: 読み取り専用です。view は閲覧用です。'),true);
      this.insertBefore=this.snapshot();this.mode='insert';this.pending='';this.count='';
      if(where==='a'&&this.pos<this.lineEnd())this.pos++;
      if(where==='A')this.pos=this.lineEnd();
      if(where==='I'){this.pos=this.lineStart();const m=this.text.slice(this.pos,this.lineEnd()).match(/^\s*/);this.pos+=m?m[0].length:0;}
      if(where==='o'){const end=this.lineEnd();this.text=this.text.slice(0,end)+'\n'+this.text.slice(end);this.pos=end+1;}
      if(where==='O'){const start=this.lineStart();this.text=this.text.slice(0,start)+'\n'+this.text.slice(start);this.pos=start;}
      this.message='-- INSERT --';this.error=false;return true;
    }
    input(text,pos){if(this.mode!=='insert'||this.readonly)return;if(text.length>2097152)return this.status(tr('編集できるテキストは2MiBまでです'),true);this.text=text;this.pos=Math.max(0,Math.min(pos,text.length));this.message='-- INSERT --';this.error=false;}
    undo(){if(!this.undoStack.length)return this.status(tr('これ以上戻せません'));this.redoStack.push(this.snapshot());this.restore(this.undoStack.pop());return this.status(tr('1変更を取り消しました'));}
    redo(){if(!this.redoStack.length)return this.status(tr('これ以上やり直せません'));this.undoStack.push(this.snapshot());this.restore(this.redoStack.pop());return this.status(tr('1変更をやり直しました'));}
    search(pattern,reverse=false,repeat=false){
      if(!pattern)return this.status(tr('検索文字列を入力してください'),true);
      if(pattern.length>512)return this.status(tr('検索は512文字までです'),true);
      let re;try{re=new RegExp(bre(pattern),this.ignorecase?'gi':'g');}catch(_){return this.status(tr('正規表現を解釈できません'),true);}
      if(/\(\?/.test(re.source)||/\([^)]*[*+][^)]*\)[*+{]/.test(re.source))return this.status(tr('この正規表現には対応していません'),true);
      const matches=[];let m;while((m=re.exec(this.text))!==null){matches.push(m.index);if(!m[0])re.lastIndex++;}
      if(!matches.length)return this.status(tr('E486: 見つかりません: ')+pattern,true);
      const direction=reverse?-1:1;
      const found=direction===1?matches.find(p=>p>this.pos):[...matches].reverse().find(p=>p<this.pos);
      this.pos=found===undefined?(direction===1?matches[0]:matches.at(-1)):found;
      this.lastSearch=pattern;if(!repeat)this.searchDirection=direction;this.clamp();this.message=(found===undefined?tr('折り返し検索: '):tr('検索: '))+pattern;this.error=false;return true;
    }
    wordForward(pos,count=1){for(let i=0;i<count;i++){if(pos>=this.text.length)return this.text.length;const word=/[A-Za-z0-9_]/.test(this.text[pos]);const punct=!word&&!/\s/.test(this.text[pos]);if(word)while(pos<this.text.length&&/[A-Za-z0-9_]/.test(this.text[pos]))pos++;else if(punct)while(pos<this.text.length&&!/[A-Za-z0-9_\s]/.test(this.text[pos]))pos++;while(pos<this.text.length&&/\s/.test(this.text[pos]))pos++;}return pos;}
    wordBack(pos,count=1){for(let i=0;i<count;i++){pos=Math.max(0,pos-1);while(pos>0&&/\s/.test(this.text[pos]))pos--;const word=/[A-Za-z0-9_]/.test(this.text[pos]);while(pos>0&&(word?/[A-Za-z0-9_]/.test(this.text[pos-1]):!/\s|[A-Za-z0-9_]/.test(this.text[pos-1])))pos--;}return pos;}
    wordEnd(pos,count=1){for(let i=0;i<count;i++){if(pos<this.text.length-1)pos++;while(pos<this.text.length&&/\s/.test(this.text[pos]))pos++;const word=/[A-Za-z0-9_]/.test(this.text[pos]||'');while(pos<this.text.length-1&&(word?/[A-Za-z0-9_]/.test(this.text[pos+1]):!/\s|[A-Za-z0-9_]/.test(this.text[pos+1])))pos++;}return pos;}
    editRange(start,end,{change=false,yank=false,linewise=false}={}){
      if(!yank&&this.readonly)return this.status(tr('E45: 読み取り専用です'),true);
      start=Math.max(0,start);end=Math.min(this.text.length,end);this.register=this.text.slice(start,end);this.linewise=linewise;
      if(yank)return this.status(tr`${linewise?this.register.split('\n').filter(Boolean).length+tr('行'):this.register.length+tr('文字')}をコピーしました`);
      const before=this.snapshot();if(!change)this.remember();this.text=this.text.slice(0,start)+(change&&linewise&&this.register.endsWith('\n')?'\n':'')+this.text.slice(end);this.pos=Math.min(start,this.text.length);this.clamp();
      if(change){this.insert();this.insertBefore=before;}else this.status(tr('削除しました'));return true;
    }
    key(key,{ctrl=false}={}){
      if(key==='Escape'){this.normal();return true;}
      if(this.mode!=='normal')return false;
      this.error=false;this.message='';
      if(ctrl&&key.toLowerCase()==='r'){this.pending='';this.count='';this.redo();return true;}
      if(ctrl&&['f','b','d','u'].includes(key.toLowerCase())){this.goto(this.row+(['b','u'].includes(key.toLowerCase())?-1:1)*(['d','u'].includes(key.toLowerCase())?10:20),this.col);this.pending='';this.count='';return true;}
      if(ctrl)return false;
      if(this.pending==='r'){const n=this.pendingCount;this.pending='';this.count='';this.pendingCount=1;this.pendingHadCount=false;if(key.length===1&&!this.readonly&&this.pos+n<=this.lineEnd()){this.remember();this.text=this.text.slice(0,this.pos)+key.repeat(n)+this.text.slice(this.pos+n);this.pos+=n-1;}else this.status(this.readonly?tr('E45: 読み取り専用です'):tr('指定した文字数を置換できません'),true);return true;}
      if(/^[0-9]$/.test(key)&&(key!=='0'||this.count)){this.count=(this.count+key).slice(0,4);return true;}
      const n=Math.min(1000,(Number(this.count)||1)*(this.pending?this.pendingCount:1)),hadCount=Boolean(this.count)||(Boolean(this.pending)&&this.pendingHadCount);
      if(this.pending){
        const op=this.pending;this.pending='';this.count='';this.pendingCount=1;this.pendingHadCount=false;
        if(op==='g'&&key==='g'){this.goto(hadCount?n-1:0,0);return true;}
        if(['d','y','c'].includes(op)){
          if(key===op){const start=this.lineStart();let end=start;for(let i=0;i<n;i++){const at=this.text.indexOf('\n',end);end=at<0?this.text.length:at+1;if(end>=this.text.length)break;}this.editRange(start,end,{yank:op==='y',change:op==='c',linewise:true});return true;}
          if(['w','e','$','0'].includes(key)){let end;if(key==='w'&&op==='c'&&!/\s/.test(this.text[this.pos]||'')){let at=this.pos;for(let i=0;i<n;i++){const word=/[A-Za-z0-9_]/.test(this.text[at]||'');while(at<this.text.length&&(word?/[A-Za-z0-9_]/.test(this.text[at]):!/\s|[A-Za-z0-9_]/.test(this.text[at])))at++;if(i<n-1)while(at<this.text.length&&/\s/.test(this.text[at]))at++;}end=at;}else end=key==='w'?this.wordForward(this.pos,n):key==='e'?this.wordEnd(this.pos,n)+1:key==='$'?this.lineEnd():this.lineStart();this.editRange(Math.min(this.pos,end),Math.max(this.pos,end),{yank:op==='y',change:op==='c'});return true;}
        }
        if(op==='Z'&&key==='Z')return {ex:'x'};
        if(op==='Z'&&key==='Q')return {ex:'q!'};
        return this.status(tr('このキーの組合せには対応していません（Escで解除）'),true);
      }
      if(['d','y','c','g','Z','r'].includes(key)){this.pending=key;this.pendingCount=n;this.pendingHadCount=hadCount;this.count='';return true;}
      this.count='';
      if(['h','ArrowLeft','Backspace'].includes(key))this.pos=Math.max(this.lineStart(),this.pos-n);
      else if(['l','ArrowRight',' '].includes(key))this.pos=Math.min(Math.max(this.lineStart(),this.lineEnd()-1),this.pos+n);
      else if(['j','ArrowDown','Enter'].includes(key)){this.desiredCol=this.desiredCol===null?this.col:this.desiredCol;this.goto(this.row+n,key==='Enter'?0:this.desiredCol);return true;}
      else if(['k','ArrowUp'].includes(key)){this.desiredCol=this.desiredCol===null?this.col:this.desiredCol;this.goto(this.row-n,this.desiredCol);return true;}
      else if(key==='0'||key==='Home')this.pos=this.lineStart();
      else if(key==='^'){this.pos=this.lineStart();this.pos+=(this.text.slice(this.pos,this.lineEnd()).match(/^\s*/)||[''])[0].length;}
      else if(key==='$'||key==='End')this.pos=Math.max(this.lineStart(),this.lineEnd()-1);
      else if(key==='G')this.goto(hadCount?n-1:this.rows.length-1,0);
      else if(key==='w')this.pos=this.wordForward(this.pos,n);
      else if(key==='b')this.pos=this.wordBack(this.pos,n);
      else if(key==='e')this.pos=this.wordEnd(this.pos,n);
      else if(['i','I','a','A','o','O'].includes(key)){this.insert(key);return true;}
      else if(key==='x'||key==='Delete')this.editRange(this.pos,Math.min(this.lineEnd(),this.pos+n));
      else if(key==='X')this.editRange(Math.max(this.lineStart(),this.pos-n),this.pos);
      else if(key==='D'||key==='C')this.editRange(this.pos,this.lineEnd(),{change:key==='C'});
      else if(key==='u'){for(let i=0;i<n;i++)this.undo();}
      else if(key==='p'||key==='P'){
        if(this.readonly)return this.status(tr('E45: 読み取り専用です'),true);
        if(!this.register)return this.status(tr('コピーした内容がありません'),true);
        if(this.text.length+this.register.length*n>2097000)return this.status(tr('貼り付け後の内容が2MiBを超えます'),true);
        this.remember();let at=this.linewise?(key==='p'?Math.min(this.text.length,this.lineEnd()+1):this.lineStart()):(key==='p'?Math.min(this.lineEnd(),this.pos+1):this.pos);
        let value=this.register.repeat(n);if(this.linewise){if(!value.endsWith('\n'))value+='\n';if(at===this.text.length&&this.text&&!this.text.endsWith('\n')){value='\n'+value;at=this.text.length;}}
        this.text=this.text.slice(0,at)+value+this.text.slice(at);this.pos=at;this.clamp();
      }
      else if(key==='n'||key==='N'){if(!this.lastSearch)this.status(tr('検索履歴がありません'),true);else this.search(this.lastSearch,(key==='n'?this.searchDirection:-this.searchDirection)<0,true);}
      else if(key===':'||key==='/'||key==='?'){this.mode=key===':'?'command':'search';this.message='';return {prompt:key};}
      else if(key==='J'){
        if(this.readonly)return this.status(tr('E45: 読み取り専用です'),true);
        const end=this.lineEnd();if(end<this.text.length-1){this.remember();const after=this.text.slice(end+1).replace(/^[ \t]+/,'');this.text=this.text.slice(0,end)+' '+after;this.pos=end;}
      } else if(key==='v')this.status(tr('ビジュアルモードは未対応です。yy / dd / p などを使えます。'),true);
      else if(key.length===1)this.status(tr('未対応のキーです。:help で対応操作を確認できます。'),true);
      this.desiredCol=null;this.clamp();return true;
    }
    ex(command){
      this.mode='normal';this.pending='';this.count='';this.error=false;const c=command.trim().replace(/^:/,'');
      if(!c)return this.status('');
      if(/^\d+$/.test(c)){this.goto(+c-1,0);return true;}if(c==='$'){this.goto(this.rows.length-1,0);return true;}
      if(c==='help'||c==='h')return {help:true};
      if(/^set\s+(?:nu|number|nonu|nonumber|ic|ignorecase|noic|noignorecase)$/.test(c)){const opt=c.split(/\s+/)[1];if(['nu','number','nonu','nonumber'].includes(opt))this.lineNumbers=!opt.startsWith('no');else this.ignorecase=!opt.startsWith('no');return this.status(tr('設定: ')+opt);}
      const m=c.match(/^(wq!?|w!?|write!?|q!?|quit!?|x!?|exit!?|e!?|edit!?|r|read|saveas!?|file)(?:\s+(.+))?$/);
      if(m){const op=m[1].replace(/!$/,''),force=m[1].endsWith('!'),path=m[2];if(['q','quit'].includes(op)){if(this.dirty&&!force)return this.status(tr('E37: 未保存の変更があります。保存は :w、破棄して閉じるには :q!'),true);return {close:true};}return {action:op,force,path};}
      if(c.startsWith('!'))return this.status(tr('このviから外部コマンドは呼び出せません。:qで端末へ戻れます。'),true);
      const sub=c.match(/^(%|\d+(?:,\d+)?)?s([^A-Za-z0-9\s])(.*)$/);
      if(sub){
        if(this.readonly)return this.status(tr('E45: 読み取り専用です'),true);
        const delim=sub[2],parts=[];let part='',rest=sub[3],i=0;
        for(;i<rest.length;i++){const x=rest[i];if(x==='\\'&&i+1<rest.length){const next=rest[++i];part+=next===delim?next:'\\'+next;continue;}if(x===delim){parts.push(part);part='';if(parts.length===2){i++;break;}}else part+=x;}
        if(parts.length!==2)return this.status(tr('置換は :s/元/先/g の形式で入力してください'),true);
        const flags=rest.slice(i);if(!/^[gi]*$/.test(flags))return this.status(tr('置換フラグは g / i に対応しています'),true);
        const pattern=parts[0]||this.lastSearch;if(!pattern)return this.status(tr('検索文字列がありません'),true);
        let re;try{const src=bre(pattern);if(pattern.length>512||/\(\?/.test(src)||/\([^)]*[*+][^)]*\)[*+{]/.test(src))throw Error();re=new RegExp(src,(flags.includes('g')?'g':'')+(flags.includes('i')||this.ignorecase?'i':''));}catch(_){return this.status(tr('この正規表現には対応していません'),true);}
        const rows=this.text.split('\n'),range=sub[1];let first=this.row,last=this.row;if(range==='%'){first=0;last=rows.length-1;}else if(range){const nums=range.split(',').map(Number);first=nums[0]-1;last=(nums[1]||nums[0])-1;}if(first<0||last<first||last>=rows.length)return this.status(tr('行の範囲が正しくありません'),true);
        const before=this.snapshot();let changed=0;
        for(let r=first;r<=last;r++){re.lastIndex=0;rows[r]=rows[r].replace(re,(...args)=>{changed++;const full=args[0],groups=args.slice(1,-2);return parts[1].replace(/\\([1-9&\\])|&/g,(x,g)=>g?(g==='&'?'&':g==='\\'?'\\':groups[+g-1]||''):full);});}
        if(!changed)return this.status(tr('E486: 見つかりません: ')+pattern,true);
        this.undoStack.push(before);this.redoStack=[];this.text=rows.join('\n');this.goto(Math.min(first,this.rows.length-1),0);this.lastSearch=pattern;return this.status(changed+tr('箇所を置換しました'));
      }
      return this.status(tr('E492: 未対応のコマンドです。:help で対応操作を確認できます。'),true);
    }
    markSaved(){this.savedText=this.text;this.status('"'+this.path+'" '+this.rows.length+tr('行 保存しました'));}
  }
  root.LogLabVi=LogLabVi;
})(globalThis);
