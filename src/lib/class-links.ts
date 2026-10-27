import {z} from "zod";

export const joinToken = z.string().regex(/^[0-9a-f]{64}$/);
export const classLinkInput = z.discriminatedUnion("operation",[
 z.object({operation:z.literal("get"),class_id:z.uuid()}),
 z.object({operation:z.literal("create"),class_id:z.uuid(),days:z.number().int().min(1).max(30),limit:z.number().int().min(1).max(1000)}),
 z.object({operation:z.literal("revoke"),class_id:z.uuid()}),
 z.object({operation:z.literal("join"),token:joinToken})
]);
export type ClassLink = {expires_at:string;max_uses:number;uses:number;revoked_at:string|null};
export type ClassLinkReply = {link:ClassLink|null;join_url?:string};
export type JoinPreview = {class_name:string;expires_at:string;remaining:number};
export const pendingJoinCookie="socratic-join";
// Only class join paths are accepted as post-login destinations.
export function joinDestination(value:unknown):string|null {
 return typeof value==="string"&&/^\/join\/[0-9a-f]{64}$/.test(value)?value:null;
}
