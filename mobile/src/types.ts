export type Kind="movie"|"series";
export type Title={id:string;providerId:string;kind:Kind;title:string;poster:string|null;backdrop:string|null;year:number|null;category:string;language:string|null;quality:string|null;rating:string|null;mature:boolean;synopsis:string;genres:string[];cast:string[];seasons:number[]};
export type Episode={number:number;season:number;title:string;thumbnail:string|null;quality:string|null;introEnd?:number;recapEnd?:number};
export type Detail={title:Title;episodes:Episode[];related:Title[];season:number};
export type Catalogue={items:Title[];page:number;hasNext:boolean;stale:boolean;categories:{name:string;kind:Kind;mature:boolean}[];years:number[];facets?:{genres:string[];languages:string[];qualities:string[];countries:string[]}};
export type Playback={status:"ready"|"unavailable"|"authorization_required"|"restricted"|"unsupported";url?:string;format?:"mp4"|"hls";subtitles?:{url:string;label:string;language:string}[];message:string};
export type Progress={id:string;title:Title;season:number;episode:number;position:number;duration:number;updatedAt:number;completed:boolean};
export const progressKey=(id:string,s=1,e=1)=>`${id}:${s}:${e}`;
