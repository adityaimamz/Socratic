import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { currentProfile,rpc } from "@/lib/server";
import type { Workspace } from "@/lib/types";
export const dynamic="force-dynamic";
export default async function WorkspaceLayout({children}:{children:React.ReactNode}){
 const p=await currentProfile().catch(()=>redirect("/access-pending")); if(!p)redirect("/login");
 const data=await rpc<Workspace>(p,"workspace",{}).catch(()=>null); if(!data)redirect("/access-pending");
 return <Shell profile={p}>{children}</Shell>;
}
