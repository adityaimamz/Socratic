import {z} from "zod";
import {joinToken} from "./class-links";
const email=z.email().max(254).transform(s=>s.toLowerCase().trim());
export const passwordRule=z.string().min(10,"Gunakan minimal 10 huruf, angka, atau tanda baca.").max(128,"Kata sandi maksimal 128 huruf, angka, atau tanda baca.");
export const passwordAction=z.discriminatedUnion("mode",[
 z.object({mode:z.literal("login"),email,password:z.string().min(1).max(128),join_token:joinToken.optional()}),
 z.object({mode:z.literal("register"),email,password:passwordRule,name:z.string().trim().min(2).max(100),join_token:joinToken.optional()}),
 z.object({mode:z.literal("recover"),email}),
 z.object({mode:z.literal("update"),password:passwordRule})
]);
