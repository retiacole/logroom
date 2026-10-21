/* Decorative, browser-local sl. No commands, files, or network are involved. */
(function(root){
  'use strict';
  const tr = (...args) => root.LogroomI18n ? root.LogroomI18n.t(...args) : Array.isArray(args[0]) ? args[0].reduce((s,p,i)=>s+p+(i<args.length-1?args[i+1]:''),'') : args[0];
  const DURATION=5000;
  // Original Logroom line art; the traditional sl program is not bundled.
  const BODY=[
    '             ___              ______________     _______________',
    '            |   |            |  LOGROOM  01  |   |   NIGHT MAIL  |',
    '         ___|   |____________|  []      []  |   | [] [] [] [] [] |',
    '       /  .----------------. |              |   |               |',
    '      <   |     LOGROOM     | |______________|---|_______________|',
    '       \\__|________________|_/______________|    |_______________|'
  ];
  const WHEELS=[
    '          (o)====(o)====(o)        (o)==(o)          (o)====(o)',
    '          (/)----(/)----(/)        (/)--(/)          (/)----(/)',
    '          (-)====(-)====(-)        (-)==(-)          (-)====(-)',
    '          (\\)----(\\)----(\\)        (\\)--(\\)          (\\)----(\\)'
  ];
  function play(container,{reducedMotion=false,onDone}={}){
    if(!container||!container.ownerDocument||typeof container.appendChild!=='function')throw new TypeError('sl: terminal container is required');
    const doc=container.ownerDocument,view=doc.defaultView||root;
    const now=()=>view.performance&&typeof view.performance.now==='function'?view.performance.now():Date.now();
    const schedule=typeof view.requestAnimationFrame==='function'?fn=>view.requestAnimationFrame(fn):fn=>view.setTimeout(()=>fn(now()),16);
    const unschedule=typeof view.cancelAnimationFrame==='function'?id=>view.cancelAnimationFrame(id):id=>view.clearTimeout(id);
    const scene=doc.createElement('section');scene.className='sl-scene'+(reducedMotion?' sl-still':'');scene.setAttribute('aria-label',tr('sl 蒸気機関車'));
    const header=doc.createElement('div');header.className='sl-heading';
    const title=doc.createElement('strong');title.textContent=tr('sl / 蒸気機関車');header.appendChild(title);
    const badge=doc.createElement('span');badge.className='sl-badge';badge.textContent='NOW PASSING';badge.setAttribute('aria-hidden','true');header.appendChild(badge);scene.appendChild(header);
    const stage=doc.createElement('div');stage.className='sl-stage';stage.setAttribute('aria-hidden','true');scene.appendChild(stage);
    const train=doc.createElement('div');train.className='sl-train';stage.appendChild(train);
    const smoke=doc.createElement('div');smoke.className='sl-smoke';
    ['.','o','( )','(  )'].forEach((s,i)=>{const puff=doc.createElement('span');puff.textContent=s;puff.style.setProperty('--puff',String(i));smoke.appendChild(puff);});train.appendChild(smoke);
    const ascii=doc.createElement('pre');ascii.className='sl-ascii';ascii.textContent=BODY.concat(WHEELS[0]).join('\n');train.appendChild(ascii);
    const rail=doc.createElement('div');rail.className='sl-rail';stage.appendChild(rail);
    const status=doc.createElement('p');status.className='sl-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent=tr('蒸気機関車が通過しています。通過するまでお待ちください。Ctrl+Cでは止まりません。');scene.appendChild(status);
    container.appendChild(scene);
    let finished=false,frameId=null,timerId=null,lastWheel=-1;
    function finish(cancelled){
      if(finished)return;finished=true;
      if(frameId!==null){unschedule(frameId);frameId=null;}
      if(timerId!==null){view.clearTimeout(timerId);timerId=null;}
      scene.remove();
      if(typeof onDone==='function')onDone({cancelled:Boolean(cancelled)});
    }
    const start=now();
    if(reducedMotion){
      train.style.transform='translateX(0px)';
      timerId=view.setTimeout(()=>finish(false),DURATION);
    }else{
      const render=(time)=>{
        if(finished)return;
        const elapsed=Math.max(0,time-start),progress=Math.min(1,elapsed/DURATION);
        const width=stage.clientWidth||container.clientWidth||320;
        const trainWidth=train.getBoundingClientRect().width||72*7.2;
        train.style.transform='translateX('+(width+16-(width+trainWidth+32)*progress).toFixed(2)+'px)';
        const wheel=Math.floor(elapsed/120)%WHEELS.length;
        if(wheel!==lastWheel){ascii.textContent=BODY.concat(WHEELS[wheel]).join('\n');lastWheel=wheel;}
        if(progress>=1){finish(false);return;}
        frameId=schedule(render);
      };
      train.style.transform='translateX('+((stage.clientWidth||320)+16)+'px)';
      frameId=schedule(render);
    }
    // Lifecycle cleanup only. The application deliberately does not bind Ctrl+C.
    return {cancel(){finish(true);}};
  }
  root.LogLabTrain=Object.freeze({play});
})(globalThis);
