import {playback} from "./api";
export type MobileSource=Awaited<ReturnType<typeof playback>>;
export async function resolveMobilePlayback(id:string,season=1,episode=1):Promise<MobileSource>{
 // Direct Java CineplexBD client from the original PinFlix Sources APK.
 // No Vercel, Cloudflare, PHP fallback, web backend or signed proxy.
 return playback(id,season,episode);
}
