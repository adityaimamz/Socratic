import { ApiError } from "./domain";
export async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, options); }
  catch { throw new ApiError("NETWORK_ERROR"); }
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError(response.status >= 500 ? "SERVER_ERROR" : "INVALID_RESPONSE", undefined, response.status); }
  if (!data || typeof data !== "object") throw new ApiError("INVALID_RESPONSE", undefined, response.status);
  if (!response.ok || data.ok === false) {
    const fallback = response.status === 401 ? "UNAUTHORIZED" : response.status === 429 ? "RATE_LIMITED" : "SERVER_ERROR";
    throw new ApiError(typeof data.code === "string" ? data.code : fallback, typeof data.message === "string" && data.message.trim() ? data.message : undefined, response.status);
  }
  return data as T;
}
export async function api<T>(path: string, body?: unknown, method="POST"): Promise<T> {
  return requestJson<T>(`/api/${path}`, { method: body === undefined ? "GET" : method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
}
export function sessionId() {
  let value = sessionStorage.getItem("safe-exam-session");
  if (!value) { value = crypto.randomUUID(); sessionStorage.setItem("safe-exam-session",value); }
  return value;
}
let claimed:Promise<string>|undefined;
// sessionStorage is copied when a tab is duplicated. A live-tab handshake prevents
// the copied ID from becoming a second writer while keeping reload/resume stable.
export function claimSession(){
  if(claimed)return claimed;
  claimed=new Promise(resolve=>{
    let value=sessionId();
    if(typeof BroadcastChannel==="undefined"){resolve(value);return;}
    const instance=crypto.randomUUID(),channel=new BroadcastChannel("safe-exam-session-presence");let occupied=false;
    channel.onmessage=e=>{const data=e.data;if(data?.instance===instance)return;if(data?.type==="probe"&&data.session===value)channel.postMessage({type:"owner",session:value,instance});if(data?.type==="owner"&&data.session===value)occupied=true;};
    channel.postMessage({type:"probe",session:value,instance});
    setTimeout(()=>{if(occupied){value=crypto.randomUUID();sessionStorage.setItem("safe-exam-session",value);}resolve(value);},150);
    window.addEventListener("pagehide",()=>channel.close(),{once:true});
  });
  return claimed;
}
