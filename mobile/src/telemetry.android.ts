// Standalone Android direct edition. Never send analytics to a Vercel backend.
export function track(_event:string,_data:Record<string,string|number|boolean>={}):void{}
