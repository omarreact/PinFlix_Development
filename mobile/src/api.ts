import type {Catalogue,Detail,Playback} from "./types";

/**
 * All mobile catalogue, detail and playback requests must target the
 * CineplexBD-only PinFlix_Development backend.
 * The final hostname currently serves another codebase; do not select it
 * until the source-only release gate and production migration have passed.
 */
const STAGING_API="https://pin-flix.pincodeit.com";
const RELEASE_API="https://pinflix.pincodeit.com";
const specified=process.env.EXPO_PUBLIC_PINFLIX_API_ORIGIN || STAGING_API;
const API=(() => {
 const url=new URL(specified);
 if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash)
   throw new Error("Invalid PinFlix API endpoint.");
 if(![STAGING_API,RELEASE_API].includes(url.origin))
   throw new Error("Unknown PinFlix catalogue backend.");
 if(url.origin===RELEASE_API&&process.env.EXPO_PUBLIC_PINFLIX_RELEASE_APPROVED!=="true")
   throw new Error("Final PinFlix backend is not cleared for release.");
 return url.origin;
})();
export const apiOrigin=API;
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
