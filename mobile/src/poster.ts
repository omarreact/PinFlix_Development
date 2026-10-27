import {artworkUrl} from "./api";

export async function loadPoster(raw:string|null|undefined):Promise<string|undefined>{
 return artworkUrl(raw);
}
