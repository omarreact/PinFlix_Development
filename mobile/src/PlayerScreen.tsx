import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,BackHandler,Dimensions,Image,Pressable,ScrollView,StatusBar,StyleSheet,Text,View} from "react-native";
import Slider from "@react-native-community/slider";
import {useVideoPlayer,VideoView} from "expo-video";
import * as Orientation from "expo-screen-orientation";
import {C,CREDIT} from "./theme";
import type{Detail,Title,Playback}from "./types";
import {playback,streamUrl} from "./api";
import {progress,lastPosition,read,preference,addToQueue} from "./library";
import {track} from "./telemetry";
export type PlayerProps={title:Title;detail:Detail|null;season:number;episode:number;onClose:()=>void;onNext:(season:number,episode:number)=>void};
const speeds=[.5,.75,1,1.25,1.5,2,3,4];
const time=(n:number)=>{const t=Math.max(0,Math.floor(n));return Math.floor(t/60)+":"+String(t%60).padStart(2,"0");};
function Btn({label,onPress}:{label:string;onPress:()=>void}){return <Pressable onPress={onPress} style={s.btn}><Text style={s.btnTxt}>{label}</Text></Pressable>;}
export default function PlayerScreen({title,detail,season,episode,onClose,onNext}:PlayerProps){
 const player=useVideoPlayer(null,p=>{p.timeUpdateEventInterval=1;});
 const [status,setStatus]=useState("Connecting…");
 const [error,setError]=useState("");
 const [playing,setPlaying]=useState(false);
 const [position,setPosition]=useState(0);
 const [duration,setDuration]=useState(0);
 const [show,setShow]=useState(true);
 const [locked,setLocked]=useState(false);
 const [intro,setIntro]=useState(false);
 const [speed,setSpeed]=useState(read().preferences.speed);
 const [fit,setFit]=useState<"contain"|"cover">("contain");
 const [panel,setPanel]=useState<"speed"|"quality"|"audio"|"subtitle"|null>(null);
 const [resumed,setResumed]=useState(0);
 const positionRef=useRef(0),lastSaved=useRef(0);
 const episodeList=detail?.episodes||[];
 const idx=episodeList.findIndex(e=>e.number===episode);
 const next=idx>=0?episodeList[idx+1]:undefined;
 useEffect(()=>{void Orientation.lockAsync(Orientation.OrientationLock.LANDSCAPE).catch(()=>{});
 const back=BackHandler.addEventListener("hardwareBackPress",()=>{onClose();return true;});
 return()=>{back.remove();void Orientation.unlockAsync().catch(()=>{});};},[onClose]);
 useEffect(()=>{
  const a=player.addListener("playingChange",ev=>setPlaying(ev.isPlaying));
  const b=player.addListener("statusChange",ev=>{if(ev.status==="readyToPlay")setStatus("");if(ev.status==="loading")setStatus("Loading…");if(ev.status==="error"){setError("Video unavailable.");track("play_error",{id:title.id});}});
  const c=player.addListener("timeUpdate",ev=>{const p=Math.max(0,ev.currentTime);positionRef.current=p;setPosition(p);setDuration(player.duration||0);
   if(p-lastSaved.current>=10){lastSaved.current=p;progress(title,season,episode,p,player.duration||0);}
  });
  const d=player.addListener("playToEnd",()=>{progress(title,season,episode,player.duration,player.duration);track("play_completed",{id:title.id});if(next&&read().preferences.autoNext)onNext(season,next.number);else setShow(true);});
  return()=>{a.remove();b.remove();c.remove();d.remove();};
 },[title,season,episode,player,next,onNext]);
 useEffect(()=>{
  let active=true;let introTimer:ReturnType<typeof setTimeout>|undefined;
  const start=async()=>{
   try{
    const data=await playback(title.id,season,episode);
    if(!active)return;
    if(data.status!=="ready"||!data.url)throw Error(data.message||"Playback not available.");
    const url=streamUrl(data.url);
    const begin=async()=>{
     await player.replaceAsync({uri:url,contentType:data.format==="hls"?"hls":"progressive"});
     if(!active)return;
     const previous=lastPosition(title.id,season,episode);
     if(previous>15){player.currentTime=previous;setResumed(previous);}
     player.playbackRate=speed;
     player.loop=read().preferences.repeat;
     player.staysActiveInBackground=read().preferences.background;
     player.showNowPlayingNotification=read().preferences.background;
     player.play();
     track("play_started",{id:title.id,kind:title.kind});
    };
    if(read().preferences.intro){setIntro(true);introTimer=setTimeout(()=>{setIntro(false);void begin();},2200);}else await begin();
   }catch(e){if(active){setIntro(false);setStatus("");setError(e instanceof Error?e.message:"Playback unavailable.");}}
  };
  void start();
  return()=>{active=false;if(introTimer)clearTimeout(introTimer);progress(title,season,episode,positionRef.current,player.duration||0);};
 },[title.id,season,episode,player]);
 const close=()=>{progress(title,season,episode,positionRef.current,player.duration||0);player.pause();onClose();};
 const choose=(name:"speed"|"quality"|"audio"|"subtitle")=>setPanel(panel===name?null:name);
 return <View style={s.root}>
  <StatusBar hidden/>
  <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} allowsFullscreen allowsPictureInPicture contentFit={fit}/>
  <Pressable style={StyleSheet.absoluteFill} onPress={()=>setShow(!show)}/>
  {intro&&<View style={s.intro}><Image source={require("../assets/icon.png")} style={{width:116,height:116,borderRadius:23}}/><Text style={s.brand}>PinFlix</Text><Text style={s.credit}>{CREDIT}</Text><Btn label="Skip intro" onPress={()=>setIntro(false)}/></View>}
  {!!status&&!intro&&<View pointerEvents="none" style={s.center}><ActivityIndicator color={C.magenta}/><Text style={s.sub}>{status}</Text></View>}
  {!!error&&<View style={s.center}><Text style={s.error}>{error}</Text><Btn label="Back" onPress={close}/></View>}
  {locked?<View style={s.unlock}><Btn label="Unlock" onPress={()=>setLocked(false)}/></View>:show&&!intro&&!error&&<View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
   <View style={s.top}><Btn label="‹ Back" onPress={close}/><Text style={s.heading} numberOfLines={1}>{title.title}</Text><Btn label="Lock" onPress={()=>setLocked(true)}/></View>
   <View style={s.centerButtons}><Btn label="↶ 10" onPress={()=>player.seekBy(-10)}/><Btn label={playing?"❚❚":"▶"} onPress={()=>playing?player.pause():player.play()}/><Btn label="10 ↷" onPress={()=>player.seekBy(10)}/></View>
   <View style={s.bottom}>
    <View style={s.timeline}><Text style={s.clock}>{time(position)} / {duration?time(duration):"--:--"}</Text><Slider value={position} minimumValue={0} maximumValue={duration||1} style={{flex:1}} minimumTrackTintColor={C.purple} maximumTrackTintColor={C.line} thumbTintColor={C.white} onSlidingComplete={v=>{player.currentTime=v;setPosition(v);}}/></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
     <Btn label={"Speed "+speed+"×"} onPress={()=>choose("speed")}/><Btn label="Quality" onPress={()=>choose("quality")}/><Btn label="CC" onPress={()=>choose("subtitle")}/><Btn label="Audio" onPress={()=>choose("audio")}/>
     <Btn label={fit==="contain"?"Fill":"Fit"} onPress={()=>setFit(fit==="contain"?"cover":"contain")}/>
     <Btn label="Repeat" onPress={()=>{player.loop=!player.loop;void preference("repeat",player.loop);}}/>
     <Btn label="Queue +" onPress={()=>void addToQueue(title.id,season,episode)}/>
     <Btn label="Sleep 30m" onPress={()=>setTimeout(()=>player.pause(),1800000)}/>
     {next&&<Btn label="Next ▶" onPress={()=>onNext(season,next.number)}/>}
    </ScrollView>
    {resumed>0&&<Text style={s.sub} onPress={()=>{player.currentTime=0;setResumed(0);}}>Resumed at {time(resumed)} — Start over</Text>}
    {panel&&<View style={s.panel}><Text style={s.sub}>{panel.toUpperCase()}</Text><ScrollView style={{maxHeight:110}}>
    {panel==="speed"?speeds.map(n=><Text key={n} style={s.option} onPress={()=>{player.playbackRate=n;setSpeed(n);void preference("speed",n);setPanel(null);}}>{n}×</Text>):
     panel==="subtitle"?[<Text key="off" style={s.option} onPress={()=>{player.subtitleTrack=null;setPanel(null);}}>Off</Text>,...(player.availableSubtitleTracks||[]).map((v,i)=><Text key={i} style={s.option} onPress={()=>{player.subtitleTrack=v;setPanel(null);}}>{v.label||v.language}</Text>)]:
     panel==="audio"?(player.availableAudioTracks||[]).map((v,i)=><Text key={i} style={s.option} onPress={()=>{player.audioTrack=v;setPanel(null);}}>{v.label||v.language}</Text>):
     <Text style={s.sub}>Adaptive quality follows the available source tracks.</Text>}
    </ScrollView></View>}
   </View>
  </View>}
 </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:"#000"},btn:{borderRadius:12,backgroundColor:"#41345BCB",paddingVertical:11,paddingHorizontal:13},btnTxt:{color:C.white,fontWeight:"700",fontSize:13},top:{position:"absolute",top:15,left:17,right:17,flexDirection:"row",alignItems:"center",gap:12},heading:{color:C.white,flex:1,fontSize:17,fontWeight:"700"},centerButtons:{position:"absolute",top:"44%",width:"100%",flexDirection:"row",justifyContent:"center",gap:28},bottom:{position:"absolute",bottom:12,left:15,right:15,padding:12,backgroundColor:"#1D1535D9",borderRadius:15},timeline:{flexDirection:"row",alignItems:"center"},clock:{color:C.white,fontSize:12},sub:{color:C.sub,fontSize:12,textAlign:"center",marginTop:8},center:{position:"absolute",top:"38%",alignSelf:"center",alignItems:"center",gap:10},error:{color:C.bad,textAlign:"center",fontWeight:"600",maxWidth:320},intro:{...StyleSheet.absoluteFillObject,backgroundColor:"#0C0819",alignItems:"center",justifyContent:"center",gap:18},mark:{fontSize:46,color:C.magenta,fontWeight:"900"},brand:{fontSize:42,fontWeight:"900",color:C.white,letterSpacing:-2},credit:{fontSize:14,color:C.sub,letterSpacing:1.5},unlock:{position:"absolute",right:20,top:20},panel:{backgroundColor:C.panel,borderRadius:14,padding:12,marginTop:8},option:{color:C.white,padding:9,borderBottomColor:C.line,borderBottomWidth:1}});
