import { useMemo, useSyncExternalStore } from 'react';
const subscribe = (notify:()=>void) => { window.addEventListener('popstate',notify); return ()=>window.removeEventListener('popstate',notify); };
const snapshot = () => location.search;
export function useSearchParams(){const key=useSyncExternalStore(subscribe,snapshot);return useMemo(()=>new URLSearchParams(key),[key]);}
const router={push(url:string,_options?:unknown){history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'));}};
export function useRouter(){return router;}
