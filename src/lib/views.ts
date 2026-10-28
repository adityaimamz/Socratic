import { z } from "zod";
import type { Profile, Question, Exam, SchoolClass, Settings, AttemptSummary, Audit, Item, GradingView, ExamResult, Answer, MonitoredAttempt, IntegrityEvent } from "./types";

export interface PageResult<T> { items: T[]; total: number; page: number; pageSize: number }
export type QuestionSummary = Pick<Question,"id"|"owner_id"|"kind"|"prompt"|"weight"|"tag"|"archived"|"version"> & { option_count: number };
export interface QuestionFolder { tag: string; key: string; count: number }
export type ClassOption = Pick<SchoolClass,"id"|"name">;
export type ClassSummary = ClassOption & Pick<SchoolClass,"owner_id"> & {member_count:number};
export type ExamSummary = Pick<Exam,"id"|"owner_id"|"title"|"mode"|"status"|"opens_at"|"closes_at"|"duration_minutes"|"question_count"|"can_manage">;
export type StudentExam = Omit<Exam,"owner_id"|"question_ids"|"participant_emails"|"staff_ids">;
export interface ExamEditorData { exam: Exam | null; has_attempts?: boolean; selected_questions: QuestionSummary[]; selected_class: ClassOption | null }
export interface AttemptDetailData { attempt_id: string; exam_id: string; name: string; status: string; items: Item[]; answers: Record<string,Answer> }
export type MonitorSummary = {exam: Exam; attempts: Omit<MonitoredAttempt,"events">[]; total: number; page: number; pageSize: number; server_now: string; stats: {sessions:number;active:number;finished:number;resets:number}};
export interface ViewDataMap {
 session: Profile;
 "teacher-overview": {exams:ExamSummary[];published:number;questions:number;classes:number};
 "student-dashboard": {exams:ExamSummary[];attempts:AttemptSummary[];server_now:string;total:number;page:number;pageSize:number;available:number;scheduled:number;completed:number};
 questions: PageResult<QuestionSummary>;
 "question-folders": {folders:QuestionFolder[]};
 "question-selection": PageResult<QuestionSummary>;
 question: {question:Question};
 classes: PageResult<ClassSummary>;
 class: {class:SchoolClass};
 "class-options": PageResult<ClassOption>;
 exams: PageResult<ExamSummary>;
 exam: {exam:Exam;class_name:string|null};
 "exam-editor": ExamEditorData;
 "exam-preview": {exam:Exam;questions:Item[]};
 "exam-participants": {exam:Exam;selected_staff:Pick<Profile,"id"|"name">[]};
 "exam-rules": {exam:StudentExam;settings:Settings;attempts:AttemptSummary[];server_now:string;fullscreen_exempt:boolean};
 teachers: PageResult<Profile>;
 "admin-users": PageResult<Profile>;
 "admin-invitations": PageResult<{email:string;name:string;role:Profile["role"];accepted_by:string|null}>;
 "admin-settings": {settings:Settings};
 "admin-audit": PageResult<Audit & {actor_name:string|null}>;
 monitor: MonitorSummary;
 "attempt-detail": AttemptDetailData;
 events: PageResult<IntegrityEvent>;
 grading: GradingView;
 result: ExamResult;
}
export type ViewName = keyof ViewDataMap;
export const viewNames = ["session","teacher-overview","student-dashboard","questions","question-folders","question-selection","question","classes","class","class-options","exams","exam","exam-editor","exam-preview","exam-participants","exam-rules","teachers","admin-users","admin-invitations","admin-settings","admin-audit","monitor","attempt-detail","events","grading","result"] as const satisfies readonly ViewName[];
export const viewInput = z.object({id:z.uuid().optional(),page:z.coerce.number().int().min(1).max(100000).default(1),q:z.string().trim().max(100).default(""),folder:z.string().trim().max(100).optional()}).strict();
export type ViewParams = { id?: string; page?: number; q?: string; folder?: string };
const needsId = new Set<ViewName>(["question","class","exam","exam-preview","exam-participants","exam-rules","monitor","attempt-detail","events","grading","result"]);
export function parseView(view: string, input: unknown) {
 const name=z.enum(viewNames).parse(view),params=viewInput.parse(input);
 if(needsId.has(name)&&!params.id)throw new z.ZodError([{code:"custom",path:["id"],message:"ID diperlukan."}]);
 return {name,params};
}
export const liveViews = new Set<ViewName>(["session","student-dashboard","exam-rules","monitor","attempt-detail","events","grading","result"]);
export function viewForPath(href: string): {view: ViewName;params:ViewParams}|null {
 const [path,search=""]=href.split("?");const s=path.split("/").filter(Boolean);const q=new URLSearchParams(search);
 const params:ViewParams={page:Number(q.get("page"))||1,q:q.get("q")||""};const folder=q.get("folder");if(folder)params.folder=folder;
 if(path==="/manage")return {view:"teacher-overview",params};
 if(s[0]==="admin"&&["users","settings","audit"].includes(s[1]))return {view:`admin-${s[1]}` as ViewName,params};
 if(s[0]!=="manage")return null;
 if(s[1]==="classes")return {view:"classes",params};
 if(s[1]==="questions")return s[2]?(s[2]==="new"||s[2]==="import"?null:{view:"question",params:{id:s[2]}}):{view:params.q||params.folder?"questions":"question-folders",params};
 if(s[1]==="exams"){
  if(!s[2])return {view:"exams",params};
  if(s[2]==="new")return {view:"exam-editor",params:{}};
  if(s[3]==="monitor"||s[3]==="results"||s[3]==="grading")return null;
  return {view:s[3]==="edit"?"exam-editor":s[3]==="preview"?"exam-preview":s[3]==="participants"?"exam-participants":"exam",params:{id:s[2]}};
 }
 return null;
}
