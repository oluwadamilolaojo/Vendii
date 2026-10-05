export type DataSource = "mock" | "firebase";

export const DATA_SOURCE: DataSource =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "firebase" ? "firebase" : "mock";

export const OPS_EMAILS: string[] = (process.env.NEXT_PUBLIC_OPS_EMAILS ?? "ops@vendii.ng")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** The one-time code that always works in mock mode. Never used in Firebase mode. */
export const MOCK_OTP = "123456";
