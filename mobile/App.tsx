import React,{useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Alert,Dimensions,FlatList,Image,ImageBackground,Pressable,ScrollView,StatusBar,StyleSheet,Switch,Text,TextInput,View} from "react-native";
import {LinearGradient} from "expo-linear-gradient";
import {SafeAreaProvider,SafeAreaView} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {C,CREDIT} from "./src/theme";
import type {Title,Detail,Catalogue,Progress} from "./src/types";
import {catalogue,detail} from "./src/api";
import {hydrate,read,watch,toggleSaved,preference,clearHistory,Library} from "./src/library";
import PlayerScreen from "./src/PlayerScreen";
import {enableAlerts,disableAlerts} from "./src/notifications";
import * as Location from "expo-location";
import {track} from "./src/telemetry";

type Tab="Home"|"Discover"|"Saved"|"Profile";
const W=Dimensions.get("window").width;
function Btn({label,onPress,fill=C.purple}:{label:string;onPress:()=>void;fill?:string}){return <Pressable onPress={onPress} style={[S.button,{backgroundColor:fill}]}><Text style={S.buttonText}>{label}</Text></Pressable>;}
function Label({text,action}:{text:string;action?:()=>void}){return <View style={S.sectionRow}><Text style={S.sectionTitle}>{text}</Text>{action&&<Text onPress={action} style={S.small}>See all</Text>}</View>;}
function Poster({item,onPress,width=118}:{item:Title;onPress:()=>void;width?:number}){return <Pressable style={{width,marginRight:11}} onPress={onPress}><Image source={item.poster?{uri:item.poster}:undefined} style={{width,height:width*1.48,borderRadius:13,backgroundColor:C.panel}}/><Text numberOfLines={2} style={S.posterTitle}>{item.title}</Text><Text style={S.caption}>{item.year||"Movie"} · {item.kind==="series"?"Series":"Film"}</Text></Pressable>;}
function Rail({titles,onSelect}:{titles:Title[];onSelect:(t:Title)=>void}){return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal:-17}} contentContainerStyle={{paddingHorizontal:17}}>{titles.map(i=><Poster key={i.id} item={i} onPress={()=>onSelect(i)}/>)}</ScrollView>;}

