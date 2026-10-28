import {preference} from "./library";
export async function enableAlerts():Promise<boolean>{
 throw new Error("Remote notifications are unavailable in the standalone direct-source edition.");
}
export async function disableAlerts():Promise<void>{
 await preference("notifications",false);
}
