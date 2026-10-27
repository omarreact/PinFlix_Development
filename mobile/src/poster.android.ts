import {NativeModules} from "react-native";
import {artworkUrl} from "./api";

const cache=new Map<string,Promise<string|undefined>>();
/** Artwork bytes are fetched by the original Java ProviderClient, with its cookies and Referer. */
export function loadPoster(raw:string|null|undefined):Promise<string|undefined>{
 const url=artworkUrl(raw);
 if(!url)return Promise.resolve(undefined);
 const saved=cache.get(url);
 if(saved)return saved;
 const module=NativeModules.PinFlixDirect as {poster?:(url:string)=>Promise<string>}|undefined;
 if(!module?.poster)return Promise.resolve(undefined);
 const request=module.poster(url).then(value=>value.startsWith("data:image/jpeg;base64,")?value:undefined).catch(()=>{
  cache.delete(url);
  return undefined;
 });
 if(cache.size>=80){const oldest=cache.keys().next().value;if(oldest)cache.delete(oldest);}
 cache.set(url,request);
 return request;
}
