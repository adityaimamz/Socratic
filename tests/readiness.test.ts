import {createServer} from "node:http";
import {spawn} from "node:child_process";
import {test,expect} from "vitest";

async function readiness(scopedAvailable:boolean,joinAvailable=true){
 const server=createServer((request,response)=>{
  response.setHeader("Content-Type","application/json");
  if(request.url?.startsWith("/auth/v1/settings"))response.end(JSON.stringify({external:{email:true,google:true}}));
  else if(request.url?.startsWith("/auth/v1/admin/users"))response.end(JSON.stringify({users:[]}));
  else if(request.url==="/rest/v1/rpc/school_api"){response.statusCode=400;response.end(JSON.stringify({message:"UNAUTHORIZED",code:"P0001"}));}
  else if(request.url==="/rest/v1/rpc/school_request"){
   response.statusCode=scopedAvailable?200:404;
   response.end(JSON.stringify(scopedAvailable?{ok:false,code:"INVITATION_REQUIRED"}:{code:"PGRST202",message:"Could not find public.school_request"}));
  }else if(request.url==="/rest/v1/rpc/school_class_link_preview"){
   response.statusCode=joinAvailable?200:404;response.end(JSON.stringify(joinAvailable?null:{code:"PGRST202"}));
  }else if(request.url==="/storage/v1/bucket/exam-media")response.end(JSON.stringify({id:"exam-media",public:false}));
  else{response.statusCode=404;response.end("{}");}
 });
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
 const address=server.address();if(!address||typeof address==="string")throw new Error("Test server unavailable");
 try{return await new Promise<{code:number|null;output:string}>((resolve,reject)=>{
  const child=spawn(process.execPath,["scripts/check-supabase.mjs"],{env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${address.port}`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"test-public-key",SUPABASE_SECRET_KEY:"test-secret-do-not-log"},windowsHide:true});
  let output="";child.stdout.on("data",data=>output+=data);child.stderr.on("data",data=>output+=data);child.on("error",reject);child.on("close",code=>resolve({code,output}));
 });}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
}

test("deployment readiness fails when the old RPC exists but the new migration is absent",async()=>{
 const result=await readiness(false);expect(result.code).toBe(1);expect(result.output).toContain("Migrasi inti: tersedia");expect(result.output).toContain("PGRST202");expect(result.output).toContain("jalankan npm run supabase:migrate sebelum deploy");expect(result.output).not.toContain("test-secret-do-not-log");
});
test("deployment readiness accepts the migrated service-only RPC",async()=>{
 const result=await readiness(true);expect(result.code).toBe(0);expect(result.output).toContain("Migrasi fetch/navigation (13): tersedia");expect(result.output).not.toContain("test-secret-do-not-log");
});

test("deployment readiness rejects missing class join link migration",async()=>{
 const result=await readiness(true,false);expect(result.code).toBe(1);expect(result.output).toContain("Migrasi link kelas (14): belum tersedia");
});
