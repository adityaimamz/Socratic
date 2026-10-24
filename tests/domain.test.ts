import { describe,it,expect } from "vitest";
import { scoreAnswers,csvCell,remaining } from "../src/lib/domain";
import { parseAction } from "../src/lib/validation";
import {passwordAction} from "../src/lib/auth-validation";
describe("grading and export",()=>{
 it("scores wrong, empty, penalty and clamps",()=>{const items=Array.from({length:10},(_,i)=>({id:String(i),weight:1,correctOptionId:"yes"}));const a=Object.fromEntries(Array.from({length:9},(_,i)=>[String(i),{optionId:i<7?"yes":"no"}]));expect(scoreAnswers(items,a,0).score).toBe(70);expect(scoreAnswers(items,a,.25).score).toBe(65);expect(scoreAnswers(items,a,100).score).toBe(0);});
 it("neutralizes spreadsheet formulas and quotes",()=>{expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');expect(csvCell('a"b')).toBe('"a""b"');expect(csvCell(" \t@cmd")).toContain("'");});
 it("uses deadline difference without negative time",()=>expect(remaining("2026-01-01T00:01:00Z","2026-01-01T00:02:00Z")).toBe(0));
 it("rejects invalid action and empty exam schedule",()=>{expect(()=>parseAction("oops",{})).toThrow();expect(()=>parseAction("attempt.save",{})).toThrow();});
 it("validates password auth without changing password whitespace",()=>{expect(passwordAction.parse({mode:"login",email:"ADMIN@school.test",password:" password  "})).toMatchObject({email:"admin@school.test",password:" password  "});expect(()=>passwordAction.parse({mode:"register",email:"admin@school.test",name:"Admin",password:"short"})).toThrow();expect(()=>passwordAction.parse({mode:"login",email:"invalid",password:"123"})).toThrow();});
});
