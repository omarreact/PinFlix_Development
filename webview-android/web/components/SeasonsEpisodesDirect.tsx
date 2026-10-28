"use client";
import {useEffect,useState} from 'react';
import type {CineplexSeason,CineplexEpisode} from '@/lib/cineplex-types';
export function SeasonsEpisodes({seasons,seriesTitle,seriesId,onPlayEpisode,activeEpisodeId}:{seasons:CineplexSeason[];seriesTitle:string;seriesId:string;onPlayEpisode:(episode:CineplexEpisode)=>void;activeEpisodeId?:string}){
 const [number,setNumber]=useState(seasons[0]?.seasonNumber||1);
 const [current,setCurrent]=useState<CineplexSeason>();
 const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [loading,setLoading]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError('');
  fetch(`/api/cineplex/series/${seriesId}/episodes?season=${number}`,{signal:controller.signal})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Episode list unavailable');return data as CineplexSeason;})
   .then(data=>{if(!controller.signal.aborted)setCurrent(data);})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[seriesId,number,retry]);
 return <section aria-label={`${seriesTitle} episodes`} className="space-y-4">
  <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Seasons & episodes</h3>
   {seasons.length>0&&<select aria-label="Season" value={number} onChange={e=>setNumber(Number(e.target.value))} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-xs">{seasons.map(s=><option key={s.seasonNumber} value={s.seasonNumber}>{s.title}</option>)}</select>}
  </div>
  {loading?<p role="status" className="text-sm text-slate-400">Loading source episodes…</p>:error?<div role="alert" className="text-sm text-amber-200">{error}<button className="ml-3 underline" onClick={()=>setRetry(n=>n+1)}>Retry episodes</button></div>:current?.episodes.length?<div className="grid gap-3 sm:grid-cols-2">{current.episodes.map(ep=><button key={ep.id} onClick={()=>onPlayEpisode(ep)} aria-pressed={activeEpisodeId===ep.id} className={`rounded-xl border p-4 text-left ${activeEpisodeId===ep.id?'border-violet-400 bg-violet-500/10':'border-white/10 bg-slate-950/50'}`}><span className="text-xs text-violet-300">S{number} E{ep.episodeNumber}</span><span className="mt-2 block text-sm font-semibold">{ep.title}</span></button>)}</div>:<p className="rounded-xl border border-white/10 p-5 text-sm text-slate-400">The source has not provided an episode list for this season.</p>}
 </section>;
}
