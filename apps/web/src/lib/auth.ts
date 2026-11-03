import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, brandProfiles, db, eq, gte, memberships, sessions, users, workspaces } from "@studio/db";

const COOKIE = "sid";
const DAYS = Number(process.env.SESSION_DAYS || 30);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const hashPassword = (pw: string) => bcrypt.hash(pw, 11);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.APP_URL?.startsWith("http://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha(token)));
  jar.delete(COOKIE);
}

export const currentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha(token)), gte(sessions.expiresAt, new Date())));
  return row?.user ?? null;
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** The user's workspace + brand profile; sends them to onboarding if they have none yet. */
export const currentWorkspace = cache(async () => {
  const user = await requireUser();
  const [row] = await db
    .select({ workspace: workspaces, role: memberships.role })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, user.id))
    .limit(1);
  if (!row) redirect("/onboarding");
  const [brand] = await db.select().from(brandProfiles).where(eq(brandProfiles.workspaceId, row.workspace.id));
  if (!brand) redirect("/onboarding");
  return { user, workspace: row.workspace, role: row.role, brand };
});
