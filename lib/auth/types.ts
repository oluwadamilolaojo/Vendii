import type { Session } from "@/lib/domain/types";

export type OtpChannel = "sms" | "whatsapp" | "email";

export interface AuthCapabilities {
  /** WhatsApp delivery for phone codes. Firebase Auth sends SMS only. */
  whatsapp: boolean;
  /** Email sends a six-digit code. When false, email is a sign-in link only. */
  emailCode: boolean;
}

export interface AuthService {
  capabilities: AuthCapabilities;
  getSession(): Promise<Session | null>;
  /** Phone numbers must already be E.164. */
  sendCode(channel: OtpChannel, identifier: string): Promise<void>;
  verifyCode(channel: OtpChannel, identifier: string, code: string): Promise<Session>;
  /** Finishes an email sign-in link on the callback page. Returns null if the URL isn't a sign-in link. */
  completeLink?(url: string): Promise<Session | null>;
  /** Fresh ID token for calls to our own API routes. Null in mock mode. */
  idToken?(): Promise<string | null>;
  signOut(): Promise<void>;
  onChange(cb: (s: Session | null) => void): () => void;
}
