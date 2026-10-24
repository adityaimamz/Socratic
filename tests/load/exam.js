import http from "k6/http";
import {check,sleep,fail} from "k6";
import {SharedArray} from "k6/data";
import {Trend,Rate} from "k6/metrics";
import crypto from "k6/crypto";

// Supply authenticated, distinct staging participants; never include server keys.
const users=new SharedArray("staging participants",()=>JSON.parse(open(__ENV.USERS_FILE)));
const base=(__ENV.BASE_URL||"").replace(/\/$/,"");
const vus=Number(__ENV.VUS||500);
if(__ENV.CONFIRM_STAGING!=="yes"||!/^https?:\/\//.test(base)||users.length<vus)throw new Error("Set CONFIRM_STAGING=yes, BASE_URL, USERS_FILE with one distinct account per VU.");
const saveLatency=new Trend("answer_save_ms",true),resetLatency=new Trend("reset_ack_ms",true),failures=new Rate("exam_operation_failed");
export const options={scenarios:{exam:{executor:"per-vu-iterations",vus,iterations:1,maxDuration:"15m"}},thresholds:{answer_save_ms:["p(95)<1000"],reset_ack_ms:["p(95)<2000"],exam_operation_failed:["rate<0.01"],checks:["rate==1"]}};
function uuid(){const b=new Uint8Array(crypto.randomBytes(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export default function(){
 const user=users[__VU-1],session=uuid();
 const headers={"Content-Type":"application/json",Origin:base,Cookie:user.cookie};
 function send(path,data,method="POST",metric){const response=http.request(method,`${base}/api/${path}`,JSON.stringify(data),{headers,tags:{operation:metric===saveLatency?"save":metric===resetLatency?"reset":"other"}});if(metric)metric.add(response.timings.duration);const ok=check(response,{"operation accepted":r=>r.status===200});failures.add(!ok);if(!ok)fail(`Operation failed: HTTP ${response.status}`);return response.json();}
 const a=send(`exams/${user.exam_id}/attempts`,{session_id:session});if(a.status!=="in_progress"||a.items.length!==100)fail("Use a fresh 100-question staging exam with sufficient duration.");
 let epoch=a.answer_epoch,answers=a.answers||{};
 for(let i=0;i<100;i++){
   const item=a.items[i];send(`attempts/${a.id}/answers/${item.id}`,{session_id:session,answer_epoch:epoch,operation_id:uuid(),expected_revision:answers[item.id]?.revision||0,option_id:item.options[0].id,marked:false,current_question:i},"PUT",saveLatency);
   if(i===49){const event={session_id:session,answer_epoch:epoch,event_id:uuid(),type:"visibility_hidden",client_at:new Date().toISOString()};const r=send(`attempts/${a.id}/events`,event,"POST",resetLatency);check(r,{"all answers cleared":x=>Object.keys(x.attempt.answers).length===0});const retry=send(`attempts/${a.id}/events`,event);check(retry,{"duplicate reset is idempotent":x=>x.attempt.answer_epoch===r.attempt.answer_epoch});epoch=r.attempt.answer_epoch;answers={};}
   if(i%10===0)send(`attempts/${a.id}/heartbeat`,{session_id:session});
   sleep(Number(__ENV.THINK_SECONDS||1));
 }
 // A shared timestamp allows a deliberate simultaneous-submit burst.
 const submitAt=Number(__ENV.SUBMIT_AT_MS||0);if(submitAt>Date.now())sleep((submitAt-Date.now())/1000);
 const receipt=send(`attempts/${a.id}/submit`,{session_id:session,answer_epoch:epoch});check(receipt,{"receipt returned":r=>Boolean(r.receipt_id),"withheld score absent":r=>!("score"in r)});
}
