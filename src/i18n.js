/* Offline localization. Case IDs, answers, evidence, and log records stay canonical. */
(function(root){
  'use strict';
  const languages=['ja','en','th'];
  let locale='ja';
  const staticNodes=[],staticAttributes=[];
  let originalTitle='';
  function t(input,...values){
    if(input===undefined||input===null)return input;
    const tagged=Array.isArray(input)&&Object.prototype.hasOwnProperty.call(input,'raw');
    const key=tagged?input.map((part,i)=>part+(i<values.length?'{'+i+'}':'')).join(''):String(input);
    const catalog=root.LOGROOM_UI_TRANSLATIONS?.[locale]||{};
    let translated=locale==='ja'?key:catalog[key];
    if(translated===undefined){
      const trimmed=key.trim();
      translated=locale!=='ja'&&catalog[trimmed]!==undefined?key.slice(0,key.indexOf(trimmed))+catalog[trimmed]+key.slice(key.indexOf(trimmed)+trimmed.length):key;
    }
    // Callback replacement never interprets $&, backslashes, or braces in user data.
    return tagged?translated.replace(/\{(\d+)\}/g,(match,n)=>+n<values.length?String(values[+n]):match):translated;
  }
  function setLocale(value){locale=languages.includes(value)?value:'ja';return locale;}
  function captureStatic(document){
    originalTitle=document.title;
    const walker=document.createTreeWalker(document.body,4);
    let text;
    while((text=walker.nextNode())){
      if(!text.textContent.trim()||text.parentElement?.closest('script,style,textarea,[data-language-name]'))continue;
      staticNodes.push([text,text.textContent]);
    }
    for(const element of document.body.querySelectorAll('*'))for(const name of ['aria-label','placeholder','title']){
      if(element.hasAttribute(name))staticAttributes.push([element,name,element.getAttribute(name)]);
    }
  }
  function applyStatic(document){
    document.documentElement.lang=locale;
    document.title=t(originalTitle);
    for(const [node,value]of staticNodes)if(node.isConnected)node.textContent=t(value);
    for(const [element,name,value]of staticAttributes)if(element.isConnected)element.setAttribute(name,t(value));
    const selector=document.getElementById('language-select');if(selector)selector.value=locale;
  }
  function localizeCases(cases,language=locale){
    if(language==='ja')return cases;
    const catalog=root.LOGROOM_CASE_TRANSLATIONS?.[language]||{};
    return cases.map(base=>{
      const localized=JSON.parse(JSON.stringify(base));
      for(const [key,value]of Object.entries(catalog[base.id]||{})){
        if(key.startsWith('fileTexts.'))continue;
        const parts=key.split('.');let target=localized;
        for(const part of parts.slice(0,-1)){if(target[part]===undefined)throw Error('Invalid locale path '+base.id+': '+key);target=target[part];}
        const last=parts.at(-1);if(typeof target[last]!=='string')throw Error('Invalid locale value '+base.id+': '+key);
        target[last]=value;
      }
      const texts=catalog[base.id]||{};
      if(texts['fileTexts.normalReadme'])localized.baselineFiles['/home/analyst/README.txt']=texts['fileTexts.normalReadme'];
      if(texts['fileTexts.attackedReadme'])localized.files['/home/analyst/README.txt']=texts['fileTexts.attackedReadme'];
      return localized;
    });
  }
  root.LogroomI18n=Object.freeze({t,setLocale,localizeCases,captureStatic,applyStatic,languages,get locale(){return locale;}});
})(globalThis);
