import type {ViewName} from "./views";
export function affectedViews(path:string):ViewName[] {
 if(path.startsWith("questions/"))return ["questions","question-selection","question","exam-editor","exam-preview","teacher-overview","admin-audit"];
 if(path.startsWith("classes/"))return ["classes","class","class-options","exams","exam","exam-editor","exam-participants","teacher-overview","student-dashboard","exam-rules","admin-invitations","admin-audit"];
 if(path.startsWith("admin/user")||path.startsWith("admin/invite"))return ["admin-users","admin-invitations","teachers","exam-participants","admin-audit"];
 if(path.startsWith("admin/settings"))return ["admin-settings","exam-rules","admin-audit"];
 if(path.startsWith("exams/"))return ["exams","exam","exam-editor","exam-preview","exam-participants","exam-rules","student-dashboard","teacher-overview","monitor","result","admin-audit"];
 if(path.startsWith("manage/"))return ["monitor","events","grading","result","exam","exams","exam-rules","student-dashboard","admin-audit"];
 if(/^attempts\/[^/]+\/(submit|takeover)$/.test(path))return ["student-dashboard","exam-rules","result","monitor"];
 return [];
}
