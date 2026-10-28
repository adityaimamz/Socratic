import { expect,test } from "vitest";
import { scoreBreakdown,deductionText,originalFormula,finalFormula } from "../src/lib/score";
test("shows original and after-penalty score with the deduction formula",()=>{
 const b=scoreBreakdown({correct:23,wrong:7,empty:0,correct_points:23,penalty:0.25,total_points:30},{grading_status:"complete",essay_points:0,score:70.83})!;
 expect(b.original).toBe(76.67);expect(b.final).toBe(70.83);expect(b.deduction).toBe(1.75);expect(b.deductionScore).toBe(5.83);
 expect(deductionText(b)).toBe("7 salah × 0,25 = 1,75 poin (−5,83 nilai)");
 expect(originalFormula(b)).toBe("100 × 23 ÷ 30 = 76,67");expect(finalFormula(b)).toBe("100 × (23 − 1,75) ÷ 30 = 70,83");
});
test("no penalty keeps both scores equal; pending essays have no breakdown",()=>{
 const b=scoreBreakdown({correct:23,wrong:7,empty:0,correct_points:23,penalty:0,total_points:30},{grading_status:"complete",essay_points:0,score:76.67})!;
 expect(b.original).toBe(b.final);expect(deductionText(b)).toBe("Tidak ada penalti");
 expect(scoreBreakdown({correct:1,wrong:0,empty:0,correct_points:1,penalty:0,total_points:2},{grading_status:"pending",essay_points:null,score:null})).toBeNull();
});
