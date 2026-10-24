import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { parseAction } from "../src/lib/validation";
const admin = crypto.randomUUID(), teacher = crypto.randomUUID(), other = crypto.randomUUID(), student = crypto.randomUUID(), disabled = crypto.randomUUID();
let db: PGlite;
async function call(actor: string, action: string, data: unknown = {}) { return (await db.query<{ result: any }>("select public.school_api($1,$2,$3::jsonb) result", [actor, action, JSON.stringify(data)])).rows[0].result; }
async function question(owner = teacher) { return call(owner, "questions.save", { kind: "essay", prompt: "Soal sementara untuk dihapus", options: [], correct_option_id: null, rubric: "Jawaban sesuai", weight: 1, tag: "Test" }); }
async function schoolClass(owner = teacher) { return call(owner, "classes.save", { name: "Kelas sementara", emails: [`${student}@school.test`] }); }
async function exam(questionIds: string[], classId: string | null = null) { return call(teacher, "exams.save", { title: "Draft untuk penghapusan", instructions: "Uji", mode: "quiz", class_id: classId, opens_at: new Date(Date.now() - 60000).toISOString(), closes_at: new Date(Date.now() + 3600000).toISOString(), duration_minutes: 30, passing_score: 70, penalty: 0, shuffle_questions: false, shuffle_options: false, question_ids: questionIds, participant_emails: [`${student}@school.test`] }); }
const deletion = (id: string) => ({ id, operation_id: crypto.randomUUID() });
beforeAll(async () => {
  db = new PGlite(); await db.exec("create role anon; create role authenticated; create role service_role; alter default privileges in schema public grant execute on functions to anon,authenticated;");
  for (const file of readdirSync("supabase/migrations").filter(n => n.endsWith(".sql") && !n.includes("storage_cron")).sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  for (const [id, role, active] of [[admin, "admin", true], [teacher, "teacher", true], [other, "teacher", true], [student, "student", true], [disabled, "teacher", false]]) await db.query("insert into private.profiles(id,email,name,role,active) values($1,$2,'Test',$3,$4)", [id, `${id}@school.test`, role, active]);
});
afterAll(async () => { await db?.close(); });
describe("authorized and audited deletion", () => {
  it("deletes an unused question and safely retries a lost response", async () => {
    const q = await question(), payload = deletion(q.id);
    const [first, retry] = await Promise.all([call(teacher, "questions.delete", payload), call(teacher, "questions.delete", payload)]);
    expect(first).toEqual(retry); expect(first.deleted).toBe(true);
    expect((await call(teacher, "workspace")).questions.some((x: any) => x.id === q.id)).toBe(false);
    const audit = await db.query<{ details: any }>("select details from private.audit_logs where resource_id=$1 and action='questions.delete'", [q.id]);
    expect(audit.rows).toHaveLength(1); expect(audit.rows[0].details.operation_id).toBe(payload.operation_id);
    await expect(call(teacher, "classes.delete", { ...payload, id: crypto.randomUUID() })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("allows admin deletion, including archived unused questions", async () => {
    const q = await question(); await call(teacher, "questions.archive", { id: q.id });
    expect((await call(admin, "questions.delete", deletion(q.id))).deleted).toBe(true);
  });
  it("rejects other teachers, students, disabled and unknown profiles", async () => {
    const q = await question(), c = await schoolClass(), e = await exam([]);
    for (const [action, id] of [["questions.delete", q.id], ["classes.delete", c.id], ["exams.delete", e.id]]) {
      for (const actor of [other, student, disabled, crypto.randomUUID()]) await expect(call(actor, action, deletion(id))).rejects.toThrow(/NOT_FOUND|FORBIDDEN|UNAUTHORIZED/);
    }
  });
  it("blocks deletion of referenced questions/classes, then allows it after draft deletion", async () => {
    const q = await question(), c = await schoolClass(), e = await exam([q.id], c.id);
    await expect(call(teacher, "questions.delete", deletion(q.id))).rejects.toThrow("QUESTION_IN_USE");
    await expect(call(teacher, "classes.delete", deletion(c.id))).rejects.toThrow("CLASS_IN_USE");
    expect((await call(teacher, "exams.delete", deletion(e.id))).deleted).toBe(true);
    expect((await call(teacher, "questions.delete", deletion(q.id))).deleted).toBe(true);
    expect((await call(teacher, "classes.delete", deletion(c.id))).deleted).toBe(true);
    expect((await db.query("select * from private.memberships where class_id=$1", [c.id])).rows).toHaveLength(0);
    expect((await db.query("select * from private.profiles where id=$1", [student])).rows).toHaveLength(1);
    expect((await db.query("select * from private.invitations where email=$1", [`${student}@school.test`])).rows).toHaveLength(1);
  });
  it("never deletes a published or closed exam or its participant sessions/results", async () => {
    const q = await question(), e = await exam([q.id]); await call(teacher, "exams.publish", { id: e.id });
    const a = await call(student, "attempt.start", { id: e.id, session_id: crypto.randomUUID() });
    await expect(call(admin, "exams.delete", deletion(e.id))).rejects.toThrow("DRAFT_ONLY");
    await call(teacher, "exams.close", { id: e.id });
    await expect(call(admin, "exams.delete", deletion(e.id))).rejects.toThrow("DRAFT_ONLY");
    await expect(call(admin, "questions.delete", deletion(q.id))).rejects.toThrow("QUESTION_IN_USE");
    expect((await db.query("select * from private.attempts where id=$1", [a.id])).rows).toHaveLength(1);
    await db.query("update private.exams set status='draft' where id=$1", [e.id]);
    await expect(call(admin, "exams.delete", deletion(e.id))).rejects.toThrow("EXAM_HAS_ATTEMPTS");
  });
  it("cannot save a draft pointing at a deleted question", async () => {
    const q = await question(); await call(teacher, "questions.delete", deletion(q.id));
    await expect(exam([q.id])).rejects.toThrow("INVALID_QUESTION");
  });
  it("does not expose the deletion helper to browser roles", async () => {
    for (const role of ["anon", "authenticated"]) expect((await db.query<{ allowed: boolean }>("select has_function_privilege($1,'private.delete_resource(uuid,text,uuid,uuid)','execute') allowed", [role])).rows[0].allowed).toBe(false);
  });
  it("requires an explicit target and valid operation identifier on the server", () => {
    for (const action of ["questions.delete", "classes.delete", "exams.delete"]) {
      expect(() => parseAction(action, { id: "bad", operation_id: crypto.randomUUID() })).toThrow();
      expect(() => parseAction(action, { id: crypto.randomUUID() })).toThrow();
      expect(parseAction(action, deletion(crypto.randomUUID()))).toBeDefined();
    }
  });
});
