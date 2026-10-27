import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import {Platform} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {preference} from "./library";
const ENDPOINT="https://admin.pincodeit.com/api/pinflix/devices";
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export async function enableAlerts(){
 const old=await Notifications.getPermissionsAsync();const allowed=old.granted?old:await Notifications.requestPermissionsAsync();
 if(!allowed.granted)return false;
 if(Platform.OS==="android")await Notifications.setNotificationChannelAsync("releases",{name:"New releases",importance:Notifications.AndroidImportance.DEFAULT});
 const projectId=process.env.EXPO_PUBLIC_EAS_PROJECT_ID||Constants.expoConfig?.extra?.eas?.projectId;
 if(!projectId)throw new Error("Push delivery is not yet configured.");
 const token=await Notifications.getExpoPushTokenAsync({projectId});
 const res=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:token.data,platform:Platform.OS,consent:true})});
 if(!res.ok)throw new Error("Push subscription is not yet available.");
 await AsyncStorage.setItem("pinflix-push-token",token.data);
 await preference("notifications",true);
 return true;
}
export async function disableAlerts(){
 await preference("notifications",false);
 try{
  const token=await AsyncStorage.getItem("pinflix-push-token");
  if(token){
   const res=await fetch(ENDPOINT,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,platform:Platform.OS,consent:true})});
   if(res.ok)await AsyncStorage.removeItem("pinflix-push-token");
  }
 }catch{}
}
