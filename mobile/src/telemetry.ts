import AsyncStorage from "@react-native-async-storage/async-storage";
import{read}from "./library";import{Platform}from "react-native";
const TYPES=new Set(["app_open","search","play_started","play_completed","play_error","notification_opt_in"]);
let installIdCache:string|null=null;
async function id(){
 if(installIdCache)return installIdCache;
 const stored=await AsyncStorage.getItem("pinflix-anonymous-install-id");
 if(stored&&/^[A-Za-z0-9-]{16,100}$/.test(stored)){installIdCache=stored;return stored;}
 const fresh="pf-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,15)+"-"+Math.random().toString(36).slice(2,15);
 installIdCache=fresh;await AsyncStorage.setItem("pinflix-anonymous-install-id",fresh);return fresh;
}
export function track(event:string,data:Record<string,string|number|boolean>={}){
 if(!TYPES.has(event)||!read().preferences.telemetry)return;
 const properties=Object.fromEntries(Object.entries(data).filter(([k,v])=>k.length<30&&(typeof v!=="string"||v.length<75)));
 void (async()=>{
  try{
   if(!read().preferences.telemetry)return;
   const installId=await id();
   if(!read().preferences.telemetry)return;
   await fetch("https://admin.pincodeit.com/api/pinflix/events",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({event,platform:Platform.OS,installId,consent:true,properties,at:Date.now(),version:"2.0.0"})});
  }catch{}
 })();
}
