import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import {Platform} from "react-native";
import {preference} from "./library";
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export async function enableAlerts(){
 const p=await Notifications.getPermissionsAsync();const a=p.granted?p:await Notifications.requestPermissionsAsync();
 if(!a.granted)return false;
 if(Platform.OS==="android")await Notifications.setNotificationChannelAsync("releases",{name:"New releases",importance:Notifications.AndroidImportance.DEFAULT});
 const projectId=process.env.EXPO_PUBLIC_EAS_PROJECT_ID||Constants.expoConfig?.extra?.eas?.projectId;
 if(projectId){
  const token=await Notifications.getExpoPushTokenAsync({projectId});
  const res=await fetch("https://admin.pincodeit.com/api/pinflix/devices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:token.data,platform:Platform.OS})});
  if(!res.ok)throw new Error("Push registration is not configured.");
 }else throw new Error("Push delivery is not configured yet.");
 await preference("notifications",true);return true;
}
