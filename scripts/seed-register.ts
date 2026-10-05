/**
 * Loads the demo register entries into Firestore so a search for the sample
 * shareholder returns results. Safe to re-run: IDs are fixed, so it overwrites.
 *
 *   npm run seed
 */
import { adminDb } from "@/lib/firebase/adminCore";
import { COL, type RegisterEntryDoc } from "@/lib/data/firestoreShape";
import { normalizeName } from "@/lib/domain/names";

const E = (id: string, company: string, ticker: string, registrar: string, holderName: string, units: number, years: string, estimatedAmount: number, declaredOn: string) =>
  ({ id, doc: { company, ticker, registrar, holderName, holderNameNorm: normalizeName(holderName), units, years, estimatedAmount, declaredOn, source: "demo" } satisfies RegisterEntryDoc });

// Search "Adewale Bamidele Ogunyemi" with variants "A. B. Ogunyemi", "Adewale B. Ogunyemi", "Adewale Ogunyemi".
const ENTRIES = [
  E("demo-okomu", "Okomu Oil Palm", "OKOMUOIL", "CardinalStone Registrars", "Adewale B. Ogunyemi", 4200, "FY2022 \u2013 FY2025", 1432000, "2025-05-20"),
  E("demo-zenith", "Zenith Bank", "ZENITHBANK", "Veritas Registrars", "Adewale Bamidele Ogunyemi", 12500, "FY2019 \u2013 FY2023", 486250, "2023-04-15"),
  E("demo-uba", "United Bank for Africa", "UBA", "Africa Prudential Registrars", "A. B. Ogunyemi", 8000, "FY2021 \u2013 FY2024", 214400, "2024-05-01"),
  E("demo-dangcem", "Dangote Cement", "DANGCEM", "Coronation Registrars", "ADEWALE BAMIDELE OGUNYEMI", 900, "FY2023", 27000, "2024-04-10"),
  E("demo-cadbury", "Cadbury Nigeria", "CADBURY", "First Registrars", "Adewale Ogunyemi", 3100, "FY2016 \u2013 FY2018", 58900, "2018-06-01"),
  E("demo-gtco", "Guaranty Trust Holding", "GTCO", "Datamax Registrars", "A.B. Ogunyemi", 5400, "FY2020 \u2013 FY2022", 91800, "2022-04-20"),
];

async function main() {
  const db = adminDb();
  const batch = db.batch();
  for (const { id, doc } of ENTRIES) batch.set(db.collection(COL.register).doc(id), doc);
  await batch.commit();
  console.log(`Wrote ${ENTRIES.length} register entries to ${COL.register}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
