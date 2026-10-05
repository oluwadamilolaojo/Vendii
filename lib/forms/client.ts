import { auth } from "@/lib/auth";
import { REPORT_HEADER, decodeReport, type FormsReport } from "./profile";
import type { FormProfile, Holding } from "./types";

export interface FormsResult { blob: Blob; filename: string; report: FormsReport | null }

export async function postForForms(url: string, body?: unknown): Promise<FormsResult> {
  const token = auth.idToken ? await auth.idToken() : null;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `Couldn't build the forms (${res.status}).`);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "mandates.pdf";
  return { blob: await res.blob(), filename: name, report: decodeReport(res.headers.get(REPORT_HEADER)) };
}

export const buildForms = (input: { profile: FormProfile; holdings: Holding[]; photo: string | null; signature: string | null }) =>
  postForForms("/api/forms", input);

/** Hands the PDF to the browser as a download. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
