import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { createSession, createUser, deleteSession, getSessionUser, getUserByEmail, getUserById } from "./db";
import type { User } from "./types";

const COOKIE_NAME = "vo_session";
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const known = Buffer.from(hash, "hex");
  return test.length === known.length && crypto.timingSafeEqual(test, known);
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function newId(prefix = ""): string {
  return prefix + crypto.randomBytes(9).toString("hex");
}

export async function signup(email: string, password: string, dealership: string): Promise<User> {
  if (await getUserByEmail(email)) throw new Error("Un compte existe déjà avec cet email");
  if (password.length < 8) throw new Error("Mot de passe trop court (8 caractères minimum)");
  const user: User = {
    id: newId("u_"),
    email: email.toLowerCase().trim(),
    password_hash: hashPassword(password),
    dealership_name: dealership.trim() || "Ma concession",
    plan: "trial",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: "trialing",
    trial_ends_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
    created_at: new Date().toISOString(),
    digest_enabled: 1,
  };
  await createUser(user);
  await issueSession(user.id);
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  const user = await getUserByEmail(email.toLowerCase().trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new Error("Email ou mot de passe incorrect");
  }
  await issueSession(user.id);
  return user;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await deleteSession(token);
  jar.delete(COOKIE_NAME);
}

async function issueSession(userId: string): Promise<void> {
  const token = newToken();
  await createSession(userId, token, 30);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
}

const DEMO_USER: User = {
  id: "demo",
  email: "demo@vo-radar.app",
  password_hash: "",
  dealership_name: "Démo",
  plan: "pro",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_status: "active",
  trial_ends_at: new Date(Date.now() + 999 * 86400_000).toISOString(),
  created_at: new Date().toISOString(),
  digest_enabled: 1,
};

export async function currentUser(): Promise<User | null> {
  if (process.env.DEMO_MODE === "true") return DEMO_USER;
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return getSessionUser(token);
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export { getUserById };
