import { DATA_SOURCE } from "@/lib/config";
import { firebaseAuth } from "./firebase";
import { mockAuth } from "./mock";
import type { AuthService } from "./types";

export const auth: AuthService = DATA_SOURCE === "firebase" ? firebaseAuth : mockAuth;
export type { AuthCapabilities, AuthService, OtpChannel } from "./types";
