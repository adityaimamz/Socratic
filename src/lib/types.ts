export type Role = "admin" | "teacher" | "student";
export interface Profile { id: string; name: string; email: string; role: Role; active: boolean }
export interface Option { id: string; text: string }
export type QuestionKind = "mcq" | "essay";
export interface Question { id: string; owner_id?: string; kind: QuestionKind; prompt: string; options: Option[]; correct_option_id: string | null; rubric: string; weight: number; tag: string; media_path: string | null; archived: boolean; version: number }
export interface Exam { id: string; owner_id?: string; title: string; instructions: string; mode: "quiz" | "exam"; status: "draft" | "published" | "closed" | "archived"; opens_at: string; closes_at: string; duration_minutes: number; passing_score: number; penalty: number; class_id: string | null; question_ids: string[]; participant_emails: string[]; staff_ids: string[]; shuffle_questions: boolean; shuffle_options: boolean; score_released: boolean; review_released: boolean; question_count: number; can_manage: boolean }
export interface SchoolClass { id: string; owner_id?: string; name: string; emails: string[] }
export interface AttemptSummary { id: string; exam_id: string; status: string; deadline_at: string; attempt_number: number }
export interface Workspace { profile: Profile; settings: Settings; exams: Exam[]; classes: SchoolClass[]; questions: Question[]; attempts: AttemptSummary[]; users: Profile[]; invitations: {email: string; name: string; role: Role; accepted_by: string | null}[]; audit: Audit[]; server_now: string }
export interface Settings { institution: string; timezone: string; result_retention_days: number; event_retention_days: number; audit_retention_days: number }
export interface Audit { id: number; actor_id: string; action: string; resource_id: string | null; details: Record<string, unknown>; created_at: string }
export interface Item { id: string; kind?: QuestionKind; prompt: string; options: Option[]; weight: number; media_path: string | null; media_url?: string; correctOptionId?: string; rubric?: string }
export interface Answer { optionId: string | null; text?: string | null; revision: number; marked: boolean; saved_at: string }
export interface Attempt { id: string; exam_id: string; title: string; mode: "exam" | "quiz"; status: "in_progress" | "finalized"; started_at: string; deadline_at: string; server_now: string; answer_epoch: number; session_generation: number; reset_count: number; current_question: number; answers: Record<string, Answer>; items: Item[] }
export interface Receipt { attempt_id: string; receipt_id: string; finalized_at: string; reason: string; score?: number | null; correct_count?: number; wrong_count?: number; empty_count?: number; grading_status: "pending" | "complete"; essay_count: number; essay_points?: number | null; graded_at?: string | null }
export interface EssayGrade { item_id: string; points: number; feedback: string; prompt?: string; max_points?: number }
export interface GradingView { attempt_id: string; exam_id: string; title: string; name: string; grading_status: "pending" | "complete"; score: number | null; items: Item[]; answers: Record<string, Answer>; grades: EssayGrade[] }
export interface ExamResult { receipt: Receipt; score_released: boolean; review_released: boolean; passing_score: number; review: Item[]; answers: Record<string, Answer>; essay_grades: EssayGrade[] }
export interface IntegrityEvent { id: string; type: string; outcome: string; answer_epoch: number; received_at: string }
export interface MonitoredAttempt { id: string; name: string; email: string; user_id: string; status: string; started_at: string; deadline_at: string; last_seen_at: string; reset_count: number; answered: number; total: number; takeover_requested: string | null; attempt_number: number; result: Receipt | null; review: { decision: string; reason: string } | null; counts?: { correct: number; wrong: number; empty: number }; events: IntegrityEvent[] }
export interface Monitor { exam: Exam; attempts: MonitoredAttempt[]; server_now: string }