function AppBody(){
 const [tab,setTab]=useState<Tab>("Home");
 const [intro,setIntro]=useState(false);
 const [movies,setMovies]=useState<Title[]>([]);
 const [series,setSeries]=useState<Title[]>([]);
 const [featured,setFeatured]=useState(0);
 const [library,setLibrary]=useState<Library>(read());
 const [selected,setSelected]=useState<Title|null>(null);
 const [data,setData]=useState<Detail|null>(null);
 const [player,setPlayer]=useState<{title:Title;season:number;episode:number}|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [query,setQuery]=useState(""),[kind,setKind]=useState("all"),[filter,setFilter]=useState(""),[sort,setSort]=useState("recent");
 const [language,setLanguage]=useState(""),[year,setYear]=useState(""),[quality,setQuality]=useState("");
 const [filterOpen,setFilterOpen]=useState(false);
 const [results,setResults]=useState<Title[]>([]),[page,setPage]=useState(1),[hasNext,setHasNext]=useState(false),[searchBusy,setSearchBusy]=useState(false);
 const [facets,setFacets]=useState<Catalogue["facets"]>();
 const source=kind==="series"?series:movies;
 const active=source[featured%Math.max(1,source.length)];

 useEffect(()=>{
  void hydrate();const unsub=watch(setLibrary);
  void AsyncStorage.getItem("pinflix-intro-done").then(x=>{if(x!=="1")setIntro(true);});
  const load=async()=>{
   try{
    const [m,s]=await Promise.all([catalogue({kind:"movie",page:1}),catalogue({kind:"series",page:1})]);
    setMovies(m.items.filter(x=>!x.mature));
    setSeries(s.items.filter(x=>!x.mature));
    setFacets(m.facets);
    track("app_open");
   }catch(e){setError("Unable to load the catalogue. Check your connection and try again.");}
   finally{setLoading(false);}
  };
  void load();
  return unsub;
 },[]);

 const search=useCallback(async(p:number)=>{
  setSearchBusy(true);
  try{
   const res=await catalogue({q:query||undefined,kind:kind==="all"?undefined:kind,category:filter||undefined,sort,year:year?Number(year):undefined,language:language||undefined,quality:quality||undefined,page:p});
   setResults(current=>p===1?res.items:current.concat(res.items.filter(t=>!current.some(c=>c.id===t.id))));
   setHasNext(res.hasNext);setPage(p);setFacets(res.facets||facets);
   track("search",{hasQuery:!!query});
  }catch{Alert.alert("Search unavailable","Unable to complete this search right now.");}
  finally{setSearchBusy(false);}
 },[query,kind,sort,year,language,quality,filter]);

 useEffect(()=>{if(tab==="Discover")void search(1);},[tab,query,kind,sort,year,language,quality,filter]);

 const open=async(item:Title)=>{
  setSelected(item);setData(null);
  try{setData(await detail(item.id,1));}catch{setData(null);}
 };
 const play=(title:Title,season=1,episode=1)=>{setPlayer({title,season,episode});};
 const closeDetail=()=>{setSelected(null);setData(null);};
 const onNext=(season:number,episode:number)=>{if(player)setPlayer({...player,season,episode});};

 if(player)return <PlayerScreen key={player.title.id+":"+player.season+":"+player.episode} title={player.title} detail={data} season={player.season} episode={player.episode} onClose={()=>setPlayer(null)} onNext={onNext}/>;

 if(intro)return <View style={S.welcome}>
  <StatusBar hidden/>
  <View style={S.collage}>{movies.slice(0,9).map((title,i)=><Image key={title.id} source={title.poster?{uri:title.poster}:undefined} style={[S.collageImage,{transform:[{rotate:i%2?"7deg":"-6deg"}]}]}/>)}</View>
  <LinearGradient colors={["#00000000","#090714","#080716"]} style={StyleSheet.absoluteFill}/>
  <View style={S.welcomeBottom}><Text style={S.welcomeTitle}>Welcome to PinFlix</Text><Text style={S.welcomeText}>Movies, series and stories worth discovering.</Text><Text style={S.credit}>{CREDIT}</Text>
   <Btn label="Get Started" onPress={()=>{setIntro(false);void AsyncStorage.setItem("pinflix-intro-done","1");}}/>
  </View>
 </View>;

 if(selected)return <SafeAreaView style={{flex:1,backgroundColor:C.bg}}><StatusBar barStyle="light-content"/><ScrollView>
  <ImageBackground source={selected.backdrop||selected.poster?{uri:(selected.backdrop||selected.poster)!}:undefined} style={S.detailsHero} imageStyle={{backgroundColor:C.panel}}>
   <LinearGradient colors={["#00000011","#090917"]} style={StyleSheet.absoluteFill}/>
   <View style={S.detailTop}><Btn label="‹" fill="#5B4A80" onPress={closeDetail}/><Btn label={library.saved[selected.id]?"♥":"♡"} fill="#5B4A80" onPress={()=>void toggleSaved(selected)}/></View>
   <View style={S.playFloating}><Btn label="▶" fill={C.purple} onPress={()=>play(selected)}/></View>
  </ImageBackground>
  <View style={{padding:18}}><Text style={S.caption}>{selected.year||"Featured"}  ·  {selected.kind==="series"?"TV Series":"Movie"}</Text><Text style={S.detailTitle}>{selected.title}</Text>
   <View style={S.pills}><Text style={S.pill}>{selected.category||"Entertainment"}</Text>{selected.quality&&<Text style={S.pill}>{selected.quality}</Text>}<Text style={S.pill}>{selected.language||"Original"}</Text></View>
   <View style={[S.pills,{marginTop:19}]}><Btn label={selected.kind==="series"?"▶ Watch episode":"▶ Play Movie"} onPress={()=>play(selected,1,data?.episodes[0]?.number||1)}/><Btn label={library.saved[selected.id]?"Saved ✓":"+ Watch Later"} fill={C.panel} onPress={()=>void toggleSaved(selected)}/></View>
   <Label text="Cast"/><ScrollView horizontal showsHorizontalScrollIndicator={false}>{data?.title.cast?.length?data.title.cast.map((name,i)=><View key={i} style={S.actor}><View style={S.avatar}><Text style={S.avatarLetter}>{name.slice(0,1)}</Text></View><Text style={S.actorName} numberOfLines={2}>{name}</Text></View>):<Text style={S.sub}>Cast details not available for this title.</Text>}</ScrollView>
   <Label text="Synopsis"/><Text style={S.description}>{data?.title.synopsis||"More information will appear when available."}</Text>
   {selected.kind==="series"&&<><Label text="Episodes"/>{(data?.title.seasons||[1]).map(season=><Text key={season} style={S.filterChip} onPress={async()=>{try{setData(await detail(selected.id,season));}catch{}}}>Season {season}</Text>)}{data?.episodes?.map(ep=><Pressable key={ep.season+":"+ep.number} onPress={()=>play(selected,ep.season,ep.number)} style={S.episode}><Text style={S.episodeTitle}>{ep.number}. {ep.title}</Text><Text style={{color:C.magenta}}>▶</Text></Pressable>)}</>}
  </View>
 </ScrollView></SafeAreaView>;

 return <SafeAreaView style={S.root}>
  <StatusBar backgroundColor={C.bg} barStyle="light-content"/>
  {tab==="Home"&&<ScrollView contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
   <View style={S.header}><Text style={S.logo}>Pin<Text style={{color:C.magenta}}>Flix</Text></Text><Text style={S.small}>● Live catalogue</Text></View>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:15}}>
    {["Trending","New","Movies","Series"].map(x=><Text key={x} onPress={()=>{setKind(x==="Series"?"series":"movie");setFeatured(0);}} style={[S.headerTab,(kind==="series"?"Series":"Trending")===x&&{color:C.white,fontWeight:"800"}]}>{x}</Text>)}
   </ScrollView>
   {loading&&<ActivityIndicator color={C.purple}/>}
   {!!error&&<Text style={S.sub}>{error}</Text>}
   {!!active&&<><ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={ev=>setFeatured(Math.round(ev.nativeEvent.contentOffset.x/(W-34)))}>{source.slice(0,8).map(i=><Pressable onPress={()=>void open(i)} key={i.id} style={[S.bigPoster,{width:W-34}]}><Image source={i.poster?{uri:i.poster}:undefined} style={S.heroArt}/><LinearGradient colors={["transparent","#130A33"]} style={StyleSheet.absoluteFill}/><Text style={S.heroTitle} numberOfLines={2}>{i.title}</Text></Pressable>)}</ScrollView>
    <Text style={S.featureYear}>{active.year||""}</Text><Text style={S.featureTitle}>{active.title}</Text><Text style={S.featureMeta}>{active.category||"Featured"}   ◇   {active.kind==="series"?"Series":"Movie"}</Text><Text style={S.dots}>●  ●  ●  ●  ●</Text>
   </>}
   <Label text="For You" action={()=>setTab("Discover")}/><Rail titles={movies.slice(0,18)} onSelect={x=>void open(x)}/>
   <Label text="Fresh Episodes" action={()=>setTab("Discover")}/><Rail titles={series.slice(0,18)} onSelect={x=>void open(x)}/>
   {Object.values(library.progress).some(v=>!v.completed)&&<><Label text="Continue Watching" action={()=>setTab("Saved")}/><Rail titles={Object.values(library.progress).filter(v=>!v.completed).sort((a,b)=>b.updatedAt-a.updatedAt).map(v=>v.title)} onSelect={x=>void open(x)}/></>}
  </ScrollView>}
  {tab==="Discover"&&<ScrollView contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">
   <Text style={S.pageTitle}>Discover</Text><TextInput placeholder="Movies, shows, actors or keywords" placeholderTextColor={C.sub} value={query} onChangeText={setQuery} style={S.input}/>
   <View style={S.pills}>{["all","movie","series"].map(t=><Text key={t} onPress={()=>setKind(t)} style={[S.pill,t===kind&&{backgroundColor:C.purple,color:C.white}]}>{t==="all"?"All":t==="movie"?"Movies":"TV Series"}</Text>)}<Text style={S.pill} onPress={()=>setFilterOpen(!filterOpen)}>⚙ Filters</Text></View>
   {filterOpen&&<View style={S.filterBox}><Text style={S.sub}>Sort</Text><View style={S.pills}>{["recent","title","year"].map(t=><Text key={t} style={[S.pill,t===sort&&{backgroundColor:C.purple}]} onPress={()=>setSort(t)}>{t}</Text>)}</View>
    <Text style={S.sub}>Year</Text><ScrollView horizontal>{["","2026","2025","2024","2023"].map(y=><Text key={y} style={[S.pill,y===year&&{backgroundColor:C.purple}]} onPress={()=>setYear(y)}>{y||"Any"}</Text>)}</ScrollView>
    <Text style={S.sub}>Language</Text><ScrollView horizontal>{["","Bangla","Hindi","English","Tamil","Korean"].map(v=><Text key={v} style={[S.pill,v===language&&{backgroundColor:C.purple}]} onPress={()=>setLanguage(v)}>{v||"Any"}</Text>)}</ScrollView>
    <Text style={S.sub}>Quality</Text><View style={S.pills}>{["","720p","1080p","4K"].map(v=><Text key={v} style={[S.pill,v===quality&&{backgroundColor:C.purple}]} onPress={()=>setQuality(v)}>{v||"Any"}</Text>)}</View>
   </View>}
   <Label text="Results"/>{searchBusy&&<ActivityIndicator color={C.magenta}/>}
   <View style={S.grid}>{results.filter(x=>!x.mature).map(i=><Poster key={i.id} item={i} onPress={()=>void open(i)} width={(W-45)/2}/>)}</View>
   {hasNext&&!searchBusy&&<Btn label="Load more" fill={C.panel} onPress={()=>void search(page+1)}/>}
  </ScrollView>}
  {tab==="Saved"&&<ScrollView contentContainerStyle={S.content}>
   <Text style={S.pageTitle}>My List</Text><Label text="Watch Later"/><View style={S.grid}>{Object.values(library.saved).map(i=><Poster key={i.id} item={i} width={(W-45)/2} onPress={()=>void open(i)}/>)}</View>
   <Label text="Continue Watching"/>{Object.values(library.progress).filter(i=>!i.completed).sort((a,b)=>b.updatedAt-a.updatedAt).map((i,index)=><Pressable key={index} onPress={()=>{void open(i.title);}} style={S.episode}><Text style={S.episodeTitle}>{i.title.title} · {Math.round(i.position/(i.duration||1)*100)}%</Text><Text style={S.sub}>▶ Resume</Text></Pressable>)}
   <Label text="Completed"/>{Object.values(library.progress).filter(i=>i.completed).map((i,index)=><Text key={index} style={S.sub}>{i.title.title}</Text>)}
  </ScrollView>}
  {tab==="Profile"&&<ScrollView contentContainerStyle={S.content}><Text style={S.pageTitle}>My PinFlix</Text><Text style={S.sub}>Streaming preferences and privacy</Text>
   <Label text="Playback"/>
   {([["autoNext","Auto-play next episode"],["background","Background playback"],["intro","Play PinFlix intro"],["repeat","Repeat current video"]] as const).map(([key,label])=><View key={key} style={S.setting}><Text style={S.episodeTitle}>{label}</Text><Switch value={Boolean(library.preferences[key])} onValueChange={v=>void preference(key,v)} trackColor={{true:C.purple}}/></View>)}
   <Label text="Notifications & Privacy"/>
   <View style={S.setting}><Text style={S.episodeTitle}>New-release notifications</Text><Switch value={library.preferences.notifications} onValueChange={async v=>{if(!v){void disableAlerts();return;}try{const ok=await enableAlerts();if(!ok)Alert.alert("Notifications","Permission was not granted.");}catch{Alert.alert("Setup required","Push alerts require cloud credentials and an active notification service.");}}}/></View>
   <View style={S.setting}><Text style={S.episodeTitle}>Anonymous usage analytics</Text><Switch value={library.preferences.telemetry} onValueChange={v=>void preference("telemetry",v)}/></View>
   <Text style={S.sub}>Region: {library.preferences.region}. Location is optional. Precise coordinates are never stored or sent to analytics.</Text>
   <View style={{marginTop:12}}><Btn label="Use location once for regional suggestions" fill={C.panel} onPress={async()=>{
     try{
       const perm=await Location.requestForegroundPermissionsAsync();
       if(!perm.granted){Alert.alert("Location","Permission not granted. You can continue without location.");return;}
       const result=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Low});
       const names=await Location.reverseGeocodeAsync(result.coords);
       const country=names[0]?.country||"Global";
       await preference("region",country);
       Alert.alert("Region set",country+" — saved locally, not sent to analytics.");
     }catch{Alert.alert("Region unavailable","You can continue using PinFlix without location.");}
   }}/></View>
   <View style={{marginTop:20}}><Btn label="Clear watch history" fill={C.panel} onPress={()=>Alert.alert("Clear history?","Saved titles will remain.",[{text:"Cancel"},{text:"Clear",style:"destructive",onPress:()=>void clearHistory()}])}/></View>
   <Text style={[S.credit,{marginTop:40}]}>{CREDIT} · PinFlix v2.0</Text>
  </ScrollView>}
  <View style={S.nav}>{(["Home","Discover","Saved","Profile"] as Tab[]).map((item,index)=><Pressable key={item} onPress={()=>setTab(item)} style={S.navItem}><Text style={{fontSize:22,color:item===tab?C.white:C.sub}}>{["⌂","◈","▢","♙"][index]}</Text><Text style={{fontSize:11,color:item===tab?C.white:C.sub}}>{item}</Text></Pressable>)}</View>
 </SafeAreaView>;
}
export default function App(){return <SafeAreaProvider><AppBody/></SafeAreaProvider>;}
const S=StyleSheet.create({root:{flex:1,backgroundColor:C.bg},content:{padding:17,paddingBottom:28},header:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12},logo:{fontSize:31,fontWeight:"900",color:C.white,letterSpacing:-1.5},small:{color:C.sub,fontSize:12},headerTab:{color:C.sub,marginRight:17,paddingVertical:8,fontSize:14},sectionRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:22,marginBottom:13},sectionTitle:{color:C.white,fontSize:18,fontWeight:"800"},posterTitle:{fontSize:12,color:C.white,marginTop:6,fontWeight:"700"},caption:{color:C.sub,fontSize:11,marginTop:4},bigPoster:{height:365,alignItems:"center",borderRadius:24,overflow:"hidden"},heroArt:{height:"100%",width:"100%",resizeMode:"contain",backgroundColor:C.panel},heroTitle:{position:"absolute",bottom:14,fontSize:23,color:C.white,fontWeight:"900",maxWidth:"85%",textAlign:"center"},featureYear:{color:C.sub,textAlign:"center",fontSize:12,marginTop:10},featureTitle:{fontWeight:"800",fontSize:21,color:C.white,textAlign:"center",marginTop:6},featureMeta:{color:C.sub,textAlign:"center",marginTop:8,fontSize:13},dots:{textAlign:"center",color:C.purple,marginTop:9},nav:{height:68,backgroundColor:"#2A1B40",flexDirection:"row",justifyContent:"space-around",alignItems:"center",borderTopColor:C.line,borderTopWidth:1},navItem:{alignItems:"center",justifyContent:"center",gap:3,flex:1},button:{paddingHorizontal:20,paddingVertical:12,borderRadius:22,alignItems:"center",justifyContent:"center"},buttonText:{color:C.white,fontWeight:"800",fontSize:14},pageTitle:{fontSize:27,color:C.white,fontWeight:"900",marginBottom:12},input:{borderRadius:15,padding:14,fontSize:14,color:C.white,backgroundColor:C.panel,marginTop:6,marginBottom:12},pills:{flexDirection:"row",flexWrap:"wrap",gap:8,alignItems:"center"},pill:{color:C.sub,paddingVertical:9,paddingHorizontal:13,backgroundColor:C.panel,borderRadius:20,fontSize:12,overflow:"hidden"},grid:{flexDirection:"row",flexWrap:"wrap",gap:8},filterBox:{padding:12,borderRadius:15,backgroundColor:C.surface,marginTop:12,gap:12},detailTop:{position:"absolute",top:20,left:15,right:15,flexDirection:"row",justifyContent:"space-between"},detailsHero:{height:340,backgroundColor:C.panel},playFloating:{position:"absolute",bottom:40,alignSelf:"center"},detailTitle:{fontSize:24,fontWeight:"800",color:C.white,marginTop:8,marginBottom:11},actor:{width:78,marginRight:14,alignItems:"center"},avatar:{width:69,height:77,borderRadius:12,backgroundColor:C.purple,justifyContent:"center",alignItems:"center"},avatarLetter:{fontSize:25,color:C.white},actorName:{fontSize:11,color:C.sub,marginTop:6,textAlign:"center"},description:{fontSize:14,color:C.sub,lineHeight:23},filterChip:{color:C.white,padding:13,backgroundColor:C.panel,marginVertical:4},episode:{padding:14,flexDirection:"row",justifyContent:"space-between",alignItems:"center",backgroundColor:C.panel,borderRadius:12,marginBottom:8},episodeTitle:{fontSize:13,color:C.white,fontWeight:"600",maxWidth:"75%"},sub:{color:C.sub,fontSize:13,lineHeight:20,marginTop:6},setting:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.line},credit:{color:C.sub,fontSize:12,letterSpacing:1.4,textAlign:"center"},welcome:{flex:1,backgroundColor:C.bg},collage:{flexDirection:"row",flexWrap:"wrap",justifyContent:"center",marginTop:-20},collageImage:{width:W/3,height:205,margin:2,borderRadius:13,backgroundColor:C.panel},welcomeBottom:{position:"absolute",bottom:36,left:20,right:20,gap:14},welcomeTitle:{fontSize:28,color:C.white,textAlign:"center",fontWeight:"900"},welcomeText:{fontSize:13,color:C.sub,textAlign:"center"}});
