import{read}from "./library";import{Platform}from "react-native";
const TYPES=new Set(["app_open","search","play_started","play_completed","play_error","notification_opt_in"]);
export function track(event:string,data:Record<string,string|number|boolean>={}){
 if(!TYPES.has(event)||!read().preferences.telemetry)return;
 const properties=Object.fromEntries(Object.entries(data).filter(([k,v])=>k.length<30&&(typeof v!=="string"||v.length<75)));
 void fetch("https://admin.pincodeit.com/api/pinflix/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event,platform:Platform.OS,properties,at:Date.now(),version:"2.0.0"})}).catch(()=>{});
}
