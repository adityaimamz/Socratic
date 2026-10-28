import type { Receipt } from "./types";

export interface ScoreCounts { correct: number; wrong: number; empty: number; correct_points?: number; penalty?: number; total_points?: number }
export interface ScoreBreakdown { original: number; final: number; deduction: number; deductionScore: number; wrong: number; penalty: number; totalPoints: number; correctPoints: number; essayPoints: number }

const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

// Mirrors server scoring: score = 100 * (correct points - wrong x penalty + essay points) / total points, clamped to 0..100.
export function scoreBreakdown(counts: ScoreCounts | undefined, result: Pick<Receipt, "grading_status" | "essay_points" | "score"> | null | undefined): ScoreBreakdown | null {
  if (!counts || counts.total_points === undefined || !counts.total_points) return null;
  if (result?.grading_status === "pending") return null;
  const essay = result?.essay_points ?? 0, penalty = counts.penalty ?? 0, total = counts.total_points;
  const deduction = counts.wrong * penalty, correctPoints = counts.correct_points ?? 0;
  const original = round(clamp(100 * (correctPoints + essay) / total));
  const final = round(clamp(100 * (correctPoints - deduction + essay) / total));
  return { original, final: result?.score ?? final, deduction, deductionScore: round(100 * deduction / total), wrong: counts.wrong, penalty, totalPoints: total, correctPoints, essayPoints: essay };
}

const num = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
export function deductionText(b: ScoreBreakdown) {
  return b.penalty > 0 ? `${b.wrong} salah × ${num(b.penalty)} = ${num(b.deduction)} poin (−${num(b.deductionScore)} nilai)` : "Tidak ada penalti";
}

// Worked examples with this participant's own numbers.
export function originalFormula(b: ScoreBreakdown) {
  return `100 × ${num(b.correctPoints + b.essayPoints)} ÷ ${num(b.totalPoints)} = ${num(b.original)}`;
}
export function finalFormula(b: ScoreBreakdown) {
  return `100 × (${num(b.correctPoints)} − ${num(b.deduction)}${b.essayPoints ? ` + ${num(b.essayPoints)}` : ""}) ÷ ${num(b.totalPoints)} = ${num(b.final)}`;
}
