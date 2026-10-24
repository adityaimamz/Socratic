import {afterEach,describe,expect,it,vi} from "vitest";
import {api,requestJson} from "../src/lib/client";
import {ApiError,messages} from "../src/lib/domain";
import {parseAction,validationMessage} from "../src/lib/validation";
import {ZodError} from "zod";

afterEach(()=>vi.unstubAllGlobals());
describe("readable request failures",()=>{
 it("labels invalid form fields in Indonesian without exposing internal paths",()=>{
  try{parseAction("admin.invite",{email:"invalid",name:"A",role:"student"});throw new Error("Expected validation to fail");}
  catch(error){expect(error).toBeInstanceOf(ZodError);const message=validationMessage(error as ZodError);expect(message).toContain("Email:");expect(message).toContain("Nama:");expect(message).not.toContain("Too small");expect(message).not.toContain("Invalid");}
 });
 it("translates network failures for all API consumers",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  await expect(api("workspace")).rejects.toMatchObject({code:"NETWORK_ERROR",message:messages.NETWORK_ERROR});
 });
 it("handles HTML gateway errors without displaying JSON parser details",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("<html>Bad gateway</html>",{status:502})));
  await expect(requestJson("/auth/password")).rejects.toMatchObject({code:"SERVER_ERROR",status:502,message:messages.SERVER_ERROR});
 });
 it.each(["null","false","42","\"unexpected\""])("rejects unusable JSON %s",async body=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(body)));
  await expect(api("workspace")).rejects.toMatchObject({code:"INVALID_RESPONSE"});
 });
 it("preserves conflict codes used by exam synchronization",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({ok:false,code:"ANSWER_EPOCH_MISMATCH"})));
  await expect(api("attempts/test")).rejects.toMatchObject({code:"ANSWER_EPOCH_MISMATCH",message:messages.ANSWER_EPOCH_MISMATCH});
 });
 it("preserves actionable server messages and HTTP status",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({code:"RATE_LIMITED",message:"Tunggu satu menit, lalu coba lagi."},{status:429})));
  await expect(requestJson("/auth/password")).rejects.toMatchObject({code:"RATE_LIMITED",status:429,message:"Tunggu satu menit, lalu coba lagi."});
 });
 it("falls back for an empty error message",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({message:""},{status:401})));
  await expect(api("workspace")).rejects.toBeInstanceOf(ApiError);
 });
 it("returns successful payloads unchanged",async()=>{
  const data={items:[{id:"question-1"}],server_now:"2026-10-24T00:00:00Z"};
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json(data)));
  await expect(api("workspace")).resolves.toEqual(data);
 });
});
