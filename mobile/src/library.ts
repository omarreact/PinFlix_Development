import AsyncStorage from "@react-native-async-storage/async-storage";
import type{Progress,Title}from "./types";import{progressKey}from "./types";
export type Preferences={notifications:boolean;telemetry:boolean;background:boolean;intro:boolean;region:string;autoNext:boolean;speed:number;repeat:boolean};
export type Library={saved:Record<string,Title>;progress:Record<string,Progress>;queue:{id:string;season:number;episode:number}[];preferences:Preferences};
const blank:Library={saved:{},progress:{},queue:[],preferences:{notifications:false,telemetry:false,background:false,intro:true,region:"Global",autoNext:true,speed:1,repeat:false}};
let current:Library=JSON.parse(JSON.stringify(blank));
const listeners=new Set<(l:Library)=>void>();export function read(){return current;}
export function watch(cb:(l:Library)=>void){listeners.add(cb);return()=>{listeners.delete(cb);};}
function emit(){for(const f of listeners)f({...current});}
export async function hydrate(){try{const str=await AsyncStorage.getItem("pinflix-v2");if(str){const s=JSON.parse(str);current={...blank,...s,preferences:{...blank.preferences,...s.preferences}};}}catch{}emit();}
let writing=Promise.resolve();
export function save(){emit();const json=JSON.stringify(current);writing=writing.then(()=>AsyncStorage.setItem("pinflix-v2",json)).catch(()=>{});return writing;}
export function toggleSaved(t:Title){if(current.saved[t.id])delete current.saved[t.id];else current.saved[t.id]=t;return save();}
export function preference<K extends keyof Preferences>(k:K,v:Preferences[K]){current.preferences[k]=v;return save();}
export function progress(t:Title,s:number,e:number,p:number,d:number){if(!Number.isFinite(p)||!Number.isFinite(d)||p<0)return;const key=progressKey(t.id,s,e);const complete=d>60&&p/d>=.95;current.progress[key]={id:t.id,title:t,season:s,episode:e,position:complete?0:Math.floor(p),duration:d,updatedAt:Date.now(),completed:complete};void save();}
export function lastPosition(id:string,s:number,e:number){const p=current.progress[progressKey(id,s,e)];return p&&!p.completed?p.position:0;}
export function addToQueue(id:string,season=1,episode=1){if(!current.queue.some(x=>x.id===id&&x.season===season&&x.episode===episode))current.queue.push({id,season,episode});return save();}
export function dequeue(){const item=current.queue.shift();void save();return item;}
export function clearHistory(){current.progress={};return save();}
