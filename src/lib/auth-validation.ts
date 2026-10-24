import {z} from "zod";
const email=z.email().max(254).transform(s=>s.toLowerCase().trim());
export const passwordRule=z.string().min(10,"Gunakan minimal 10 karakter.").max(128,"Password maksimal 128 karakter.");
export const passwordAction=z.discriminatedUnion("mode",[
 z.object({mode:z.literal("login"),email,password:z.string().min(1).max(128)}),
 z.object({mode:z.literal("register"),email,password:passwordRule,name:z.string().trim().min(2).max(100)}),
 z.object({mode:z.literal("recover"),email}),
 z.object({mode:z.literal("update"),password:passwordRule})
]);
