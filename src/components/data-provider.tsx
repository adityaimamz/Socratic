"use client";
import {createContext,useContext,useEffect,useState,useRef,useCallback,type ReactNode} from "react";
import {QueryClient,QueryClientProvider,queryOptions,useQueryClient} from "@tanstack/react-query";
import {useRouter} from "next/navigation";
import type {Profile,Question} from "@/lib/types";
import {api} from "@/lib/client";
import {ApiError} from "@/lib/domain";
import {affectedViews} from "@/lib/query-policy";
import {liveViews,viewForPath,type ViewName,type ViewDataMap,type ViewParams} from "@/lib/views";

const ViewerContext=createContext<Profile|null>(null);
function isQuestion(value:Record<string,unknown>):value is Record<string,unknown> & Question {
 return typeof value.id==="string"&&typeof value.prompt==="string"&&Array.isArray(value.options)&&typeof value.weight==="number"&&typeof value.tag==="string"&&typeof value.rubric==="string"&&typeof value.archived==="boolean"&&typeof value.version==="number"&&(value.kind==="mcq"||value.kind==="essay")&&(value.correct_option_id===null||typeof value.correct_option_id==="string")&&(value.media_path===null||typeof value.media_path==="string");
}
export function useViewer(){const p=useContext(ViewerContext);if(!p)throw new Error("Workspace provider missing");return p;}
export function viewOptions<V extends ViewName>(viewer:Pick<Profile,"id"|"role">,view:V,params:ViewParams={}){
 const normalized={id:params.id??"",page:params.page??1,q:params.q??"",folder:params.folder??""};
 return queryOptions({queryKey:["views",viewer.id,viewer.role,view,normalized] as const,
  queryFn:({signal})=>{const search=new URLSearchParams();for(const [key,value] of Object.entries(normalized))if(value!=="")search.set(key,String(value));return api<ViewDataMap[V]>(`views/${view}?${search}`,undefined,"GET",signal);},
  staleTime:liveViews.has(view)?0:30000,gcTime:liveViews.has(view)?0:300000,
  retry:(count,error)=>count<1&&error instanceof ApiError&&(error.code==="NETWORK_ERROR"||error.status>=500),
  retryDelay:500,refetchOnWindowFocus:true,refetchOnReconnect:true,
 });
}
export function DataProvider({profile,children}:{profile:Profile;children:ReactNode}){
 const [client]=useState(()=>new QueryClient());
 return <QueryClientProvider client={client}><ViewerContext.Provider value={profile}><CacheLifecycle profile={profile}/>{children}</ViewerContext.Provider></QueryClientProvider>;
}
function CacheLifecycle({profile}:{profile:Profile}){
 const client=useQueryClient(),router=useRouter();
 const routerRef=useRef(router);useEffect(()=>{routerRef.current=router;},[router]);
 useEffect(()=>{
  client.removeQueries({predicate:q=>q.queryKey[0]==="views"&&(q.queryKey[1]!==profile.id||q.queryKey[2]!==profile.role)});
  const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel("socratic-cache"):null;
  const clear=()=>{prefetchEpoch++;queue.length=0;scheduled.clear();void client.cancelQueries();client.clear();};
  const mutation=(event:Event)=>{const {path,result}= (event as CustomEvent<{path:string;result:Record<string,unknown>}>).detail;const views=affectedViews(path);if(!views.length)return;
   if(path==="questions/save"&&isQuestion(result))client.setQueryData(viewOptions({id:profile.id,role:profile.role},"question",{id:result.id}).queryKey,{question:result});
   void client.invalidateQueries({predicate:q=>q.queryKey[0]==="views"&&views.includes(q.queryKey[3] as ViewName)});channel?.postMessage({type:"invalidate",views});};
  const logout=()=>{clear();channel?.postMessage({type:"logout"});};
  const unauthorized=(event:Event)=>{clear();const blocked=(event as CustomEvent<{status:number}>).detail?.status===403;channel?.postMessage({type:blocked?"blocked":"logout"});routerRef.current.replace(blocked?"/access-pending":"/login");};
  let lastCheck=Date.now();let checking=false;
  const viewer=(event:Event)=>{lastCheck=Date.now();if((event as CustomEvent<string>).detail!==`${profile.id}:${profile.role}`){clear();routerRef.current.refresh();}};
  const checkIdentity=()=>{if(document.visibilityState!=="visible"||Date.now()-lastCheck<30000||checking)return;checking=true;void api("views/session").catch(()=>{}).finally(()=>{checking=false;lastCheck=Date.now();});};
  const queryErrors=client.getQueryCache().subscribe(event=>{
   if(event.type!=="updated"||event.action.type!=="error")return;
   const error=event.query.state.error;
   if(error instanceof ApiError&&[401,403].includes(error.status)){clear();routerRef.current.replace(error.status===401?"/login":"/access-pending");}
   else if(error instanceof ApiError&&error.status===404)event.query.setState({data:undefined,dataUpdatedAt:0});
  });
  if(channel)channel.onmessage=event=>{if(event.data?.type==="logout"||event.data?.type==="blocked"){clear();routerRef.current.replace(event.data.type==="blocked"?"/access-pending":"/login");}else if(event.data?.type==="invalidate"&&Array.isArray(event.data.views))void client.invalidateQueries({predicate:q=>q.queryKey[0]==="views"&&event.data.views.includes(q.queryKey[3])});};
  window.addEventListener("socratic:mutation",mutation);window.addEventListener("socratic:logout",logout);window.addEventListener("socratic:viewer",viewer);window.addEventListener("socratic:unauthorized",unauthorized);window.addEventListener("focus",checkIdentity);document.addEventListener("visibilitychange",checkIdentity);
  return()=>{window.removeEventListener("socratic:mutation",mutation);window.removeEventListener("socratic:logout",logout);window.removeEventListener("socratic:viewer",viewer);window.removeEventListener("socratic:unauthorized",unauthorized);window.removeEventListener("focus",checkIdentity);document.removeEventListener("visibilitychange",checkIdentity);queryErrors();channel?.close();clear();};
 },[client,profile.id,profile.role]);
 return null;
}
// Single queue per mounted workspace, not per Link. QueryClient deduplicates demand reads.
let runningPrefetches=0,prefetchEpoch=0;const queue:(()=>Promise<void>)[]=[];const scheduled=new Set<string>();
function drain(){while(runningPrefetches<2&&queue.length){const work=queue.shift()!;runningPrefetches++;void work().finally(()=>{runningPrefetches--;drain();});}}
export function usePrefetch(){
 const client=useQueryClient(),profile=useViewer(),router=useRouter();
 return useCallback((href:string)=>{
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean}}).connection;
  if(connection?.saveData)return;
  router.prefetch(href);
  const target=viewForPath(href);if(!target||liveViews.has(target.view))return;
  const options=viewOptions(profile,target.view,target.params),state=client.getQueryState(options.queryKey);
  if(state?.fetchStatus==="fetching"||state&&Date.now()-state.dataUpdatedAt<30000)return;
  const key=JSON.stringify(options.queryKey),epoch=prefetchEpoch;
  if(scheduled.has(key))return;scheduled.add(key);
  queue.push(async()=>{scheduled.delete(key);if(epoch!==prefetchEpoch)return;await client.prefetchQuery(options);});drain();
 },[client,profile,router]);
}
