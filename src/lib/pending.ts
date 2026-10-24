export interface PendingAnswer { item_id:string; option_id:string|null; text?:string|null; marked:boolean; expected_revision:number; operation_id:string; current_question:number; answer_epoch:number }
export interface PendingIncident { event_id:string; type:"visibility_hidden"; answer_epoch:number; client_at:string }
export interface PendingState { key:string; attemptId:string; sessionId:string; epoch:number; answers:PendingAnswer[]; incident:PendingIncident|null; expiresAt:number }
function open(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("safe-exam-pending",1);r.onupgradeneeded=()=>r.result.createObjectStore("queue",{keyPath:"key"});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
let writes:Promise<void>=Promise.resolve();
export async function loadPending(key:string):Promise<PendingState|null>{await writes.catch(()=>{});const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction("queue","readonly");const r=tx.objectStore("queue").get(key);r.onsuccess=()=>{const value=r.result as PendingState|undefined;resolve(value&&value.expiresAt>Date.now()?value:null);};tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error);};});}
function write(action:(store:IDBObjectStore)=>void){const work=writes.catch(()=>{}).then(async()=>{const db=await open();return new Promise<void>((resolve,reject)=>{const tx=db.transaction("queue","readwrite");action(tx.objectStore("queue"));tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});});writes=work;return work;}
export function storePending(value:PendingState){return write(store=>{store.put(value);});}
export function clearPending(key:string){return write(store=>{store.delete(key);});}
