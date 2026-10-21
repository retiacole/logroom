'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let time=0,nextId=1,checks=0;
const frames=new Map(),timers=new Map();
class Element{
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.parentNode=null;this.clientWidth=320;this.style={setProperty(k,v){this[k]=v;}};this.attributes={};this.textContent='';}
  appendChild(el){el.parentNode=this;this.children.push(el);return el;}
  setAttribute(k,v){this.attributes[k]=v;}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(c=>c!==this);this.parentNode=null;}}
  getBoundingClientRect(){return{width:this.className==='sl-train'?510:this.clientWidth};}
}
const view={performance:{now:()=>time},requestAnimationFrame(fn){const id=nextId++;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);},setTimeout(fn,ms){const id=nextId++;timers.set(id,{fn,at:time+ms});return id;},clearTimeout(id){timers.delete(id);}};
const doc={defaultView:view,createElement(tag){return new Element(tag,doc);}};
const context=vm.createContext({globalThis:{}});vm.runInContext(fs.readFileSync(__dirname+'/../src/sl.js','utf8'),context);
const api=context.globalThis.LogLabTrain;
function equal(actual,expected){assert.equal(actual,expected);checks++;}
function tick(ms){time+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));for(const[id,t]of [...timers])if(t.at<=time){timers.delete(id);t.fn();}}
const out=new Element('div',doc);let calls=[];
const first=api.play(out,{onDone:r=>calls.push(r.cancelled)});
equal(out.children.length,1);equal(out.children[0].className,'sl-scene');
const scene=out.children[0],stage=scene.children[1],train=stage.children[0],status=scene.children[2];
equal(stage.attributes['aria-hidden'],'true');equal(status.attributes.role,'status');
assert.match(status.textContent,/Ctrl\+Cでは止まりません/);checks++;
equal(scene.children.some(n=>n.tagName==='button'),false);
tick(2500);assert.match(train.style.transform,/-95\.00px/);checks++;
equal(calls.length,0);tick(2500);equal(out.children.length,0);equal(calls.join(','),'false');equal(frames.size,0);
first.cancel();equal(calls.length,1);
calls=[];const second=api.play(out,{onDone:r=>calls.push(r.cancelled)});second.cancel();second.cancel();
equal(calls.join(','),'true');equal(out.children.length,0);equal(frames.size,0);
calls=[];const third=api.play(out,{reducedMotion:true,onDone:r=>calls.push(r.cancelled)});
equal(out.children[0].className,'sl-scene sl-still');equal(frames.size,0);equal(timers.size,1);tick(4999);equal(calls.length,0);equal(out.children.length,1);tick(1);equal(calls.join(','),'false');equal(out.children.length,0);equal(timers.size,0);third.cancel();equal(calls.length,1);
calls=[];const fourth=api.play(out,{reducedMotion:true,onDone:r=>calls.push(r.cancelled)});fourth.cancel();equal(timers.size,0);equal(calls.join(','),'true');
assert.throws(()=>api.play(null),/container/);checks++;
console.log(`sl: ${checks} checks passed; animation, accessible status, five-second reduced motion, cancellation cleanup.`);
