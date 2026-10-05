import "@/lib/storageMigration";
import { MOCK_OTP } from "@/lib/config";
import { findMockStaff } from "./mockStaff";
import type { Session } from "@/lib/domain/types";
import { delay } from "@/lib/util";
import type { AuthService } from "./types";

const KEY = "vendii:v1:session";
const EVT = "vendii:auth";

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function readMockSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** Same identifier always maps to the same user, so claims survive signing out and back in. */
export function mockSignInAs(identifier: string, channel: "phone" | "email"): Session {
  const id = identifier.trim().toLowerCase();
  const staff = findMockStaff(identifier);
  const session: Session = staff
    ? { userId: staff.id, identifier: identifier.trim(), channel, role: staff.role, name: staff.name }
    : { userId: "mock-" + hash(id), identifier: identifier.trim(), channel, role: "shareholder" };
  window.localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(EVT));
  return session;
}

export const mockAuth: AuthService = {
  capabilities: { whatsapp: true, emailCode: true },
  async getSession() {
    return readMockSession();
  },
  async sendCode() {
    await delay(400); // nothing is sent in mock mode
  },
  async verifyCode(channel, identifier, code) {
    await delay(300);
    if (code.trim() !== MOCK_OTP) throw new Error(`That code doesn't match. In demo mode the code is ${MOCK_OTP}.`);
    return mockSignInAs(identifier, channel === "email" ? "email" : "phone");
  },
  async signOut() {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVT));
  },
  onChange(cb) {
    const handler = () => cb(readMockSession());
    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
    };
  },
};
