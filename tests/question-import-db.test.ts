import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { parseQuestionText, QUESTION_TEMPLATE } from "../src/lib/question-import";
const admin = crypto.randomUUID(), teacher = crypto.randomUUID(), student = crypto.randomUUID(), disabled = crypto.randomUUID();
let db: PGlite;
async function bulk(actor: string, operation: string, questions: unknown) {
  return (await db.query<{ result: any }>("select public.school_import_questions($1,$2,$3::jsonb) result", [actor, operation, JSON.stringify(questions)])).rows[0].result;
}
async function call(actor: string, action: string, data: unknown = {}) { return (await db.query<{ result: any }>("select public.school_api($1,$2,$3::jsonb) result", [actor, action, JSON.stringify(data)])).rows[0].result; }
async function count() { return Number((await db.query<{ n: number }>("select count(*) n from private.questions")).rows[0].n); }
beforeAll(async () => {
  db = new PGlite(); await db.exec("create role anon; create role authenticated; create role service_role; alter default privileges in schema public grant execute on functions to anon,authenticated;");
  for (const name of readdirSync("supabase/migrations").filter(n => n.endsWith(".sql") && !n.includes("storage_cron")).sort()) await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  for (const [id, role, active] of [[admin, "admin", true], [teacher, "teacher", true], [student, "student", true], [disabled, "teacher", false]]) await db.query("insert into private.profiles(id,email,name,role,active) values($1,$2,'Test',$3,$4)", [id, `${id}@school.test`, role, active]);
});
afterAll(async () => { await db?.close(); });
describe("atomic and authorized bulk question storage", () => {
  it("imports owned MCQ and essay questions, creates audit records, and retries without duplicates", async () => {
    const questions = parseQuestionText(QUESTION_TEMPLATE).rows.map(r => r.question), operation = crypto.randomUUID(), before = await count();
    const [first, retry] = await Promise.all([bulk(teacher, operation, questions), bulk(teacher, operation, questions)]);
    expect(first).toEqual(retry); expect(first.count).toBe(2); expect(await count()).toBe(before + 2);
    const rows = (await db.query<{ owner_id: string; kind: string }>("select owner_id,kind from private.questions where id=any($1::uuid[])", [first.question_ids])).rows;
    expect(rows.every(q => q.owner_id === teacher)).toBe(true); expect(rows.map(q => q.kind).sort()).toEqual(["essay", "mcq"]);
    expect((await db.query("select * from private.audit_logs where action='questions.import'")).rows).toHaveLength(1);
    await expect(bulk(teacher, operation, questions.slice(0, 1))).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    expect(await count()).toBe(before + 2);
  });
  it("rolls back all questions, audit entries and receipt if any question fails", async () => {
    const questions = parseQuestionText(QUESTION_TEMPLATE).rows.map(r => r.question!), operation = crypto.randomUUID(), before = await count();
    const auditCount = (await db.query<{ n: string }>("select count(*) n from private.audit_logs")).rows[0].n;
    await expect(bulk(admin, operation, [questions[0], { ...questions[1], weight: 0 }])).rejects.toThrow("INVALID_QUESTION");
    expect(await count()).toBe(before); expect((await db.query("select * from private.question_imports where operation_id=$1", [operation])).rows).toHaveLength(0);
    expect((await db.query<{ n: string }>("select count(*) n from private.audit_logs")).rows[0].n).toBe(auditCount);
    expect((await bulk(admin, operation, questions)).count).toBe(2);
  });
  it("denies students, disabled and unknown profiles and does not expose the RPC to browser roles", async () => {
    const questions = parseQuestionText(QUESTION_TEMPLATE).rows.map(r => r.question);
    for (const actor of [student, disabled, crypto.randomUUID()]) await expect(bulk(actor, crypto.randomUUID(), questions)).rejects.toThrow(/FORBIDDEN|UNAUTHORIZED/);
    for (const role of ["anon", "authenticated"]) expect((await db.query<{ allowed: boolean }>("select has_function_privilege($1,'public.school_import_questions(uuid,uuid,jsonb)','EXECUTE') allowed", [role])).rows[0].allowed).toBe(false);
  });
  it("cannot update someone else's question, and rejects empty/oversize batches", async () => {
    const questions = parseQuestionText(QUESTION_TEMPLATE).rows.map(r => r.question!);
    const target = (await bulk(teacher, crypto.randomUUID(), questions)).question_ids[0];
    await expect(bulk(admin, crypto.randomUUID(), [{ ...questions[0], id: target }])).rejects.toThrow("INVALID_QUESTION");
    await expect(bulk(admin, crypto.randomUUID(), [])).rejects.toThrow("INVALID_QUESTION");
    await expect(bulk(admin, crypto.randomUUID(), Array.from({ length: 101 }, () => questions[0]))).rejects.toThrow("INVALID_QUESTION");
  });
  it("imported questions can be published and used by students without leaking keys or rubric", async () => {
    const questions = parseQuestionText(QUESTION_TEMPLATE).rows.map(r => r.question!);
    const imported = await bulk(teacher, crypto.randomUUID(), questions);
    const exam = await call(teacher, "exams.save", { title: "Ujian hasil impor", instructions: "Uji impor", mode: "quiz", opens_at: new Date(Date.now() - 1000).toISOString(), closes_at: new Date(Date.now() + 3600000).toISOString(), duration_minutes: 30, passing_score: 70, penalty: 0, shuffle_questions: false, shuffle_options: false, question_ids: imported.question_ids, participant_emails: [`${student}@school.test`] });
    await call(teacher, "exams.publish", { id: exam.id });
    const attempt = await call(student, "attempt.start", { id: exam.id, session_id: crypto.randomUUID() });
    expect(attempt.items).toHaveLength(2); expect(attempt.items[0].options).toHaveLength(4); expect(attempt.items[1].kind).toBe("essay");
    expect(JSON.stringify(attempt)).not.toContain("correctOptionId"); expect(JSON.stringify(attempt)).not.toContain("Keliling adalah panjang");
  });
});
