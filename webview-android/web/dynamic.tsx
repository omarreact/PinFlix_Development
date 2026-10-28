import { lazy, Suspense, type ComponentType } from 'react';
export default function dynamic<P extends object>(loader:()=>Promise<ComponentType<P>>,_options?:unknown){
 const Component=lazy(()=>loader().then(defaultExport=>({default:defaultExport})));
 return function LazyComponent(props:P){return <Suspense fallback={null}><Component {...props}/></Suspense>;};
}
