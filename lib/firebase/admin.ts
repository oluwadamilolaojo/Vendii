import "server-only";
// Route handlers import from here, so a stray client import fails the build instead of leaking the key.
export { adminAuth, adminBucket, adminDb } from "./adminCore";
