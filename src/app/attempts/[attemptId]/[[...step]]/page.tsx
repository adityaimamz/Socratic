import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/server";
import { Runner } from "@/components/runner";
export const dynamic="force-dynamic";
export default async function AttemptPage({params}:{params:Promise<{attemptId:string;step?:string[]}>}){const profile=await requireProfile();if(profile.role==="student"&&!profile.name_confirmed)redirect("/dashboard");const {attemptId,step}=await params;if(step?.[0]==="receipt")redirect(`/results/${attemptId}`);return <Runner attemptId={attemptId}/>}
