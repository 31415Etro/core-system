import type { PagePermission } from "@/lib/types"
export type LocalManagedUser={id:string;name:string;email:string;role:"admin"|"manager"|"support"|"finance"|"commercial"|"client"|"user";permissions:PagePermission[];active:boolean;passwordHash:string;createdAt:string}
const KEY="genes-local-users"
export async function hashPassword(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("")}
export function getLocalUsers():LocalManagedUser[]{if(typeof window==="undefined")return[];try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
export function saveLocalUsers(users:LocalManagedUser[]){localStorage.setItem(KEY,JSON.stringify(users))}
export async function createLocalUser(input:Omit<LocalManagedUser,"id"|"passwordHash"|"createdAt">&{password:string}){const users=getLocalUsers();if(users.some(u=>u.email.toLowerCase()===input.email.toLowerCase()))throw new Error("Já existe um usuário com este e-mail");const user:LocalManagedUser={...input,id:crypto.randomUUID(),email:input.email.toLowerCase(),passwordHash:await hashPassword(input.password),createdAt:new Date().toISOString()};saveLocalUsers([user,...users]);return user}
export async function authenticateLocalUser(email:string,password:string){const user=getLocalUsers().find(u=>u.email===email.toLowerCase()&&u.active);if(!user)return null;return user.passwordHash===await hashPassword(password)?user:null}
