(function playerFile(){
  "use strict";
  const storageKey = "pinflix:php:v1:progress";
  function readProgress(key){
    try { const values=JSON.parse(localStorage.getItem(storageKey)||"{}");return Number(values[key]||0); }
    catch{return 0;}
  }
  function writeProgress(key,seconds){
    try{
      const values=JSON.parse(localStorage.getItem(storageKey)||"{}");
      values[key]=Math.floor(seconds);
      localStorage.setItem(storageKey,JSON.stringify(values));
    }catch{/* storage unavailable */}
  }
  const time=n=>Number.isFinite(n) ? `${Math.floor(n/3600)>0?Math.floor(n/3600)+":":""}${String(Math.floor((n%3600)/60)).padStart(2,"0")}:${String(Math.floor(n%60)).padStart(2,"0")}` : "00:00";
  function mount(container,source,context){
    if(!source||!source.url||!/^https:\/\//.test(source.url)) throw new Error("An approved HTTPS media source is required");
    let hls=null,closing=false,clearIdle=0,retries=0,lastTap=0,sourceReady=false,lastSaved=0,oldMarkup=container.innerHTML;
    container.innerHTML=`<div class="pf-player" role="region" aria-label="Video player">
      <video class="pf-video" playsinline preload="metadata"></video><div class="pf-overlay">
      <div class="pf-top"><span class="pf-heading"></span><button class="pf-close" aria-label="Close player">×</button></div>
      <button class="pf-center" aria-label="Play or pause">▶</button>
      <div class="pf-bottom"><input class="pf-progress" type="range" min="0" max="100" step=".1" value="0" aria-label="Seek">
      <button class="pf-toggle" aria-label="Play or pause">▶</button><span class="pf-time">00:00 / 00:00</span>
      <button class="pf-mute" aria-label="Mute">◖))</button><input class="pf-volume" type="range" min="0" max="1" step=".05" value="1" aria-label="Volume">
      <select class="pf-speed" aria-label="Playback speed"><option value=".75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>
      <select class="pf-quality" aria-label="Video quality"><option value="-1">Auto</option></select>
      <select class="pf-audio" aria-label="Audio track" hidden><option value="-1">Default audio</option></select>
      <select class="pf-subtitles" aria-label="Subtitles"><option value="-1">CC Off</option></select>
      <button class="pf-fullscreen" aria-label="Fullscreen">⛶</button></div></div>
      <p class="pf-error" role="alert" hidden></p></div>`;
    const root=container.querySelector(".pf-player"), video=root.querySelector("video");
    const $=s=>root.querySelector(s);
    $(".pf-heading").textContent=context.title || "PinFlix";
    const on=(node,event,fn)=>node.addEventListener(event,fn);
    function error(message){
      $(".pf-error").textContent=message;$(".pf-error").hidden=false;root.classList.remove("pf-controls-hidden");
    }
    function reveal(){
      root.classList.remove("pf-controls-hidden");
      clearTimeout(clearIdle);
      if(!video.paused) clearIdle=setTimeout(()=>root.classList.add("pf-controls-hidden"),3600);
    }
    function toggle(){
      if(video.paused){video.play().catch(()=>error("Tap Play to start. Your browser may have blocked autoplay."));}
      else video.pause();
      reveal();
    }
    function seek(n){
      if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.min(video.duration,Math.max(0,video.currentTime+n));
      reveal();
    }
    async function fullscreen(){
      try{
        if(document.fullscreenElement){await document.exitFullscreen();return;}
        if(root.requestFullscreen){await root.requestFullscreen();try{if(matchMedia("(max-width:800px)").matches)await screen.orientation.lock("landscape");}catch{/* unsupported */}}
        else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();
        else error("Fullscreen is unsupported in this browser.");
      }catch{error("Fullscreen requires a user gesture or is unsupported.");}
    }
    function sync(){
      $(".pf-time").textContent=time(video.currentTime)+" / "+time(video.duration);
      if(Number.isFinite(video.duration)&&video.duration>0)
        $(".pf-progress").value=String(100*video.currentTime/video.duration);
      if(Date.now()-lastSaved>5000 && video.currentTime>0){lastSaved=Date.now();writeProgress(context.key,video.currentTime);}
    }
    on(video,"loadedmetadata",()=>{
      if(!sourceReady){const resume=readProgress(context.key);if(resume>5&&resume<video.duration-10)video.currentTime=resume;sourceReady=true;}
      const tracks=Array.from(video.textTracks||[]);
      const sub=$(".pf-subtitles");
      tracks.forEach((t,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=t.label||t.language||"Subtitle "+(i+1);sub.append(o);});
    });
    on(video,"timeupdate",sync);
    on(video,"play",()=>{ $(".pf-toggle").textContent="Ⅱ";$(".pf-center").textContent="Ⅱ";reveal();});
    on(video,"pause",()=>{ $(".pf-toggle").textContent="▶";$(".pf-center").textContent="▶";reveal();writeProgress(context.key,video.currentTime);});
    on(video,"error",()=>error("Playback could not start. Check the source format and network."));
    on(video,"waiting",()=>{ $(".pf-center").textContent="…";reveal(); });
    on(video,"playing",()=>{ $(".pf-center").textContent="Ⅱ"; });
    on(video,"ended",()=>{writeProgress(context.key,0);reveal();});
    on($(".pf-close"),"click",close);
    on($(".pf-toggle"),"click",toggle);on($(".pf-center"),"click",toggle);
    on($(".pf-mute"),"click",()=>{video.muted=!video.muted;$(".pf-mute").textContent=video.muted?"🔇":"◖))";reveal();});
    on($(".pf-volume"),"input",e=>{video.volume=Number(e.target.value);video.muted=video.volume===0;});
    on($(".pf-progress"),"input",e=>{if(Number.isFinite(video.duration))video.currentTime=video.duration*Number(e.target.value)/100;});
    on($(".pf-speed"),"change",e=>{video.playbackRate=Number(e.target.value);});
    on($(".pf-quality"),"change",e=>{if(hls)hls.currentLevel=Number(e.target.value);});
    on($(".pf-audio"),"change",e=>{if(hls)hls.audioTrack=Number(e.target.value);});
    on($(".pf-subtitles"),"change",e=>{
      const value=Number(e.target.value);
      if(hls){hls.subtitleDisplay=value>=0;hls.subtitleTrack=value;}
      else Array.from(video.textTracks||[]).forEach((t,i)=>t.mode=i===value?"showing":"disabled");
    });
    on($(".pf-fullscreen"),"click",fullscreen);
    on(root,"pointermove",reveal);
    on(root,"touchend",e=>{
      if(e.target.closest("button,input,select"))return;
      const now=e.timeStamp;
      if(now-lastTap<350){e.preventDefault();const rect=root.getBoundingClientRect();seek(e.changedTouches[0].clientX<rect.left+rect.width/2?-5:5);}
      else reveal();
      lastTap=now;
    },{passive:false});
    const keydown=e=>{
      if(!root.isConnected||["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
      if(e.code==="Space"){e.preventDefault();toggle();}
      else if(e.code==="ArrowRight"){e.preventDefault();seek(5);}
      else if(e.code==="ArrowLeft"){e.preventDefault();seek(-5);}
      else if(e.code==="KeyF")void fullscreen();
      else if(e.code==="KeyM"){video.muted=!video.muted;}
      else if(e.code==="Escape"&&!document.fullscreenElement)close();
    };
    document.addEventListener("keydown",keydown);
    if(source.format==="hls" && !video.canPlayType("application/vnd.apple.mpegurl")){
      if(window.Hls&&window.Hls.isSupported()){
        hls=new window.Hls({maxBufferLength:30,enableWorker:true});
        hls.attachMedia(video);hls.loadSource(source.url);
        hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{
          hls.levels.forEach((level,i)=>{const opt=document.createElement("option");opt.value=String(i);opt.textContent=level.height?level.height+"p":"Level "+(i+1);$(".pf-quality").append(opt);});
          video.play().catch(()=>reveal());
        });
        hls.on(window.Hls.Events.AUDIO_TRACKS_UPDATED,(_,data)=>{
          const select=$(".pf-audio");select.hidden=!data.audioTracks.length;
          data.audioTracks.forEach((track,i)=>{const opt=document.createElement("option");opt.value=String(i);opt.textContent=track.name||track.lang||"Audio "+(i+1);select.append(opt);});
        });
        hls.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED,(_,data)=>{
          data.subtitleTracks.forEach((t,i)=>{const opt=document.createElement("option");opt.value=String(i);opt.textContent=t.name||t.lang||"CC "+(i+1);$(".pf-subtitles").append(opt);});
        });
        hls.on(window.Hls.Events.ERROR,(_,data)=>{
          if(!data.fatal)return;
          if(retries++<2){if(data.type===window.Hls.ErrorTypes.MEDIA_ERROR)hls.recoverMediaError();else hls.startLoad();}
          else error(data.type===window.Hls.ErrorTypes.NETWORK_ERROR?"Media network error; please retry.":"Media could not be decoded.");
        });
      }else error("HLS support is unavailable in this browser.");
    }else{video.src=source.url;video.load();}
    function close(){
      if(closing)return;closing=true;
      if(Number.isFinite(video.currentTime))writeProgress(context.key,video.currentTime);
      document.removeEventListener("keydown",keydown);clearTimeout(clearIdle);
      if(hls)hls.destroy();video.pause();video.removeAttribute("src");video.load();
      if(document.fullscreenElement===root)document.exitFullscreen().catch(()=>{});
      container.innerHTML=oldMarkup;
      context.onClose?.();
    }
    return {destroy:close,element:root};
  }
  window.PinFlixPlayer={mount};
})();
