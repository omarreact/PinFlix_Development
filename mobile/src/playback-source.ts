import {Platform} from "react-native";
import type {Playback} from "./types";
import {playback,streamUrl} from "./api";
import {resolveLegacyDirect,type LegacySource} from "./legacy-source";

export type MobileSource=(Playback & {transport:"proxy"})|LegacySource;

/**
 * Keep the signed HTTPS server proxy for web/iOS and first choice on Android.
 * When the backend explicitly finds no playable source, Android can use the
 * exact legacy on-device CineplexBD resolver from the working v1.1 app.
 * Do not circumvent restrictions, paywalls, or source authorization errors.
 */
export async function resolveMobilePlayback(
  id:string,season=1,episode=1,
):Promise<MobileSource>{
  let remote:Playback;
  try{remote=await playback(id,season,episode);}
  catch(err){
    // Network failures to PinFlix do not imply authorization restrictions.
    // The app's legacy Android source works independently of the server.
    if(Platform.OS==="android")return resolveLegacyDirect(id,season,episode);
    throw err;
  }
  if(remote.status==="ready"&&remote.url){
    const approved=streamUrl(remote.url);
    return {...remote,url:approved,transport:"proxy"};
  }
  if(remote.status==="restricted"||remote.status==="authorization_required"||remote.status==="unsupported"){
    throw new Error(remote.message||"Playback is unavailable for this title.");
  }
  if(Platform.OS==="android")return resolveLegacyDirect(id,season,episode);
  throw new Error(remote.message||"No playable source is available.");
}
