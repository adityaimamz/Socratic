import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { currentProfile } from "@/lib/server";
import {DataProvider} from "@/components/data-provider";
import {NameGate} from "@/components/name-gate";
export const dynamic="force-dynamic";
export default async function WorkspaceLayout({children}:{children:React.ReactNode}){
 const p=await currentProfile().catch(()=>redirect("/access-pending")); if(!p)redirect("/login");
 return <DataProvider profile={p}><Shell profile={p}>{p.role==="student"&&!p.name_confirmed?<NameGate profile={p}/>:children}</Shell></DataProvider>;
}
