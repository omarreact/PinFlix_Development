import {NativeModules} from "react-native";
import type {Catalogue,Detail,Playback} from "./types";

type DirectSource={
 catalogue:(kind:string,page:number,query:string,category:string,year:string,language:string,quality:string,sort:string)=>Promise<Catalogue>;
 detail:(id:string,season:number)=>Promise<Detail>;
 playback:(id:string,season:number,episode:number)=>Promise<Playback & {transport:"direct";headers:Record<string,string>}>;
};
function native():DirectSource{
 const source=NativeModules.PinFlixDirect as DirectSource|undefined;
 if(!source)throw new Error("Native PinFlix provider is missing. Install the standalone direct-source APK.");
 return source;
}
export async function catalogue(p:Record<string,string|number|boolean|undefined>={}):Promise<Catalogue>{
 const kind=p.kind==="movie"||p.kind==="series"?String(p.kind):"all";
 return native().catalogue(kind,Math.max(1,Number(p.page)||1),
   String(p.q||""),String(p.category||""),String(p.year||""),
   String(p.language||""),String(p.quality||""),String(p.sort||"recent"));
}
export const detail=(id:string,season=1)=>native().detail(id,season);
export const playback=(id:string,season=1,episode=1)=>native().playback(id,season,episode);
const IMAGE_HOSTS=new Set(["cineplexbd.net","cds3.cineplexbd.net"]);
/** Artwork is returned directly from the same approved origin as the old APK. */
export function artworkUrl(raw:string|null|undefined):string|undefined{
 if(!raw)return undefined;
 try{
  const url=new URL(raw);
  if(url.protocol!=="http:"&&url.protocol!=="https:")return undefined;
  if(!IMAGE_HOSTS.has(url.hostname.toLowerCase())||url.username||url.password)return undefined;
  if(url.port&&url.port!=="80"&&url.port!=="443")return undefined;
  return url.toString();
 }catch{return undefined;}
}
