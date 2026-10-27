import type {Catalogue,Detail,Playback} from "./types";
const API="https://pinflix.pincodeit.com";
export async function request<T>(resource:string, params:Record<string,string|number|boolean|undefined>={}):Promise<T>{
 const q=new URLSearchParams();
 for(const [k,v] of Object.entries(params))if(v!==undefined&&v!=="")q.set(k,String(v));
 const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),16000);
 try{
  const r=await fetch(`${API}/api/${resource}/?${q.toString()}`,{signal:abort.signal,headers:{Accept:"application/json"}});
  if(!r.ok)throw new Error(r.status===429?"Too many requests. Try again shortly.":"Content is currently unavailable.");
  const data=await r.json();if(data.error)throw new Error("Content unavailable.");
  return data as T;
 }finally{clearTimeout(timer);}
}
export const catalogue=(p:Record<string,string|number|boolean|undefined>)=>request<Catalogue>("catalogue",p);
export const detail=(id:string,season=1)=>request<Detail>("detail",{id,season});
export const playback=(id:string,season=1,episode=1)=>request<Playback>("playback",{id,season,episode});
export function streamUrl(raw:string){const url=new URL(raw,API);if(url.protocol!=="https:"||url.origin!==API||!url.pathname.startsWith("/api/stream/"))throw new Error("Untrusted playback source.");return url.toString();}

// HTTPS artwork relay keeps Android and iOS rendering compatible with legacy upstream images.
export function artworkUrl(raw:string|null|undefined):string|undefined{
 if(!raw)return undefined;
 try{
  const uri=new URL(raw,API);
  if(uri.origin===API&&uri.protocol==="https:")return uri.toString();
  if(!["http:","https:"].includes(uri.protocol)||uri.username||uri.password)return undefined;
  return API+"/api/artwork?url="+encodeURIComponent(uri.toString());
 }catch{return undefined;}
}
