"use client";
import {useEffect,useState,type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {viewOptions,useViewer} from "./data-provider";
import {PageSkeleton} from "./page-skeleton";
import {Notice} from "./ui";
import type {ViewName,ViewDataMap,ViewParams} from "@/lib/views";
import {navigationRendered} from "@/lib/navigation-metrics";
const paginatedViews=new Set<ViewName>(["questions","classes","exams","admin-users","admin-audit","student-dashboard"]);

export function RemoteView<V extends ViewName>({view,params={},children,loading}:{view:V;params?:ViewParams;children:(data:ViewDataMap[V])=>ReactNode;loading?:ReactNode}){
 const viewer=useViewer(),options=viewOptions(viewer,view,params);
 const query=useQuery({...options,placeholderData:(data,previous)=>paginatedViews.has(view)&&previous?.queryKey[1]===viewer.id&&previous.queryKey[2]===viewer.role&&previous.queryKey[3]===view?data:undefined});const pathname=usePathname();
 useEffect(()=>{if(query.data){navigationRendered("visual",pathname);navigationRendered("data",pathname);}},[query.data,pathname]);
 if(!query.data)return query.isError?<Notice tone="error" title="Halaman belum berhasil dimuat">{query.error.message} <button className="text-btn" onClick={()=>void query.refetch()}>Coba lagi</button></Notice>:loading??<PageSkeleton pathname={pathname}/>;
 return <div data-view-ready={view} style={{display:"contents"}}>{query.isFetching&&<p className="small" role="status">Memperbarui data…</p>}{query.isError&&<Notice tone="error" title="Data belum diperbarui">{query.error.message} Data terakhir tetap ditampilkan. <button className="text-btn" onClick={()=>void query.refetch()}>Coba lagi</button></Notice>}{children(query.data)}</div>;
}
export function useListParams(){const search=useSearchParams();return {page:Math.max(1,Number(search.get("page"))||1),q:search.get("q")??""};}
export function ListControls({total,page,pageSize=50,label="Cari"}:{total:number;page:number;pageSize?:number;label?:string}){
 const router=useRouter(),pathname=usePathname(),search=useSearchParams(),[value,setValue]=useState(search.get("q")??"");
 const currentQ=search.get("q")??"";
 useEffect(()=>setValue(currentQ),[currentQ]);
 useEffect(()=>{if(value===currentQ)return;const timer=setTimeout(()=>{const params=new URLSearchParams(search);params.set("q",value);params.delete("page");router.replace(`${pathname}?${params}`,{scroll:false});},300);return()=>clearTimeout(timer);},[value,currentQ,pathname,router,search]);
 function change(next:number){const params=new URLSearchParams(search);params.set("page",String(next));router.replace(`${pathname}?${params}`,{scroll:false});}
 return <div className="list-controls"><div className="field"><label className="sr-only" htmlFor="list-search">{label}</label><input id="list-search" type="search" value={value} onChange={e=>setValue(e.target.value)} placeholder={label}/></div><div className="actions"><span className="small">{total} data · Halaman {page} / {Math.max(1,Math.ceil(total/pageSize))}</span><button className="btn small" disabled={page<=1} onClick={()=>change(page-1)}>Sebelumnya</button><button className="btn small" disabled={page*pageSize>=total} onClick={()=>change(page+1)}>Berikutnya</button></div></div>;
}
