// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../addon/experiment.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('const GROUP_PREF'),source.indexOf('function rememberEmail'));
let now=0,next=0,sounds=0,native=0;const timers=new Map(),alerts=[],saved=[];
const prefs=new Map([['mail.biff.show_alert',true],['mail.biff.play_sound',true]]),observers=new Map();
const manager={_osIntegration:{isInDoNotDisturbMode:false},_notifyNewMail(){native++},_getNewMsgKeysNotNotified:f=>f.keys,_saveNotificationTime(f){saved.push(f.URI);f.keys=[]},playSound(branch){assert.equal(branch,'mail.biff.play_sound');sounds++}};
const original=manager._notifyNewMail;
const timerAPI={setTimeout(fn,ms){const id=++next;timers.set(id,{fn,at:now+ms});return id},clearTimeout(id){timers.delete(id)}};
const Services={prefs:{getBoolPref:(p,d)=>prefs.get(p)??d,getIntPref:(p,d)=>prefs.get(p)??d,getBranch:p=>p,addObserver:(p,f)=>observers.set(p,f),removeObserver:p=>observers.delete(p)}};
const Cc={'@mozilla.org/alert-notification;1':{createInstance(){return{initWithObject(data){Object.assign(this,data)}}}},'@mozilla.org/system-alerts-service;1':{getService(){return{showAlert(a){alerts.push(a)}}}}};
const context=vm.createContext({ChromeUtils:{importESModule:p=>p.includes('Timer.sys')?timerAPI:{MailNotificationManager:manager}},Services,Cc,Ci:{nsMsgFolderFlags:{Inbox:1,SpecialUse:2,Virtual:4}},Cu:{reportError:e=>{throw e}}});
vm.runInContext(code+';globalThis.stop=groupMailNotifications()',context);
const tick=ms=>{now+=ms;for(const[id,t]of timers)if(t.at<=now){timers.delete(id);t.fn()}};
const set=(p,v)=>{prefs.set(p,v);observers.get(p)?.()};
const enabled='extensions.thundercards.groupNotifications',delay='extensions.thundercards.notificationDelay';
const folder=(uri,keys)=>({URI:uri,keys,flags:1,descendants:[],server:{type:'imap'}});
await manager._notifyNewMail(folder('a',[1]));assert.equal(native,1,'default off');
set(enabled,true);
const a=folder('a',[1,2]),b=folder('b',[1]);await manager._notifyNewMail(a);tick(4000);await manager._notifyNewMail(b);tick(4000);assert.equal(sounds,0);tick(1000);
assert.equal(sounds,1);assert.equal(alerts.length,1);assert.equal(alerts[0].text,'You have 3 new emails.');assert.equal(alerts[0].silent,true);
await manager._notifyNewMail(a);tick(6000);assert.equal(sounds,1);
for(const seconds of [3,5,10,15]){set(delay,seconds);a.keys=[seconds];await manager._notifyNewMail(a);const before=sounds;tick(seconds*1000-1);assert.equal(sounds,before);tick(1);assert.equal(sounds,before+1)}
set('mail.biff.play_sound',false);a.keys=[20];await manager._notifyNewMail(a);const quiet=sounds;tick(15000);assert.equal(sounds,quiet);
set('mail.biff.show_alert',false);set('mail.biff.play_sound',true);a.keys=[21];await manager._notifyNewMail(a);const alertCount=alerts.length;tick(15000);assert.equal(alerts.length,alertCount);assert.equal(sounds,quiet+1);
manager._osIntegration.isInDoNotDisturbMode=true;a.keys=[22];await manager._notifyNewMail(a);tick(15000);assert.equal(sounds,quiet+1);manager._osIntegration.isInDoNotDisturbMode=false;
a.keys=[23];await manager._notifyNewMail(a);set(enabled,false);tick(15000);assert.equal(sounds,quiet+1);
await manager._notifyNewMail(a);assert.equal(native,2);set(enabled,true);await manager._notifyNewMail({...a,server:{type:'rss'}});assert.equal(native,3);
context.stop();assert.equal(manager._notifyNewMail,original);assert.equal(observers.size,0);assert.equal(timers.size,0);
console.log('PASS: default off; cross-account totals; all four delays; debounce; duplicates; sound/alert preferences; DND; RSS delegation; cancellation; teardown.');
