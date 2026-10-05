import "@/lib/storageMigration";
import {
  RecaptchaVerifier,
  isSignInWithEmailLink,
  onIdTokenChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { fbAuth } from "@/lib/firebase/client";
import type { Session } from "@/lib/domain/types";
import type { AuthService } from "./types";
import { normaliseRole } from "@/lib/domain/permissions";

const EMAIL_KEY = "vendii:emailForSignIn";

let verifier: RecaptchaVerifier | null = null;
let pending: { phone: string; confirmation: ConfirmationResult } | null = null;

/** Firebase phone sign-in needs reCAPTCHA. Invisible, so the shareholder never sees a puzzle unless Google insists. */
function getVerifier(): RecaptchaVerifier {
  if (verifier) return verifier;
  let host = document.getElementById("recaptcha-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "recaptcha-host";
    document.body.appendChild(host);
  }
  verifier = new RecaptchaVerifier(fbAuth(), host, { size: "invisible" });
  return verifier;
}

function resetVerifier() {
  verifier?.clear();
  verifier = null;
  document.getElementById("recaptcha-host")?.remove();
}

/** Role is a custom claim set with `npm run set-role`. Clients can't write it. */
async function toSession(user: User | null, forceRefresh = false): Promise<Session | null> {
  if (!user) return null;
  const token = await user.getIdTokenResult(forceRefresh);
  return {
    userId: user.uid,
    identifier: user.phoneNumber ?? user.email ?? "",
    channel: user.phoneNumber ? "phone" : "email",
    role: normaliseRole(token.claims.role),
    name: typeof token.claims.name === "string" ? token.claims.name : user.displayName ?? undefined,
  };
}

function friendly(e: unknown): Error {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-verification-code": "That code doesn't match. Check the SMS and try again.",
    "auth/code-expired": "That code has expired. Send a new one.",
    "auth/too-many-requests": "Too many attempts from this device. Wait a few minutes and try again.",
    "auth/invalid-phone-number": "Enter a Nigerian mobile number, like 0803 123 4567.",
    "auth/quota-exceeded": "We can't send codes right now. Try email instead.",
    "auth/invalid-action-code": "This sign-in link has expired or was already used. Request a new one.",
    "auth/invalid-email": "Enter a valid email address.",
  };
  return new Error(map[code] ?? (e instanceof Error ? e.message : "Sign-in failed. Try again."));
}

export const firebaseAuth: AuthService = {
  capabilities: { whatsapp: false, emailCode: false },

  async getSession() {
    const a = fbAuth();
    await a.authStateReady();
    // Force a refresh once per load so a newly granted ops role shows up without signing out.
    return toSession(a.currentUser, true);
  },

  async sendCode(channel, identifier) {
    const a = fbAuth();
    try {
      if (channel === "email") {
        await sendSignInLinkToEmail(a, identifier, {
          url: `${window.location.origin}/auth/callback`,
          handleCodeInApp: true,
        });
        window.localStorage.setItem(EMAIL_KEY, identifier);
        return;
      }
      const confirmation = await signInWithPhoneNumber(a, identifier, getVerifier());
      pending = { phone: identifier, confirmation };
    } catch (e) {
      resetVerifier();
      throw friendly(e);
    }
  },

  async verifyCode(channel, identifier, code) {
    if (channel === "email") throw new Error("Open the sign-in link we emailed you to continue.");
    if (!pending || pending.phone !== identifier) throw new Error("Send a new code first.");
    try {
      const cred = await pending.confirmation.confirm(code.trim());
      pending = null;
      const s = await toSession(cred.user);
      if (!s) throw new Error("Signed in, but no user came back. Try again.");
      return s;
    } catch (e) {
      throw friendly(e);
    }
  },

  async completeLink(url) {
    const a = fbAuth();
    if (!isSignInWithEmailLink(a, url)) return null;
    let email = window.localStorage.getItem(EMAIL_KEY);
    // Link opened on a different device from the one that asked for it.
    if (!email) email = window.prompt("Confirm the email address you signed in with")?.trim().toLowerCase() ?? null;
    if (!email) throw new Error("We need your email address to finish signing in.");
    try {
      const cred = await signInWithEmailLink(a, email, url);
      window.localStorage.removeItem(EMAIL_KEY);
      return toSession(cred.user);
    } catch (e) {
      throw friendly(e);
    }
  },

  async idToken() {
    const u = fbAuth().currentUser;
    return u ? u.getIdToken() : null;
  },

  async signOut() {
    await signOut(fbAuth());
  },

  onChange(cb) {
    return onIdTokenChanged(fbAuth(), (user) => {
      void toSession(user).then(cb);
    });
  },
};
