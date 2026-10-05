import "server-only";
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import type { Role } from "@/lib/domain/types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Caller {
  uid: string;
  role: Role;
}

/** Every route starts here. The role comes from the verified token's custom claim, never from the request body. */
export async function caller(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Sign in to continue.");
  try {
    const decoded = await adminAuth().verifyIdToken(token, true);
    return { uid: decoded.uid, role: decoded.role === "ops" ? "ops" : "shareholder" };
  } catch (e) {
    // Only a bad or expired token is the user's problem. Anything else (missing server keys,
    // Firebase unreachable) is ours and must surface as a logged 500, not a sign-in loop.
    const code = String((e as { code?: unknown })?.code ?? "");
    if (code.startsWith("auth/")) throw new HttpError(401, "Your session has expired. Sign in again.");
    throw e;
  }
}

export function requireOps(c: Caller): void {
  if (c.role !== "ops") throw new HttpError(403, "Only Dividendi staff can do that.");
}

/** Wraps a handler so thrown errors become JSON the UI can show as-is. */
export function handle(fn: (req: Request, ctx: { params: Record<string, string> }) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Record<string, string> }) => {
    try {
      return NextResponse.json(await fn(req, ctx));
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
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
