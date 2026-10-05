import "server-only";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { PermissionError } from "@/lib/domain/authorize";
import { can, isStaff, normaliseRole, type Permission } from "@/lib/domain/permissions";
import type { Actor, Role } from "@/lib/domain/types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Caller {
  uid: string;
  role: Role;
  name: string;
}

export const actorOf = (c: Caller): Actor => ({ id: c.uid, name: c.name, role: c.role });

/** Every route starts here. The role comes from the verified token's custom claim, never from the request body. */
export async function caller(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Sign in to continue.");
  try {
    const decoded = await adminAuth().verifyIdToken(token, true);
    const name = typeof decoded.name === "string" && decoded.name ? decoded.name : decoded.email ?? decoded.phone_number ?? decoded.uid;
    return { uid: decoded.uid, role: normaliseRole(decoded.role), name };
  } catch (e) {
    // Only a bad or expired token is the user's problem. Anything else (missing server keys,
    // Firebase unreachable) is ours and must surface as a logged 500, not a sign-in loop.
    const code = String((e as { code?: unknown })?.code ?? "");
    if (code.startsWith("auth/")) throw new HttpError(401, "Your session has expired. Sign in again.");
    throw e;
  }
}

export function requireStaff(c: Caller, p?: Permission): void {
  if (!isStaff(c.role)) throw new HttpError(403, "Only Vendii staff can do that.");
  if (p && !can(c.role, p)) throw new HttpError(403, "Your role doesn't allow that. Ask an admin.");
}

/** Wraps a handler so thrown errors become JSON the UI can show as-is. */
export function handle(fn: (req: Request, ctx: { params: Record<string, string> }) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Record<string, string> }) => {
    try {
      return NextResponse.json(await fn(req, ctx));
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
      // Domain rule violations (bad transitions, missing reasons) are plain Errors with no code:
      // the caller's problem, shown as-is. Firebase and gRPC failures carry a code: ours, logged.
      const infra = !(e instanceof Error) || (e as { code?: unknown }).code !== undefined;
      if (infra) console.error(e);
      return NextResponse.json(
        { error: infra ? "Something went wrong on our side. Try again." : (e as Error).message },
        { status: infra ? 500 : 400 },
      );
    }
  };
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "The request body wasn't valid JSON.");
  }
}
